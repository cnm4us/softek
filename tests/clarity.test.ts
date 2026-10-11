import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import { createApp } from '../apps/api/src/app.js';
import { fixtureUser, cleanUsers } from './fixtures.js';
import { collectionMode } from '../scripts/lib/collection-mode.js';
test('Clarity switch protects consent, deployment gates, retries and automation', async (t) => {
  const keys = [
    'CLARITY_ENABLED',
    'VITE_CLARITY_ENABLED',
    'CLARITY_CONFIG_VERIFIED',
    'CLARITY_PROJECT_ID',
    'PUBLIC_ORIGIN',
  ];
  const original = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  process.env.PUBLIC_ORIGIN = 'http://127.0.0.1:5173';
  process.env.CLARITY_ENABLED = 'false';
  process.env.VITE_CLARITY_ENABLED = 'false';
  const { app, pool } = createApp(true),
    server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const [saved] = await pool.query(
    'SELECT * FROM clarity_collection WHERE id=1',
  );
  const cookies = new Map<string, string>();
  let csrf = '';
  const browser = randomUUID(),
    ids: string[] = [];
  async function req(
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    const r = await fetch(url + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Origin: process.env.PUBLIC_ORIGIN!,
        'Content-Type': 'application/json',
        Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        'X-CSRF-Token': csrf,
        'X-Browser-Session': browser,
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    for (const v of r.headers.getSetCookie()) {
      const [k, value] = v.split(';')[0]!.split('=');
      cookies.set(k!, value!);
    }
    return { status: r.status, data: await r.json() };
  }
  try {
    await pool.query('UPDATE clarity_collection SET enabled=FALSE WHERE id=1');
    await t.test(
      'admin authorization, origin and strict payloads',
      async () => {
        assert.equal((await req('/admin/clarity')).status, 401);
        assert.equal((await req('/analytics')).status, 401);
        const login = await req('/admin/login', {
          password: process.env.DEMO_ADMIN_SECRET,
        });
        csrf = login.data.csrf;
        const status = await req('/admin/clarity');
        assert.equal(status.data.enabled, false);
        assert.equal(status.data.configured, false);
        assert.equal(
          (
            await req('/admin/clarity', {
              enabled: true,
              revision: status.data.revision,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await req(
              '/admin/clarity',
              { enabled: false, revision: status.data.revision },
              { 'X-CSRF-Token': 'bad' },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await req(
              '/admin/clarity',
              { enabled: false, revision: status.data.revision },
              { Origin: 'https://other.example' },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await req('/admin/clarity', {
              enabled: true,
              revision: status.data.revision,
              projectId: 'other',
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      'explicit build/deploy mode and matching runtime gates',
      async () => {
        assert.equal(collectionMode([]), false);
        assert.throws(() => collectionMode(['--unknown']));
        process.env.CLARITY_CONFIG_VERIFIED = 'false';
        assert.throws(() => collectionMode(['--clarity']));
        process.env.CLARITY_CONFIG_VERIFIED = 'true';
        process.env.CLARITY_PROJECT_ID = 'yvs5hp3ivb';
        assert.equal(collectionMode(['--clarity']), true);
        assert.equal(collectionMode([]), false);
        process.env.CLARITY_ENABLED = 'true';
        assert.equal((await req('/admin/clarity')).data.configured, false);
        process.env.VITE_CLARITY_ENABLED = 'true';
        assert.equal((await req('/admin/clarity')).data.configured, true);
      },
    );
    await t.test(
      'persisted revisions, stale conflict, retries, human state and run stability',
      async () => {
        const user = await fixtureUser(pool, 'alex', 'human');
        ids.push(user.id);
        const login = await req('/auth/login', {
          username: user.username,
          password: user.password,
          requestId: randomUUID(),
        });
        assert.equal(login.status, 200);
        const before = (await req('/state')).data;
        assert.equal(before.analytics.enabled, false);
        const first = (await req('/admin/clarity')).data;
        const enabled = await req('/admin/clarity', {
          enabled: true,
          revision: first.revision,
        });
        assert.equal(enabled.data.enabled, true);
        assert.notEqual(enabled.data.revision, first.revision);
        const retry = await req('/admin/clarity', {
          enabled: true,
          revision: first.revision,
        });
        assert.equal(retry.data.revision, enabled.data.revision);
        assert.equal(
          (
            await req('/admin/clarity', {
              enabled: false,
              revision: first.revision,
            })
          ).status,
          409,
        );
        const during = (await req('/state')).data;
        assert.equal(during.analytics.enabled, true);
        assert.equal(during.analytics.projectId, 'yvs5hp3ivb');
        assert.equal(during.runId, before.runId);
        assert.deepEqual(during.accounts, before.accounts);
        assert.equal(
          (await req('/analytics')).data.revision,
          enabled.data.revision,
        );
        const off = (
          await req('/admin/clarity', {
            enabled: false,
            revision: enabled.data.revision,
          })
        ).data;
        assert.equal(off.enabled, false);
        assert.notEqual(off.revision, enabled.data.revision);
        assert.equal((await req('/analytics')).data.enabled, false);
      },
    );
    await t.test(
      'routine automation cannot capture without a separate trusted pilot header',
      async () => {
        const user = await fixtureUser(pool);
        ids.push(user.id);
        const automation = {
          'X-Demo-Automation': process.env.AUTOMATION_SECRET!,
        };
        const login = await req(
          '/auth/login',
          {
            username: user.username,
            password: user.password,
            requestId: randomUUID(),
          },
          automation,
        );
        assert.equal(login.status, 200);
        const settings = (await req('/admin/clarity')).data;
        await req('/admin/clarity', {
          enabled: true,
          revision: settings.revision,
        });
        assert.equal(
          (await req('/state', undefined, automation)).data.analytics.enabled,
          false,
        );
        assert.equal(
          (
            await req('/analytics', undefined, {
              ...automation,
              'X-Demo-Capture': 'wrong',
            })
          ).data.enabled,
          false,
        );
        assert.equal(
          (
            await req('/analytics', undefined, {
              ...automation,
              'X-Demo-Capture': process.env.AUTOMATION_SECRET!,
            })
          ).data.enabled,
          true,
        );
      },
    );
  } finally {
    await pool.query(
      'UPDATE clarity_collection SET enabled=?,revision=?,updated_at=? WHERE id=1',
      [saved.enabled, saved.revision, saved.updated_at],
    );
    await cleanUsers(pool, ids);
    const admin = cookies.get('softek_admin');
    if (admin)
      await pool.query('DELETE FROM admin_sessions WHERE token_hash=?', [
        createHash('sha256').update(admin).digest('hex'),
      ]);
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
    await pool.end();
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});
