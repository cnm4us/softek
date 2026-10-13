import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createApp } from '../apps/api/src/app.js';
import { seed } from '../scripts/seed.js';
import { fixtureUser, cleanUsers } from './fixtures.js';
import { suppressionReason } from '../apps/api/src/discovery-config.js';

test('discovery policy uses explicit preferences and exact cooldown boundaries', () => {
  const now = Date.now();
  const base = {
    optOut: false,
    fewerSuggestions: false,
    lastImpression: null,
    lastDismissal: null,
    lastAnyImpression: null,
    adopted: false,
  };
  assert.equal(suppressionReason(base, now), null);
  assert.equal(suppressionReason({ ...base, optOut: true }, now), 'opted-out');
  assert.equal(
    suppressionReason({ ...base, adopted: true }, now),
    'already-activated',
  );
  assert.equal(
    suppressionReason(
      { ...base, lastImpression: now - 14 * 86400000 + 1 },
      now,
    ),
    'recently-seen',
  );
  assert.equal(
    suppressionReason({ ...base, lastImpression: now - 14 * 86400000 }, now),
    null,
  );
  assert.equal(
    suppressionReason({ ...base, lastDismissal: now - 89 * 86400000 }, now),
    'dismissed',
  );
  assert.equal(
    suppressionReason({ ...base, lastDismissal: now - 90 * 86400000 }, now),
    null,
  );
  assert.equal(
    suppressionReason(
      {
        ...base,
        fewerSuggestions: true,
        lastAnyImpression: now - 6 * 86400000,
      },
      now,
    ),
    'fewer-suggestions',
  );
});

