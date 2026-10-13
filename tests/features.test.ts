import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { createApp } from '../apps/api/src/app.js';
import { features } from '../apps/api/src/features.js';
import { seed } from '../scripts/seed.js';
import { fixtureUser, cleanUsers } from './fixtures.js';
import { assetDirectory } from '../apps/api/src/banner-assets.js';
import {
  analyticsContext,
  applyContext,
  featureEntry,
} from '../apps/web/src/feature-context.js';
import type { State } from '../apps/web/src/api.js';
import { journeyScenario } from '../scripts/lib/journey-scenarios.js';

test('feature context clears old campaign/banner tags without loading Clarity', () => {
  const state = {
    user: { id: randomUUID() },
    runId: randomUUID(),
    visitId: randomUUID(),
    analytics: { actor: 'human' },
    variant: 'value',
  } as State;
  const entry = {
    userId: state.user.id,
    runId: state.runId,
    featureId: 'easycoin',
    selectionId: randomUUID(),
    bannerId: randomUUID(),
  };
  const tags = analyticsContext(state, '/features/easycoin', entry);
  assert.equal(tags.feature, 'easycoin');
  assert.equal(tags.service, 'easycoin');
  assert.equal(tags.campaign, 'none');
  assert.equal(tags.banner, entry.bannerId);
  assert.equal(
    analyticsContext(state, '/features/easycoin', null).banner,
    'none',
  );
  assert.equal(
    featureEntry({ ...state, runId: randomUUID() }, 'easycoin', entry),
    null,
  );
  assert.equal(featureEntry(state, 'easyvest-auto', entry), null);
  const catalog = analyticsContext(state, '/explore', entry);
  assert.equal(catalog.route, 'explore');
  assert.equal(catalog.feature, 'none');
  assert.equal(catalog.banner, 'none');
  for (const path of [
    '/accounts/checking',
    '/accounts/savings',
    '/accounts/credit-card',
  ]) {
    const tags = analyticsContext(state, path, entry);
    assert.match(tags.route, /^account-(checking|savings|credit)$/);
    assert.equal(tags.feature, 'none');
    assert.equal(tags.banner, 'none');
    assert.equal(tags.campaign, 'none');
    assert.equal(tags.service, 'banking');
  }
  const calls: unknown[][] = [];
  const stub = (command: string, ...args: any[]) => {
    calls.push([command, ...args]);
  };
  applyContext(stub, state, tags);
  applyContext(stub, state, analyticsContext(state, '/transfers', entry));
  const last = new Map(
    calls.filter((c) => c[0] === 'set').map((c) => [c[1], c[2]]),
  );
  assert.equal(last.get('feature'), 'none');
  assert.equal(last.get('campaign'), 'none');
  assert.equal(last.get('banner'), 'none');
  assert.equal(last.get('service'), 'banking');
  assert.equal(
    analyticsContext(state, '/goals', entry).campaign,
    'savings-launch',
  );
  assert.equal(
    analyticsContext(state, '/features/missing', entry).route,
    'unknown',
  );
  const scenario = {
    name: 'Feature click',
    userAlias: 'demo.alias',
    viewport: { width: 360, height: 800 },
    steps: [
      { kind: 'feature', featureId: 'easycoin' },
      { kind: 'action', choice: 'click' },
    ],
  };
  assert.ok(journeyScenario.safeParse(scenario).success);
  assert.ok(
    !journeyScenario.safeParse({
      ...scenario,
      steps: [{ kind: 'feature', featureId: 'invalid' }],
    }).success,
  );
});

