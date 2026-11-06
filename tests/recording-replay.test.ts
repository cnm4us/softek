import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  guideMotion,
  gestureFilters,
} from '../scripts/lib/interaction-replay.js';
import type { Interaction } from '../apps/mobile/src/change-capture.js';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  timeline,
  alignVertical,
  compositeScroll,
  registerIntervals,
  renderReplay,
  type ReplayFrame,
  replayFps,
  publishReplay,
  keyboardPlaceholder,
} from '../scripts/lib/recording-replay.js';
import {
  replayUsage,
  replayWorkReservation,
} from '../apps/api/src/recording-replay-files.js';

const frame = (sequence: number, elapsedMs: number): ReplayFrame => ({
  sequence,
  elapsedMs,
  capturedAt: '2026-11-05T05:46:58.015Z',
  hash: 'a'.repeat(64),
  width: 720,
  height: 500,
});
test('replay timeline preserves initial absence, capture order, missing slots and Stop', () => {
  const result = timeline(
    [frame(4, 4010), frame(1, 1010), frame(2, 2010)],
    4355,
  );
  assert.deepEqual(
    result.map((i) => [i.startMs, i.endMs, i.kind, i.source]),
    [
      [0, 1010, 'gap', undefined],
      [1010, 2010, 'hold', 1],
      [2010, 3010, 'hold', 2],
      [3010, 4010, 'gap', undefined],
      [4010, 4355, 'hold', 4],
    ],
  );
  assert.throws(() => timeline([frame(1, 1010), frame(1, 2010)], 3000));
  assert.throws(() => timeline([frame(1, 1010)], 1000));
});

async function images(offset = 150) {
  const shapes = Array.from(
    { length: 22 },
    (_, n) =>
      `<rect x="${20 + (n % 3) * 10}" y="${n * 45 + 4}" width="${200 + n * 9}" height="20" fill="${n % 2 ? '#174736' : '#903b25'}"/><text x="30" y="${n * 45 + 38}" fill="black" font-size="16">Fictional entry ${n}</text>`,
  ).join('');
  const tall = await sharp(
    Buffer.from(
      `<svg width="720" height="1000"><rect width="720" height="1000" fill="#f4f5ef"/>${shapes}</svg>`,
    ),
  )
    .png()
    .toBuffer();
  const a = await sharp(tall)
    .extract({ left: 0, top: 0, width: 720, height: 500 })
    .jpeg({ quality: 85 })
    .toBuffer();
  const b = await sharp(tall)
    .extract({ left: 0, top: offset, width: 720, height: 500 })
    .jpeg({ quality: 85 })
    .toBuffer();
  return { a, b };
}
test('overlapping text remains aligned for forward/reverse scroll and unsupported page change cuts', async () => {
  const { a, b } = await images();
  const down = await alignVertical(a, b),
    up = await alignVertical(b, a);
  assert.ok(down.accepted, JSON.stringify(down));
  assert.equal(down.dy, 150);
  assert.ok(up.accepted, JSON.stringify(up));
  assert.equal(up.dy, -150);
  const composite = await compositeScroll(a, b, 150);
  const first = await sharp(composite)
    .extract({ left: 0, top: 0, width: 720, height: 500 })
    .removeAlpha()
    .raw()
    .toBuffer();
  assert.equal(
    createHash('sha256').update(first).digest('hex'),
    createHash('sha256')
      .update(await sharp(a).raw().toBuffer())
      .digest('hex'),
  );
  const changed = await sharp({
    create: { width: 720, height: 500, channels: 3, background: '#803429' },
  })
    .jpeg()
    .toBuffer();
  assert.equal((await alignVertical(a, changed)).accepted, false);
  const fixed = await sharp(b)
    .composite([
      {
        input: await sharp(a)
          .extract({ left: 0, top: 0, width: 720, height: 100 })
          .toBuffer(),
        top: 0,
        left: 0,
      },
    ])
    .jpeg()
    .toBuffer();
  assert.equal((await alignVertical(a, fixed)).accepted, false);
  const scrollbar = async (image: Buffer, top: number) =>
    sharp(image)
      .composite([
        {
          input: Buffer.from(
            `<svg width="8" height="500"><rect width="8" height="500" fill="white"/><rect y="${top}" width="8" height="160" fill="#555"/></svg>`,
          ),
          left: 712,
          top: 0,
        },
      ])
      .png()
      .toBuffer();
  const withScrollbar = await alignVertical(
    await scrollbar(a, 10),
    await scrollbar(b, 290),
  );
  assert.ok(
    withScrollbar.accepted,
    'A moving scrollbar does not reject matching page content',
  );
  assert.equal(withScrollbar.dy, 150);
  const intervals = timeline([frame(1, 1000), frame(2, 2000)], 2300);
  await registerIntervals(intervals, async (n) => (n === 1 ? a : b));
  assert.equal(intervals[1].kind, 'scroll');
  assert.equal(intervals[1].dy, 150);
});

