import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import { createApp } from '../apps/api/src/app.js';
import { fixtureUser, cleanUsers } from './fixtures.js';

test('saved customer browser profiles are protected, compatible and independent of banking', async (t) => {
  const origin = 'http://127.0.0.1:5173';
  process.env.PUBLIC_ORIGIN = origin;
  const { app, pool } = createApp(true),
    server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const ids: string[] = [],
    batches: number[] = [],
    cookies = new Map<string, string>();
  let csrf = '';
  const browser = randomUUID();
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
        'X-Demo-Automation': process.env.AUTOMATION_SECRET!,
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
  try {
    const legacy = await fixtureUser(pool);
    ids.push(legacy.id);
    await t.test(
      'legacy defaults and protected validated profile updates',
      async () => {
        const path = `/admin/users/${legacy.id}/browser-profile`;
        assert.equal(
          (await req(path, { device: 'iphone', browser: 'safari' })).status,
          403,
        );
        csrf = (
          await req('/admin/login', { password: process.env.DEMO_ADMIN_SECRET })
        ).data.csrf;
        const user = (await req('/admin/users')).data.find(
          (u: any) => u.id === legacy.id,
        );
        assert.equal(user.device, 'desktop');
        assert.equal(user.browser, 'chrome');
        assert.equal(
          (
            await req(
              path,
              { device: 'iphone', browser: 'safari' },
              { 'X-CSRF-Token': 'bad' },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await req(
              path,
              { device: 'iphone', browser: 'safari' },
              { Origin: 'https://elsewhere.test' },
            )
          ).status,
          403,
        );
        for (const data of [
          { device: 'iphone', browser: 'chrome' },
          { device: 'android', browser: 'safari' },
          { device: 'desktop', browser: 'opera' },
          { device: 'watch', browser: 'safari' },
          { device: 'ipad' },
          { device: 'ipad', browser: 'safari', extra: 1 },
        ])
          assert.equal((await req(path, data)).status, 400);
        await assert.rejects(
          pool.query('INSERT INTO customer_browser_profiles VALUES (?,?,?)', [
            legacy.id,
            'iphone',
            'chrome',
          ]),
        );
      },
    );
    await t.test(
      'manual and generated choices persist; bulk retry and pair validation',
      async () => {
        const payload = {
          username: `test.profile-${randomUUID().slice(0, 8)}`,
          password: randomUUID(),
          displayName: 'Device Profile Check',
          profileId: 'alex',
          eligible: true,
          actor: 'automation',
          device: 'iphone',
          browser: 'safari',
        };
        assert.equal(
          (await req('/admin/users', { ...payload, browser: 'chrome' })).status,
          400,
        );
        const created = await req('/admin/users', payload);
        assert.equal(created.status, 201);
        ids.push(created.data.id);
        const saved = (await req('/admin/users')).data.find(
          (u: any) => u.id === created.data.id,
        );
        assert.equal(saved.device, 'iphone');
        assert.equal(saved.browser, 'safari');
        const batch = {
          requestId: randomUUID(),
          count: 2,
          prefix: 'test.devices',
          password: randomUUID(),
          eligible: true,
          actor: 'automation',
          device: 'android',
          browser: 'chrome',
          checkingMinMinor: 10000,
          checkingMaxMinor: 20000,
          savingsMinMinor: 0,
          savingsMaxMinor: 10000,
        };
        assert.equal(
          (await req('/admin/users/generate', { ...batch, browser: 'firefox' }))
            .status,
          400,
        );
        const made = await req('/admin/users/generate', batch);
        assert.equal(made.status, 201);
        batches.push(made.data.batchId);
        ids.push(...made.data.customers.map((u: any) => u.id));
        assert.ok(
          made.data.customers.every(
            (u: any) => u.device === 'android' && u.browser === 'chrome',
          ),
        );
        assert.deepEqual(
          (await req('/admin/users/generate', batch)).data,
          made.data,
        );
        assert.equal(
          (await req('/admin/users/generate', { ...batch, device: 'desktop' }))
            .status,
          409,
        );
      },
    );
    await t.test(
      'changing profile preserves current run, accounts, user session and reset preferences',
      async () => {
        assert.equal(
          (
            await req('/auth/login', {
              username: legacy.username,
              password: legacy.password,
              requestId: randomUUID(),
            })
          ).status,
          200,
        );
        const original = (await req('/state')).data;
        assert.equal(
          (
            await req(`/admin/users/${legacy.id}/browser-profile`, {
              device: 'ipad',
              browser: 'safari',
            })
          ).status,
          200,
        );
        const after = (await req('/state')).data;
        assert.equal(after.runId, original.runId);
        assert.deepEqual(after.accounts, original.accounts);
        assert.equal(after.csrf, original.csrf);
        assert.deepEqual(after.analytics, original.analytics);
        assert.equal(
          (await req('/reset', {}, { 'X-CSRF-Token': after.csrf })).status,
          200,
        );
        const saved = (await req('/admin/users')).data.find(
          (u: any) => u.id === legacy.id,
        );
        assert.equal(saved.device, 'ipad');
        assert.equal(saved.browser, 'safari');
        assert.equal(
          (
            await req(`/admin/users/${legacy.id}/reset`, {
              profileId: 'alex',
              variant: 'value',
              eligible: true,
            })
          ).status,
          200,
        );
        assert.equal(
          (await req('/admin/users')).data.find((u: any) => u.id === legacy.id)
            .device,
          'ipad',
        );
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