test('feature observations, attribution and reports on demo_test', async (t) => {
  process.env.PUBLIC_ORIGIN = 'http://127.0.0.1:5173';
  await seed(true);
  const { app, pool } = createApp(true),
    server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const ids: string[] = [],
    assets: { id: string; asset_key: string }[] = [],
    adminTokens: string[] = [];
  const start = new Date(Date.now() - 10).toISOString();
  class Client {
    cookies = new Map<string, string>();
    csrf = '';
    browser = randomUUID();
    constructor(public automated = true) {}
    async request(
      path: string,
      body?: unknown,
      override: Record<string, string> = {},
    ) {
      const r = await fetch(base + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          ...(body instanceof FormData
            ? {}
            : { 'Content-Type': 'application/json' }),
          Origin: process.env.PUBLIC_ORIGIN!,
          'X-Browser-Session': this.browser,
          'X-CSRF-Token': this.csrf,
          Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
          ...(this.automated
            ? { 'X-Demo-Automation': process.env.AUTOMATION_SECRET! }
            : {}),
          ...override,
        },
        ...(body === undefined
          ? {}
          : { body: body instanceof FormData ? body : JSON.stringify(body) }),
      });
      for (const raw of r.headers.getSetCookie()) {
        const [k, v] = raw.split(';')[0]!.split('=');
        this.cookies.set(k!, v!);
        if (k === 'softek_admin') adminTokens.push(v!);
      }
      const data = await r.json();
      return { status: r.status, data };
    }
    async login(user: Awaited<ReturnType<typeof fixtureUser>>) {
      const r = await this.request('/auth/login', {
        username: user.username,
        password: user.password,
        requestId: randomUUID(),
      });
      assert.equal(r.status, 200);
      this.csrf = r.data.csrf;
      return r.data;
    }
    async state() {
      const r = await this.request('/state');
      assert.equal(r.status, 200);
      return r.data;
    }
    event(
      name = 'feature_viewed',
      routeKey = 'easycoin',
      pageId = randomUUID(),
      selectionId?: string,
    ) {
      return {
        name,
        routeKey,
        pageId,
        requestId: randomUUID(),
        observedAt: new Date().toISOString(),
        ...(selectionId ? { selectionId } : {}),
      };
    }
  }
  const a = new Client(),
    b = new Client(false),
    admin = new Client(),
    anon = new Client();
  try {
    const logged = await admin.request('/admin/login', {
      password: process.env.DEMO_ADMIN_SECRET,
    });
    assert.equal(logged.status, 200);
    admin.csrf = logged.data.csrf;
    const ua = await fixtureUser(pool),
      ub = await fixtureUser(pool, 'jamie', 'human');
    ids.push(ua.id, ub.id);
    await a.login(ua);
    await b.login(ub);
    const original = await a.state();
    await t.test(
      'authentication, strict IDs/actions, CSRF and observed times',
      async () => {
        assert.equal(
          (await anon.request('/interactions', anon.event())).status,
          403,
        );
        assert.equal((await a.request('/admin/feature-activity')).status, 401);
        assert.equal(
          (
            await a.request('/interactions', a.event(), {
              'X-CSRF-Token': 'wrong',
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await a.request(
              '/interactions',
              a.event('feature_viewed', 'unknown'),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await a.request(
              '/interactions',
              a.event('feature_viewed', 'summary'),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await a.request(
              '/interactions',
              a.event('placeholder_action', 'easycoin'),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await a.request('/interactions', {
              ...a.event(),
              observedAt: '2000-01-01T00:00:00.000Z',
            })
          ).status,
          400,
        );
        assert.equal(
          (await a.request('/interactions', { ...a.event(), actor: 'human' }))
            .status,
          400,
        );
      },
    );
    await t.test(
      'all features accept independent views/CTAs and retries preserve banking and savings milestones',
      async () => {
        const before = await pool.query(
          'SELECT name FROM adoption_events WHERE run_id=? ORDER BY name',
          [original.runId],
        );
        for (const f of features) {
          const pageId = randomUUID(),
            view = a.event('feature_viewed', f.id, pageId),
            click = a.event('feature_cta_clicked', f.id, pageId);
          assert.equal(
            (await a.request('/interactions', view)).data.accepted,
            true,
          );
          assert.equal(
            (await a.request('/interactions', view)).data.accepted,
            false,
          );
          const simultaneous = await Promise.all([
            a.request('/interactions', click),
            a.request('/interactions', { ...click, requestId: randomUUID() }),
          ]);
          assert.deepEqual(simultaneous.map((r) => r.data.accepted).sort(), [
            false,
            true,
          ]);
          assert.ok(
            simultaneous.every(
              (r) => r.data.acknowledged && r.data.events.length === 0,
            ),
          );
        }
        const current = await a.state();
        assert.equal(current.runId, original.runId);
        assert.deepEqual(current.accounts, original.accounts);
        assert.deepEqual(current.goals, original.goals);
        assert.equal(current.enrolled, original.enrolled);
        assert.deepEqual(
          await pool.query(
            'SELECT name FROM adoption_events WHERE run_id=? ORDER BY name',
            [original.runId],
          ),
          before,
        );
        const [presentations] = await pool.query(
          'SELECT COUNT(*) AS n FROM banner_presentations WHERE run_id=?',
          [original.runId],
        );
        assert.equal(Number(presentations.n), 1);
      },
    );
    let selected: any;
    await t.test(
      'banner destinations, immutable attribution, ownership and changed retry context',
      async () => {
        const options = await admin.request('/admin/banners');
        for (const f of features)
          assert.ok(
            options.data.destinations.some(
              (d: any) => d.key === f.id && d.href === f.href,
            ),
          );
        const buffer = await sharp({
          create: {
            width: 1200,
            height: 400,
            channels: 3,
            background: '#205747',
          },
        })
          .png()
          .toBuffer();
        const form = new FormData();
        form.set(
          'image',
          new Blob([new Uint8Array(buffer)]),
          'test-feature.png',
        );
        form.set('title', 'Test feature');
        form.set('altText', 'Explore crypto');
        form.set('destination', 'easycoin');
        form.set('sortOrder', '999');
        const uploaded = await admin.request('/admin/banners/upload', form);
        assert.equal(uploaded.status, 201);
        const [row] = await pool.query(
          'SELECT id,asset_key FROM demo_banners WHERE id=?',
          [uploaded.data.id],
        );
        assets.push(row);
        assert.equal(
          (
            await admin.request(`/admin/banners/${row.id}/settings`, {
              title: 'Test feature',
              altText: 'Explore crypto',
              destination: 'easycoin',
              sortOrder: 999,
              enabled: true,
              campaignId: 'savings-launch',
            })
          ).status,
          400,
        );
        await pool.query(
          "UPDATE banner_rotation SET last_banner_id='harbor-cards' WHERE user_id=?",
          [ua.id],
        );
        selected = (
          await a.request('/banners/select', {
            reason: 'refresh',
            requestId: randomUUID(),
          })
        ).data;
        assert.equal(selected.bannerId, row.id);
        const e = a.event(
          'feature_viewed',
          'easycoin',
          randomUUID(),
          selected.id,
        );
        assert.equal((await a.request('/interactions', e)).status, 200);
        assert.equal(
          (await a.request('/interactions', { ...e, selectionId: undefined }))
            .status,
          409,
        );
        assert.equal(
          (
            await b.request(
              '/interactions',
              b.event('feature_viewed', 'easycoin', randomUUID(), selected.id),
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await a.request(
              '/interactions',
              a.event('feature_viewed', 'bnpl', randomUUID(), selected.id),
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await a.request(
              '/interactions',
              a.event('page_view', 'easycoin', randomUUID(), selected.id),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await admin.request(`/admin/banners/${row.id}/settings`, {
              title: 'Changed feature',
              altText: 'Explore investing',
              destination: 'easyvest-auto',
              sortOrder: 999,
              enabled: false,
              campaignId: null,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await a.request(
              '/interactions',
              a.event('feature_cta_clicked', 'easycoin', e.pageId, selected.id),
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await a.request(
              '/interactions',
              a.event('feature_viewed', 'easycoin', randomUUID()),
            )
          ).status,
          200,
        );
      },
    );
    await t.test(
      'report separates raw events/users/runs, actor, cohort and cutoff',
      async () => {
        await b.request('/interactions', b.event('feature_viewed', 'easycoin'));
        const query = `?start=${encodeURIComponent(start)}`;
        const human = (
          await admin.request('/admin/feature-activity' + query)
        ).data.features.find((f: any) => f.id === 'easycoin');
        assert.equal(human.views, 1);
        assert.equal(human.clicks, 0);
        const auto = (
          await admin.request(
            '/admin/feature-activity' + query + '&actor=automation',
          )
        ).data.features.find((f: any) => f.id === 'easycoin');
        assert.equal(auto.views, 3);
        assert.equal(auto.viewers, 1);
        assert.equal(auto.viewedRuns, 1);
        assert.equal(auto.clicks, 2);
        assert.equal(auto.bannerViews, 1);
        assert.equal(auto.bannerClicks, 1);
        const all = (
          await admin.request('/admin/feature-activity' + query + '&actor=all')
        ).data.features.find((f: any) => f.id === 'easycoin');
        assert.equal(all.views, 4);
        assert.equal(all.viewers, 2);
        const baseline = (
          await admin.request(
            '/admin/feature-activity' + query + '&actor=all&variant=baseline',
          )
        ).data.features;
        assert.ok(baseline.every((f: any) => f.views === 0));
        const cutoff = new Date().toISOString();
        await new Promise((resolve) => setTimeout(resolve, 10));
        await a.request('/interactions', a.event('feature_viewed', 'easycoin'));
        const bounded = (
          await admin.request(
            '/admin/feature-activity' +
              query +
              '&actor=all&cutoff=' +
              encodeURIComponent(cutoff),
          )
        ).data.features.find((f: any) => f.id === 'easycoin');
        assert.equal(bounded.views, 4);
        assert.equal(
          (
            await admin.request(
              '/admin/feature-activity?start=2030-01-01T00:00:00.000Z&end=2000-01-01T00:00:00.000Z',
            )
          ).status,
          400,
        );
      },
    );
    await t.test(
      'reset retains feature history and rejects prior-run banner attribution',
      async () => {
        assert.equal((await a.request('/reset', {})).status, 200);
        assert.equal(
          (
            await a.request(
              '/interactions',
              a.event('feature_viewed', 'easycoin', randomUUID(), selected.id),
            )
          ).status,
          403,
        );
        await a.request('/interactions', a.event('feature_viewed', 'easycoin'));
        const stats = (
          await admin.request(
            '/admin/feature-activity?actor=automation&start=' +
              encodeURIComponent(start),
          )
        ).data.features.find((f: any) => f.id === 'easycoin');
        assert.equal(stats.viewers, 1);
        assert.equal(stats.viewedRuns, 2);
        assert.equal(stats.views, 5);
        const rows = (
          await admin.request('/admin/interactions?userId=' + ua.id)
        ).data;
        assert.ok(
          rows.some(
            (row: any) =>
              row.runId === original.runId &&
              row.name === 'feature_cta_clicked',
          ),
        );
      },
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await cleanUsers(pool, ids);
    for (const row of assets) {
      await pool.query('DELETE FROM demo_banners WHERE id=?', [row.id]);
      await pool.query('DELETE FROM banner_assets WHERE asset_key=?', [
        row.asset_key,
      ]);
      await unlink(join(assetDirectory(true), row.asset_key)).catch(() => {});
    }
    for (const raw of adminTokens)
      await pool.query('DELETE FROM admin_sessions WHERE token_hash=?', [
        createHash('sha256').update(raw).digest('hex'),
      ]);
    await pool.end();
  }
});
