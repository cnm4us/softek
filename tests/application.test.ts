import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import { createApp } from '../apps/api/src/app.js';
import { seed } from '../scripts/seed.js';

test('persistent adoption journey and API boundaries on demo_test', async (t) => {
  process.env.PUBLIC_ORIGIN = 'http://127.0.0.1:5173';
  await seed(true);
  const { app, pool } = createApp(true);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const runIds: string[] = [],
    adminTokens: string[] = [];
  class Client {
    cookies = new Map<string, string>();
    browser = randomUUID();
    csrf = '';
    adminCsrf = '';
    async request(
      path: string,
      body?: unknown,
      options: { csrf?: string; origin?: string; automation?: boolean } = {},
    ) {
      const response = await fetch(base + '/api' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: options.origin ?? 'http://127.0.0.1:5173',
          'X-Browser-Session': this.browser,
          Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
          'X-CSRF-Token': options.csrf ?? this.csrf,
          ...(options.automation === false
            ? {}
            : { 'X-Demo-Automation': process.env.AUTOMATION_SECRET! }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      for (const cookie of response.headers.getSetCookie()) {
        const [name, value] = cookie.split(';')[0]!.split('=');
        this.cookies.set(name!, value!);
        if (name === 'softek_admin') adminTokens.push(value!);
      }
      const data = await response.json();
      if (path === '/entry' && response.ok) {
        this.csrf = data.csrf;
        runIds.push(data.runId);
      }
      if (path === '/reset' && response.ok) {
        this.csrf = data.csrf;
        runIds.push(data.runId);
      }
      return { status: response.status, data };
    }
    async state() {
      const r = await this.request('/state');
      assert.equal(r.status, 200);
      this.csrf = r.data.csrf;
      return r.data;
    }
    async event(name: string, placement = 'direct', presentation = placement) {
      return this.request('/events', {
        name,
        placement,
        presentation,
        observedAt: new Date().toISOString(),
      });
    }
  }
  const alex = new Client(),
    other = new Client(),
    jamie = new Client();
  let goalId = '',
    initial: any;
  try {
    await t.test(
      'anonymous access, origin checks, and CSRF protection',
      async () => {
        assert.equal((await alex.request('/state')).status, 401);
        assert.equal(
          (
            await alex.request(
              '/entry',
              { profileId: 'alex' },
              { origin: 'https://unrelated.example' },
            )
          ).status,
          403,
        );
        assert.equal(
          (await alex.request('/entry', { profileId: 'alex', actor: 'human' }))
            .status,
          400,
        );
        assert.equal(
          (await alex.request('/entry', { profileId: 'alex' })).status,
          201,
        );
        initial = await alex.state();
        assert.equal(
          (
            await alex.request(
              '/enroll',
              { requestId: randomUUID(), accepted: true },
              { csrf: 'wrong' },
            )
          ).status,
          403,
        );
        assert.equal(
          (await other.request('/entry', { profileId: 'alex' })).status,
          201,
        );
        assert.equal(
          (await jamie.request('/entry', { profileId: 'jamie' })).status,
          201,
        );
        assert.notEqual((await other.state()).runId, initial.runId);
      },
    );
    await t.test(
      'eligibility is enforced and clients cannot forge confirmed milestones',
      async () => {
        assert.equal(
          (
            await jamie.request('/enroll', {
              requestId: randomUUID(),
              accepted: true,
            })
          ).status,
          403,
        );
        assert.equal(
          (await jamie.event('promotion_visible', 'banner')).status,
          403,
        );
        assert.equal((await alex.event('enrollment_completed')).status, 400);
        assert.equal(
          (await alex.event('promotion_visible', 'direct')).status,
          400,
        );
        assert.equal(
          (
            await alex.request('/goals', {
              requestId: randomUUID(),
              title: 'Too early',
              targetMinor: 50000,
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      'deduplicated placements and journey observations',
      async () => {
        assert.equal(
          (await alex.event('promotion_visible', 'banner')).data.accepted,
          true,
        );
        assert.equal(
          (await alex.event('promotion_visible', 'banner')).data.accepted,
          false,
        );
        assert.equal(
          (await alex.event('promotion_visible', 'sidebar', 'inline')).data
            .accepted,
          true,
        );
        for (const [name, placement] of [
          ['promotion_clicked', 'banner'],
          ['details_viewed', 'direct'],
          ['enrollment_started', 'direct'],
        ])
          assert.equal((await alex.event(name!, placement)).status, 200);
      },
    );
    await t.test(
      'concurrent enrollment retries commit once and changed payloads are rejected',
      async () => {
        const requestId = randomUUID();
        const results = await Promise.all([
          alex.request('/enroll', { requestId, accepted: true }),
          alex.request('/enroll', { requestId, accepted: true }),
        ]);
        assert.deepEqual(
          results.map((r) => r.status),
          [200, 200],
        );
        assert.equal(results.filter((r) => r.data.replayed).length, 1);
        assert.equal(
          results
            .flatMap((r) => r.data.events)
            .filter((n) => n === 'enrollment_completed').length,
          1,
        );
        assert.equal((await alex.state()).enrolled, true);
        assert.equal((await other.state()).enrolled, false);
        assert.equal(
          (
            await alex.request('/goals', {
              requestId,
              title: 'Changed operation',
              targetMinor: 50000,
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      'goal creation is persistent, idempotent, and first use is committed once',
      async () => {
        const body = {
          requestId: randomUUID(),
          title: 'A weekend away',
          targetMinor: 50000,
        };
        const r = await alex.request('/goals', body);
        assert.equal(r.status, 201);
        goalId = r.data.goalId;
        assert.deepEqual(r.data.events, ['first_use']);
        const replay = await alex.request('/goals', body);
        assert.equal(replay.data.goalId, goalId);
        assert.equal(replay.data.replayed, true);
        assert.deepEqual(replay.data.events, []);
        assert.equal(
          (await alex.request('/goals', { ...body, title: 'Altered' })).status,
          409,
        );
        const state = await alex.state();
        assert.equal(state.goals.length, 1);
        assert.equal(state.goals[0].currentMinor, 0);
        assert.equal(
          state.accounts[1].balanceMinor,
          initial.accounts[1].balanceMinor,
        );
      },
    );
    await t.test('ownership and funding limits protect balances', async () => {
      assert.equal(
        (
          await other.request('/goals/' + goalId + '/contributions', {
            requestId: randomUUID(),
            amountMinor: 100,
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await alex.request('/goals/' + goalId + '/contributions', {
            requestId: randomUUID(),
            amountMinor: 50001,
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await alex.request('/goals/' + goalId + '/contributions', {
            requestId: randomUUID(),
            amountMinor: 1.1,
          })
        ).status,
        400,
      );
      const big = await alex.request('/goals', {
        requestId: randomUUID(),
        title: 'Bigger goal',
        targetMinor: 1000000,
      });
      assert.equal(
        (
          await alex.request('/goals/' + big.data.goalId + '/contributions', {
            requestId: randomUUID(),
            amountMinor: 500000,
          })
        ).status,
        409,
      );
      assert.equal(
        (await alex.state()).accounts[0].balanceMinor,
        initial.accounts[0].balanceMinor,
      );
    });
    await t.test(
      'contributions transfer atomically and same-visit use is not repeat adoption',
      async () => {
        const body = { requestId: randomUUID(), amountMinor: 2500 };
        assert.deepEqual(
          (await alex.request('/goals/' + goalId + '/contributions', body)).data
            .events,
          [],
        );
        assert.equal(
          (await alex.request('/goals/' + goalId + '/contributions', body)).data
            .replayed,
          true,
        );
        const state = await alex.state();
        assert.equal(
          state.goals.find((g: any) => g.id === goalId).currentMinor,
          2500,
        );
        assert.equal(
          state.accounts[0].balanceMinor,
          initial.accounts[0].balanceMinor - 2500,
        );
        assert.equal(
          state.accounts[1].balanceMinor,
          initial.accounts[1].balanceMinor + 2500,
        );
        const repeat = await pool.query(
          "SELECT COUNT(*) AS n FROM adoption_events WHERE run_id=? AND name='repeat_use'",
          [initial.runId],
        );
        assert.equal(Number(repeat[0].n), 0);
      },
    );
    await t.test(
      'new browser session and inactivity produce later visits and one repeat milestone',
      async () => {
        const old = (await alex.state()).visitId;
        alex.browser = randomUUID();
        const later = await alex.state();
        assert.notEqual(later.visitId, old);
        assert.equal(later.goals.length, 2);
        const r = await alex.request('/goals/' + goalId + '/contributions', {
          requestId: randomUUID(),
          amountMinor: 500,
        });
        assert.deepEqual(r.data.events, ['repeat_use']);
        await pool.query(
          'UPDATE visits SET last_seen_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 31 MINUTE) WHERE id=?',
          [later.visitId],
        );
        const after = await alex.state();
        assert.notEqual(after.visitId, later.visitId);
        const again = await alex.request(
          '/goals/' + goalId + '/contributions',
          { requestId: randomUUID(), amountMinor: 500 },
        );
        assert.deepEqual(again.data.events, []);
      },
    );
    await t.test('repeat seed never overwrites participant state', async () => {
      await seed(true);
      const s = await alex.state();
      assert.equal(
        s.goals.find((g: any) => g.id === goalId).currentMinor,
        3500,
      );
      assert.equal(s.enrolled, true);
    });
    await t.test(
      'protected report reconciles cohort, ordered funnel, reach, and actor separation',
      async () => {
        assert.equal((await alex.request('/admin/report')).status, 401);
        assert.equal(
          (await alex.request('/admin/login', { password: 'wrong' })).status,
          401,
        );
        const login = await alex.request('/admin/login', {
          password: process.env.DEMO_ADMIN_SECRET,
        });
        assert.equal(login.status, 200);
        alex.adminCsrf = login.data.csrf;
        const start = new Date(Date.now() - 60_000).toISOString();
        const report = (
          await alex.request(
            '/admin/report?actor=automation&start=' + encodeURIComponent(start),
          )
        ).data;
        assert.equal(report.totalRuns, 3);
        assert.equal(report.eligibleRuns, 2);
        assert.deepEqual(report.actors, { human: 0, automation: 3 });
        assert.deepEqual(
          report.funnel.map((r: any) => r.count),
          [2, 1, 1, 1, 1, 1, 1, 1],
        );
        assert.deepEqual(
          report.funnel.map((r: any) => r.denominator),
          [2, 2, 1, 1, 1, 1, 1, 1],
        );
        assert.equal(report.placements[0].visible, 1);
        assert.equal(report.placements[1].visible, 1);
        const prior = (
          await alex.request(
            '/admin/report?actor=automation&cutoff=' +
              encodeURIComponent('2000-01-01T00:00:00.000Z'),
          )
        ).data;
        assert.equal(prior.totalRuns, 0);
        assert.equal(prior.eventCount, 0);
      },
    );
    await t.test(
      'reset retires old run, invalidates its cookie, and retains report history',
      async () => {
        const oldToken = alex.cookies.get('softek_run')!;
        const reset = await alex.request('/reset', {});
        assert.equal(reset.status, 200);
        assert.notEqual(reset.data.runId, initial.runId);
        const state = await alex.state();
        assert.equal(state.goals.length, 0);
        assert.equal(state.enrolled, false);
        assert.equal(
          state.accounts[0].balanceMinor,
          initial.accounts[0].balanceMinor,
        );
        assert.equal(state.variant, initial.variant);
        const stale = new Client();
        stale.cookies.set('softek_run', oldToken);
        assert.equal((await stale.request('/state')).status, 401);
        const retained = await pool.query(
          'SELECT status FROM participant_runs WHERE id=?',
          [initial.runId],
        );
        assert.equal(retained[0].status, 'retired');
        const history = await pool.query(
          'SELECT COUNT(*) AS n FROM adoption_events WHERE run_id=?',
          [initial.runId],
        );
        assert.ok(Number(history[0].n) > 8);
        assert.equal(
          (await other.state()).accounts[0].balanceMinor,
          initial.accounts[0].balanceMinor,
        );
      },
    );
    await t.test(
      'admin variant/eligibility changes create a fresh run and logout revokes access',
      async () => {
        const result = await alex.request(
          '/admin/restart',
          { profileId: 'jamie', variant: 'value', eligible: true },
          { csrf: alex.adminCsrf },
        );
        assert.equal(result.status, 200);
        runIds.push(result.data.runId);
        alex.csrf = result.data.csrf;
        const state = await alex.state();
        assert.equal(state.profileId, 'jamie');
        assert.equal(state.variant, 'value');
        assert.equal(state.eligible, true);
        assert.equal(state.enrolled, false);
        assert.equal(
          (await alex.request('/admin/logout', {}, { csrf: alex.adminCsrf }))
            .status,
          200,
        );
        assert.equal((await alex.request('/admin/report')).status, 401);
      },
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
    for (const id of runIds)
      await pool.query(
        "DELETE FROM participant_runs WHERE id=? AND actor='automation'",
        [id],
      );
    for (const raw of adminTokens)
      await pool.query('DELETE FROM admin_sessions WHERE token_hash=?', [
        createHash('sha256').update(raw).digest('hex'),
      ]);
    await pool.end();
  }
});
