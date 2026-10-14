import type { Express, Request } from 'express';
import type { Pool, PoolConnection } from 'mariadb';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { z } from 'zod';
import { clarityStatus, customerAnalytics } from './clarity.js';
import { customerContext } from './customer-context.js';
import { HttpError } from './errors.js';
import { safeCall, safeTag, traceCommands } from './clarity-trace-contract.js';

type Row = Record<string, any>;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const capture = (req: Request) =>
  Boolean(process.env.AUTOMATION_SECRET) &&
  timingSafeEqual(
    Buffer.from(hash(req.get('x-demo-capture') ?? '')),
    Buffer.from(hash(process.env.AUTOMATION_SECRET!)),
  );
export function phoenixEndpoint(): string | null {
  if (process.env.PHOENIX_TRACING_ENABLED !== 'true') return null;
  try {
    const u = new URL(
      process.env.SOFTEK_PHOENIX_ENDPOINT ?? 'http://127.0.0.1:6006/v1/traces',
    );
    if (
      u.protocol !== 'http:' ||
      u.hostname !== '127.0.0.1' ||
      u.pathname !== '/v1/traces' ||
      u.username ||
      u.password ||
      u.search ||
      u.hash
    )
      return null;
    return u.href;
  } catch {
    return null;
  }
}
export async function tracingStatus(db: Pool | PoolConnection) {
  const [r] = await db.query(
    'SELECT enabled,revision,updated_at AS updatedAt FROM clarity_tracing WHERE id=1',
  );
  const configured =
    Boolean(phoenixEndpoint()) &&
    process.env.VITE_PHOENIX_TRACING_ENABLED === 'true';
  return {
    configured,
    enabled: configured && Boolean(r.enabled),
    requestedEnabled: Boolean(r.enabled),
    revision: r.revision as string,
    updatedAt: r.updatedAt,
  };
}
export async function customerTracing(
  db: Pool | PoolConnection,
  eligible: boolean,
) {
  const s = await tracingStatus(db);
  return { enabled: eligible && s.enabled, revision: s.revision };
}
type Context = {
  app: Express;
  pool: Pool;
  transaction: <T>(action: (c: PoolConnection) => Promise<T>) => Promise<T>;
  active: (c: PoolConnection, req: Request) => Promise<Row>;
  token: (req: Request) => string;
  checkCsrf: (req: Request, token: string) => void;
  admin: (req: Request, mutate?: boolean) => Promise<unknown>;
};
const uuid = z.string().uuid();
const metadata = z
  .record(z.string(), z.string())
  .refine(
    (m) =>
      Object.keys(m).length <= 10 &&
      Object.entries(m).every(([k, v]) => safeTag(k, v)),
  );
const callSchema = z
  .object({
    id: uuid,
    sequence: z.number().int().min(1).max(10000000),
    command: z.enum(traceCommands),
    args: z.array(z.unknown()).max(3),
    observedAt: z.iso.datetime(),
    durationUs: z.number().int().min(0).max(10000000),
    sdkState: z.enum(['queued', 'loaded', 'absent']),
    outcome: z.enum(['returned', 'threw', 'absent']),
    metadata,
  })
  .strict()
  .refine((v) => safeCall(v.command, v.args));
const decode = (v: string | object) =>
  typeof v === 'string' ? JSON.parse(v) : v;
