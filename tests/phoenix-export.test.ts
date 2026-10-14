import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { callSpan } from '../apps/api/src/phoenix-export.js';

const row = {
  id: 'presentation-fixture',
  command: 'event',
  arguments_json: '["banner_clicked"]',
  metadata_json: '{}',
  sdk_state: 'loaded',
  outcome: 'returned',
  observed_at: '2026-10-14T12:00:00.000Z',
  received_at: '2026-10-14T12:00:01.000Z',
  duration_us: 15,
  trace_id: '1234567890abcdef1234567890abcdef',
  span_id: '1234567890abcdef',
  user_id: 'fictional-user',
  visit_id: 'fictional-visit',
  run_id: 'fictional-run',
  document_id: 'fictional-document',
  sequence_number: 1,
  collection_revision: 1,
  tracing_revision: 1,
};

test('Phoenix inputs render complete JSON-escaped calls without altering raw arguments', () => {
  const examples = [
    {
      command: 'event',
      args: ['banner_clicked'],
      call: 'clarity("event", "banner_clicked");',
    },
    { command: 'stop', args: [], call: 'clarity("stop");' },
    {
      command: 'consentv2',
      args: [{ ad_Storage: 'denied', analytics_Storage: 'granted' }],
      call: 'clarity("consentv2", {"ad_Storage":"denied","analytics_Storage":"granted"});',
    },
    {
      command: 'identify',
      args: ['fictional-user', 'fictional-visit', 'fictional-page'],
      call: 'clarity("identify", "fictional-user", "fictional-visit", "fictional-page");',
    },
    {
      command: 'set',
      args: ['test', 'quote " newline\n slash\\'],
      call: 'clarity("set", "test", "quote \\" newline\\n slash\\\\");',
    },
  ];
  for (const example of examples) {
    // MariaDB may return a JSON-check column already parsed or as a string.
    for (const args of [example.args, JSON.stringify(example.args)]) {
      const span = callSpan({
        ...row,
        command: example.command,
        arguments_json: args,
      });
      assert.equal(span.attributes['input.value'], example.call);
      assert.equal(span.attributes['clarity.call'], example.call);
      assert.equal(span.attributes['input.mime_type'], 'text/plain');
      assert.equal(
        span.attributes['clarity.arguments_json'],
        JSON.stringify(example.args),
      );
      assert.equal(span.kind, SpanKind.INTERNAL);
      assert.equal(span.attributes['openinference.span.kind'], undefined);
      assert.deepEqual(span.spanContext(), {
        traceId: row.trace_id,
        spanId: row.span_id,
        traceFlags: 1,
      });
    }
  }
});

test('Phoenix status and output describe local invocation, with bounded ERROR messages', () => {
  const cases = [
    {
      sdk_state: 'queued',
      outcome: 'returned',
      output: 'Queued for SDK',
      code: SpanStatusCode.OK,
    },
    {
      sdk_state: 'loaded',
      outcome: 'returned',
      output: 'SDK invocation returned',
      code: SpanStatusCode.OK,
    },
    {
      sdk_state: 'loaded',
      outcome: 'threw',
      output: 'Invocation threw',
      code: SpanStatusCode.ERROR,
      message: 'Clarity SDK invocation threw an exception',
    },
    {
      sdk_state: 'queued',
      outcome: 'threw',
      output: 'Invocation threw',
      code: SpanStatusCode.ERROR,
      message: 'Clarity SDK invocation threw an exception',
    },
    {
      sdk_state: 'absent',
      outcome: 'absent',
      output: 'Clarity SDK callable was unavailable',
      code: SpanStatusCode.ERROR,
      message: 'Clarity SDK callable was unavailable',
    },
  ];
  for (const example of cases) {
    const span = callSpan({ ...row, ...example });
    assert.equal(span.attributes['output.value'], example.output);
    assert.equal(span.attributes['output.mime_type'], 'text/plain');
    assert.equal(span.status.code, example.code);
    assert.equal(span.status.message, example.message);
    assert.equal(
      span.attributes['clarity.invocation_outcome'],
      example.outcome,
    );
    assert.equal(span.attributes['clarity.sdk_state'], example.sdk_state);
    assert.deepEqual(span.events, []);
  }
});

