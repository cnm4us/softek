import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { createApp } from '../apps/api/src/app.js';
import { seed } from '../scripts/seed.js';
import { assetDirectory } from '../apps/api/src/banner-assets.js';
import { fixtureUser, cleanUsers } from './fixtures.js';

test('authenticated users, banner rotation, uploads, and observations', async (t) => {
  process.env.PUBLIC_ORIGIN = 'http://127.0.0.1:5173';
  await seed(true);
  const { app, pool } = createApp(true),
    server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const users: string[] = [],
    uploaded: string[] = [],
    assets: string[] = [],
    adminTokens: string[] = [];
  const initialBanners = await pool.query('SELECT * FROM demo_banners');
  class Client {
    cookies = new Map<string, string>();
    csrf = '';
    browser = randomUUID();
    user = { id: '', username: '', password: '' };
    async request(
      path: string,
      body?: unknown,
      options: { csrf?: string; automated?: boolean; origin?: string } = {},
    ) {
      const response = await fetch(
        base + (path.startsWith('/media/') ? path : '/api' + path),
        {
          method: body === undefined ? 'GET' : 'POST',
          headers: {
            ...(body instanceof FormData
              ? {}
              : { 'Content-Type': 'application/json' }),
            Origin: options.origin ?? process.env.PUBLIC_ORIGIN!,
            'X-Browser-Session': this.browser,
            'X-CSRF-Token': options.csrf ?? this.csrf,
            Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
            ...(options.automated === false
              ? {}
              : { 'X-Demo-Automation': process.env.AUTOMATION_SECRET! }),
          },
          ...(body === undefined
            ? {}
            : { body: body instanceof FormData ? body : JSON.stringify(body) }),
        },
      );
      for (const raw of response.headers.getSetCookie()) {
        const [k, v] = raw.split(';')[0]!.split('=');
        this.cookies.set(k!, v!);
        if (k === 'softek_admin') adminTokens.push(v!);
      }
      const data = response.headers
        .get('content-type')
        ?.includes('application/json')
        ? await response.json()
        : await response.arrayBuffer();
      return { status: response.status, data, headers: response.headers };
    }
    async login() {
      const r = await this.request('/auth/login', {
        username: this.user.username,
        password: this.user.password,
        requestId: randomUUID(),
      });
      if (r.status === 200) this.csrf = r.data.csrf;
      return r;
    }
    async state() {
      const r = await this.request('/state');
      assert.equal(r.status, 200);
      this.csrf = r.data.csrf;
      return r.data;
    }
  }
  const admin = new Client(),
    a = new Client(),
    b = new Client();
  try {
    const adminLogin = await admin.request('/admin/login', {
      password: process.env.DEMO_ADMIN_SECRET,
    });
    assert.equal(adminLogin.status, 200);
    admin.csrf = adminLogin.data.csrf;
    a.user = await fixtureUser(pool);
    b.user = await fixtureUser(pool, 'jamie');
    users.push(a.user.id, b.user.id);
    await t.test(
      'admin creates users; credential errors and runtime sessions do not disclose passwords',
      async () => {
        assert.equal((await a.request('/admin/users')).status, 401);
        const name = `test.${randomUUID().slice(0, 16)}`;
        const created = await admin.request('/admin/users', {
          username: name.toUpperCase(),
          password: 'fictional-test-password',
          displayName: 'Fictional Test',
          variant: 'value',
          eligible: false,
          actor: 'human',
        });
        assert.equal(created.status, 201);
        users.push(created.data.id);
        assert.equal(created.data.username, name);
        const [stored] = await pool.query(
          'SELECT password_hash FROM demo_users WHERE id=?',
          [created.data.id],
        );
        assert.ok(stored.password_hash.startsWith('scrypt-v1:'));
        assert.ok(!stored.password_hash.includes('fictional-test-password'));
        const human = new Client();
        const logged = await human.request(
          '/auth/login',
          {
            username: name,
            password: 'fictional-test-password',
            requestId: randomUUID(),
          },
          { automated: false },
        );
        assert.equal(logged.status, 200);
        const humanState = await human.state();
        assert.equal(humanState.profileId, 'alex');
        assert.equal(humanState.eligible, false);
        assert.equal(humanState.user.displayName, 'Fictional Test');
        assert.equal(
          (
            await human.request(
              '/enroll',
              {
                requestId: randomUUID(),
                accepted: true,
              },
              { automated: false },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await admin.request('/admin/users', {
              username: name,
              password: 'fictional-test-password',
              displayName: 'Other',
              profileId: 'alex',
              eligible: true,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await a.request('/auth/login', {
              username: a.user.username,
              password: 'wrong-password',
              requestId: randomUUID(),
            })
          ).status,
          401,
        );
        assert.equal(
          (await a.request('/entry', { profileId: 'alex' })).status,
          410,
        );
        const legacy = new Client();
        legacy.cookies.set('softek_run', 'stale');
        assert.equal((await legacy.request('/state')).status, 401);
      },
    );
    await t.test(
      'email usernames normalize on creation/login and invalid fields get useful errors',
      async () => {
        const email = `test.${randomUUID().slice(0, 8)}+pilot@example.com`;
        const details = {
          username: ` ${email.toUpperCase()} `,
          password: 'demo-pass',
          displayName: 'Fictional Email User',
          profileId: 'alex',
          variant: 'value',
          eligible: true,
          actor: 'human',
        };
        const created = await admin.request('/admin/users', details);
        assert.equal(created.status, 201);
        users.push(created.data.id);
        assert.equal(created.data.username, email);
        const customer = new Client();
        const logged = await customer.request(
          '/auth/login',
          {
            username: email.toUpperCase(),
            password: details.password,
            requestId: randomUUID(),
          },
          { automated: false },
        );
        assert.equal(logged.status, 200);
        assert.equal((await customer.state()).user.id, created.data.id);
        assert.equal(
          (await admin.request('/admin/users', { ...details, username: email }))
            .status,
          409,
        );
        for (const [field, value, message] of [
          ['username', 'invalid username', 'Username'],
          ['username', 'a'.repeat(41), 'Username'],
          ['password', 'short', 'Initial password'],
          ['displayName', '  ', 'Display name'],
        ]) {
          const rejected = await admin.request('/admin/users', {
            ...details,
            [field!]: value,
          });
          assert.equal(rejected.status, 400);
          assert.ok(rejected.data.error.startsWith(message));
          assert.ok(!rejected.data.error.includes(details.password));
          assert.ok(!rejected.data.error.includes(email));
        }
      },
    );
    let original: any, bannerA: any;
    await t.test(
      'concurrent first logins create one owned current run',
      async () => {
        const user = await fixtureUser(pool);
        users.push(user.id);
        const clients = Array.from({ length: 4 }, () => new Client());
        for (const client of clients) client.user = user;
        const replies = await Promise.all(
          clients.map((client) => client.login()),
        );
        assert.ok(replies.every((reply) => reply.status === 200));
        const states = await Promise.all(
          clients.map((client) => client.state()),
        );
        assert.equal(new Set(states.map((state) => state.runId)).size, 1);
        const [count] = await pool.query(
          'SELECT COUNT(*) AS n FROM participant_runs WHERE user_id=?',
          [user.id],
        );
        assert.equal(Number(count.n), 1);
      },
    );
    await t.test(
      'login, session expiry, and relogin preserve owned banking state',
      async () => {
        const login = await a.login();
        assert.equal(login.status, 200);
        bannerA = login.data.banner;
        assert.equal(bannerA.bannerId, 'harbor-goals');
        original = await a.state();
        assert.equal((await b.login()).status, 200);
        assert.notEqual((await b.state()).runId, original.runId);
        const goal = await a.request('/enroll', {
          requestId: randomUUID(),
          accepted: true,
        });
        assert.equal(goal.status, 200);
        assert.equal(
          (
            await a.request('/goals', {
              requestId: randomUUID(),
              title: 'Remember my state',
              targetMinor: 10000,
            })
          ).status,
          201,
        );
        const tokenHash = createHash('sha256')
          .update(a.cookies.get('softek_user')!)
          .digest('hex');
        await pool.query(
          'UPDATE user_sessions SET expires_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE token_hash=?',
          [tokenHash],
        );
        assert.equal((await a.request('/state')).status, 401);
        assert.equal((await a.login()).status, 200);
        const saved = await a.state();
        assert.equal(saved.runId, original.runId);
        assert.equal(saved.user.id, original.user.id);
        assert.equal(saved.enrolled, true);
        assert.equal(saved.goals[0].title, 'Remember my state');
        assert.notEqual(saved.visitId, original.visitId);
        await pool.query(
          'UPDATE participant_runs SET expires_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 DAY) WHERE id=?',
          [original.runId],
        );
        assert.equal((await a.state()).runId, original.runId);
      },
    );
    await t.test(
      'refresh selection retries serialize; menu/data returns do not advance',
      async () => {
        const before = (await a.request('/banners/current')).data;
        assert.equal(before.bannerId, 'harbor-bill-pay');
        const requestId = randomUUID();
        const replies = await Promise.all(
          Array.from({ length: 6 }, () =>
            a.request('/banners/select', { requestId, reason: 'refresh' }),
          ),
        );
        assert.ok(replies.every((r) => r.status === 200));
        assert.equal(new Set(replies.map((r) => r.data.id)).size, 1);
        assert.equal(replies[0]!.data.bannerId, 'harbor-cards');
        await a.state();
        assert.equal(
          (await a.request('/banners/current')).data.id,
          replies[0]!.data.id,
        );
        const next = await a.request('/banners/select', {
          requestId: randomUUID(),
          reason: 'refresh',
        });
        assert.equal(next.data.bannerId, 'harbor-goals');
        bannerA = next.data;
        assert.equal(
          (await b.request(`/banners/current?id=${bannerA.id}`)).status,
          404,
        );
        assert.equal(
          (
            await a.request(
              '/banners/select',
              { requestId: randomUUID(), reason: 'refresh' },
              { csrf: 'bad' },
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      'observations validate ownership and keep placeholder actions out of adoption',
      async () => {
        const event = {
          requestId: randomUUID(),
          pageId: randomUUID(),
          selectionId: bannerA.id,
          name: 'banner_visible',
          routeKey: 'summary',
          observedAt: new Date().toISOString(),
        };
        assert.equal((await b.request('/interactions', event)).status, 403);
        const observed = await a.request('/interactions', event);
        assert.equal(observed.status, 200);
        assert.equal(observed.data.accepted, true);
        assert.equal(
          (await a.request('/interactions', event)).data.accepted,
          false,
        );
        assert.equal(
          (
            await a.request('/interactions', {
              requestId: randomUUID(),
              pageId: randomUUID(),
              name: 'placeholder_action',
              routeKey: 'bill-pay',
              observedAt: new Date().toISOString(),
            })
          ).status,
          200,
        );
        assert.equal(
          (await a.request('/interactions', { ...event, name: 'first_use' }))
            .status,
          400,
        );
        const [count] = await pool.query(
          "SELECT COUNT(*) AS n FROM adoption_events WHERE run_id=? AND name='first_use'",
          [original.runId],
        );
        assert.equal(Number(count.n), 1); // only the real goal creation
      },
    );
    await t.test(
      'upload re-encodes actual raster content, rejects unsafe input, and validates destinations',
      async () => {
        const png = await sharp({
          create: {
            width: 600,
            height: 200,
            channels: 3,
            background: '#205747',
          },
        })
          .png()
          .toBuffer();
        const form = (bytes: Uint8Array, link = 'bill-pay') => {
          const f = new FormData();
          f.set(
            'image',
            new Blob([bytes as BlobPart], { type: 'image/png' }),
            '../pretend.png',
          );
          f.set('title', 'Uploaded test');
          f.set('altText', 'Explore test Bill Pay');
          f.set('destination', link);
          f.set('sortOrder', '4');
          return f;
        };
        assert.equal(
          (await a.request('/admin/banners/upload', form(png))).status,
          403,
        );
        assert.equal(
          (
            await admin.request(
              '/admin/banners/upload',
              form(png, 'https://example.com'),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await admin.request(
              '/admin/banners/upload',
              form(Buffer.from('<script>bad</script>')),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await admin.request(
              '/admin/banners/upload',
              form(Buffer.alloc(5 * 1024 * 1024 + 1)),
            )
          ).status,
          413,
        );
        const uploadedBanner = await admin.request(
          '/admin/banners/upload',
          form(png),
        );
        assert.equal(uploadedBanner.status, 201);
        uploaded.push(uploadedBanner.data.id);
        assets.push(uploadedBanner.data.imageUrl.split('/').at(-1));
        const image = await new Client().request(uploadedBanner.data.imageUrl);
        assert.equal(image.status, 200);
        assert.equal(image.headers.get('content-type'), 'image/webp');
        assert.ok(image.headers.get('cache-control')?.includes('immutable'));
        const replacement = form(png);
        replacement.set('replaceId', uploadedBanner.data.id);
        const replaced = await admin.request(
          '/admin/banners/upload',
          replacement,
        );
        assert.equal(replaced.status, 201);
        uploaded.push(replaced.data.id);
        assets.push(replaced.data.imageUrl.split('/').at(-1));
        assert.notEqual(replaced.data.imageUrl, uploadedBanner.data.imageUrl);
        const oldImage = await new Client().request(
          uploadedBanner.data.imageUrl,
        );
        assert.deepEqual(Buffer.from(oldImage.data), Buffer.from(image.data));
        const [oldCreative] = await pool.query(
          'SELECT enabled FROM demo_banners WHERE id=?',
          [uploadedBanner.data.id],
        );
        assert.equal(Boolean(oldCreative.enabled), false);
        const settings = {
          title: 'Test',
          altText: 'Test banner',
          destination: '//example.com',
          enabled: true,
          sortOrder: 0,
          campaignId: null,
        };
        assert.equal(
          (
            await admin.request(
              `/admin/banners/${uploadedBanner.data.id}/settings`,
              settings,
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await admin.request(
              `/admin/banners/${uploadedBanner.data.id}/settings`,
              {
                ...settings,
                destination: 'bill-pay',
                campaignId: 'savings-launch',
              },
            )
          ).status,
          400,
        );
      },
    );
    await t.test(
      'zero/one enabled banners and disabled-presentation fallback are deterministic',
      async () => {
        await pool.query('UPDATE demo_banners SET enabled=FALSE');
        const zero = await a.request('/banners/select', {
          requestId: randomUUID(),
          reason: 'refresh',
        });
        assert.equal(zero.status, 200);
        assert.equal(zero.data.bannerId, null);
        await pool.query(
          "UPDATE demo_banners SET enabled=TRUE WHERE id='harbor-cards'",
        );
        const one = await a.request('/banners/select', {
          requestId: randomUUID(),
          reason: 'refresh',
        });
        const again = await a.request('/banners/select', {
          requestId: randomUUID(),
          reason: 'refresh',
        });
        assert.equal(one.data.bannerId, 'harbor-cards');
        assert.equal(again.data.bannerId, 'harbor-cards');
        await pool.query(
          "UPDATE demo_banners SET enabled=FALSE WHERE id='harbor-cards'",
        );
        const fallback = await a.request(`/banners/current?id=${one.data.id}`);
        assert.equal(fallback.data.bannerId, null);
        const retry = await a.request(`/banners/current?id=${one.data.id}`);
        assert.equal(fallback.data.id, retry.data.id);
      },
    );
    await t.test(
      'reset keeps identity/history; password replacement and disable revoke sessions',
      async () => {
        const reset = await a.request('/reset', {});
        assert.equal(reset.status, 200);
        const clean = await a.state();
        assert.equal(clean.user.id, original.user.id);
        assert.notEqual(clean.runId, original.runId);
        assert.equal(clean.goals.length, 0);
        const [history] = await pool.query(
          'SELECT status FROM participant_runs WHERE id=?',
          [original.runId],
        );
        assert.equal(history.status, 'retired');
        const legacy = await b.state();
        assert.equal(legacy.profileId, 'jamie');
        assert.equal(legacy.eligible, false);
        const configured = await admin.request(
          `/admin/users/${b.user.id}/reset`,
          {
            variant: 'baseline',
            eligible: true,
          },
        );
        assert.equal(configured.status, 200);
        const eligible = await b.state();
        assert.equal(eligible.profileId, 'jamie');
        assert.equal(eligible.eligible, true);
        assert.equal(eligible.variant, 'baseline');
        assert.notEqual(eligible.runId, legacy.runId);
        assert.equal(eligible.user.id, legacy.user.id);
        assert.deepEqual(
          eligible.accounts.map(({ id, ...account }: any) => account),
          legacy.accounts.map(({ id, ...account }: any) => account),
        );
        const [retired] = await pool.query(
          'SELECT status FROM participant_runs WHERE id=?',
          [legacy.runId],
        );
        assert.equal(retired.status, 'retired');
        assert.equal(
          (
            await b.request('/enroll', {
              requestId: randomUUID(),
              accepted: true,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await admin.request(`/admin/users/${a.user.id}/password`, {
              password: 'replacement-password',
            })
          ).status,
          200,
        );
        assert.equal((await a.request('/state')).status, 401);
        assert.equal((await a.login()).status, 401);
        a.user.password = 'replacement-password';
        assert.equal((await a.login()).status, 200);
        assert.equal((await a.state()).runId, clean.runId);
        assert.equal(
          (
            await admin.request(`/admin/users/${a.user.id}/status`, {
              enabled: false,
            })
          ).status,
          200,
        );
        assert.equal((await a.request('/state')).status, 401);
        assert.equal((await a.login()).status, 401);
      },
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await cleanUsers(pool, users);
    for (const row of initialBanners)
      await pool.query(
        'UPDATE demo_banners SET enabled=?,sort_order=? WHERE id=?',
        [row.enabled, row.sort_order, row.id],
      );
    for (const id of uploaded)
      await pool.query('DELETE FROM demo_banners WHERE id=?', [id]);
    for (const key of assets) {
      await pool.query('DELETE FROM banner_assets WHERE asset_key=?', [key]);
      await unlink(join(assetDirectory(true), key)).catch(() => {});
    }
    for (const raw of adminTokens)
      await pool.query('DELETE FROM admin_sessions WHERE token_hash=?', [
        createHash('sha256').update(raw).digest('hex'),
      ]);
    await pool.end();
  }
});
