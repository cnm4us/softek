import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { createApp } from '../apps/api/src/app.js';
import { publishAsset, assetDirectory } from '../apps/api/src/banner-assets.js';
import { fixtureUser, cleanUsers } from './fixtures.js';

test('owned Summary feature banner rotation and attribution', async (t) => {
  process.env.PUBLIC_ORIGIN = 'http://127.0.0.1:5173';
  const { app, pool } = createApp(true),
    server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const users: string[] = [],
    widgets: string[] = [],
    assets: string[] = [];
  const original = await pool.query(
    'SELECT id,enabled FROM feature_explorer_widgets',
  );
  class Client {
    cookies = new Map<string, string>();
    csrf = '';
    browser = randomUUID();
    async request(path: string, body?: unknown) {
      const response = await fetch(base + '/api' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Origin: process.env.PUBLIC_ORIGIN!,
          'Content-Type': 'application/json',
          'X-Browser-Session': this.browser,
          'X-CSRF-Token': this.csrf,
          'X-Demo-Automation': process.env.AUTOMATION_SECRET!,
          Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      for (const raw of response.headers.getSetCookie()) {
        const [k, v] = raw.split(';')[0]!.split('=');
        this.cookies.set(k!, v!);
      }
      return { status: response.status, data: await response.json() };
    }
    async login() {
      const user = await fixtureUser(pool);
      users.push(user.id);
      const r = await this.request('/auth/login', {
        username: user.username,
        password: user.password,
        requestId: randomUUID(),
      });
      assert.equal(r.status, 200);
      this.csrf = r.data.csrf;
    }
    select(advance = true, selectionId?: string, requestId = randomUUID()) {
      return this.request('/feature-explorer/summary/select', {
        requestId,
        advance,
        ...(selectionId ? { selectionId } : {}),
      });
    }
  }
  const a = new Client(),
    b = new Client();
  let first: any, legacy: any, initial: any;
  try {
    await pool.query(
      "UPDATE feature_explorer_widgets SET enabled=FALSE WHERE section_key='summary'",
    );
    const key = await publishAsset(
      await sharp({
        create: { width: 960, height: 315, channels: 3, background: '#205747' },
      })
        .webp()
        .toBuffer(),
      true,
    );
    assets.push(key);
    await pool.query(
      "INSERT INTO banner_assets VALUES (?,'webp',960,315,1000,UTC_TIMESTAMP(6))",
      [key],
    );
    for (const [i, id] of [
      'easycoin',
      'business-invoice',
      'youth-banking',
      'identity-protect',
    ].entries()) {
      const widget = randomUUID();
      widgets.push(widget);
      await pool.query(
        'INSERT INTO feature_explorer_widgets VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))',
        [
          widget,
          i === 3 ? 'account-checking' : 'summary',
          id,
          key,
          `Explore ${id}`,
          true,
          i,
        ],
      );
    }
    await a.login();
    await b.login();
    legacy = (await a.request('/banners/current')).data;
    initial = (await a.request('/state')).data;
    await t.test(
      'filters by Summary and cycles in order once per request',
      async () => {
        const requestId = randomUUID();
        const results = await Promise.all([
          a.select(true, undefined, requestId),
          a.select(true, undefined, requestId),
        ]);
        assert.equal(results[0]!.status, 200);
        first = results[0]!.data;
        assert.equal(first.destination, 'easycoin');
        assert.deepEqual(results[1]!.data, first);
        assert.equal((await a.select()).data.destination, 'business-invoice');
        assert.equal((await a.select()).data.destination, 'youth-banking');
        assert.equal((await a.select()).data.destination, 'easycoin');
        assert.deepEqual((await a.request('/banners/current')).data, legacy);
        const [count] = await pool.query(
          "SELECT COUNT(*) AS n FROM banner_presentations WHERE user_id=? AND request_key LIKE 'explorer-summary:%'",
          [initial.user.id],
        );
        assert.equal(Number(count.n), 4);
      },
    );
    await t.test(
      'preserves a tab selection and rejects foreign ownership',
      async () => {
        assert.deepEqual((await a.select(false, first.id)).data, first);
        assert.equal((await b.select(false, first.id)).status, 403);
        assert.equal((await b.select()).data.destination, 'easycoin');
        assert.equal(
          (await a.request('/banners/current?id=' + first.id)).status,
          404,
        );
      },
    );
    await t.test(
      'feature and CTA observations keep the immutable banner association',
      async () => {
        const pageId = randomUUID();
        for (const name of [
          'banner_visible',
          'banner_clicked',
          'feature_viewed',
          'feature_cta_clicked',
        ]) {
          const event = {
            requestId: randomUUID(),
            pageId,
            selectionId: first.id,
            name,
            routeKey: name.startsWith('banner_') ? 'summary' : 'easycoin',
            observedAt: new Date().toISOString(),
          };
          assert.equal((await a.request('/interactions', event)).status, 200);
          if (name === 'feature_cta_clicked')
            assert.equal(
              (await a.request('/interactions', event)).data.accepted,
              false,
            );
        }
        const rows = await pool.query(
          'SELECT name,selection_id FROM interaction_events WHERE run_id=? AND selection_id=?',
          [initial.runId, first.id],
        );
        assert.equal(rows.length, 4);
        assert.ok(rows.every((r: any) => r.selection_id === first.id));
        const [promotions] = await pool.query(
          "SELECT COUNT(*) AS n FROM adoption_events WHERE run_id=? AND placement='banner'",
          [initial.runId],
        );
        assert.equal(Number(promotions.n), 0);
        const state = (await a.request('/state')).data;
        assert.deepEqual(state.accounts, initial.accounts);
        assert.deepEqual(state.transactions, initial.transactions);
        assert.deepEqual(state.goals, initial.goals);
      },
    );
    await t.test(
      'recovers deletion and keeps historical attribution',
      async () => {
        await pool.query('DELETE FROM feature_explorer_widgets WHERE id=?', [
          widgets[0],
        ]);
        const next = (await a.select(false, first.id)).data;
        assert.equal(next.destination, 'business-invoice');
        assert.notEqual(next.id, first.id);
        assert.equal(
          (
            await a.request('/interactions', {
              requestId: randomUUID(),
              pageId: randomUUID(),
              selectionId: first.id,
              name: 'feature_viewed',
              routeKey: 'easycoin',
              observedAt: new Date().toISOString(),
            })
          ).status,
          200,
        );
        const [snapshot] = await pool.query(
          'SELECT asset_key,destination FROM banner_presentations WHERE id=?',
          [first.id],
        );
        assert.equal(snapshot.asset_key, key);
        assert.equal(snapshot.destination, 'easycoin');
        await pool.query(
          "UPDATE feature_explorer_widgets SET enabled=FALSE WHERE section_key='summary'",
        );
        assert.equal((await a.select()).data, null);
      },
    );
  } finally {
    await cleanUsers(pool, users);
    for (const id of widgets)
      await pool.query('DELETE FROM feature_explorer_widgets WHERE id=?', [id]);
    for (const row of original)
      await pool.query(
        'UPDATE feature_explorer_widgets SET enabled=? WHERE id=?',
        [row.enabled, row.id],
      );
    for (const key of assets) {
      await pool.query('DELETE FROM banner_assets WHERE asset_key=?', [key]);
      await unlink(join(assetDirectory(true), key)).catch(() => {});
    }
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
    await pool.end();
  }
});
