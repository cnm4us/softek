import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import type { State } from '../apps/web/src/api.js';
import {
  analyticsContext,
  createContextUpdater,
} from '../apps/web/src/feature-context.js';

const state = () =>
  ({
    user: { id: randomUUID() },
    runId: randomUUID(),
    visitId: randomUUID(),
    analytics: { actor: 'human' },
    variant: 'value',
  }) as State;

test('unchanged context emits once; startup queue replacement keeps already applied context', () => {
  const s = state(),
    updater = createContextUpdater(),
    calls: string[][] = [];
  const invoke = (command: string, ...args: string[]) => {
    calls.push([command, ...args]);
  };
  const tags = analyticsContext(s, '/', null);
  updater.apply(invoke, s, tags);
  assert.equal(calls.length, 10);
  assert.equal(calls[0]![0], 'identify');
  updater.apply(invoke, { ...s }, { ...tags });
  // The hosted SDK drains the startup queue; replacing the callable alone is not a restart.
  updater.apply((...args) => invoke(...args), s, tags);
  assert.equal(calls.length, 10);
});

test('banner load updates only feature/service/banner; navigation clears them and return restores them', () => {
  const s = state(),
    updater = createContextUpdater(),
    calls: string[][] = [];
  const invoke = (command: string, ...args: string[]) => {
    calls.push([command, ...args]);
  };
  updater.apply(invoke, s, analyticsContext(s, '/', null));
  calls.length = 0;
  const banner = {
    bannerId: randomUUID(),
    destination: 'identity-protect',
    campaignId: null,
  };
  const shown = analyticsContext(s, '/', null, banner);
  updater.apply(invoke, s, shown);
  assert.deepEqual(calls, [
    ['set', 'feature', 'identity-protect'],
    ['set', 'service', 'identity-protect'],
    ['set', 'banner', banner.bannerId],
  ]);
  calls.length = 0;
  updater.apply(invoke, s, analyticsContext(s, '/accounts/checking', null));
  assert.deepEqual(calls, [
    ['identify', s.user.id, s.visitId, 'account-checking'],
    ['set', 'route', 'account-checking'],
    ['set', 'feature', 'none'],
    ['set', 'service', 'banking'],
    ['set', 'banner', 'none'],
  ]);
  calls.length = 0;
  updater.apply(invoke, s, shown);
  assert.equal(calls.length, 5);
  assert.deepEqual(calls.at(-1), ['set', 'banner', banner.bannerId]);
  updater.apply(invoke, s, shown);
  assert.equal(calls.length, 5);
});

test('new customer/run/visit and explicit collection restart emit a complete fresh context', () => {
  for (const change of [
    (s: State) => ({ ...s, user: { ...s.user, id: randomUUID() } }),
    (s: State) => ({ ...s, runId: randomUUID() }),
    (s: State) => ({ ...s, visitId: randomUUID() }),
  ]) {
    const s = state(),
      updater = createContextUpdater(),
      calls: string[][] = [];
    const invoke = (command: string, ...args: string[]) => {
      calls.push([command, ...args]);
    };
    updater.apply(invoke, s, analyticsContext(s, '/', null));
    const next = change(s);
    updater.apply(invoke, next, analyticsContext(next, '/', null));
    assert.equal(calls.length, 20);
    updater.reset();
    updater.apply(invoke, next, analyticsContext(next, '/', null));
    assert.equal(calls.length, 30);
  }
});

test('a throwing call is retried, preserving its exception and previously successful context', () => {
  const s = state(),
    updater = createContextUpdater(),
    calls: string[][] = [],
    error = new Error('bounded test error');
  let fail = true;
  const invoke = (command: string, ...args: string[]) => {
    calls.push([command, ...args]);
    if (args[0] === 'institution' && fail) throw error;
  };
  const tags = analyticsContext(s, '/', null);
  assert.throws(
    () => updater.apply(invoke, s, tags),
    (e) => e === error,
  );
  assert.equal(calls.length, 3);
  fail = false;
  updater.apply(invoke, s, tags);
  assert.equal(calls.filter((c) => c[0] === 'identify').length, 1);
  assert.equal(calls.filter((c) => c[1] === 'institution').length, 2);
  assert.equal(calls.length, 11);
  updater.apply(invoke, s, tags);
  assert.equal(calls.length, 11);
});

