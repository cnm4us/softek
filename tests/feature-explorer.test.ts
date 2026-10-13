import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { createApp } from '../apps/api/src/app.js';
import { features } from '../apps/api/src/features.js';
import { explorerSections } from '../apps/api/src/feature-explorer-config.js';
import { assetDirectory } from '../apps/api/src/banner-assets.js';

test('Feature Explorer admin configuration and immutable mobile artwork', async (t) => {
  process.env.PUBLIC_ORIGIN = 'http://127.0.0.1:5173';
  const { app, pool } = createApp(true),
    server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  let cookie = '',
    csrf = '',
    adminToken = '';
  const widgets: string[] = [],
    assets: string[] = [];
  async function request(
    path: string,
    body?: unknown,
    auth = true,
    token = csrf,
  ) {
    const r = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Origin: process.env.PUBLIC_ORIGIN!,
        ...(auth ? { Cookie: cookie, 'X-CSRF-Token': token } : {}),
        ...(body instanceof FormData
          ? {}
          : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined
        ? {}
        : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    });
    const data = r.headers.get('content-type')?.includes('application/json')
      ? await r.json()
      : await r.arrayBuffer();
    return { status: r.status, data, response: r };
  }
  const image = await sharp({
    create: { width: 960, height: 315, channels: 3, background: '#205747' },
  })
    .png()
    .toBuffer();
  const imageForm = (buffer: Uint8Array = image, name = 'mobile.png') => {
    const f = new FormData();
    f.set('image', new Blob([new Uint8Array(buffer)]), name);
    return f;
  };
  try {
    await t.test('private access and catalog-owned identities', async () => {
      assert.equal(
        (await request('/api/admin/feature-explorer', undefined, false)).status,
        401,
      );
      const logged = await request('/api/admin/login', {
        password: process.env.DEMO_ADMIN_SECRET,
      });
      assert.equal(logged.status, 200);
      csrf = logged.data.csrf;
      cookie = logged.response.headers
        .getSetCookie()
        .find((s) => s.startsWith('softek_admin='))!
        .split(';')[0]!;
      adminToken = cookie.split('=')[1]!;
      const listed = await request('/api/admin/feature-explorer');
      assert.equal(listed.status, 200);
      assert.deepEqual(listed.data.sections, explorerSections);
      assert.equal(listed.data.features.length, 12);
      for (const section of explorerSections) {
        const r = await request('/api/admin/feature-explorer', {
          section: section.key,
          featureId: 'easycoin',
        });
        assert.equal(r.status, 201);
        widgets.push(r.data.id);
        const w = (await request('/api/admin/feature-explorer/' + r.data.id))
          .data;
        assert.equal(w.title, 'EasyCoin Cryptocurrency');
        assert.equal(w.href, '/features/easycoin');
        assert.equal(w.section, section.key);
        assert.equal(w.imageUrl, null);
        assert.equal(w.enabled, false);
      }
      assert.equal(
        (
          await request('/api/admin/feature-explorer', {
            section: 'summary',
            featureId: 'easycoin',
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request('/api/admin/feature-explorer', {
            section: 'summary',
            featureId: 'external-site',
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            '/api/admin/feature-explorer',
            { section: 'summary', featureId: 'easyvest-auto' },
            true,
            'invalid',
          )
        ).status,
        403,
      );
    });
    await t.test(
      'validates settings and refuses image-less activation',
      async () => {
        const url = '/api/admin/feature-explorer/' + widgets[0] + '/settings';
        assert.equal(
          (
            await request(url, {
              altText: 'Explore crypto',
              sortOrder: 0,
              enabled: true,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(url, {
              altText: 'Explore crypto',
              sortOrder: 1,
              enabled: false,
              href: 'https://example.com',
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(url, {
              altText: 'Explore crypto',
              sortOrder: 4,
              enabled: false,
            })
          ).status,
          200,
        );
        const w = (await request('/api/admin/feature-explorer/' + widgets[0]))
          .data;
        assert.equal(w.altText, 'Explore crypto');
        assert.equal(w.sortOrder, 4);
      },
    );
    await t.test(
      'uploads and replaces immutable images, without activating the customer slot',
      async () => {
        const url = '/api/admin/feature-explorer/' + widgets[0] + '/image';
        assert.equal(
          (
            await request(
              url,
              imageForm(new TextEncoder().encode('invalid image')),
            )
          ).status,
          400,
        );
        assert.equal(
          (await request(url, imageForm(), true, 'invalid')).status,
          403,
        );
        for (let i = 0; i < 2; i++) {
          const uploaded = await request(url, imageForm());
          assert.equal(uploaded.status, 201);
          assets.push(uploaded.data.imageUrl.split('/').at(-1));
          const media = await request(uploaded.data.imageUrl);
          assert.equal(media.status, 200);
          assert.equal(
            media.response.headers.get('content-type'),
            'image/webp',
          );
        }
        assert.notEqual(assets[0], assets[1]);
        assert.equal(
          (await request('/media/banners/' + assets[0])).status,
          200,
        );
        let w = (await request('/api/admin/feature-explorer/' + widgets[0]))
          .data;
        assert.equal(w.imageUrl, '/media/banners/' + assets[1]);
        assert.equal(w.enabled, false);
        assert.equal(
          (
            await request(
              '/api/admin/feature-explorer/' + widgets[0] + '/settings',
              { altText: w.altText, sortOrder: 4, enabled: true },
            )
          ).status,
          200,
        );
        w = (await request('/api/admin/feature-explorer/' + widgets[0])).data;
        assert.equal(w.enabled, true);
        const [linked] = await pool.query(
          'SELECT COUNT(*) AS n FROM banner_presentations WHERE asset_key IN (?)',
          [assets],
        );
        assert.equal(Number(linked.n), 0);
      },
    );
    await t.test('upload limits and missing widget cleanup', async () => {
      const url = '/api/admin/feature-explorer/' + widgets[1] + '/image';
      assert.equal(
        (await request(url, imageForm(new Uint8Array(5 * 1024 * 1024 + 1))))
          .status,
        413,
      );
      assert.equal(
        (
          await request(
            '/api/admin/feature-explorer/00000000-0000-4000-8000-000000000000/image',
            imageForm(),
          )
        ).status,
        404,
      );
      const w = (await request('/api/admin/feature-explorer/' + widgets[1]))
        .data;
      assert.equal(w.imageUrl, null);
    });
    await t.test(
      'deletion is protected, scoped, retryable and allows re-adding',
      async () => {
        const url = '/api/admin/feature-explorer/' + widgets[0] + '/delete';
        assert.equal((await request(url, {}, false)).status, 403);
        assert.equal((await request(url, {}, true, 'invalid')).status, 403);
        assert.equal(
          (await request(url, { section: 'account-checking' })).status,
          400,
        );
        assert.equal((await request(url, {})).status, 200);
        assert.equal(
          (await request('/api/admin/feature-explorer/' + widgets[0])).status,
          404,
        );
        const listed = (await request('/api/admin/feature-explorer')).data;
        assert.ok(!listed.widgets.some((w: any) => w.id === widgets[0]));
        for (const id of widgets.slice(1))
          assert.equal(
            (await request('/api/admin/feature-explorer/' + id)).status,
            200,
          );
        for (const key of assets)
          assert.equal((await request('/media/banners/' + key)).status, 200);
        assert.equal((await request(url, {})).status, 200);
        const added = await request('/api/admin/feature-explorer', {
          section: 'summary',
          featureId: 'easycoin',
        });
        assert.equal(added.status, 201);
        widgets.push(added.data.id);
        const fresh = (
          await request('/api/admin/feature-explorer/' + added.data.id)
        ).data;
        assert.notEqual(fresh.id, widgets[0]);
        assert.equal(fresh.imageUrl, null);
        assert.equal(fresh.enabled, false);
        assert.equal(listed.features.length, 12);
      },
    );
  } finally {
    for (const id of widgets)
      await pool.query('DELETE FROM feature_explorer_widgets WHERE id=?', [id]);
    for (const key of assets) {
      await pool.query('DELETE FROM banner_assets WHERE asset_key=?', [key]);
      await unlink(join(assetDirectory(true), key)).catch(() => {});
    }
    if (adminToken)
      await pool.query('DELETE FROM admin_sessions WHERE token_hash=?', [
        createHash('sha256').update(adminToken).digest('hex'),
      ]);
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
    await pool.end();
  }
});