export function registerClarityTracing({
  app,
  pool,
  transaction,
  active,
  token,
  checkCsrf,
  admin,
}: Context) {
  async function policy(c: PoolConnection, req: Request, r: Row) {
    return customerAnalytics(
      c,
      r.actor,
      capture(req),
      customerContext(req).source === 'admin_impersonation',
    );
  }
  app.post('/api/analytics/trace-session', async (req, res) => {
    checkCsrf(req, token(req));
    const b = z
      .object({
        documentId: uuid,
        visitId: uuid,
        collectionRevision: uuid,
        tracingRevision: uuid,
        consent: z.literal('granted'),
      })
      .strict()
      .parse(req.body);
    res.json(
      await transaction(async (c) => {
        const r = await active(c, req),
          p = await policy(c, req, r),
          s = await tracingStatus(c);
        if (
          !p.enabled ||
          !s.enabled ||
          p.revision !== b.collectionRevision ||
          s.revision !== b.tracingRevision
        )
          throw new HttpError(
            403,
            'Tracing is not available for this session.',
          );
        const [v] = await c.query(
          "SELECT v.id FROM visits v JOIN visit_contexts vc ON vc.visit_id=v.id WHERE v.id=? AND v.run_id=? AND v.browser_session=? AND vc.activity_source='customer' AND v.last_seen_at>DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 30 MINUTE)",
          [b.visitId, r.id, req.get('x-browser-session')],
        );
        if (!v)
          throw new HttpError(403, 'That visit is not available for tracing.');
        const [old] = await c.query(
          'SELECT * FROM clarity_trace_contexts WHERE user_id=? AND document_id=? AND tracing_revision=?',
          [r.user_id, b.documentId, s.revision],
        );
        if (old) {
          if (
            old.closed_at ||
            old.session_hash !== hash(token(req)) ||
            old.run_id !== r.id ||
            old.visit_id !== v.id ||
            old.collection_revision !== p.revision ||
            new Date(old.expires_at).getTime() <= Date.now()
          )
            throw new HttpError(409, 'Start a new diagnostic document.');
          return { contextId: old.id };
        }
        const id = randomUUID();
        await c.query(
          'INSERT INTO clarity_trace_contexts (id,user_id,run_id,visit_id,document_id,session_hash,collection_revision,tracing_revision,consent_at,expires_at) VALUES (?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 12 HOUR))',
          [
            id,
            r.user_id,
            r.id,
            v.id,
            b.documentId,
            hash(token(req)),
            p.revision,
            s.revision,
          ],
        );
        return { contextId: id };
      }),
    );
  });
  app.post('/api/analytics/clarity-calls', async (req, res) => {
    checkCsrf(req, token(req));
    if (Buffer.byteLength(JSON.stringify(req.body)) >= 12 * 1024)
      throw new HttpError(413, 'Diagnostic batch is too large.');
    const b = z
      .object({
        contextId: uuid,
        calls: z.array(callSchema).max(20),
        close: z.boolean().default(false),
        droppedCalls: z.number().int().min(0).max(10000000).default(0),
        failedBatches: z.number().int().min(0).max(10000000).default(0),
      })
      .strict()
      .parse(req.body);
    res.json(
      await transaction(async (c) => {
        const r = await active(c, req);
        if (customerContext(req).source !== 'customer')
          throw new HttpError(403, 'Customer tracing only.');
        const [x] = await c.query(
          'SELECT * FROM clarity_trace_contexts WHERE id=? AND user_id=? AND run_id=? FOR UPDATE',
          [b.contextId, r.user_id, r.id],
        );
        if (
          !x ||
          x.session_hash !== hash(token(req)) ||
          new Date(x.expires_at).getTime() <= Date.now()
        )
          throw new HttpError(403, 'Diagnostic context expired.');
        const p = await policy(c, req, r),
          s = await tracingStatus(c);
        const terminal =
          b.close &&
          b.calls.length <= 2 &&
          b.calls.every(
            (v) =>
              v.command === 'stop' ||
              (v.command === 'consentv2' &&
                (v.args[0] as any).analytics_Storage === 'denied'),
          );
        if (
          !terminal &&
          (!p.enabled ||
            !s.enabled ||
            x.closed_at ||
            x.collection_revision !== p.revision ||
            x.tracing_revision !== s.revision)
        )
          throw new HttpError(403, 'Diagnostic context closed.');
        if (b.close && !terminal)
          throw new HttpError(400, 'Only stopping calls may close tracing.');
        for (const v of b.calls) {
          if (
            Math.abs(Date.now() - new Date(v.observedAt).getTime()) >
              15 * 60 * 1000 ||
            new Date(v.observedAt).getTime() <
              new Date(x.consent_at).getTime() - 5000
          )
            throw new HttpError(400, 'Diagnostic observation time is invalid.');
          if (
            v.command === 'identify' &&
            (v.args[0] !== r.user_id || v.args[1] !== x.visit_id)
          )
            throw new HttpError(403, 'Diagnostic identity mismatch.');
          if (
            v.command === 'set' &&
            ((v.args[0] === 'run' && v.args[1] !== r.id) ||
              (v.args[0] === 'actor' && v.args[1] !== r.actor) ||
              (v.args[0] === 'variant' && v.args[1] !== r.variant))
          )
            throw new HttpError(403, 'Diagnostic context mismatch.');
          if (
            (v.metadata.actor && v.metadata.actor !== r.actor) ||
            (v.metadata.variant && v.metadata.variant !== r.variant) ||
            (v.metadata.run && v.metadata.run !== r.id)
          )
            throw new HttpError(403, 'Diagnostic metadata mismatch.');
          const payloadHash = hash(JSON.stringify(v));
          const [old] = await c.query(
            'SELECT context_id,payload_hash FROM clarity_api_calls WHERE id=? OR (context_id=? AND sequence_number=?)',
            [v.id, x.id, v.sequence],
          );
          if (old) {
            if (old.context_id !== x.id || old.payload_hash !== payloadHash)
              throw new HttpError(
                409,
                'Diagnostic retry conflicts with an existing call.',
              );
            continue;
          }
          if (x.closed_at)
            throw new HttpError(403, 'Diagnostic context closed.');
          await c.query(
            'INSERT INTO clarity_api_calls (id,context_id,sequence_number,command,arguments_json,metadata_json,payload_hash,observed_at,received_at,duration_us,sdk_state,outcome,trace_id,span_id,next_attempt_at) VALUES (?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6),?,?,?,?,?,UTC_TIMESTAMP(6))',
            [
              v.id,
              x.id,
              v.sequence,
              v.command,
              JSON.stringify(v.args),
              JSON.stringify({
                ...v.metadata,
                actor: r.actor,
                variant: r.variant,
                run: r.id,
              }),
              payloadHash,
              new Date(v.observedAt),
              v.durationUs,
              v.sdkState,
              v.outcome,
              randomBytes(16).toString('hex'),
              randomBytes(8).toString('hex'),
            ],
          );
        }
        await c.query(
          'UPDATE clarity_trace_contexts SET dropped_calls=GREATEST(dropped_calls,?),failed_batches=GREATEST(failed_batches,?),closed_at=IF(?,COALESCE(closed_at,UTC_TIMESTAMP(6)),closed_at) WHERE id=?',
          [b.droppedCalls, b.failedBatches, b.close, x.id],
        );
        return { accepted: b.calls.map((v) => v.id), closed: b.close };
      }),
    );
  });
  app.get('/api/admin/clarity-tracing', async (req, res) => {
    await admin(req);
    const status = await tracingStatus(pool);
    const counts: Row[] = await pool.query(
      'SELECT export_status AS status,COUNT(*) AS count FROM clarity_api_calls GROUP BY export_status',
    );
    const [times] = await pool.query(
      "SELECT MIN(IF(export_status IN ('pending','exporting'),received_at,NULL)) AS oldestPendingAt,MAX(acknowledged_at) AS lastAcknowledgedAt FROM clarity_api_calls",
    );
    const [loss] = await pool.query(
      'SELECT COALESCE(SUM(dropped_calls),0) AS droppedCalls,COALESCE(SUM(failed_batches),0) AS failedBatches FROM clarity_trace_contexts',
    );
    res.json({
      ...status,
      counts: Object.fromEntries(
        counts.map((r) => [r.status, Number(r.count)]),
      ),
      ...times,
      ...loss,
      retentionDays: 7,
      project: 'softek-clarity-api',
    });
  });
  app.post('/api/admin/clarity-tracing', async (req, res) => {
    await admin(req, true);
    const b = z
      .object({ enabled: z.boolean(), revision: uuid })
      .strict()
      .parse(req.body);
    res.json(
      await transaction(async (c) => {
        const [r] = await c.query(
          'SELECT * FROM clarity_tracing WHERE id=1 FOR UPDATE',
        );
        const status = await tracingStatus(c);
        if (b.enabled && !status.configured)
          throw new HttpError(400, 'Phoenix tracing is not configured.');
        if (Boolean(r.enabled) === b.enabled) return status;
        if (r.revision !== b.revision)
          throw new HttpError(409, 'Settings changed. Refresh and try again.');
        await c.query(
          'UPDATE clarity_tracing SET enabled=?,revision=?,updated_at=UTC_TIMESTAMP(6) WHERE id=1',
          [b.enabled, randomUUID()],
        );
        if (!b.enabled)
          await c.query(
            'UPDATE clarity_trace_contexts SET closed_at=COALESCE(closed_at,UTC_TIMESTAMP(6))',
          );
        return tracingStatus(c);
      }),
    );
  });
  app.get('/api/admin/clarity-tracing/export', async (req, res) => {
    await admin(req);
    const b = z
      .object({
        customer: uuid.optional(),
        command: z.enum(traceCommands).optional(),
        from: z.iso.datetime().optional(),
        to: z.iso.datetime().optional(),
      })
      .strict()
      .parse(req.query);
    if (b.from && b.to && b.from > b.to)
      throw new HttpError(400, 'Choose an ordered date range.');
    const clauses = ['a.received_at>DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 7 DAY)'],
      values: unknown[] = [];
    for (const [k, v] of [
      ['x.user_id', b.customer],
      ['a.command', b.command],
    ] as const)
      if (v) {
        clauses.push(k + '=?');
        values.push(v);
      }
    if (b.from) {
      clauses.push('a.received_at>=?');
      values.push(new Date(b.from));
    }
    if (b.to) {
      clauses.push('a.received_at<=?');
      values.push(new Date(b.to));
    }
    const rows: Row[] = await pool.query(
      `SELECT a.*,x.user_id,x.run_id,x.visit_id,x.document_id,x.collection_revision,x.tracing_revision FROM clarity_api_calls a JOIN clarity_trace_contexts x ON x.id=a.context_id WHERE ${clauses.join(' AND ')} ORDER BY a.received_at,a.id LIMIT 1001`,
      values,
    );
    res.set(
      'Content-Disposition',
      'attachment; filename="softek-clarity-api-calls.json"',
    );
    res.json({
      limit: 1000,
      truncated: rows.length > 1000,
      evidence: 'Application API calls; not Microsoft upload receipts.',
      records: rows.slice(0, 1000).map(({ payload_hash, ...r }) => ({
        ...r,
        arguments_json: decode(r.arguments_json),
        metadata_json: decode(r.metadata_json),
      })),
    });
  });
}