if (process.env.SOFTEK_TEST_PHOENIX === 'true')
  test('isolated Phoenix persists presentation fields and shows Input/Output/Error for generic spans', async () => {
    const { randomBytes, randomUUID } = await import('node:crypto');
    const { sendSpans } = await import('../apps/api/src/phoenix-export.js');
    const examples = [
      {
        command: 'event',
        sdk_state: 'queued',
        outcome: 'returned',
        output: 'Queued for SDK',
        status: 'OK',
        message: '',
      },
      {
        command: 'set',
        arguments_json: '["page","feature"]',
        sdk_state: 'loaded',
        outcome: 'returned',
        output: 'SDK invocation returned',
        status: 'OK',
        message: '',
      },
      {
        command: 'identify',
        arguments_json: '["fictional-user","fictional-visit","fictional-page"]',
        sdk_state: 'loaded',
        outcome: 'threw',
        output: 'Invocation threw',
        status: 'ERROR',
        message: 'Clarity SDK invocation threw an exception',
      },
      {
        command: 'stop',
        arguments_json: '[]',
        sdk_state: 'absent',
        outcome: 'absent',
        output: 'Clarity SDK callable was unavailable',
        status: 'ERROR',
        message: 'Clarity SDK callable was unavailable',
      },
    ];
    const rows = examples.map((example) => ({
      ...row,
      ...example,
      id: randomUUID(),
      trace_id: randomBytes(16).toString('hex'),
      span_id: randomBytes(8).toString('hex'),
      observed_at: new Date().toISOString(),
      received_at: new Date().toISOString(),
    }));
    await sendSpans(rows, 'http://127.0.0.1:6008/v1/traces');
    for (const record of rows) {
      let visible: any;
      for (let attempt = 0; attempt < 40; attempt++) {
        const response = await fetch(
          `http://127.0.0.1:6008/v1/projects/softek-clarity-api/spans?trace_id=${record.trace_id}`,
        );
        if (response.ok) visible = (await response.json()).data?.[0];
        if (visible) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      assert(
        visible,
        'Collector acknowledgment must be followed by persisted readback.',
      );
      const expectedCall = callSpan(record).attributes['clarity.call'];
      assert.equal(visible.attributes['input.value'], expectedCall);
      assert.equal(visible.attributes['clarity.call'], expectedCall);
      assert.equal(
        visible.attributes['clarity.arguments_json'],
        record.arguments_json,
      );
      assert.equal(visible.attributes['output.value'], record.output);
      assert.equal(visible.status_code, record.status);
      assert.equal(visible.status_message, record.message);
      assert.equal(visible.span_kind, 'UNKNOWN');
    }
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({
        viewport: { width: 1600, height: 1000 },
      });
      await page.goto('http://127.0.0.1:6008/');
      await page
        .getByText('softek-clarity-api', { exact: true })
        .first()
        .click();
      for (const record of rows) {
        await page.getByText(record.output, { exact: true }).first().waitFor();
        await page
          .getByText(String(callSpan(record).attributes['clarity.call']), {
            exact: true,
          })
          .first()
          .waitFor();
      }
      await page
        .getByText('Clarity SDK invocation threw an exception', { exact: true })
        .first()
        .waitFor();
      await page.screenshot({
        path: 'artifacts/phoenix-presentation-columns.png',
        fullPage: true,
      });
      await page.getByText('clarity.event', { exact: true }).first().click();
      await page.getByRole('tab', { name: 'Attributes', exact: true }).click();
      await page.getByText('clarity.call', { exact: true }).waitFor();
      await page.screenshot({
        path: 'artifacts/phoenix-presentation-detail.png',
        fullPage: true,
      });
    } finally {
      await browser.close();
    }
  });
