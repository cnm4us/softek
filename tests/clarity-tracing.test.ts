import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createApp } from '../apps/api/src/app.js';
import { fixtureUser, cleanUsers } from './fixtures.js';
import {
  exportTick,
  sendSpans,
  callSpan,
} from '../apps/api/src/phoenix-export.js';

test('Clarity tracing: consent ownership, durable audit and truthful export', async (t) => {
  const keys = [
    'CLARITY_ENABLED',
    'VITE_CLARITY_ENABLED',
    'CLARITY_CONFIG_VERIFIED',
    'PHOENIX_TRACING_ENABLED',
    'VITE_PHOENIX_TRACING_ENABLED',
    'SOFTEK_PHOENIX_ENDPOINT',
    'PUBLIC_ORIGIN',
  ];
  const env = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys.slice(0, 5)) process.env[k] = 'true';
  process.env.PUBLIC_ORIGIN = 'http://127.0.0.1:5173';
  const { app, pool } = createApp(true),
    server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const [collection] = await pool.query(
    'SELECT * FROM clarity_collection WHERE id=1',
  );
  const [settings] = await pool.query(
    'SELECT * FROM clarity_tracing WHERE id=1',
  );
  const users: string[] = [];
  class Client {
    cookies = new Map<string, string>();
    csrf = '';
    browser = randomUUID();
    capture = false;
    automation = false;
    async req(
      path: string,
      body?: unknown,
      headers: Record<string, string> = {},
    ) {
      const r = await fetch(base + '/api' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Origin: process.env.PUBLIC_ORIGIN!,
          'Content-Type': 'application/json',
          'X-Browser-Session': this.browser,
          'X-CSRF-Token': this.csrf,
          Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
          ...(this.automation
            ? { 'X-Demo-Automation': process.env.AUTOMATION_SECRET! }
            : {}),
          ...(this.capture
            ? { 'X-Demo-Capture': process.env.AUTOMATION_SECRET! }
            : {}),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      for (const raw of r.headers.getSetCookie()) {
        const [k, v] = raw.split(';')[0]!.split('=');
        this.cookies.set(k!, v!);
      }
      return { status: r.status, data: await r.json() };
    }
    async login(actor = 'human') {
      this.automation = actor === 'automation';
      const user = await fixtureUser(pool, 'alex', actor);
      users.push(user.id);
      const result = await this.req('/auth/login', {
        username: user.username,
        password: user.password,
        requestId: randomUUID(),
      });
      assert.equal(result.status, 200);
      this.csrf = result.data.csrf;
      return (await this.req('/state')).data;
    }
  }
  const admin = new Client(),
    a = new Client(),
    b = new Client(),
    auto = new Client();
  let state: any, context: string, openBody: any, call: any;
  const body = (calls: any[], extra = {}) => ({
    contextId: context,
    calls,
    ...extra,
  });
  const makeCall = (command = 'event', args: any[] = ['banner_clicked']) => ({
    id: randomUUID(),
    sequence: 1,
    command,
    args,
    observedAt: new Date().toISOString(),
    durationUs: 15,
    sdkState: 'queued',
    outcome: 'returned',
    metadata: {
      route: 'summary',
      actor: 'human',
      variant: 'value',
      feature: 'none',
      banner: 'none',
      run: state.runId,
    },
  });
  try {
    await pool.query('UPDATE clarity_collection SET enabled=TRUE WHERE id=1');
    await pool.query('UPDATE clarity_tracing SET enabled=FALSE WHERE id=1');
    await t.test(
      'private admin control, strict payload, stale revision and readiness',
      async () => {
        assert.equal((await a.req('/admin/clarity-tracing')).status, 401);
        const r = await admin.req('/admin/login', {
          password: process.env.DEMO_ADMIN_SECRET,
        });
        admin.csrf = r.data.csrf;
        let s = (await admin.req('/admin/clarity-tracing')).data;
        assert.equal(
          (
            await admin.req(
              '/admin/clarity-tracing',
              { enabled: true, revision: s.revision },
              { 'X-CSRF-Token': 'bad' },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await admin.req('/admin/clarity-tracing', {
              enabled: true,
              revision: s.revision,
              endpoint: 'http://elsewhere',
            })
          ).status,
          400,
        );
        process.env.PHOENIX_TRACING_ENABLED = 'false';
        assert.equal(
          (
            await admin.req('/admin/clarity-tracing', {
              enabled: true,
              revision: s.revision,
            })
          ).status,
          400,
        );
        process.env.PHOENIX_TRACING_ENABLED = 'true';
        const switched = await admin.req('/admin/clarity-tracing', {
          enabled: true,
          revision: s.revision,
        });
        assert.equal(switched.status, 200);
        assert.equal(
          (
            await admin.req('/admin/clarity-tracing', {
              enabled: false,
              revision: s.revision,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await admin.req('/admin/clarity-tracing', {
              enabled: true,
              revision: s.revision,
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      'explicit grant, owned existing visit, no banking or visit side effects',
      async () => {
        state = await a.login();
        await b.login();
        openBody = {
          documentId: randomUUID(),
          visitId: state.visitId,
          collectionRevision: state.analytics.revision,
          tracingRevision: state.analytics.tracing.revision,
          consent: 'granted',
        };
        const [before] = await pool.query(
          'SELECT COUNT(*) AS n FROM visits WHERE run_id=?',
          [state.runId],
        );
        assert.equal(
          (
            await a.req('/analytics/trace-session', {
              ...openBody,
              consent: 'denied',
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await a.req('/analytics/trace-session', {
              ...openBody,
              visitId: randomUUID(),
            })
          ).status,
          403,
        );
        const x = await a.req('/analytics/trace-session', openBody);
        assert.equal(x.status, 200);
        context = x.data.contextId;
        assert.equal(
          (await a.req('/analytics/trace-session', openBody)).data.contextId,
          context,
        );
        const [after] = await pool.query(
          'SELECT COUNT(*) AS n FROM visits WHERE run_id=?',
          [state.runId],
        );
        assert.equal(after.n, before.n);
        assert.deepEqual((await a.req('/state')).data.accounts, state.accounts);
        call = makeCall();
      },
    );
    await t.test(
      'call arrays persisted exactly, retries deduplicate and forged identity is refused',
      async () => {
        assert.equal(
          (await b.req('/analytics/clarity-calls', body([call]))).status,
          403,
        );
        assert.equal(
          (
            await a.req(
              '/analytics/clarity-calls',
              body([{ ...call, args: ['unknown'] }]),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await a.req(
              '/analytics/clarity-calls',
              body([
                makeCall('identify', [randomUUID(), state.visitId, 'summary']),
              ]),
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await a.req('/analytics/clarity-calls', body([call]), {
              Origin: 'https://other.example',
            })
          ).status,
          403,
        );
        assert.equal(
          (await a.req('/analytics/clarity-calls', body([call]))).status,
          200,
        );
        assert.equal(
          (await a.req('/analytics/clarity-calls', body([call]))).status,
          200,
        );
        assert.equal(
          (
            await a.req(
              '/analytics/clarity-calls',
              body([{ ...call, args: ['feature_viewed'] }]),
            )
          ).status,
          409,
        );
        const rows = await pool.query(
          'SELECT * FROM clarity_api_calls WHERE context_id=?',
          [context],
        );
        assert.equal(rows.length, 1);
        assert.deepEqual(
          typeof rows[0].arguments_json === 'string'
            ? JSON.parse(rows[0].arguments_json)
            : rows[0].arguments_json,
          call.args,
        );
        assert.equal(
          (
            await a.req(
              '/analytics/clarity-calls',
              body(Array.from({ length: 21 }, () => call)),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await a.req(
              '/analytics/clarity-calls',
              body([
                { ...call, metadata: { username: 'private@example.com' } },
              ]),
            )
          ).status,
          400,
        );
      },
    );
    await t.test(
      'capture-disabled automation cannot open context',
      async () => {
        const s = await auto.login('automation');
        assert.equal(s.analytics.enabled, false);
        const c = await auto.req('/analytics/trace-session', {
          ...openBody,
          documentId: randomUUID(),
          visitId: s.visitId,
        });
        assert.equal(c.status, 403);
        auto.capture = true;
        const visible = (await auto.req('/state')).data;
        assert.equal(visible.analytics.tracing.enabled, true);
      },
    );
    await t.test(
      'impersonation cannot grant tracing even with capture headers',
      async () => {
        const entered = await admin.req(
          '/admin/users/' + state.user.id + '/impersonate',
          { requestId: randomUUID() },
        );
        assert.equal(entered.status, 200);
        const headers = {
          'X-CSRF-Token': entered.data.csrf,
          'X-Customer-Context': entered.data.contextId,
          'X-Demo-Capture': process.env.AUTOMATION_SECRET!,
        };
        assert.equal(
          (
            await admin.req(
              '/analytics/trace-session',
              { ...openBody, documentId: randomUUID() },
              headers,
            )
          ).status,
          403,
        );
        assert.equal(
          (await admin.req('/auth/impersonation/exit', {}, headers)).status,
          200,
        );
      },
    );
    await t.test(
      'collector errors leave persisted pending records and successful acknowledgment is separate',
      async () => {
        let mode = 'fail';
        const collector = createServer((req, res) => {
          req.resume();
          req.on('end', () => {
            if (mode === 'timeout') return;
            res.statusCode = mode === 'fail' ? 503 : 200;
            res.setHeader('Content-Type', 'application/x-protobuf');
            res.end(
              mode === 'partial' ? Buffer.from([10, 2, 8, 1]) : undefined,
            );
          });
        }).listen(0, '127.0.0.1');
        await new Promise<void>((r) => collector.once('listening', r));
        process.env.SOFTEK_PHOENIX_ENDPOINT = `http://127.0.0.1:${(collector.address() as any).port}/v1/traces`;
        try {
          await exportTick(pool);
          let [r] = await pool.query(
            'SELECT * FROM clarity_api_calls WHERE id=?',
            [call.id],
          );
          assert.equal(r.export_status, 'pending');
          assert.equal(r.error_code, 'collector_http_503');
          assert.equal(r.acknowledged_at, null);
          const ids = [r.trace_id, r.span_id];
          await pool.query(
            'UPDATE clarity_api_calls SET next_attempt_at=UTC_TIMESTAMP(6) WHERE id=?',
            [call.id],
          );
          mode = 'partial';
          await exportTick(pool);
          [r] = await pool.query('SELECT * FROM clarity_api_calls WHERE id=?', [
            call.id,
          ]);
          assert.equal(r.export_status, 'pending');
          assert.equal(r.error_code, 'collector_partial_rejection');
          await pool.query(
            "UPDATE clarity_api_calls SET export_status='exporting',lease_until=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 30 SECOND) WHERE id=?",
            [call.id],
          );
          mode = 'success';
          await exportTick(pool);
          [r] = await pool.query('SELECT * FROM clarity_api_calls WHERE id=?', [
            call.id,
          ]);
          assert.equal(r.export_status, 'acknowledged');
          assert(r.acknowledged_at);
          assert.deepEqual([r.trace_id, r.span_id], ids);
          const [x] = await pool.query(
            'SELECT * FROM clarity_trace_contexts WHERE id=?',
            [context],
          );
          const span = callSpan({ ...r, ...x, id: r.id });
          assert.equal(span.name, 'clarity.event');
          assert.equal(
            span.attributes['clarity.arguments_json'],
            '["banner_clicked"]',
          );
          mode = 'fail';
          await assert.rejects(
            () => sendSpans([{ ...r, ...x, id: r.id }]),
            /collector_http_503/,
          );
          mode = 'timeout';
          await assert.rejects(() => sendSpans([{ ...r, ...x, id: r.id }]));
        } finally {
          await new Promise<void>((r) => collector.close(() => r()));
        }
      },
    );
    if (process.env.SOFTEK_TEST_PHOENIX === 'true')
      await t.test(
        'real isolated Phoenix persists exact DB arguments and exposes generic custom spans',
        async () => {
          process.env.SOFTEK_PHOENIX_ENDPOINT =
            'http://127.0.0.1:6008/v1/traces';
          await pool.query(
            "UPDATE clarity_api_calls SET export_status='pending',next_attempt_at=UTC_TIMESTAMP(6) WHERE id=?",
            [call.id],
          );
          await exportTick(pool);
          const [r] = await pool.query(
            'SELECT * FROM clarity_api_calls WHERE id=?',
            [call.id],
          );
          assert.equal(r.export_status, 'acknowledged');
          let visible: any;
          for (let i = 0; i < 40; i++) {
            const response = await fetch(
              'http://127.0.0.1:6008/v1/projects/softek-clarity-api/spans?trace_id=' +
                r.trace_id,
            );
            if (response.ok) {
              const result = await response.json();
              visible = result.data?.[0];
              if (visible) break;
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
          assert(
            visible,
            'Collector acknowledgment alone does not prove persisted visibility.',
          );
          assert.equal(visible.name, 'clarity.event');
          assert.equal(
            visible.attributes['clarity.arguments_json'],
            JSON.stringify(call.args),
          );
          assert.equal(visible.attributes['softek.event_id'], call.id);
          const { chromium } = await import('@playwright/test');
          const browser = await chromium.launch();
          try {
            const page = await browser.newPage();
            await page.goto('http://127.0.0.1:6008/');
            await page
              .getByText('softek-clarity-api', { exact: true })
              .first()
              .click();
            await page
              .getByText('clarity.event', { exact: true })
              .first()
              .click();
            await page
              .getByText('clarity.arguments_json', { exact: true })
              .waitFor();
            await page.screenshot({
              path: 'artifacts/phoenix-real-span.png',
              fullPage: true,
            });
          } finally {
            await browser.close();
          }
        },
      );
    await t.test(
      'admin export is bounded, filtered and contains no session secrets',
      async () => {
        assert.equal(
          (await a.req('/admin/clarity-tracing/export')).status,
          401,
        );
        const exported = (
          await admin.req(
            '/admin/clarity-tracing/export?customer=' +
              state.user.id +
              '&command=event',
          )
        ).data;
        assert.equal(exported.records.length, 1);
        assert.deepEqual(exported.records[0].arguments_json, call.args);
        assert(!JSON.stringify(exported).includes('session_hash'));
        assert.equal(
          (await admin.req('/admin/clarity-tracing/export?command=unknown'))
            .status,
          400,
        );
      },
    );
    await t.test(
      'revocation terminal batch closes once; no later activity is accepted',
      async () => {
        const terminal = [
          {
            ...makeCall('consentv2', [
              { ad_Storage: 'denied', analytics_Storage: 'denied' },
            ]),
            sequence: 2,
          },
          { ...makeCall('stop', []), sequence: 3 },
        ];
        assert.equal(
          (
            await a.req(
              '/analytics/clarity-calls',
              body([call], { close: true }),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await a.req(
              '/analytics/clarity-calls',
              body(terminal, { close: true, droppedCalls: 2 }),
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await a.req(
              '/analytics/clarity-calls',
              body(terminal, { close: true }),
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await a.req(
              '/analytics/clarity-calls',
              body([{ ...makeCall(), sequence: 4 }]),
            )
          ).status,
          403,
        );
        assert.equal(
          (await a.req('/analytics/trace-session', openBody)).status,
          409,
        );
      },
    );
    await t.test(
      'tracing Off closes contexts without changing Clarity collection',
      async () => {
        const opened = await a.req('/analytics/trace-session', {
          ...openBody,
          documentId: randomUUID(),
        });
        assert.equal(opened.status, 200);
        const before = (await admin.req('/admin/clarity')).data;
        const s = (await admin.req('/admin/clarity-tracing')).data;
        assert.equal(
          (
            await admin.req('/admin/clarity-tracing', {
              enabled: false,
              revision: s.revision,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await a.req('/analytics/clarity-calls', {
              contextId: opened.data.contextId,
              calls: [makeCall()],
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await a.req('/analytics/trace-session', {
              ...openBody,
              documentId: randomUUID(),
            })
          ).status,
          403,
        );
        const after = (await admin.req('/admin/clarity')).data;
        assert.equal(after.enabled, before.enabled);
        assert.equal(after.revision, before.revision);
      },
    );
    await t.test(
      'reset retains audit history and refuses retired-run contexts',
      async () => {
        const s = (await admin.req('/admin/clarity-tracing')).data;
        await admin.req('/admin/clarity-tracing', {
          enabled: true,
          revision: s.revision,
        });
        const fresh = (await a.req('/state')).data;
        const opened = await a.req('/analytics/trace-session', {
          ...openBody,
          documentId: randomUUID(),
          visitId: fresh.visitId,
          tracingRevision: fresh.analytics.tracing.revision,
        });
        assert.equal(opened.status, 200);
        const [before] = await pool.query(
          'SELECT COUNT(*) AS n FROM clarity_api_calls WHERE context_id=?',
          [context],
        );
        assert.equal(
          (
            await admin.req('/admin/users/' + state.user.id + '/reset', {
              variant: 'value',
              eligible: true,
            })
          ).status,
          200,
        );
        const [after] = await pool.query(
          'SELECT COUNT(*) AS n FROM clarity_api_calls WHERE context_id=?',
          [context],
        );
        assert.equal(after.n, before.n);
        assert.equal(
          (
            await a.req('/analytics/clarity-calls', {
              contextId: opened.data.contextId,
              calls: [makeCall()],
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      'permanent deletion cascades diagnostic rows and prevents pending export',
      async () => {
        const [before] = await pool.query(
          'SELECT COUNT(*) AS n FROM clarity_api_calls WHERE context_id=?',
          [context],
        );
        assert(before.n > 0);
        assert.equal(
          (await admin.req('/admin/users/' + state.user.id + '/delete', {}))
            .status,
          200,
        );
        const [after] = await pool.query(
          'SELECT COUNT(*) AS n FROM clarity_api_calls WHERE context_id=?',
          [context],
        );
        assert.equal(after.n, 0);
      },
    );
  } finally {
    await cleanUsers(pool, users);
    for (const c of [admin, a, b, auto]) {
      const cookie = c.cookies.get('softek_admin');
      if (cookie)
        await pool.query('DELETE FROM admin_sessions WHERE token_hash=?', [
          createHash('sha256').update(cookie).digest('hex'),
        ]);
    }
    await pool.query(
      'UPDATE clarity_collection SET enabled=?,revision=?,updated_at=? WHERE id=1',
      [collection.enabled, collection.revision, collection.updated_at],
    );
    await pool.query(
      'UPDATE clarity_tracing SET enabled=?,revision=?,updated_at=? WHERE id=1',
      [settings.enabled, settings.revision, settings.updated_at],
    );
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
    for (const k of keys)
      if (env[k] === undefined) delete process.env[k];
      else process.env[k] = env[k];
  }
});
