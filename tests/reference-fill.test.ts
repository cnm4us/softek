import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import {
  renderReplay,
  timeline,
  alignVertical,
} from '../scripts/lib/recording-replay.js';
import { buildLegacyReferences } from '../scripts/lib/session-reference.js';
import { fillFromReference } from '../scripts/lib/reference-fill.js';
import type { ReplayFrame } from '../scripts/lib/recording-replay.js';
const picture = (color: string) =>
  sharp({ create: { width: 300, height: 200, channels: 3, background: color } })
    .png()
    .toBuffer();
async function fixture(directory: string, footer = false, future = true) {
  const before = await picture('#802020'),
    after = await picture('#208020'),
    blue = await picture('#202080');
  const target = await sharp(await picture('#f5f6f1'))
    .composite([
      {
        input: await sharp(blue)
          .extract({ left: 0, top: 0, width: 300, height: 50 })
          .png()
          .toBuffer(),
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer();
  const frame = (
    sequence: number,
    y: number,
    image: Buffer,
    masked = false,
  ): ReplayFrame => ({
    sequence,
    elapsedMs: sequence * 1000,
    capturedAt: '2026-11-06T06:00:00Z',
    hash: createHash('sha256').update(image).digest('hex'),
    width: 300,
    height: 200,
    context: {
      reason: 'scroll',
      unstable: false,
      uncertaintyMs: 1,
      geometry: {
        route: '/goals',
        width: 300,
        height: 200,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        scrollX: 0,
        scrollY: y,
        container: 'document',
        containerX: 0,
        containerY: y,
      },
      surface: {
        method: 'window-crop-v1',
        maskedKeyboard: masked,
        anchoredPopover: masked,
      },
      page: {
        version: 1,
        web: {
          version: 1,
          visit: 1,
          layout: 1,
          documentWidth: 300,
          documentHeight: 600,
          clientWidth: 300,
          clientHeight: 200,
          scrollX: 0,
          scrollY: y,
          fontSize: 16,
          lineHeight: 24,
          layer: 'document',
          top: y === 0,
          bottom: y >= 400,
        },
        image: {
          width: 300,
          height: 200,
          valid: { x: 0, y: 0, width: 300, height: masked ? 50 : 200 },
          excluded: masked ? [{ x: 0, y: 50, width: 300, height: 150 }] : [],
        },
      },
    },
  });
  const frames = [
    frame(1, 0, before),
    frame(2, footer ? 500 : 100, target, true),
    ...(future ? [frame(3, footer ? 400 : 200, after)] : []),
  ];
  const result = await buildLegacyReferences({
    recordingId: 'fixture',
    frames,
    directory,
    source: async (n) => [before, target, after][n - 1],
  });
  return { result, frame: frames[1], target };
}
const pixel = async (image: Buffer, x: number, y: number) => [
  ...(await sharp(image)
    .extract({ left: x, top: y, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer()),
];
test('reference fill keeps observed pixels, uses past pixels first and labels later observations', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'softek-reference-fill-'));
  try {
    const f = await fixture(directory);
    const fill = await fillFromReference(f.frame, f.target, f.result);
    assert.ok(fill);
    assert.equal(fill.missingPixels, 0);
    assert.equal(fill.usedLater, true);
    assert.deepEqual(fill.sourceIds, [1, 3]);
    assert.deepEqual(fill.timeRangeMs, { min: -1000, max: 1000 });
    assert.deepEqual(await pixel(fill.image, 20, 25), [32, 32, 128]);
    assert.deepEqual(await pixel(fill.image, 20, 75), [128, 32, 32]);
    assert.deepEqual(await pixel(fill.image, 20, 125), [32, 128, 32]);
    const upper = (b: Buffer) =>
      sharp(b)
        .extract({ left: 0, top: 0, width: 300, height: 50 })
        .removeAlpha()
        .raw()
        .toBuffer();
    assert.deepEqual(await upper(fill.image), await upper(f.target));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('unobserved page holes stay explicit and space beyond the measured page is not fabricated', async () => {
  for (const footer of [false, true]) {
    const directory = await mkdtemp(join(tmpdir(), 'softek-reference-gap-'));
    try {
      const f = await fixture(directory, footer, footer);
      const fill = await fillFromReference(f.frame, f.target, f.result);
      assert.ok(fill);
      if (footer) {
        assert.equal(fill.outsideDocumentPixels, 100 * 288);
        assert.deepEqual(await pixel(fill.image, 20, 150), [245, 246, 241]);
      } else {
        assert.equal(fill.missingPixels, 100 * 288);
        assert.equal(fill.usedLater, false);
        assert.match(fill.label, /partial/);
        const p = await pixel(fill.image, 20, 125);
        assert.equal(p[0], p[1]);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

test('FFmpeg replay uses the canvas fill while preserving the captured viewport and timing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'softek-reference-video-'));
  try {
    const f = await fixture(directory),
      output = join(directory, 'replay.mp4');
    const result = await renderReplay({
      frames: [f.frame],
      intervals: timeline([f.frame], 3200, 'changes-v2'),
      startMs: 2000,
      endMs: 3200,
      work: directory,
      output,
      source: async () => f.target,
      referenceFill: (frame, image) =>
        fillFromReference(frame, image, f.result),
    });
    assert.equal(result.canvasReferenceFrames, 1);
    assert.equal(result.retrospectiveFillFrames, 1);
    assert.equal(result.keyboardPlaceholderFrames, 0);
    assert.ok(Math.abs(result.durationMs - 1200) <= 1000 / 24);
    const png = execFileSync(
      'ffmpeg',
      [
        '-v',
        'error',
        '-ss',
        '0.5',
        '-i',
        output,
        '-frames:v',
        '1',
        '-f',
        'image2pipe',
        '-vcodec',
        'png',
        'pipe:1',
      ],
      { maxBuffer: 1024 ** 2 },
    );
    for (const [y, expected] of [
      [25, [32, 32, 128]],
      [75, [128, 32, 32]],
      [125, [32, 128, 32]],
    ] as const) {
      const actual = await pixel(png, 20, y + 108);
      assert.ok(actual.every((v, i) => Math.abs(v - expected[i]) < 10));
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('post-keyboard anchors recover only the unseen tail despite changed focus pixels', async () => {
  const tall = await sharp(
    Buffer.from(
      `<svg width="720" height="1300"><rect width="720" height="1300" fill="#f5f6f1"/>${Array.from({ length: 26 }, (_, i) => `<text x="32" y="${i * 48 + ((i * i * 7) % 23) + 28}" font-size="22" fill="#17372f">Fictional page entry ${i} / readable content</text><rect x="32" y="${i * 48 + ((i * i * 7) % 23) + 36}" width="${180 + i * 7}" height="6" fill="#a54a30"/>`).join('')}</svg>`,
    ),
  )
    .png()
    .toBuffer();
  const before = await sharp(tall)
    .extract({ left: 0, top: 0, width: 720, height: 900 })
    .jpeg({ quality: 85 })
    .toBuffer();
  const clear = await sharp(tall)
    .extract({ left: 0, top: 400, width: 720, height: 900 })
    .png()
    .toBuffer();
  const after = await sharp(clear)
    .composite([
      {
        input: Buffer.from(
          '<svg width="300" height="50"><rect width="300" height="50" fill="#808080"/></svg>',
        ),
        left: 180,
        top: 160,
      },
    ])
    .jpeg({ quality: 85 })
    .toBuffer();
  assert.equal(
    (await alignVertical(before, after)).accepted,
    false,
    'Whole-image matching rejects the focus-state change',
  );
  const masked = await sharp(clear)
    .composite([
      {
        input: Buffer.from(
          '<svg width="720" height="450"><rect width="720" height="450" fill="#f5f6f1"/></svg>',
        ),
        left: 0,
        top: 450,
      },
    ])
    .jpeg({ quality: 85 })
    .toBuffer();
  const images = [before, masked, after];
  const frames = images.map((image, i): ReplayFrame => ({
    sequence: i + 1,
    elapsedMs: (i + 1) * 1000,
    capturedAt: '2026-11-06T17:00:00Z',
    hash: createHash('sha256').update(image).digest('hex'),
    width: 720,
    height: 900,
    context: {
      reason: i === 1 ? 'error' : 'scroll',
      unstable: false,
      uncertaintyMs: 1,
      geometry: {
        route: '/goals',
        width: 720,
        height: i === 1 ? 450 : 900,
        scale: 1,
        offsetX: 0,
        offsetY: i === 1 ? 100 : 0,
        scrollX: 0,
        scrollY: i ? 400 : 0,
        container: 'document',
        containerX: 0,
        containerY: i ? 400 : 0,
      },
      surface: {
        method: 'window-crop-v1',
        maskedKeyboard: i === 1,
        anchoredPopover: i === 1,
      },
      page: {
        version: 1,
        web: {
          version: 1,
          visit: 1,
          layout: 1,
          documentWidth: 720,
          documentHeight: 1300,
          clientWidth: 720,
          clientHeight: 900,
          scrollX: 0,
          scrollY: i ? 400 : 0,
          fontSize: 16,
          lineHeight: 24,
          layer: 'document',
          top: i === 0,
          bottom: i > 0,
        },
        image: {
          width: 720,
          height: 900,
          valid: { x: 0, y: 0, width: 720, height: i === 1 ? 450 : 900 },
          excluded: i === 1 ? [{ x: 0, y: 450, width: 720, height: 450 }] : [],
        },
      },
    },
  }));
  for (const mode of [
    'recover',
    'no-keyboard',
    'moving',
    'wrong-position',
    'late',
    'wrong-layout',
    'unrelated',
    'blank',
  ] as const) {
    const directory = await mkdtemp(join(tmpdir(), 'softek-keyboard-tail-'));
    try {
      const observations = structuredClone(frames);
      if (mode === 'moving') observations[2].context!.unstable = true;
      if (mode === 'wrong-position')
        observations[2].context!.page!.web.scrollY += 40;
      if (mode === 'late') observations[2].elapsedMs = 15000;
      if (mode === 'wrong-layout')
        observations[2].context!.page!.web.layout = 2;
      const replacement =
        mode === 'unrelated' || mode === 'blank'
          ? await sharp({
              create: {
                width: 720,
                height: 900,
                channels: 3,
                background: mode === 'blank' ? '#f5f6f1' : '#902055',
              },
            })
              .jpeg()
              .toBuffer()
          : after;
      observations[2].hash = createHash('sha256')
        .update(replacement)
        .digest('hex');
      const result = await buildLegacyReferences({
        recordingId: 'fixture',
        frames:
          mode === 'no-keyboard'
            ? [observations[0], observations[2]]
            : observations,
        source: async (n) => (n === 3 ? replacement : images[n - 1]),
        directory,
      });
      const anchors = result.manifest.pages.flatMap((p) =>
        p.observations.filter((o) => o.mapping?.method === 'image-anchors'),
      );
      if (mode !== 'recover') {
        assert.equal(anchors.length, 0, mode);
        continue;
      }
      assert.equal(
        anchors.length,
        1,
        JSON.stringify(await alignVertical(before, after)),
      );
      assert.deepEqual(
        anchors[0].rect,
        { x: 0, y: 900, width: 708, height: 400 },
        'Only the newly observed lower tail is imported',
      );
      assert.equal(result.manifest.pages[0].coverageStatus, 'complete');
      const fill = await fillFromReference(observations[1], masked, result);
      assert.ok(fill);
      assert.equal(fill.missingPixels, 0);
      assert.equal(fill.usedLater, true);
      assert.deepEqual(fill.sourceIds, [1, 3]);
      const prefix = (b: Buffer) =>
        sharp(b)
          .extract({ left: 0, top: 0, width: 720, height: 450 })
          .removeAlpha()
          .raw()
          .toBuffer();
      assert.deepEqual(
        await prefix(fill.image),
        await prefix(masked),
        'Actually captured tooltip/input pixels are unchanged',
      );
      const tail = (b: Buffer) =>
        sharp(b)
          .extract({ left: 0, top: 500, width: 708, height: 400 })
          .removeAlpha()
          .raw()
          .toBuffer();
      assert.deepEqual(
        await tail(fill.image),
        await tail(after),
        'Hidden tail uses verified later pixels',
      );
      const old = await result.pages[0].canvas.view(
        { x: 0, y: 900, width: 708, height: 400 },
        2000,
      );
      assert.equal(
        (await sharp(old).ensureAlpha().raw().toBuffer())[3],
        0,
        'Later footer is never backdated into as-of coverage',
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});
