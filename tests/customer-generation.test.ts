import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import { createApp } from '../apps/api/src/app.js';
import { cleanUsers, fixtureUser } from './fixtures.js';
import { passwordMatches } from '../apps/api/src/passwords.js';

test('bulk customer generation is protected, atomic, retry-safe and persistent', async (t) => {
  process.env.PUBLIC_ORIGIN = 'http://127.0.0.1:5173';
  const { app, pool } = createApp(true),
    server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const origin = process.env.PUBLIC_ORIGIN,
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const cookies = new Map<string, string>(),
    ids: string[] = [],
    batches: number[] = [];
  let csrf = '';
  const browser = randomUUID(),
    sharedPassword = randomUUID();
  const body = {
    requestId: randomUUID(),
    count: 200,
    prefix: 'test.bulk',
    password: sharedPassword,
    profileId: 'alex',
    variant: 'value',
    eligible: true,
    actor: 'human',
    checkingMinMinor: 10125,
    checkingMaxMinor: 90125,
    savingsMinMinor: 0,
    savingsMaxMinor: 200000,
  };
  async function req(
    path: string,
    data?: unknown,
    extra: Record<string, string> = {},
  ) {
    const response = await fetch(base + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        'X-CSRF-Token': csrf,
        'X-Browser-Session': browser,
        ...extra,
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    for (const raw of response.headers.getSetCookie()) {
      const [key, value] = raw.split(';')[0]!.split('=');
      cookies.set(key!, value!);
    }
    return { status: response.status, data: await response.json() };
  }
  let batch: any;
  try {
    await t.test(
      'authorization, CSRF, exact origin and bounded settings',
      async () => {
        assert.equal((await req('/admin/users/generate', body)).status, 403);
        const login = await req('/admin/login', {
          password: process.env.DEMO_ADMIN_SECRET,
        });
        csrf = login.data.csrf;
        assert.equal(
          (
            await req('/admin/users/generate', body, {
              'X-CSRF-Token': 'invalid',
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await req('/admin/users/generate', body, {
              Origin: 'https://elsewhere.example',
            })
          ).status,
          403,
        );
        for (const patch of [
          { count: 201 },
          { count: 0 },
          { prefix: '=bad' },
          { password: 'short' },
          { checkingMaxMinor: 100 },
          { savingsMinMinor: -1 },
          { savingsMaxMinor: 100000001 },
          { count: 1.5 },
          { unknown: true },
        ])
          assert.equal(
            (await req('/admin/users/generate', { ...body, ...patch })).status,
            400,
          );
      },
    );
    await t.test(
      '200 unique customers, cent ranges, salted passwords, no premature runs',
      async () => {
        const start = Date.now();
        const [created, concurrent] = await Promise.all([
          req('/admin/users/generate', body),
          req('/admin/users/generate', body),
        ]);
        assert.deepEqual(concurrent.data, created.data);
        assert.equal(created.status, 201);
        batch = created.data;
        batches.push(batch.batchId);
        ids.push(...batch.customers.map((c: any) => c.id));
        assert.equal(batch.customers.length, 200);
        assert.equal(
          new Set(batch.customers.map((c: any) => c.username)).size,
          200,
        );
        assert.equal(
          new Set(batch.customers.map((c: any) => c.displayName)).size,
          200,
        );
        for (const c of batch.customers) {
          assert.ok(
            c.checkingMinor >= 10125 &&
              c.checkingMinor <= 90125 &&
              Number.isInteger(c.checkingMinor),
          );
          assert.ok(
            c.savingsMinor >= 0 &&
              c.savingsMinor <= 200000 &&
              Number.isInteger(c.savingsMinor),
          );
          assert.equal(c.actor, 'human');
          assert.equal(c.password, undefined);
        }
        assert.ok(
          new Set(batch.customers.map((c: any) => c.checkingMinor)).size > 100,
        );
        assert.ok(
          new Set(batch.customers.map((c: any) => c.savingsMinor)).size > 100,
        );
        const rows = await pool.query(
          'SELECT password_hash FROM demo_users WHERE id IN (?)',
          [ids],
        );
        assert.equal(new Set(rows.map((r: any) => r.password_hash)).size, 200);
        assert.equal(
          await passwordMatches(sharedPassword, rows[0].password_hash),
          true,
        );
        const [runs] = await pool.query(
          'SELECT COUNT(*) AS n FROM participant_runs WHERE user_id IN (?)',
          [ids],
        );
        assert.equal(Number(runs.n), 0);
        console.log(`200-customer batch completed in ${Date.now() - start}ms.`);
      },
    );
    await t.test(
      'concurrent replay returns identical batch; changed payload conflicts',
      async () => {
        const replies = await Promise.all([
          req('/admin/users/generate', body),
          req('/admin/users/generate', body),
        ]);
        for (const r of replies) {
          assert.equal(r.status, 201);
          assert.deepEqual(r.data, batch);
        }
        assert.equal(
          (await req('/admin/users/generate', { ...body, count: 199 })).status,
          409,
        );
        const second = await req('/admin/users/generate', {
          ...body,
          requestId: randomUUID(),
          count: 3,
        });
        assert.equal(second.status, 201);
        batches.push(second.data.batchId);
        ids.push(...second.data.customers.map((c: any) => c.id));
        assert.equal(
          new Set(
            [...batch.customers, ...second.data.customers].map(
              (c) => c.username,
            ),
          ).size,
          203,
        );
        assert.equal(
          new Set(
            [...batch.customers, ...second.data.customers].map(
              (c) => c.displayName,
            ),
          ).size,
          203,
        );
      },
    );
    await t.test(
      'login, contribution, relogin and both resets preserve per-customer opening amounts',
      async () => {
        const customer = batch.customers[0];
        assert.equal(
          (
            await req('/auth/login', {
              username: customer.username,
              password: sharedPassword,
              requestId: randomUUID(),
            })
          ).status,
          200,
        );
        let state = (await req('/state')).data;
        const run = state.runId;
        const checking = (s: any) =>
          s.accounts.find((a: any) => a.kind === 'checking').balanceMinor;
        const savings = (s: any) =>
          s.accounts.find((a: any) => a.kind === 'savings').balanceMinor;
        assert.equal(checking(state), customer.checkingMinor);
        assert.equal(savings(state), customer.savingsMinor);
        const userCsrf = state.csrf;
        assert.equal(
          (
            await req(
              '/enroll',
              { requestId: randomUUID(), accepted: true },
              { 'X-CSRF-Token': userCsrf },
            )
          ).status,
          200,
        );
        const goal = await req(
          '/goals',
          { requestId: randomUUID(), title: 'Batch goal', targetMinor: 10000 },
          { 'X-CSRF-Token': userCsrf },
        );
        assert.equal(goal.status, 201);
        assert.equal(
          (
            await req(
              '/goals/' + goal.data.goalId + '/contributions',
              { requestId: randomUUID(), amountMinor: 100 },
              { 'X-CSRF-Token': userCsrf },
            )
          ).status,
          200,
        );
        await req('/auth/logout', {}, { 'X-CSRF-Token': userCsrf });
        await req('/auth/login', {
          username: customer.username,
          password: sharedPassword,
          requestId: randomUUID(),
        });
        state = (await req('/state')).data;
        assert.equal(state.runId, run);
        assert.equal(checking(state), customer.checkingMinor - 100);
        assert.equal(savings(state), customer.savingsMinor + 100);
        const reset = await req('/admin/users/' + customer.id + '/reset', {
          variant: 'baseline',
          eligible: false,
        });
        assert.equal(reset.status, 200);
        state = (await req('/state')).data;
        assert.notEqual(state.runId, run);
        assert.equal(state.profileId, customer.profileId);
        assert.equal(state.eligible, false);
        assert.equal(checking(state), customer.checkingMinor);
        assert.equal(savings(state), customer.savingsMinor);
        assert.equal(
          (await req('/reset', {}, { 'X-CSRF-Token': state.csrf })).status,
          200,
        );
        state = (await req('/state')).data;
        assert.equal(checking(state), customer.checkingMinor);
        assert.equal(savings(state), customer.savingsMinor);
      },
    );
    await t.test(
      'late username collision rolls back the entire batch',
      async () => {
        const [next] = await pool.query(
          "SELECT AUTO_INCREMENT AS nextId FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_generation_batches'",
        );
        const collision = await fixtureUser(pool);
        ids.push(collision.id);
        await pool.query('UPDATE demo_users SET username=? WHERE id=?', [
          `test.bulk.${next.nextId}.3`,
          collision.id,
        ]);
        const [before] = await pool.query(
          'SELECT COUNT(*) AS n FROM demo_users',
        );
        const failed = await req('/admin/users/generate', {
          ...body,
          requestId: randomUUID(),
          count: 5,
        });
        assert.equal(failed.status, 409);
        const [after] = await pool.query(
          'SELECT COUNT(*) AS n FROM demo_users',
        );
        assert.equal(after.n, before.n);
        const [empty] = await pool.query(
          'SELECT id FROM customer_generation_batches WHERE id=?',
          [next.nextId],
        );
        assert.equal(empty, undefined);
      },
    );
  } finally {
    await cleanUsers(pool, ids);
    if (batches.length)
      await pool.query(
        'DELETE FROM customer_generation_batches WHERE id IN (?)',
        [batches],
      );
    const token = cookies.get('softek_admin');
    if (token)
      await pool.query('DELETE FROM admin_sessions WHERE token_hash=?', [
        createHash('sha256').update(token).digest('hex'),
      ]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
