import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChangeCaptureLoop, type CaptureReason } from '../src/change-capture';
import type { Clock, CapturedFile, Frame } from '../src/capture-loop';

test('change loop remains idle, coalesces rapid changes, prioritizes errors and bounds spacing', async () => {
  let now = 0,
    id = 0;
  const timers = new Map<number, { at: number; action: () => void }>(),
    frames: Frame[] = [],
    reasons: CaptureReason[] = [];
  const clock: Clock = {
    now: () => now,
    utc: () => new Date(now).toISOString(),
    later: (action, ms) => {
      timers.set(++id, { at: now + ms, action });
      return id;
    },
    cancel: (t) => {
      timers.delete(t as number);
    },
  };
  const loop = new ChangeCaptureLoop(
    {
      eligible: () => true,
      capture: async (reason) => {
        reasons.push(reason);
        return { uri: 'file:///fixture', bytes: 100, dispose: () => {} };
      },
      frame: (f) => frames.push(f),
      stopped: () => {},
    },
    clock,
  );
  const advance = async (t: number) => {
    now = t;
    for (const [key, v] of [...timers])
      if (v.at <= now) {
        timers.delete(key);
        v.action();
      }
    for (let n = 0; n < 10; n++) await Promise.resolve();
  };
  loop.start();
  await advance(100);
  await advance(10000);
  assert.equal(frames.length, 1);
  loop.request('ui');
  loop.request('scroll');
  loop.request('error');
  await advance(10100);
  assert.equal(frames.length, 2);
  assert.equal(reasons[1], 'error');
  assert.equal(loop.coalesced, 2);
  loop.request('ui');
  await advance(10200);
  assert.equal(frames.length, 2);
  await advance(10600);
  assert.equal(frames.length, 3);
  assert.deepEqual(
    frames.map((f) => f.sequence),
    [1, 2, 3],
  );
  loop.stop();
  await advance(20000);
  assert.equal(frames.length, 3);
});
test('change loop disposes a late capture across Stop and still captures the next approved generation', async () => {
  let now = 0,
    id = 0,
    disposed = 0;
  let resolve!: (f: CapturedFile) => void;
  const timers = new Map<number, { at: number; action: () => void }>(),
    frames: Frame[] = [];
  const clock: Clock = {
    now: () => now,
    utc: () => new Date(now).toISOString(),
    later: (action, ms) => {
      timers.set(++id, { at: now + ms, action });
      return id;
    },
    cancel: (t) => {
      timers.delete(t as number);
    },
  };
  let slow = true;
  const file = () => ({
    uri: 'file:///fixture',
    bytes: 100,
    dispose: () => {
      disposed++;
    },
  });
  const loop = new ChangeCaptureLoop(
    {
      eligible: () => true,
      capture: () =>
        slow
          ? new Promise((r) => {
              resolve = r;
            })
          : Promise.resolve(file()),
      frame: (f) => frames.push(f),
      stopped: () => {},
    },
    clock,
  );
  const advance = async (t: number) => {
    now = t;
    for (const [key, v] of [...timers])
      if (v.at <= now) {
        timers.delete(key);
        v.action();
      }
    for (let n = 0; n < 10; n++) await Promise.resolve();
  };
  loop.start();
  await advance(100);
  loop.stop();
  loop.start();
  slow = false;
  resolve(file());
  await advance(101);
  await advance(250);
  assert.equal(disposed, 1);
  assert.equal(frames.length, 1);
  assert.equal(frames[0].sequence, 1);
  loop.stop();
});
