import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/src/app.js';
import { fixtureUser, cleanUsers } from './fixtures.js';

test('admin impersonation preserves state and isolates authentication and measurement', async (t) => {
  const keys = [
    'PUBLIC_ORIGIN',
    'CLARITY_ENABLED',
    'VITE_CLARITY_ENABLED',
    'CLARITY_CONFIG_VERIFIED',
    'CLARITY_PROJECT_ID',
  ];
  const savedEnv = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  process.env.PUBLIC_ORIGIN = 'http://127.0.0.1:5173';
  process.env.CLARITY_ENABLED = 'true';
  process.env.VITE_CLARITY_ENABLED = 'true';
  process.env.CLARITY_CONFIG_VERIFIED = 'true';
  process.env.CLARITY_PROJECT_ID = 'yvs5hp3ivb';
  const { app, pool } = createApp(true);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const ids: string[] = [],
    adminTokens: string[] = [];
  const [savedClarity] = await pool.query(
    'SELECT * FROM clarity_collection WHERE id=1',
  );
  class Client {
    cookies = new Map<string, string>();
    adminCsrf = '';
    csrf = '';
    contextId = '';
    browser = randomUUID();
    async req(
      path: string,
      body?: unknown,
      headers: Record<string, string> = {},
    ) {
      const r = await fetch(origin + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Origin: process.env.PUBLIC_ORIGIN!,
          'Content-Type': 'application/json',
          Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
          'X-Browser-Session': this.browser,
          'X-CSRF-Token': path.startsWith('/admin/')
            ? this.adminCsrf
            : this.csrf,
          ...(this.contextId ? { 'X-Customer-Context': this.contextId } : {}),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      for (const cookie of r.headers.getSetCookie()) {
        const [k, v] = cookie.split(';')[0]!.split('=');
        if (v) this.cookies.set(k!, v);
        else this.cookies.delete(k!);
      }
      return { status: r.status, data: await r.json() };
    }
    async admin() {
      const r = await this.req('/admin/login', {
        password: process.env.DEMO_ADMIN_SECRET,
      });
      assert.equal(r.status, 200);
      this.adminCsrf = r.data.csrf;
      adminTokens.push(this.cookies.get('softek_admin')!);
    }
    async enter(id: string, requestId = randomUUID()) {
      const r = await this.req(`/admin/users/${id}/impersonate`, { requestId });
      if (r.status === 200) {
        this.csrf = r.data.csrf;
        this.contextId = r.data.contextId;
      }
      return r;
    }
    async login(
      user: { username: string; password: string },
      automated = false,
    ) {
      this.contextId = '';
      const r = await this.req(
        '/auth/login',
        { ...user, requestId: randomUUID() },
        automated
          ? { 'X-Demo-Automation': process.env.AUTOMATION_SECRET! }
          : {},
      );
      if (r.status === 200) this.csrf = r.data.csrf;
      return r;
    }
  }
  const admin = new Client(),
    ordinary = new Client();
  const create = async (actor = 'human') => {
    const u = await fixtureUser(pool, 'alex', actor);
    ids.push(u.id);
    return u;
  };
  try {
    await pool.query('UPDATE clarity_collection SET enabled=TRUE WHERE id=1');
    const customer = await create(),
      automated = await create('automation');
    await t.test(
      'entry requires admin, CSRF, origin, UUID, strict body and enabled target',
      async () => {
        assert.equal((await ordinary.enter(customer.id)).status, 403);
        await admin.admin();
        assert.equal(
          (
            await admin.req(
              `/admin/users/${customer.id}/impersonate`,
              { requestId: randomUUID() },
              { 'X-CSRF-Token': 'bad' },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await admin.req(
              `/admin/users/${customer.id}/impersonate`,
              { requestId: randomUUID() },
              { Origin: 'https://other.example' },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await admin.req('/admin/users/invalid/impersonate', {
              requestId: randomUUID(),
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await admin.req(`/admin/users/${customer.id}/impersonate`, {
              requestId: randomUUID(),
              actor: 'human',
            })
          ).status,
          400,
        );
        assert.equal((await admin.enter(randomUUID())).status, 404);
        await admin.req(`/admin/users/${customer.id}/status`, {
          enabled: false,
        });
        assert.equal((await admin.enter(customer.id)).status, 403);
        await admin.req(`/admin/users/${customer.id}/status`, {
          enabled: true,
        });
      },
    );
    let runId = '',
      goalId = '',
      entry: any;
    const baseline = (await admin.req('/admin/report?actor=all')).data;
    const requestId = randomUUID();
    await t.test(
      'lost response retries reissue cookie and preserve one run/banner with Clarity forced off',
      async () => {
        entry = await admin.enter(customer.id, requestId);
        assert.equal(entry.status, 200);
        const raw = admin.cookies.get('softek_impersonation');
        admin.cookies.delete('softek_impersonation');
        admin.contextId = '';
        const retry = await admin.enter(customer.id, requestId);
        assert.equal(retry.status, 200);
        assert.equal(admin.cookies.get('softek_impersonation'), raw);
        assert.equal(retry.data.banner.id, entry.data.banner.id);
        const state = (await admin.req('/state')).data;
        runId = state.runId;
        assert.equal(state.user.id, customer.id);
        assert.equal(state.impersonation.contextId, entry.data.contextId);
        assert.equal(state.analytics.enabled, false);
        assert.equal(
          (
            await admin.req('/analytics', undefined, {
              'X-Demo-Capture': process.env.AUTOMATION_SECRET!,
            })
          ).data.enabled,
          false,
        );
        assert.equal(
          (
            await admin.req('/state', undefined, {
              'X-Customer-Context': 'old-context',
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await admin.req(
              '/enroll',
              { requestId: randomUUID(), accepted: true },
              { 'X-CSRF-Token': 'old' },
            )
          ).status,
          403,
        );
        const rows = await pool.query(
          'SELECT * FROM participant_runs WHERE user_id=?',
          [customer.id],
        );
        assert.equal(rows.length, 1);
        const presentations = await pool.query(
          'SELECT * FROM banner_presentations WHERE user_id=?',
          [customer.id],
        );
        assert.equal(presentations.length, 1);
      },
    );
    await t.test(
      'persistent impersonation actions are labeled and excluded from all customer report counts',
      async () => {
        assert.equal(
          (
            await admin.req('/enroll', {
              requestId: randomUUID(),
              accepted: true,
            })
          ).status,
          200,
        );
        const goal = await admin.req('/goals', {
          requestId: randomUUID(),
          title: 'Admin goal',
          targetMinor: 10000,
        });
        assert.equal(goal.status, 201);
        goalId = goal.data.goalId;
        for (const name of ['feature_viewed', 'feature_cta_clicked']) {
          assert.equal(
            (
              await admin.req('/interactions', {
                requestId: randomUUID(),
                pageId: randomUUID(),
                name,
                routeKey: 'easycoin',
                observedAt: new Date().toISOString(),
              })
            ).status,
            200,
          );
        }
        const history = (
          await admin.req(`/admin/interactions?userId=${customer.id}`)
        ).data;
        assert.ok(history.length >= 2);
        assert.ok(
          history.every((a: any) => a.activitySource === 'admin_impersonation'),
        );
        const report = (await admin.req('/admin/report?actor=all')).data;
        assert.equal(report.totalRuns, baseline.totalRuns);
        assert.deepEqual(report.serviceUse, baseline.serviceUse);
        const feature = (
          await admin.req('/admin/feature-activity?actor=all')
        ).data.features.find((f: any) => f.id === 'easycoin');
        assert.equal(feature.views, 0);
        assert.equal(feature.clicks, 0);
        const [first] = await pool.query(
          "SELECT dedupe_key FROM adoption_events WHERE run_id=? AND name='first_use'",
          [runId],
        );
        assert.equal(first.dedupe_key, 'admin:first_use');
      },
    );
    await t.test(
      'exit is repeatable, preserves admin and does not resurrect a previous request',
      async () => {
        const exit = await admin.req('/auth/impersonation/exit', {});
        assert.equal(exit.status, 200);
        assert.equal(
          exit.data.destination,
          `/controls/customers/${customer.id}`,
        );
        assert.equal(
          (await admin.req('/auth/impersonation/exit', {})).status,
          200,
        );
        assert.equal((await admin.req('/state')).status, 401);
        assert.equal(
          (await admin.req('/admin/status')).data.authenticated,
          true,
        );
        assert.equal((await admin.enter(customer.id, requestId)).status, 409);
      },
    );
    await t.test(
      'genuine login resumes changed banking and qualifies independently after an admin first use',
      async () => {
        const login = await ordinary.login({
          username: customer.username,
          password: customer.password,
        });
        assert.equal(login.status, 200);
        const state = (await ordinary.req('/state')).data;
        assert.equal(state.runId, runId);
        assert.equal(state.enrolled, true);
        assert.equal(state.goals[0].id, goalId);
        assert.equal(state.impersonation, null);
        assert.equal(state.analytics.enabled, true);
        const first = await ordinary.req('/goals', {
          requestId: randomUUID(),
          title: 'Customer goal',
          targetMinor: 10000,
        });
        assert.ok(first.data.events.includes('first_use'));
        assert.ok(!first.data.events.includes('repeat_use'));
        const report = (await admin.req('/admin/report?actor=all')).data;
        assert.equal(report.totalRuns, baseline.totalRuns + 1);
        assert.equal(
          report.serviceUse.firstUse,
          baseline.serviceUse.firstUse + 1,
        );
        assert.equal(report.serviceUse.enrolled, baseline.serviceUse.enrolled);
      },
    );
    await t.test(
      'automation can be impersonated without relaxing normal login and sign out preserves admin',
      async () => {
        const outsider = new Client();
        assert.equal(
          (
            await outsider.login({
              username: automated.username,
              password: automated.password,
            })
          ).status,
          403,
        );
        assert.equal((await admin.enter(automated.id)).status, 200);
        const state = (await admin.req('/state')).data;
        assert.equal(state.analytics.actor, 'automation');
        assert.equal(state.analytics.enabled, false);
        assert.equal((await admin.req('/auth/logout', {})).status, 200);
        assert.equal(
          (await admin.req('/admin/status')).data.authenticated,
          true,
        );
        assert.equal((await admin.req('/state')).status, 401);
      },
    );
    await t.test(
      'password/disable/admin expiry/logout/delete revoke customer access but allow exit cleanup',
      async () => {
        for (const reason of [
          'password',
          'disable',
          'expiry',
          'logout',
          'delete',
        ]) {
          const u = await create();
          const operator = new Client();
          await operator.admin();
          assert.equal((await operator.enter(u.id)).status, 200);
          if (reason === 'password')
            await admin.req(`/admin/users/${u.id}/password`, {
              password: randomUUID(),
            });
          if (reason === 'disable')
            await admin.req(`/admin/users/${u.id}/status`, { enabled: false });
          if (reason === 'expiry')
            await pool.query(
              'UPDATE admin_sessions SET expires_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE token_hash=?',
              [
                createHash('sha256')
                  .update(operator.cookies.get('softek_admin')!)
                  .digest('hex'),
              ],
            );
          if (reason === 'logout')
            assert.equal((await operator.req('/admin/logout', {})).status, 200);
          if (reason === 'delete')
            assert.equal(
              (await admin.req(`/admin/users/${u.id}/delete`, {})).status,
              200,
            );
          assert.equal((await operator.req('/state')).status, 401, reason);
          const exit = await operator.req('/auth/impersonation/exit', {});
          assert.equal(exit.status, 200, reason);
          assert.equal(
            exit.data.destination,
            reason === 'logout' || reason === 'delete'
              ? '/controls/customers'
              : `/controls/customers/${u.id}`,
          );
        }
      },
    );
    await t.test(
      'concurrent entry, ordinary-session replacement and reset preserve isolation',
      async () => {
        const operator = new Client();
        await operator.admin();
        await operator.login({
          username: customer.username,
          password: customer.password,
        });
        const userToken = operator.cookies.get('softek_user')!;
        const rId = randomUUID();
        const results = await Promise.all([
          operator.enter(automated.id, rId),
          operator.enter(automated.id, rId),
        ]);
        assert.ok(results.every((r) => r.status === 200));
        assert.equal(results[0]!.data.banner.id, results[1]!.data.banner.id);
        assert.ok(!operator.cookies.has('softek_user'));
        const rows = await pool.query(
          'SELECT * FROM user_sessions WHERE token_hash=?',
          [createHash('sha256').update(userToken).digest('hex')],
        );
        assert.equal(rows.length, 0);
        const prior = (await operator.req('/state')).data;
        assert.equal((await operator.req('/reset', {})).status, 200);
        const fresh = (await operator.req('/state')).data;
        assert.notEqual(fresh.runId, prior.runId);
        assert.equal(
          fresh.impersonation.contextId,
          prior.impersonation.contextId,
        );
        assert.equal(fresh.analytics.enabled, false);
        assert.equal((await ordinary.req('/state')).data.runId, runId);
        await operator.req('/auth/impersonation/exit', {});
      },
    );
  } finally {
    await cleanUsers(pool, ids);
    for (const raw of adminTokens)
      await pool.query('DELETE FROM admin_sessions WHERE token_hash=?', [
        createHash('sha256').update(raw).digest('hex'),
      ]);
    await pool.query(
      'UPDATE clarity_collection SET enabled=?,revision=?,updated_at=? WHERE id=1',
      [savedClarity.enabled, savedClarity.revision, savedClarity.updated_at],
    );
    for (const k of keys) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
