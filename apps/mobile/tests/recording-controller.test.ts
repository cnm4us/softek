import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RecordingController } from '../src/recording-controller';
import type { CapturedFile, Clock, Frame } from '../src/capture-loop';

const site = 'https://demo.bawebtech.com/';
const recordingId = '01234567-89ab-4cde-8fab-0123456789ab';
const viewport = {
  route: '/',
  width: 440,
  height: 812,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  scrollX: 0,
  scrollY: 0,
  container: 'document',
  containerX: 0,
  containerY: 0,
};
const pageWeb = {
  version: 1 as const,
  visit: 1,
  layout: 1,
  documentWidth: 440,
  documentHeight: 2000,
  clientWidth: 440,
  clientHeight: 812,
  scrollX: 0,
  scrollY: 0,
  fontSize: 16,
  lineHeight: 24,
  layer: 'document' as const,
  top: true,
  bottom: false,
};
function setup(windowCapture = false, pageContext = false) {
  let now = 0,
    timerId = 0,
    disposed = 0,
    captures = 0,
    candidates = 0;
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
      pageContext,
      capture: () => capture(),
      ...(windowCapture
        ? {
            windowCapture: async () => {
              candidates++;
              return {
                ...(await capture()),
                capturedMonotonicMs: clock.now(),
                ...(pageContext
                  ? {
                      imageBounds: {
                        width: 720,
                        height: 1327,
                        valid: { x: 0, y: 0, width: 720, height: 700 },
                        excluded: [{ x: 0, y: 700, width: 720, height: 627 }],
                      },
                    }
                  : {}),
                surface: {
                  method: 'window-crop-v1' as const,
                  maskedKeyboard: true,
                  anchoredPopover: true,
                },
              };
            },
          }
        : {}),
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
            geometry: viewport,
            ...(pageContext ? { page: pageWeb } : {}),
          });
        else if (m.type === 'clock')
          native({
            type: 'clock-reply',
            requestId: m.requestId,
            generation: 1,
            webNow: now + 50000,
            geometry: viewport,
            ...(pageContext ? { page: pageWeb } : {}),
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
    candidates: () => candidates,
    start(policy = 'periodic-v1', captureMethod?: string) {
      native({ type: 'hello' });
      native({ type: 'eligibility', allowed: true, generation: 1 });
      native({
        type: 'start',
        recordingId,
        credential: 'a'.repeat(64),
        generation: 1,
        policy,
        ...(captureMethod ? { captureMethod } : {}),
        ...(pageContext ? { pageContextVersion: 1 } : {}),
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

test('change mode calibrates separate clocks, captures on changes only and drains gesture metadata at Stop', async () => {
  const s = setup();
  s.start('changes-v2');
  await s.advance(100);
  assert.equal(s.captures(), 1);
  const first = s.requests.find((r) => r.endpoint === 'frames')!.body;
  assert.equal(first.sequence, 1);
  assert.equal(first.elapsedMs, 100);
  assert.equal(first.context.reason, 'start');
  await s.advance(10000);
  assert.equal(s.captures(), 1);
  s.native({
    type: 'interaction',
    generation: 1,
    kind: 'tap',
    x: 0.2,
    y: 0.3,
    capture: false,
    webNow: 60000,
    geometry: viewport,
  });
  s.native({
    type: 'interaction',
    generation: 1,
    kind: 'ui',
    capture: true,
    webNow: 60000,
    geometry: viewport,
  });
  await s.advance(10100);
  assert.equal(s.captures(), 2);
  await s.controller.stop();
  const batch = s.requests.find((r) => r.endpoint === 'events')!.body;
  assert.equal(batch.events.length, 2);
  assert.equal(batch.events[0].elapsedMs, 10000);
  assert.equal(batch.events[0].x, 0.2);
  await s.advance(20000);
  assert.equal(s.captures(), 2);
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

test('window capture is opt-in, advertises its capability and stamps immutable provenance', async () => {
  const baseline = setup(true);
  assert.ok(baseline.controller.bootstrap().includes('window-crop-v1'));
  baseline.start('changes-v2');
  await baseline.advance(100);
  assert.equal(baseline.candidates(), 0);
  await baseline.controller.stop();
  const s = setup(true);
  s.start('changes-v2', 'window-crop-v1');
  await s.advance(100);
  assert.equal(s.candidates(), 1);
  const frame = s.requests.find((r) => r.endpoint === 'frames')!.body as Frame;
  assert.equal(frame.context?.surface?.method, 'window-crop-v1');
  assert.equal(frame.context?.surface?.maskedKeyboard, true);
  s.native({
    type: 'start',
    recordingId,
    credential: 'a'.repeat(64),
    generation: 1,
    policy: 'changes-v2',
    captureMethod: 'view-v1',
  });
  await s.advance(1000);
  assert.equal(s.candidates(), 1);
  await s.controller.stop();
  const unavailable = setup();
  unavailable.start('changes-v2', 'window-crop-v1');
  await unavailable.advance(100);
  assert.equal(unavailable.captures(), 0);
  assert.ok(unavailable.statuses.some((x) => x.phase === 'error'));
  await unavailable.controller.stop();
});
test('Stop during a window validation settle delay prevents a later native screenshot', async () => {
  const s = setup(true);
  s.start('changes-v2', 'window-crop-v1');
  await s.advance(100);
  s.native({
    type: 'interaction',
    kind: 'error',
    capture: true,
    webNow: 50100,
    geometry: viewport,
    generation: 1,
  });
  await s.advance(500);
  await s.controller.stop();
  await s.advance(800);
  assert.equal(s.candidates(), 1);
});

test('window validation capture settles for 350 ms and subsequent taps retain 500 ms spacing', async () => {
  const s = setup(true);
  s.start('changes-v2', 'window-crop-v1');
  await s.advance(100);
  await s.advance(1000);
  s.native({
    type: 'interaction',
    kind: 'error',
    capture: true,
    webNow: 51000,
    geometry: viewport,
    generation: 1,
  });
  await s.advance(1349);
  assert.equal(s.candidates(), 1);
  await s.advance(1350);
  assert.equal(s.candidates(), 2);
  s.native({
    type: 'interaction',
    kind: 'tap',
    capture: false,
    webNow: 51350,
    geometry: viewport,
    generation: 1,
    x: 0.2,
    y: 0.3,
  });
  await s.advance(1849);
  assert.equal(s.candidates(), 2);
  await s.advance(1850);
  assert.equal(s.candidates(), 3);
  const times = s.requests
    .filter((r) => r.endpoint === 'frames')
    .map((r) => r.body.elapsedMs);
  assert.deepEqual(times, [100, 1350, 1850]);
  await s.controller.stop();
});

test('page-reference capability stamps capture-time page identity and exact native bounds without changing baseline sessions', async () => {
  const baseline = setup(true);
  assert.equal(
    baseline.controller.bootstrap().includes('page-context-v1'),
    false,
  );
  baseline.controller.dispose();
  const s = setup(true, true);
  assert.ok(s.controller.bootstrap().includes('page-context-v1'));
  s.start('changes-v2', 'window-crop-v1');
  await s.advance(100);
  const frame = s.requests.find((r) => r.endpoint === 'frames')!.body as Frame;
  assert.deepEqual(frame.context?.page?.web, pageWeb);
  assert.equal(frame.context?.page?.image.valid.height, 700);
  assert.equal(frame.context?.page?.image.excluded[0].height, 627);
  await s.controller.stop();
  s.controller.dispose();
});