test('fast scroll with only a quarter viewport overlap animates in both directions without changing the source', async () => {
  const { a, b } = await images(375);
  const down = await alignVertical(a, b),
    up = await alignVertical(b, a);
  assert.ok(down.accepted, JSON.stringify(down));
  assert.equal(down.dy, 375);
  assert.ok(up.accepted, JSON.stringify(up));
  assert.equal(up.dy, -375);
  for (const [from, to, dy] of [
    [a, b, 375],
    [b, a, -375],
  ] as const) {
    const composite = await compositeScroll(from, to, dy);
    const start = await sharp(composite)
      .extract({ left: 0, top: dy > 0 ? 0 : -dy, width: 720, height: 500 })
      .removeAlpha()
      .raw()
      .toBuffer();
    assert.equal(
      createHash('sha256').update(start).digest('hex'),
      createHash('sha256')
        .update(await sharp(from).raw().toBuffer())
        .digest('hex'),
    );
  }
  const intervals = timeline([frame(1, 1000), frame(2, 2000)], 2300);
  await registerIntervals(intervals, async (n) => (n === 1 ? a : b));
  assert.equal(intervals[1].kind, 'scroll');
});

test('replacement keeps old video on failure and exchanges complete output directories on success', async () => {
  const root = await mkdtemp(join(tmpdir(), 'softek-replay-publish-'));
  const output = join(root, 'output'),
    live = join(root, 'replay');
  try {
    await mkdir(live);
    await mkdir(output);
    await writeFile(join(live, 'full.mp4'), 'old');
    await writeFile(join(output, 'full.mp4'), 'new');
    await assert.rejects(publishReplay(output, live));
    assert.equal(await readFile(join(live, 'full.mp4'), 'utf8'), 'old');
    await assert.rejects(publishReplay(join(root, 'missing'), live, true));
    assert.equal(await readFile(join(live, 'full.mp4'), 'utf8'), 'old');
    await publishReplay(output, live, true);
    assert.equal(await readFile(join(live, 'full.mp4'), 'utf8'), 'new');
    assert.equal(await readFile(join(output, 'full.mp4'), 'utf8'), 'old');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('actual FFmpeg encodes and decodes timed pan with odd-height padding and subframe duration precision', async () => {
  const work = await mkdtemp(join(tmpdir(), 'softek-replay-test-'));
  try {
    const pair = await images();
    const odd = (image: Buffer) =>
      sharp(image)
        .extend({ top: 0, bottom: 1, left: 0, right: 0, background: '#f4f5ef' })
        .png()
        .toBuffer();
    const a = await odd(pair.a),
      b = await odd(pair.b);
    const frames = [frame(1, 1011), frame(2, 2015)].map((f) => ({
      ...f,
      height: 501,
    }));
    const intervals = timeline(frames, 2334);
    await registerIntervals(intervals, async (n) => (n === 1 ? a : b));
    const result = await renderReplay({
      frames,
      intervals,
      startMs: 0,
      endMs: 2334,
      work,
      output: join(work, 'result.mp4'),
      source: async (n) => (n === 1 ? a : b),
    });
    assert.ok(Math.abs(result.durationErrorMs) < 1000 / replayFps);
    assert.equal(result.width, 720);
    assert.equal(result.height, 610);
    assert.equal(result.fps, 30);
    const probe = JSON.parse(
      execFileSync(
        'ffprobe',
        [
          '-v',
          'error',
          '-select_streams',
          'v:0',
          '-show_entries',
          'stream=r_frame_rate',
          '-of',
          'json',
          join(work, 'result.mp4'),
        ],
        { encoding: 'utf8' },
      ),
    );
    assert.equal(probe.streams[0].r_frame_rate, '30/1');
    assert.ok(result.bytes > 1000);
    assert.ok(result.maxRssKiB > 0);
    assert.ok(
      (await readFile(join(work, 'result.mp4'))).includes(Buffer.from('ftyp')),
    );
    const clipped = await renderReplay({
      frames,
      intervals,
      startMs: 503,
      endMs: 2107,
      work,
      output: join(work, 'clip.mp4'),
      source: async (n) => (n === 1 ? a : b),
    });
    assert.ok(Math.abs(clipped.durationErrorMs) < 1000 / replayFps);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test('derived outputs and working reservation count toward the recording storage budget', async () => {
  const root = await mkdtemp(join(tmpdir(), 'softek-replay-quota-'));
  try {
    const directory = join(root, 'a88bbb7b-f78b-46ee-85cc-a7c4c998fbfb');
    await mkdir(join(directory, 'replay'), { recursive: true });
    await writeFile(join(directory, 'replay', 'sample.mp4'), Buffer.alloc(100));
    await writeFile(join(directory, 'replay', 'full.mp4'), Buffer.alloc(200));
    await mkdir(join(directory, '.replay-work'));
    assert.deepEqual(await replayUsage(root), {
      derivedBytes: 300,
      reservedBytes: replayWorkReservation,
    });
    await rm(join(directory, '.replay-work'), { recursive: true });
    assert.deepEqual(await replayUsage(root), {
      derivedBytes: 300,
      reservedBytes: 0,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('sparse replay holds idle time and renders observed gesture coordinates with event-guided scrolling', async () => {
  const work = await mkdtemp(join(tmpdir(), 'softek-observed-replay-'));
  try {
    const { a, b } = await images();
    const g = {
      route: '/',
      width: 720,
      height: 500,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      scrollX: 0,
      scrollY: 0,
      container: 'document',
      containerX: 0,
      containerY: 0,
    };
    const frames: ReplayFrame[] = [
      {
        ...frame(1, 0),
        context: {
          reason: 'start',
          geometry: g,
          unstable: false,
          uncertaintyMs: 5,
        },
      },
      {
        ...frame(2, 2000),
        context: {
          reason: 'scroll',
          geometry: { ...g, scrollY: 150, containerY: 150 },
          unstable: false,
          uncertaintyMs: 5,
        },
      },
    ];
    const events: Interaction[] = [
      {
        sequence: 1,
        elapsedMs: 500,
        kind: 'tap',
        geometry: g,
        uncertaintyMs: 5,
        x: 0.3,
        y: 0.3,
      },
      {
        sequence: 2,
        elapsedMs: 1000,
        kind: 'scroll',
        geometry: g,
        uncertaintyMs: 5,
      },
      {
        sequence: 3,
        elapsedMs: 1500,
        kind: 'scroll',
        geometry: { ...g, scrollY: 75, containerY: 75 },
        uncertaintyMs: 5,
      },
      {
        sequence: 4,
        elapsedMs: 1800,
        kind: 'swipe',
        geometry: g,
        uncertaintyMs: 5,
        x: 0.7,
        y: 0.8,
        endX: 0.7,
        endY: 0.4,
        durationMs: 300,
      },
    ];
    const idle = timeline([frames[0]], 20000, 'changes-v2');
    assert.equal(idle.length, 1);
    assert.equal(idle[0].kind, 'hold');
    assert.equal(idle[0].endMs, 20000);
    const intervals = timeline(frames, 2400, 'changes-v2');
    await registerIntervals(intervals, async (n) => (n === 1 ? a : b));
    guideMotion(intervals, frames, events);
    assert.equal(intervals[0].kind, 'scroll');
    assert.ok(
      intervals[0].motion!.some((p) => p.atMs === 1000 && p.position === 0),
    );
    assert.equal(intervals[0].motionStartMs, 895);
    const output = join(work, 'observed.mp4');
    const result = await renderReplay({
      frames,
      intervals,
      events,
      startMs: 0,
      endMs: 2400,
      work,
      output,
      source: async (n) => (n === 1 ? a : b),
    });
    assert.equal(result.suppressedGestureMarkers, 0);
    const capture = join(work, 'tap.png');
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-ss',
      '0.6',
      '-i',
      output,
      '-frames:v',
      '1',
      capture,
    ]);
    const pixels = await sharp(capture)
      .extract({ left: 195, top: 237, width: 45, height: 45 })
      .removeAlpha()
      .raw()
      .toBuffer();
    let orange = 0;
    for (let i = 0; i < pixels.length; i += 3)
      if (
        pixels[i] > 180 &&
        pixels[i + 1] > 50 &&
        pixels[i + 1] < 170 &&
        pixels[i + 2] < 100
      )
        orange++;
    assert.ok(
      orange > 20,
      'Tap glyph appears at recorded normalized coordinates in the encoded video',
    );
    const shortGeometry = { ...g, height: 250 };
    const shortFrames = frames.map((f) => ({
      ...f,
      context: { ...f.context!, geometry: shortGeometry },
    }));
    const shortEvents: Interaction[] = [
      { ...events[0], geometry: shortGeometry },
      {
        ...events[0],
        sequence: 2,
        elapsedMs: 1100,
        geometry: { ...shortGeometry, container: 's1' },
      },
    ];
    const shortOutput = join(work, 'short-viewport.mp4');
    await renderReplay({
      frames: shortFrames,
      intervals: timeline(shortFrames, 2400, 'changes-v2'),
      events: shortEvents,
      startMs: 0,
      endMs: 2400,
      work,
      output: shortOutput,
      source: async (n) => (n === 1 ? a : b),
    });
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-ss',
      '0.6',
      '-i',
      shortOutput,
      '-frames:v',
      '1',
      join(work, 'short-tap.png'),
    ]);
    const shortPixels = await sharp(join(work, 'short-tap.png'))
      .extract({ left: 195, top: 162, width: 45, height: 45 })
      .removeAlpha()
      .raw()
      .toBuffer();
    let shortOrange = 0;
    for (let n = 0; n < shortPixels.length; n += 3)
      if (
        shortPixels[n] > 180 &&
        shortPixels[n + 1] > 50 &&
        shortPixels[n + 1] < 170 &&
        shortPixels[n + 2] < 100
      )
        shortOrange++;
    assert.ok(
      shortOrange > 20,
      'Short visual viewport uses the same scale in both axes',
    );
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-ss',
      '1.2',
      '-i',
      shortOutput,
      '-frames:v',
      '1',
      join(work, 'unknown-surface.png'),
    ]);
    const unknownPixels = await sharp(join(work, 'unknown-surface.png'))
      .extract({ left: 195, top: 162, width: 45, height: 45 })
      .removeAlpha()
      .raw()
      .toBuffer();
    let unknownOrange = 0;
    for (let n = 0; n < unknownPixels.length; n += 3)
      if (
        unknownPixels[n] > 180 &&
        unknownPixels[n + 1] > 50 &&
        unknownPixels[n + 1] < 170 &&
        unknownPixels[n + 2] < 100
      )
        unknownOrange++;
    assert.equal(
      unknownOrange,
      0,
      'A tap on an uncaptured dialog is not drawn on the underlying page',
    );
    for (const mode of ['popover', 'keyboard', 'error'] as const) {
      const nativeFrames = structuredClone(frames);
      for (const f of nativeFrames)
        f.context!.surface = {
          method: 'window-crop-v1',
          maskedKeyboard: mode === 'keyboard',
          anchoredPopover: mode === 'popover',
        };
      if (mode === 'error') nativeFrames[0].context!.reason = 'error';
      const nativeIntervals = timeline(nativeFrames, 2400, 'changes-v2');
      await registerIntervals(nativeIntervals, async (n) => (n === 1 ? a : b));
      guideMotion(nativeIntervals, nativeFrames, events);
      assert.equal(
        nativeIntervals[0].kind,
        'hold',
        'Native overlay/mask frames use cuts, not whole-page motion',
      );
      assert.deepEqual(
        gestureFilters(events, nativeFrames[0], 0, 2000, 108).filters,
        [],
        'Unknown native/masked surface does not receive page gesture marks',
      );
    }
    const lost = timeline(frames, 2400, 'changes-v2');
    await registerIntervals(lost, async (n) => (n === 1 ? a : b));
    guideMotion(lost, frames, events, 1);
    assert.equal(lost[0].motion, undefined);
    assert.equal(lost[0].motionStartMs, undefined);
    const movingEndpoint = structuredClone(frames);
    movingEndpoint[1].context!.unstable = true;
    const fallback = timeline(movingEndpoint, 2400, 'changes-v2');
    await registerIntervals(fallback, async (n) => (n === 1 ? a : b));
    guideMotion(fallback, movingEndpoint, events);
    assert.equal(fallback[0].motion, undefined);
    assert.equal(
      fallback[0].motionStartMs,
      895,
      'Estimated motion preserves the preceding idle pause',
    );
    const fallbackOutput = join(work, 'idle-before-moving-endpoint.mp4');
    await renderReplay({
      frames: movingEndpoint,
      intervals: fallback,
      events: [],
      startMs: 0,
      endMs: 2400,
      work,
      output: fallbackOutput,
      source: async (n) => (n === 1 ? a : b),
    });
    const idlePixels: Buffer[] = [];
    for (const at of ['0.2', '0.7']) {
      const png = join(work, `idle-${at}.png`);
      execFileSync('ffmpeg', [
        '-v',
        'error',
        '-ss',
        at,
        '-i',
        fallbackOutput,
        '-frames:v',
        '1',
        png,
      ]);
      idlePixels.push(
        await sharp(png)
          .extract({ left: 0, top: 108, width: 720, height: 500 })
          .removeAlpha()
          .raw()
          .toBuffer(),
      );
    }
    const idleDifference =
      idlePixels[0].reduce(
        (sum, value, n) => sum + Math.abs(value - idlePixels[1][n]),
        0,
      ) / idlePixels[0].length;
    assert.ok(
      idleDifference < 2,
      'Encoded content stays still before the first scroll sample',
    );
    const changed = structuredClone(frames);
    changed[1].context!.geometry.route = '/cards';
    const unsafe = timeline(changed, 2400, 'changes-v2');
    await registerIntervals(unsafe, async (n) => (n === 1 ? a : b));
    guideMotion(unsafe, changed, events);
    assert.equal(unsafe[0].kind, 'hold');
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test('keyboard placeholder decorates only confirmed masked blank pixels and survives video encoding', async () => {
  const work = await mkdtemp(join(tmpdir(), 'softek-keyboard-placeholder-'));
  try {
    const { a } = await images();
    const blank = await sharp({
      create: { width: 720, height: 500, channels: 3, background: '#f5f6f1' },
    })
      .composite([
        {
          input: await sharp(a)
            .extract({ left: 0, top: 0, width: 720, height: 220 })
            .png()
            .toBuffer(),
          left: 0,
          top: 0,
        },
      ])
      .png()
      .toBuffer();
    const f: ReplayFrame = {
      ...frame(1, 0),
      context: {
        reason: 'viewport',
        unstable: false,
        uncertaintyMs: 5,
        geometry: {
          route: '/',
          width: 440,
          height: 300,
          scale: 1,
          offsetX: 0,
          offsetY: 0,
          scrollX: 0,
          scrollY: 0,
          container: 'document',
          containerX: 0,
          containerY: 0,
        },
        surface: {
          method: 'window-crop-v1',
          maskedKeyboard: true,
          anchoredPopover: true,
        },
      },
    };
    const decorated = await keyboardPlaceholder(blank, f);
    assert.ok(decorated.regionTop !== null && decorated.regionTop >= 220);
    const top = async (image: Buffer) =>
      sharp(image)
        .extract({ left: 0, top: 0, width: 720, height: 220 })
        .removeAlpha()
        .raw()
        .toBuffer();
    assert.deepEqual(
      await top(decorated.image),
      await top(blank),
      'Captured content above the blank area remains byte-identical',
    );
    const unmasked = structuredClone(f);
    unmasked.context!.surface!.maskedKeyboard = false;
    assert.equal(
      (await keyboardPlaceholder(blank, unmasked)).image,
      blank,
      'An ordinary blank footer is not labeled',
    );
    assert.equal(
      (await keyboardPlaceholder(blank, { ...f, context: null })).image,
      blank,
      'Legacy frames are untouched',
    );
    const covered = await sharp(blank)
      .composite([
        {
          input: Buffer.from(
            '<svg width="720" height="100"><rect width="720" height="100" fill="white"/><text x="20" y="50">Visible page content</text></svg>',
          ),
          left: 0,
          top: 400,
        },
      ])
      .png()
      .toBuffer();
    assert.equal(
      (await keyboardPlaceholder(covered, f)).regionTop,
      null,
      'Nonblank lower content blocks an inferred panel',
    );
    const intervals = timeline([f], 1200, 'changes-v2');
    const output = join(work, 'placeholder.mp4');
    const result = await renderReplay({
      frames: [f],
      intervals,
      startMs: 0,
      endMs: 1200,
      work,
      output,
      source: async () => blank,
    });
    assert.equal(result.keyboardPlaceholderFrames, 1);
    const png = join(work, 'encoded.png');
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-ss',
      '0.5',
      '-i',
      output,
      '-frames:v',
      '1',
      png,
    ]);
    const pixels = await sharp(png)
      .extract({ left: 150, top: 408, width: 420, height: 130 })
      .removeAlpha()
      .raw()
      .toBuffer();
    let textPixels = 0;
    for (let n = 0; n < pixels.length; n += 3)
      if (pixels[n] < 160 && pixels[n + 1] < 160 && pixels[n + 2] < 160)
        textPixels++;
    assert.ok(
      textPixels > 200,
      'Placeholder text is visible in the encoded blank area',
    );
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});
