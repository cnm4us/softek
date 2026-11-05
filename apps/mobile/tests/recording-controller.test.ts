import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RecordingController } from '../src/recording-controller';
import type { CapturedFile, Clock, Frame } from '../src/capture-loop';

const site = 'https://demo.bawebtech.com/';
const recordingId = '01234567-89ab-4cde-8fab-0123456789ab';
function setup() {
  let now = 0,
    timerId = 0,
    disposed = 0,
    captures = 0;
  const timers = new Map<number, { action: () => void; at: number }>();
  const statuses: Record<string, any>[] = [],
    requests: { endpoint: string; body: any }[] = [];
  const clock: Clock = {
    now: () => now,
    utc: () => new Date(1700000000000 + now).toISOString(),
    later: (action, ms) => {
      timers.set(++timerId, { action, at: now + ms });
      return timerId;
    },
    cancel: (id) => {
      timers.delete(id as number);
    },
  };
  const file = (): CapturedFile => ({
    uri: 'file:///fixture.jpg',
    bytes: 1234,
    dispose: () => {
      disposed++;
    },
  });
  let capture = async () => {
    captures++;
    return file();
  };
  let upload = async (_frame: Frame) => ({ ok: true, status: 201 });
  const controller = new RecordingController(
    {
      capture: () => capture(),
      request: async (_session, endpoint, body) => {
        requests.push({ endpoint, body });
        return endpoint === 'frames'
          ? upload(body as Frame)
          : { ok: true, status: 200 };
      },
      inject: (script) => {
        const m = JSON.parse(script.match(/receive\((.*)\);true;/s)![1]!);
        if (m.type === 'probe')
          native({
            type: 'probe',
            requestId: m.requestId,
            allowed: true,
            generation: 1,
          });
        else statuses.push(m);
      },
    },
    clock,
  );
  function native(message: Record<string, unknown>, source = site) {
    controller.receive(
      source,
      JSON.stringify({
        ...message,
        protocol: 'softek-capture-v1',
        documentId: controller.documentId,
      }),
    );
  }
  const flush = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  };
  return {
    controller,
    statuses,
    requests,
    native,
    file,
    flush,
    setCapture: (f: typeof capture) => {
      capture = f;
    },
    setUpload: (f: typeof upload) => {
      upload = f;
    },
    disposed: () => disposed,
    captures: () => captures,
    start() {
      native({ type: 'hello' });
      native({ type: 'eligibility', allowed: true, generation: 1 });
      native({
        type: 'start',
        recordingId,
        credential: 'a'.repeat(64),
        generation: 1,
      });
    },
    async advance(ms: number) {
      now = ms;
      for (const [id, t] of [...timers])
        if (t.at <= now) {
          timers.delete(id);
          t.action();
        }
      await flush();
    },
  };
}
test('native recorder starts only after a same-document handshake; external/stale messages cannot start capture', async () => {
  const s = setup();
  s.native({ type: 'hello' }, 'https://example.com/');
  s.native({ type: 'eligibility', allowed: true, generation: 1 });
  s.native({
    type: 'start',
    recordingId,
    credential: 'a'.repeat(64),
    generation: 1,
  });
  await s.advance(1000);
  assert.equal(s.captures(), 0);
  s.start();
  await s.advance(2000);
  assert.equal(s.captures(), 1);
  const old = s.controller.documentId;
  s.controller.navigate();
  assert.notEqual(s.controller.documentId, old);
  s.controller.receive(
    site,
    JSON.stringify({
      protocol: 'softek-capture-v1',
      documentId: old,
      type: 'eligibility',
      allowed: true,
      generation: 1,
    }),
  );
  await s.flush();
  await s.advance(4000);
  assert.equal(s.captures(), 1);
  await s.controller.stop();
  s.controller.dispose();
});
test('approved native snapshots upload in order; Stop drains, disposes and finalizes without further capture', async () => {
  const s = setup();
  s.start();
  await s.advance(1000);
  await s.advance(2000);
  assert.deepEqual(
    s.requests
      .filter((r) => r.endpoint === 'frames')
      .map((r) => r.body.sequence),
    [1, 2],
  );
  assert.equal(s.disposed(), 2);
  await s.controller.stop();
  await s.advance(5000);
  assert.equal(s.captures(), 2);
  assert.deepEqual(
    s.requests.filter((r) => r.endpoint === 'stop').map((r) => r.body.phase),
    ['drain', 'finish'],
  );
  assert.equal(s.statuses.at(-1)?.phase, 'stopped');
  assert.equal(s.statuses.at(-1)?.uploaded, 2);
  s.controller.dispose();
});
test('logout/lifecycle changes discard an in-progress screenshot and never resume automatically', async () => {
  const s = setup();
  let finish!: (f: CapturedFile) => void;
  s.setCapture(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  s.start();
  await s.advance(1000);
  s.controller.appState(false);
  finish(s.file());
  await s.flush();
  s.controller.appState(true);
  await s.advance(5000);
  assert.equal(s.disposed(), 1);
  assert.equal(s.requests.filter((r) => r.endpoint === 'frames').length, 0);
  s.controller.dispose();
});
test('bounded queue stops at ten pending frames; an API rejection is terminal rather than an unbounded retry', async () => {
  const s = setup();
  let finish!: (r: { ok: boolean; status: number }) => void;
  s.setUpload(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  s.start();
  for (let ms = 1000; ms <= 11_000; ms += 1000) await s.advance(ms);
  assert.ok(s.statuses.some((m) => m.phase === 'uploading'));
  assert.equal(s.disposed(), 1);
  finish({ ok: false, status: 401 });
  await s.flush();
  assert.equal(s.requests.filter((r) => r.endpoint === 'frames').length, 1);
  assert.equal(s.disposed(), 11);
  assert.equal(s.statuses.at(-1)?.phase, 'error');
  s.controller.dispose();
});