test('pending Summary omits dependent tags; ready image supplies them once and account navigation clears them', () => {
  const s = state(),
    updater = createContextUpdater(),
    calls: string[][] = [];
  const invoke = (command: string, ...args: string[]) => {
    calls.push([command, ...args]);
  };
  const pending = analyticsContext(s, '/', null, null, true);
  assert.deepEqual(Object.keys(pending).sort(), [
    'actor',
    'institution',
    'route',
    'variant',
  ]);
  updater.apply(invoke, s, pending);
  assert.equal(calls.length, 6);
  updater.apply(invoke, s, pending);
  assert.equal(calls.length, 6);
  const banner = {
    bannerId: randomUUID(),
    destination: 'business-invoice',
    campaignId: null,
  };
  updater.apply(invoke, s, analyticsContext(s, '/', null, banner));
  assert.equal(calls.length, 10);
  assert(
    !calls.some(
      (c) =>
        c[0] === 'set' &&
        ['feature', 'banner'].includes(c[1]!) &&
        c[2] === 'none',
    ),
  );
  assert(
    !calls.some(
      (c) => c[0] === 'set' && c[1] === 'service' && c[2] === 'banking',
    ),
  );
  updater.apply(invoke, s, analyticsContext(s, '/', null, banner));
  assert.equal(calls.length, 10);
  updater.apply(invoke, s, analyticsContext(s, '/accounts/checking', null));
  assert.deepEqual(calls.at(-1), ['set', 'banner', 'none']);
});

test('Summary readiness distinguishes pending/ready/empty/failed and rejects another owner', async () => {
  const {
    clearRenderedSummaryBanner,
    setRenderedSummaryBanner,
    renderedSummaryBanner,
    summaryBannerPending,
  } = await import('../apps/web/src/summary-explorer-context.js');
  const s = state();
  clearRenderedSummaryBanner();
  assert.equal(summaryBannerPending(s), true);
  setRenderedSummaryBanner(s, null, false);
  assert.equal(summaryBannerPending(s), true);
  assert.equal(renderedSummaryBanner(s), null);
  const banner = {
    id: randomUUID(),
    bannerId: randomUUID(),
    imageUrl: '/example.webp',
  } as any;
  setRenderedSummaryBanner(s, banner);
  assert.equal(summaryBannerPending(s), false);
  assert.equal(renderedSummaryBanner(s), banner);
  assert.equal(summaryBannerPending(state()), true);
  // A resolved empty slot or failed image is genuinely absent, rather than pending.
  setRenderedSummaryBanner(s, null, true);
  assert.equal(summaryBannerPending(s), false);
  assert.equal(renderedSummaryBanner(s), null);
  const empty = analyticsContext(
    s,
    '/',
    null,
    renderedSummaryBanner(s),
    summaryBannerPending(s),
  );
  assert.equal(empty.banner, 'none');
  assert.equal(empty.feature, 'none');
  assert.equal(empty.service, 'banking');
  clearRenderedSummaryBanner();
});

test('readable banner value carries to its owned landing entry while internal attribution stays UUID-based', async () => {
  const { featureEntry } = await import('../apps/web/src/feature-context.js');
  const s = state(),
    uuid = randomUUID();
  const banner = {
    bannerId: uuid,
    analyticsId: 'summary-business-invoice',
    destination: 'business-invoice',
    campaignId: null,
  };
  assert.equal(
    analyticsContext(s, '/', null, banner).banner,
    'summary-business-invoice',
  );
  const entry = {
    userId: s.user.id,
    runId: s.runId,
    featureId: 'business-invoice',
    selectionId: randomUUID(),
    bannerId: uuid,
    bannerAnalyticsId: banner.analyticsId,
  };
  const owned = featureEntry(s, 'business-invoice', entry);
  assert(owned);
  assert.equal(owned.bannerId, uuid);
  assert.equal(owned.selectionId, entry.selectionId);
  assert.equal(
    analyticsContext(s, '/features/business-invoice', entry).banner,
    banner.analyticsId,
  );
  assert.equal(
    analyticsContext(s, '/features/business-invoice', null).banner,
    'none',
  );
  assert.equal(
    featureEntry(s, 'business-invoice', {
      ...entry,
      bannerAnalyticsId: 'summary-identity-protect',
    }),
    null,
  );
  assert.equal(
    featureEntry(
      { ...s, user: { ...s.user, id: randomUUID() } },
      'business-invoice',
      entry,
    ),
    null,
  );
  const { bannerAnalyticsId, ...legacy } = entry;
  assert.equal(
    analyticsContext(s, '/features/business-invoice', legacy).banner,
    uuid,
  );
});
