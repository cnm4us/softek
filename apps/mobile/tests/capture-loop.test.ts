import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CaptureLoop,
  type CapturedFile,
  type Clock,
  type Frame,
} from '../src/capture-loop';

function setup() {
  let now = 0,
    nextId = 0,
    eligible = true,
    disposals = 0;
  const timers = new Map<number, { at: number; action: () => void }>();
  const frames: Frame[] = [],
    reasons: string[] = [];
  const clock: Clock = {
    now: () => now,
    utc: () => new Date(1700000000000 + now).toISOString(),
    later: (action, ms) => {
      timers.set(++nextId, { at: now + ms, action });
      return nextId;
    },
    cancel: (timer) => {
      timers.delete(timer as number);
    },
  };
  const file = (): CapturedFile => ({
    uri: 'file:///frame.jpg',
    bytes: 1234,
    dispose: () => {
      disposals++;
    },
  });
  let capture: () => Promise<CapturedFile> = async () => file();
  const loop = new CaptureLoop(
    {
      eligible: () => eligible,
      capture: () => capture(),
      frame: (frame) => frames.push(frame),
      stopped: (r) => reasons.push(r),
    },
    clock,
    5,
  );
  return {
    loop,
    frames,
    reasons,
    timers,
    file,
    setEligible: (value: boolean) => {
      eligible = value;
    },
    setCapture: (value: typeof capture) => {
      capture = value;
    },
    disposed: () => disposals,
    async wakeEarly(time: number) {
      now = time;
      const pending = [...timers][0];
      assert.ok(pending);
      timers.delete(pending[0]);
      pending[1].action();
      await Promise.resolve();
      await Promise.resolve();
    },
    async advance(time: number) {
      now = time;
      const pending = [...timers].filter(([, t]) => t.at <= now);
      for (const [id, t] of pending) {
        timers.delete(id);
        t.action();
      }
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

test('capture waits one second, preserves timestamps and stops at the slot limit', async () => {
  const s = setup();
  s.loop.start();
  await s.advance(999);
  assert.equal(s.frames.length, 0);
  for (let ms = 1000; ms <= 5000; ms += 1000) await s.advance(ms);
  assert.deepEqual(
    s.frames.map((f) => f.sequence),
    [1, 2, 3, 4, 5],
  );
  assert.equal(s.frames[0]!.elapsedMs, 1000);
  assert.equal(s.frames[0]!.capturedAt, '2023-11-14T22:13:21.000Z');
  assert.deepEqual(s.reasons, ['Duration limit reached']);
  assert.equal(s.timers.size, 0);
});

test('fractionally early timer wakes never produce frame zero or duplicate sequences', async () => {
  const s = setup();
  s.loop.start();
  await s.wakeEarly(999.1);
  assert.equal(s.frames.length, 0);
  await s.advance(1001);
  assert.equal(s.frames.length, 1);
  await s.wakeEarly(1999.1);
  assert.equal(s.frames.length, 1);
  await s.advance(2001);
  assert.deepEqual(
    s.frames.map((f) => f.sequence),
    [1, 2],
  );
  s.loop.stop();
});

test('slow captures never overlap or burst to catch up, and skipped slots remain visible', async () => {
  const s = setup();
  let finish!: (file: CapturedFile) => void,
    calls = 0;
  s.setCapture(() => {
    calls++;
    return new Promise((r) => {
      finish = r;
    });
  });
  s.loop.start();
  await s.advance(1000);
  await s.advance(3500);
  assert.equal(calls, 1);
  finish(s.file());
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(s.frames[0]!.captureMs, 2500);
  s.setCapture(async () => {
    calls++;
    return s.file();
  });
  await s.advance(4000);
  assert.equal(calls, 2);
  assert.deepEqual(
    s.frames.map((f) => f.sequence),
    [1, 4],
  );
  s.loop.stop();
});

test('Stop discards a late result and prevents any following captures', async () => {
  const s = setup();
  let finish!: (file: CapturedFile) => void;
  s.setCapture(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  s.loop.start();
  await s.advance(1000);
  s.loop.stop();
  finish(s.file());
  await Promise.resolve();
  await Promise.resolve();
  await s.advance(5000);
  assert.equal(s.frames.length, 0);
  assert.equal(s.disposed(), 1);
  assert.equal(s.timers.size, 0);
});

test('eligibility is checked before and after capture; oversized files stop cleanly', async () => {
  const s = setup();
  s.setEligible(false);
  s.loop.start();
  await s.advance(1000);
  assert.equal(s.frames.length, 0);
  assert.deepEqual(s.reasons, ['Capture is unavailable']);
  s.setEligible(true);
  s.setCapture(async () => ({ ...s.file(), bytes: 1024 * 1024 + 1 }));
  s.loop.start();
  await s.advance(2000);
  assert.equal(s.disposed(), 1);
  assert.equal(s.frames.length, 0);
  assert.equal(s.reasons.at(-1), 'Screenshot capture failed');
});

test('capture failure does not reschedule; a fresh start cannot inherit an old frame', async () => {
  const s = setup();
  s.setCapture(async () => {
    throw new Error('native failure');
  });
  s.loop.start();
  await s.advance(1000);
  assert.equal(s.timers.size, 0);
  let finish!: (file: CapturedFile) => void;
  s.setCapture(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  s.loop.start();
  await s.advance(2000);
  s.loop.stop();
  s.loop.start();
  finish(s.file());
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(s.disposed(), 1);
  assert.equal(s.frames.length, 0);
  s.setCapture(async () => s.file());
  await s.advance(3000);
  assert.equal(s.frames.length, 1);
  s.loop.stop();
});
