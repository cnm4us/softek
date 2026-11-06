import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  OverlayComparison,
  type OverlaySample,
} from '../src/overlay-comparison';
import type { Clock } from '../src/capture-loop';
import type { OverlayImage } from '../src/overlay-capture';

function setup() {
  let now = 0,
    timerId = 0;
  const timers = new Map<number, { at: number; action: () => void }>();
  const samples: OverlaySample[] = [],
    methods: string[] = [],
    disposed: string[] = [],
    stopped: string[] = [];
  const clock: Clock = {
    now: () => now,
    utc: () => new Date(now).toISOString(),
    later: (action, ms) => {
      timers.set(++timerId, { at: now + ms, action });
      return timerId;
    },
    cancel: (t) => {
      timers.delete(t as number);
    },
  };
  const port = {
    allowed: true,
    capture: async (
      method: OverlaySample['method'],
    ): Promise<OverlayImage> => ({
      uri: 'file:///fixture',
      bytes: 100,
      width: 720,
      height: 1000,
      dispose: () => {
        disposed.push(method);
      },
    }),
  };
  const loop = new OverlayComparison(
    {
      eligible: () => port.allowed,
      capture: async (m) => {
        methods.push(m);
        return port.capture(m);
      },
      sample: (s) => samples.push(s),
      stopped: (r) => stopped.push(r),
    },
    clock,
  );
  const advance = async (at: number) => {
    now = at;
    for (const [id, t] of [...timers])
      if (t.at <= now) {
        timers.delete(id);
        t.action();
      }
    for (let n = 0; n < 15; n++) await Promise.resolve();
  };
  return { loop, port, samples, methods, disposed, stopped, advance };
}

test('local comparison coalesces invalid events, captures one sequential pair and stays idle', async () => {
  const s = setup();
  s.loop.start();
  s.loop.request('invalid');
  s.loop.request('viewport');
  await s.advance(349);
  assert.equal(s.methods.length, 0);
  await s.advance(350);
  assert.deepEqual(s.methods, ['View baseline', 'Window candidate']);
  assert.deepEqual(
    s.samples.map((x) => x.reason),
    ['invalid', 'invalid'],
  );
  await s.advance(10000);
  assert.equal(s.samples.length, 2);
  s.loop.request('ui');
  await s.advance(10350);
  assert.equal(s.samples.length, 4);
  await s.advance(60000);
  assert.equal(s.stopped.length, 1);
  assert.equal(s.samples.length, 4);
});
test('Stop cancels delayed captures and discards a late baseline without invoking candidate', async () => {
  const s = setup();
  let finish!: (i: OverlayImage) => void;
  s.port.capture = () =>
    new Promise((r) => {
      finish = r;
    });
  s.loop.start();
  await s.advance(350);
  s.loop.stop();
  finish({
    uri: 'file:///late',
    bytes: 100,
    width: 720,
    height: 1000,
    dispose: () => {
      s.disposed.push('late');
    },
  });
  await s.advance(400);
  assert.deepEqual(s.methods, ['View baseline']);
  assert.equal(s.samples.length, 0);
  assert.deepEqual(s.disposed, ['late']);
  s.loop.start();
  s.loop.stop();
  await s.advance(1000);
  assert.equal(s.methods.length, 1);
});
test('eligibility loss after baseline disposes it and prevents candidate capture', async () => {
  const s = setup();
  s.port.capture = async () => {
    s.port.allowed = false;
    return {
      uri: 'file:///fixture',
      bytes: 100,
      width: 720,
      height: 1000,
      dispose: () => s.disposed.push('baseline'),
    };
  };
  s.loop.start();
  await s.advance(350);
  assert.equal(s.samples.length, 0);
  assert.equal(s.methods.length, 1);
  assert.deepEqual(s.disposed, ['baseline']);
  assert.equal(s.stopped.length, 1);
});
test('candidate failure remains visible beside successful baseline without retry bursts', async () => {
  const s = setup();
  const original = s.port.capture;
  s.port.capture = (m) =>
    m === 'Window candidate'
      ? Promise.reject(new Error('Candidate native capture failed'))
      : original(m);
  s.loop.start();
  await s.advance(350);
  assert.ok(s.samples[0].image);
  assert.equal(s.samples[1].error, 'Candidate native capture failed');
  await s.advance(10000);
  assert.equal(s.methods.length, 2);
});
test('pending changes do not overlap in-flight pairs and a restart recovers after a late result', async () => {
  const s = setup();
  let finish!: (i: OverlayImage) => void;
  const original = s.port.capture;
  s.port.capture = () =>
    new Promise((r) => {
      finish = r;
    });
  s.loop.start();
  await s.advance(350);
  s.loop.request('invalid');
  await s.advance(1000);
  assert.equal(s.methods.length, 1);
  s.loop.stop();
  s.loop.start();
  s.port.capture = original;
  finish({
    uri: 'file:///old',
    bytes: 100,
    width: 720,
    height: 1000,
    dispose: () => s.disposed.push('old'),
  });
  await s.advance(1100);
  assert.equal(s.samples.length, 0);
  await s.advance(1450);
  assert.equal(s.samples.length, 2);
  assert.deepEqual(s.disposed, ['old']);
});