test('persistent contextual discovery, ownership, attribution and report isolation', async (t) => {
  process.env.PUBLIC_ORIGIN = 'http://127.0.0.1:5173';
  await seed(true);
  const { app, pool } = createApp(true),
    server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const ids: string[] = [];
  class Client {
    cookies = new Map<string, string>();
    csrf = '';
    browser = randomUUID();
    contextId = '';
    constructor(public automated = true) {}
    async request(
      path: string,
      body?: unknown,
      override: Record<string, string> = {},
    ) {
      const r = await fetch(base + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Origin: process.env.PUBLIC_ORIGIN!,
          'Content-Type': 'application/json',
          'X-Browser-Session': this.browser,
          'X-CSRF-Token': this.csrf,
          ...(this.contextId ? { 'X-Customer-Context': this.contextId } : {}),
          Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
          ...(this.automated
            ? { 'X-Demo-Automation': process.env.AUTOMATION_SECRET! }
            : {}),
          ...override,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      for (const raw of r.headers.getSetCookie()) {
        const [k, v] = raw.split(';')[0]!.split('=');
        this.cookies.set(k!, v!);
      }
      return { status: r.status, data: await r.json() };
    }
    async login(user: { username: string; password: string }) {
      const r = await this.request('/auth/login', {
        username: user.username,
        password: user.password,
        requestId: randomUUID(),
      });
      assert.equal(r.status, 200);
      this.csrf = r.data.csrf;
    }
    select(context = 'investing') {
      return this.request('/discovery/select', { context });
    }
    observe(id: string, name: string) {
      return this.request('/discovery/observations', {
        presentationId: id,
        name,
      });
    }
  }
  const admin = new Client();
  const create = async (actor = 'automation') => {
    const user = await fixtureUser(pool, 'alex', actor);
    ids.push(user.id);
    const client = new Client(actor === 'automation');
    await client.login(user);
    return { user, client };
  };
  try {
    const logged = await admin.request('/admin/login', {
      password: process.env.DEMO_ADMIN_SECRET,
    });
    admin.csrf = logged.data.csrf;
    const { user: ua, client: a } = await create();
    const { user: ub, client: b } = await create('human');
    const original = (await a.request('/state')).data;
    let p: any, q: any;
    await t.test(
      'selection rejects unknown input and reserves one consistent owned invitation under concurrent retries',
      async () => {
        assert.equal((await a.select('unknown')).status, 400);
        assert.equal(
          (
            await a.request('/discovery/select', {
              context: 'investing',
              balance: 12,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await a.request(
              '/discovery/select',
              { context: 'investing' },
              { 'X-CSRF-Token': 'wrong' },
            )
          ).status,
          403,
        );
        assert.equal(
          (await b.select('loan-personal')).data.recommendation,
          null,
        );
        const selected = await Promise.all(
          Array.from({ length: 6 }, () => a.select()),
        );
        p = selected[0]!.data.recommendation;
        assert.ok(p.id);
        assert.ok(
          selected.every(
            (r) => r.status === 200 && r.data.recommendation.id === p.id,
          ),
        );
        assert.equal((await a.select('loan-auto')).data.reason, 'visit-cap');
        q = (await b.select('loan-auto')).data.recommendation;
        assert.equal(q.featureId, 'skip-pay');
        assert.equal((await b.observe(p.id, 'impression')).status, 403);
        const results = await Promise.all(
          Array.from({ length: 4 }, () => a.observe(p.id, 'impression')),
        );
        assert.ok(results.every((r) => r.data.acknowledged));
        const [count] = await pool.query(
          'SELECT COUNT(*) AS n FROM discovery_presentations WHERE user_id=?',
          [ua.id],
        );
        assert.equal(Number(count.n), 1);
        assert.deepEqual(
          (await a.request('/state')).data.accounts,
          original.accounts,
        );
      },
    );
    await t.test(
      'clicked discovery context is immutable and feature engagement is separately attributed',
      async () => {
        const event = {
          name: 'feature_viewed',
          routeKey: 'easycoin',
          pageId: randomUUID(),
          requestId: randomUUID(),
          observedAt: new Date().toISOString(),
          discoveryPresentationId: p.id,
        };
        assert.equal((await a.request('/interactions', event)).status, 403);
        await a.observe(p.id, 'learn-more');
        assert.equal((await a.request('/interactions', event)).status, 200);
        assert.equal((await a.request('/interactions', event)).status, 200);
        const { discoveryPresentationId: _discard, ...direct } = event;
        assert.equal((await a.request('/interactions', direct)).status, 409);
        assert.equal(
          (
            await a.request('/interactions', {
              ...event,
              discoveryPresentationId: q.id,
            })
          ).status,
          403,
        );
        const directFirst = {
          ...direct,
          pageId: randomUUID(),
          requestId: randomUUID(),
        };
        assert.equal(
          (await a.request('/interactions', directFirst)).status,
          200,
        );
        assert.equal(
          (
            await a.request('/interactions', {
              ...directFirst,
              discoveryPresentationId: p.id,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await a.request('/interactions', {
              ...event,
              name: 'feature_cta_clicked',
              requestId: randomUUID(),
            })
          ).status,
          200,
        );
        const report = (
          await admin.request('/admin/discovery-report?actor=automation')
        ).data.rows.find((r: any) => r.featureId === 'easycoin');
        assert.equal(Number(report.impressions), 1);
        assert.equal(Number(report.clicks), 1);
        assert.equal(Number(report.featureViews), 1);
        assert.equal(Number(report.featureCtas), 1);
        assert.equal(
          (await admin.request('/admin/discovery-report')).data.rows.some(
            (r: any) => r.featureId === 'easycoin',
          ),
          false,
        );
      },
    );
    await t.test(
      'impression cooldown, dismissal and opt-out survive logins and banking reset',
      async () => {
        await a.request('/auth/logout', {});
        await a.login(ua);
        assert.equal((await a.select()).data.reason, 'recently-seen');
        const loan = (await a.select('loan-auto')).data.recommendation;
        await a.observe(loan.id, 'dismiss');
        assert.equal((await a.request('/reset', {})).status, 200);
        a.csrf = (await a.request('/state')).data.csrf;
        assert.equal((await a.select('loan-auto')).data.reason, 'dismissed');
        assert.equal(
          (
            await a.request('/discovery/preferences', {
              optOut: true,
              fewerSuggestions: false,
            })
          ).status,
          200,
        );
        const otherTab = new Client();
        await otherTab.login(ua);
        assert.equal(
          (await otherTab.request('/discovery/preferences')).data.optOut,
          true,
        );
        assert.equal((await otherTab.select()).data.reason, 'opted-out');
        assert.equal(
          (await b.request('/discovery/preferences')).data.optOut,
          false,
        );
        assert.equal(
          (
            await a.request('/discovery/preferences', {
              optOut: false,
              fewerSuggestions: false,
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      'fewer suggestions suppresses a different feature and impersonation has a separate cap/history',
      async () => {
        const { user, client } = await create();
        const first = (await client.select()).data.recommendation;
        await client.observe(first.id, 'impression');
        await client.request('/discovery/preferences', {
          optOut: false,
          fewerSuggestions: true,
        });
        await client.request('/auth/logout', {});
        await client.login(user);
        assert.equal(
          (await client.select('loan-auto')).data.reason,
          'fewer-suggestions',
        );
        const entry = await admin.request(`/admin/users/${ub.id}/impersonate`, {
          requestId: randomUUID(),
        });
        assert.equal(entry.status, 200);
        admin.contextId = entry.data.contextId;
        const adminState = (await admin.request('/state')).data;
        const oldAdminCsrf = admin.csrf;
        admin.csrf = adminState.csrf;
        const impersonated = (await admin.select()).data.recommendation;
        assert.ok(impersonated);
        await admin.observe(impersonated.id, 'impression');
        admin.csrf = oldAdminCsrf;
        const report = (
          await admin.request('/admin/discovery-report?actor=all')
        ).data.rows;
        assert.equal(
          report
            .filter((r: any) => r.featureId === 'easycoin')
            .reduce((n: number, r: any) => n + Number(r.presentations), 0),
          2,
        );
        admin.csrf = adminState.csrf;
        await admin.request('/auth/impersonation/exit', {});
        admin.contextId = '';
        admin.csrf = oldAdminCsrf;
      },
    );
  } finally {
    await admin.request('/admin/logout', {});
    await cleanUsers(pool, ids);
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
    await pool.end();
  }
});
