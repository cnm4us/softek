import type { Pool } from 'mariadb';
import {
  SpanKind,
  SpanStatusCode,
  TraceFlags,
  type HrTime,
} from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { ProtobufTraceSerializer } from '@opentelemetry/otlp-transformer';
import { phoenixEndpoint } from './clarity-tracing.js';

type Row = Record<string, any>;
const time = (ms: number): HrTime => [
  Math.floor(ms / 1000),
  Math.round((ms % 1000) * 1000000),
];
const json = (v: any) => (typeof v === 'string' ? JSON.parse(v) : v);
export function callSpan(r: Row): ReadableSpan {
  const start = new Date(r.observed_at).getTime(),
    end = start + r.duration_us / 1000;
  const meta = json(r.metadata_json);
  const args = json(r.arguments_json);
  const call = `clarity(${[r.command, ...args].map((v) => JSON.stringify(v)).join(', ')});`;
  const absent = r.outcome === 'absent' || r.sdk_state === 'absent';
  const threw = r.outcome === 'threw';
  const output = absent
    ? 'Clarity SDK callable was unavailable'
    : threw
      ? 'Invocation threw'
      : r.sdk_state === 'queued'
        ? 'Queued for SDK'
        : 'SDK invocation returned';
  return {
    name: `clarity.${r.command}`,
    kind: SpanKind.INTERNAL,
    spanContext: () => ({
      traceId: r.trace_id,
      spanId: r.span_id,
      traceFlags: TraceFlags.SAMPLED,
    }),
    startTime: time(start),
    endTime: time(end),
    duration: time(r.duration_us / 1000),
    ended: true,
    status: {
      code: absent || threw ? SpanStatusCode.ERROR : SpanStatusCode.OK,
      ...(absent || threw
        ? {
            message: absent
              ? 'Clarity SDK callable was unavailable'
              : 'Clarity SDK invocation threw an exception',
          }
        : {}),
    },
    attributes: {
      'input.value': call,
      'input.mime_type': 'text/plain',
      'output.value': output,
      'output.mime_type': 'text/plain',
      'clarity.command': r.command,
      'clarity.call': call,
      'clarity.arguments_json': JSON.stringify(args),
      'clarity.sdk_state': r.sdk_state,
      'clarity.invocation_outcome': r.outcome,
      'softek.event_id': r.id,
      'softek.sequence': r.sequence_number,
      'softek.user_id': r.user_id,
      'user.id': r.user_id,
      'session.id': r.visit_id,
      'softek.run_id': r.run_id,
      'softek.document_id': r.document_id,
      'softek.received_at': new Date(r.received_at).toISOString(),
      'softek.collection_revision': r.collection_revision,
      'softek.tracing_revision': r.tracing_revision,
      ...Object.fromEntries(
        Object.entries(meta).map(([k, v]) => [`softek.${k}`, String(v)]),
      ),
    },
    links: [],
    events: [],
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
    resource: resourceFromAttributes({
      'service.name': 'softek-clarity-api',
      'openinference.project.name': 'softek-clarity-api',
      'service.version': process.env.SOFTEK_RELEASE ?? 'development',
    }),
    instrumentationScope: { name: 'softek.clarity-api', version: '1.0.0' },
  };
}
export async function sendSpans(rows: Row[], endpoint = phoenixEndpoint()) {
  if (!endpoint) throw new Error('not_configured');
  const bytes = ProtobufTraceSerializer.serializeRequest(rows.map(callSpan));
  if (!bytes) throw new Error('serialization_failed');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-protobuf' },
    body: Buffer.from(bytes),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`collector_http_${response.status}`);
  const content = new Uint8Array(await response.arrayBuffer());
  const result = content.length
    ? ProtobufTraceSerializer.deserializeResponse(content)
    : {};
  if (Number(result.partialSuccess?.rejectedSpans ?? 0) > 0)
    throw new Error('collector_partial_rejection');
}
export async function exportTick(pool: Pool) {
  if (!phoenixEndpoint()) return;
  const c = await pool.getConnection();
  let rows: Row[] = [];
  try {
    await c.beginTransaction();
    rows = await c.query(
      "SELECT * FROM clarity_api_calls WHERE (export_status='pending' AND next_attempt_at<=UTC_TIMESTAMP(6)) OR (export_status='exporting' AND lease_until<UTC_TIMESTAMP(6)) ORDER BY received_at LIMIT 25 FOR UPDATE SKIP LOCKED",
    );
    for (const r of rows)
      await c.query(
        "UPDATE clarity_api_calls SET export_status='exporting',lease_until=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 20 SECOND),attempts=attempts+1 WHERE id=?",
        [r.id],
      );
    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
  if (!rows.length) return;
  // Recheck after leasing: deletion cascades remove both owner/context and calls.
  const owned: Row[] = await pool.query(
    `SELECT a.*,x.user_id,x.run_id,x.visit_id,x.document_id,x.collection_revision,x.tracing_revision FROM clarity_api_calls a JOIN clarity_trace_contexts x ON x.id=a.context_id WHERE a.id IN (${rows.map(() => '?').join(',')}) AND a.export_status='exporting'`,
    rows.map((r) => r.id),
  );
  if (!owned.length) return;
  let failure: string | null = null;
  try {
    await sendSpans(owned);
  } catch (e) {
    const text = (e as Error).message;
    failure =
      /^collector_http_\d{3}$/.test(text) ||
      ['collector_partial_rejection', 'serialization_failed'].includes(text)
        ? text
        : 'collector_unavailable';
  }
  for (const r of owned) {
    if (failure)
      await pool.query(
        "UPDATE clarity_api_calls SET export_status=IF(attempts>=10,'failed','pending'),next_attempt_at=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL ? SECOND),lease_until=NULL,error_code=? WHERE id=? AND export_status='exporting'",
        [Math.min(300, 2 ** Math.min(r.attempts, 8)), failure, r.id],
      );
    else
      await pool.query(
        "UPDATE clarity_api_calls SET export_status='acknowledged',acknowledged_at=UTC_TIMESTAMP(6),lease_until=NULL,error_code=NULL WHERE id=? AND export_status='exporting'",
        [r.id],
      );
  }
}
export function startPhoenixExporter(pool: Pool) {
  let stopping = false,
    running: Promise<void> | null = null,
    lastCleanup = 0;
  const tick = () => {
    if (stopping || running || !phoenixEndpoint()) return;
    running = (async () => {
      await exportTick(pool);
      if (Date.now() - lastCleanup > 3600000) {
        await pool.query(
          'DELETE FROM clarity_api_calls WHERE received_at<DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 7 DAY)',
        );
        await pool.query(
          'DELETE FROM clarity_trace_contexts WHERE consent_at<DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 7 DAY)',
        );
        lastCleanup = Date.now();
      }
    })()
      .catch(() => {
        console.error(
          'Phoenix export worker failed; diagnostics remain queued.',
        );
      })
      .finally(() => {
        running = null;
      });
  };
  const timer = setInterval(tick, 1000);
  timer.unref();
  tick();
  return async () => {
    stopping = true;
    clearInterval(timer);
    await running;
  };
}
