import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invokeClarity } from '../apps/web/src/clarity-call.js';
import { safeCall } from '../apps/api/src/clarity-trace-contract.js';

test('call mirror preserves receiver, original values, return, order and queue replacement', () => {
  const queue: any[] = [];
  const host: { clarity: any } = {
    clarity: Object.assign(
      function (this: any, ...args: any[]) {
        assert.equal(this, host);
        queue.push(args);
        return 42;
      },
      { q: queue },
    ),
  };
  const records: any[] = [];
  const consent = { ad_Storage: 'denied', analytics_Storage: 'granted' };
  assert.equal(
    invokeClarity(host, 'consentv2', [consent], (r) => records.push(r)),
    42,
  );
  assert.equal(queue[0][1], consent);
  consent.analytics_Storage = 'denied';
  assert.equal(records[0].args[0].analytics_Storage, 'granted');
  assert.equal(records[0].sdkState, 'queued');
  const received: any[] = [];
  host.clarity = function (...args: any[]) {
    received.push(args);
    return 'loaded';
  };
  assert.equal(
    invokeClarity(host, 'event', ['banner_clicked'], (r) => records.push(r)),
    'loaded',
  );
  assert.deepEqual(received, [['event', 'banner_clicked']]);
  assert.equal(records[1].sdkState, 'loaded');
  assert.equal(records[1].outcome, 'returned');
});
test('serializer and recorder failures cannot prevent a call or replace its error', () => {
  let invoked = 0,
    omitted = 0;
  const cyclic: any = {};
  cyclic.self = cyclic;
  const host = {
    clarity: () => {
      invoked++;
      return 'ok';
    },
  };
  assert.equal(
    invokeClarity(
      host,
      'set',
      [cyclic],
      () => assert.fail(),
      () => omitted++,
    ),
    'ok',
  );
  assert.equal(omitted, 1);
  assert.equal(invoked, 1);
  assert.equal(
    invokeClarity(host, 'event', ['banner_clicked'], () => {
      throw new Error('audit');
    }),
    'ok',
  );
  const original = new Error('original');
  let outcome = '';
  assert.throws(
    () =>
      invokeClarity(
        {
          clarity: () => {
            throw original;
          },
        },
        'stop',
        [],
        (r) => {
          outcome = r.outcome;
          throw new Error('audit');
        },
      ),
    (e) => e === original,
  );
  assert.equal(outcome, 'threw');
  let absent: any;
  invokeClarity({}, 'stop', [], (r) => (absent = r));
  assert.equal(absent.outcome, 'absent');
});
test('safe contract rejects credentials, arbitrary metadata and unsupported command shapes', () => {
  assert(safeCall('event', ['banner_clicked']));
  assert(safeCall('set', ['banner', 'harbor-goals']));
  assert(!safeCall('set', ['username', 'person@example.com']));
  assert(!safeCall('identify', ['person@example.com', 'session', 'summary']));
  assert(!safeCall('event', ['banner_clicked', 'extra']));
  assert(
    !safeCall('consentv2', [
      { ad_Storage: 'granted', analytics_Storage: 'granted' },
    ]),
  );
  assert(!safeCall('unknown', []));
});

test('readable banner tags are limited to known space-feature pairs and retain legacy values', async () => {
  const { explorerBannerAnalyticsIds } =
    await import('../apps/api/src/feature-explorer-config.js');
  assert.equal(
    new Set(explorerBannerAnalyticsIds).size,
    explorerBannerAnalyticsIds.length,
  );
  for (const value of explorerBannerAnalyticsIds)
    assert(safeCall('set', ['banner', value]));
  assert(safeCall('set', ['banner', 'summary-business-invoice']));
  assert(safeCall('set', ['banner', '6af92924-6860-49e7-948c-88ad4e360547']));
  assert(safeCall('set', ['banner', 'none']));
  assert(!safeCall('set', ['banner', 'summary-missing']));
  assert(!safeCall('set', ['banner', 'unsupported-space-business-invoice']));
  assert(!safeCall('set', ['banner', 'person@example.com']));
});

test('CTA tags accept only known active-space aliases, never arbitrary identifiers or absence values', () => {
  assert(safeCall('set', ['cta-clicked', 'summary-business-invoice']));
  assert(safeCall('set', ['cta-clicked', 'summary-identity-protect']));
  assert(safeCall('set', ['cta-clicked', 'summary-youth-banking']));
  for (const value of [
    'none',
    'summary-missing',
    'account-checking-business-invoice',
    'person@example.com',
    '6af92924-6860-49e7-948c-88ad4e360547',
  ])
    assert(!safeCall('set', ['cta-clicked', value]));
});
