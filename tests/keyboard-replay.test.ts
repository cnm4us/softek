import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import {
  applyKeyboardReconstruction,
  planKeyboardReconstruction,
  keyboardPlaceholder,
  planPageReconstruction,
  applyPageReconstruction,
} from '../scripts/lib/keyboard-replay.js';
import {
  renderReplay,
  timeline,
  type ReplayFrame,
} from '../scripts/lib/recording-replay.js';

async function fixture(offset = 156) {
  const page = await sharp(
    Buffer.from(
      `<svg width="720" height="1600"><rect width="720" height="1600" fill="#f5f6f1"/>${Array.from({ length: 25 }, (_, i) => `<rect x="${25 + (i % 3) * 12}" y="${i * 61}" width="${380 + i * 7}" height="29" fill="${i % 2 ? '#205447' : '#ac5127'}"/><text x="40" y="${i * 61 + 50}" font-size="20">Fictional page element ${i}</text>`).join('')}</svg>`,
    ),
  )
    .png()
    .toBuffer();
  const before = await sharp(page)
    .extract({ left: 0, top: 0, width: 720, height: 800 })
    .png()
    .toBuffer();
  const after = await sharp(page)
    .extract({ left: 0, top: offset, width: 720, height: 800 })
    .png()
    .toBuffer();
  const visible = await sharp(after)
    .extract({ left: 0, top: 0, width: 720, height: 400 })
    .png()
    .toBuffer();
  const masked = await sharp({
    create: { width: 720, height: 800, channels: 3, background: '#f5f6f1' },
  })
    .composite([
      { input: visible, left: 0, top: 0 },
      {
        input: Buffer.from(
          '<svg width="200" height="70"><rect width="200" height="70" rx="20" fill="white"/><text x="10" y="40" font-size="18">Fill out this field</text></svg>',
        ),
        left: 220,
        top: 90,
      },
    ])
    .png()
    .toBuffer();
  const frame = (
    n: number,
    ms: number,
    y: number,
    mask = false,
  ): ReplayFrame => ({
    sequence: n,
    elapsedMs: ms,
    capturedAt: '2026-11-06T01:24:33.874Z',
    hash: 'a'.repeat(64),
    width: 720,
    height: 800,
    context: {
      reason: mask ? 'error' : 'scroll',
      unstable: false,
      uncertaintyMs: 10,
      geometry: {
        route: '/goals',
        width: 720,
        height: mask ? 400 : 800,
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
        maskedKeyboard: mask,
        anchoredPopover: mask,
      },
    },
  });
  const frames = [
    frame(1, 0, 0),
    frame(2, 1000, offset, true),
    frame(3, 2000, offset),
  ];
  const source = async (n: number) => [before, masked, after][n - 1];
  return { before, after, masked, frames, source };
}
const raw = async (image: Buffer, top: number, height: number) =>
  sharp(image)
    .extract({ left: 0, top, width: 720, height })
    .removeAlpha()
    .raw()
    .toBuffer();

test('keyboard fill preserves captured pixels/bubble and borrows only the aligned hidden strip with source timing', async () => {
  const { masked, after, frames, source } = await fixture();
  const plan = await planKeyboardReconstruction(
    masked,
    frames[1],
    frames,
    source,
  );
  assert.ok(plan);
  assert.equal(plan.donor, 3);
  assert.equal(plan.relativeMs, 1000);
  assert.equal(plan.dy, 0);
  assert.equal(plan.top + plan.height, 800);
  const filled = await applyKeyboardReconstruction(masked, after, plan);
  assert.deepEqual(
    await raw(filled, 0, plan.top),
    await raw(masked, 0, plan.top),
    'All observed pixels, including the actual tooltip, are unchanged',
  );
  assert.deepEqual(
    await raw(filled, plan.top, plan.height),
    await raw(after, plan.top, plan.height),
    'Hidden pixels are the exact registered donor strip',
  );
  assert.equal(
    (await keyboardPlaceholder(filled, frames[1], 800)).regionTop,
    null,
  );
});

test('earlier partial observation leaves unrecovered pixels masked and eligible for the existing placeholder', async () => {
  const { masked, before, frames, source } = await fixture();
  const plan = await planKeyboardReconstruction(
    masked,
    frames[1],
    frames.slice(0, 2),
    source,
  );
  assert.ok(plan);
  assert.equal(plan.donor, 1);
  assert.equal(plan.relativeMs, -1000);
  assert.equal(plan.dy, 156);
  assert.ok(plan.top + plan.height < 800);
  const filled = await applyKeyboardReconstruction(masked, before, plan);
  assert.deepEqual(
    await raw(filled, plan.top + plan.height, 800 - plan.top - plan.height),
    await raw(masked, plan.top + plan.height, 800 - plan.top - plan.height),
  );
  const labeled = await keyboardPlaceholder(
    filled,
    frames[1],
    plan.top + plan.height,
  );
  assert.ok(
    labeled.regionTop !== null && labeled.regionTop >= plan.top + plan.height,
  );
});

test('keyboard donors must stay within one contiguous route, geometry, time window and stable window observation', async () => {
  const { masked, frames, source } = await fixture();
  const invalid = [
    (fs: ReplayFrame[]) => {
      fs[0].context!.geometry.route = '/';
      fs[2].context!.geometry.route = '/';
    },
    (fs: ReplayFrame[]) => {
      fs[0].sequence = 0;
      fs[2].sequence = 4;
    },
    (fs: ReplayFrame[]) => {
      fs[1].context!.geometry.scale = 1.2;
    },
    (fs: ReplayFrame[]) => {
      fs[1].context!.geometry.container = 's1';
    },
    (fs: ReplayFrame[]) => {
      fs[0].context!.unstable = true;
      fs[2].context!.unstable = true;
    },
    (fs: ReplayFrame[]) => {
      fs[0].context!.surface!.anchoredPopover = true;
      fs[2].context!.surface!.anchoredPopover = true;
    },
    (fs: ReplayFrame[]) => {
      fs[0].context!.surface!.maskedKeyboard = true;
      fs[2].context!.surface!.maskedKeyboard = true;
    },
    (fs: ReplayFrame[]) => {
      fs[0].elapsedMs = -30_001;
      fs[2].elapsedMs = 32_000;
    },
    (fs: ReplayFrame[]) => {
      fs[0].context!.geometry.width = 500;
      fs[2].context!.geometry.width = 500;
    },
  ];
  for (const change of invalid) {
    const fs = structuredClone(frames);
    change(fs);
    assert.equal(
      await planKeyboardReconstruction(masked, fs[1], fs, source),
      null,
    );
  }
  const leave = structuredClone(frames);
  leave[2].context!.geometry.route = '/';
  const returned = {
    ...structuredClone(frames[2]),
    sequence: 4,
    elapsedMs: 3000,
  };
  assert.equal(
    await planKeyboardReconstruction(
      masked,
      leave[1],
      [leave[1], leave[2], returned],
      source,
    ),
    null,
    'Returning to the same URL does not cross the intervening route',
  );
  const unmasked = structuredClone(frames[1]);
  unmasked.context!.surface!.maskedKeyboard = false;
  assert.equal(
    await planKeyboardReconstruction(masked, unmasked, [unmasked], source),
    null,
  );
});

test('registration rejects unrelated page pixels and blank overlap even when route/scroll metadata agrees', async () => {
  const { masked, frames } = await fixture();
  const wrong = await sharp({
    create: { width: 720, height: 800, channels: 3, background: '#7c244c' },
  })
    .png()
    .toBuffer();
  assert.equal(
    await planKeyboardReconstruction(
      masked,
      frames[1],
      frames,
      async () => wrong,
    ),
    null,
  );
  const blank = await sharp({
    create: { width: 720, height: 800, channels: 3, background: '#f5f6f1' },
  })
    .png()
    .toBuffer();
  assert.equal(
    await planKeyboardReconstruction(
      blank,
      frames[1],
      frames,
      async () => blank,
    ),
    null,
  );
});

test('encoded keyboard reconstruction retains real tooltip pixels, filled content and the measured timeline', async () => {
  const { masked, after, frames, source } = await fixture();
  const f = frames[1],
    plan = await planKeyboardReconstruction(masked, f, frames, source);
  assert.ok(plan);
  const work = await mkdtemp(join(tmpdir(), 'softek-keyboard-fill-'));
  try {
    const output = join(work, 'reconstruction.mp4');
    const result = await renderReplay({
      frames,
      intervals: timeline([f], 2200, 'changes-v2'),
      startMs: 1000,
      endMs: 2200,
      work,
      output,
      source,
      keyboardReconstructions: new Map([[f.sequence, plan]]),
    });
    assert.equal(result.keyboardReconstructionFrames, 1);
    assert.equal(result.keyboardPlaceholderFrames, 0);
    assert.ok(Math.abs(result.durationMs - 1200) < 1000 / 24);
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
      { maxBuffer: 4 * 1024 ** 2 },
    );
    const encoded = await sharp(png)
      .extract({ left: 0, top: 108, width: 720, height: 800 })
      .png()
      .toBuffer();
    for (const [top, height, reference] of [
      [0, 300, masked],
      [450, 300, after],
    ] as const) {
      const a = await raw(encoded, top, height),
        b = await raw(reference, top, height);
      const error =
        a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length;
      assert.ok(
        error < 6,
        `Encoded captured/borrowed region differs by only codec rounding (${error})`,
      );
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test('multiple registered sources extend a partial fill without importing changed upper content', async () => {
  const { masked, after, frames, source } = await fixture(84);
  const later = await sharp(after)
    .composite([
      {
        input: Buffer.from(
          '<svg width="720" height="60"><rect width="720" height="60" fill="#902040"/></svg>',
        ),
        left: 0,
        top: 20,
      },
    ])
    .png()
    .toBuffer();
  const sources = async (n: number) => (n === 3 ? later : source(n));
  const plan = await planPageReconstruction(masked, frames[1], frames, sources);
  assert.ok(plan);
  assert.equal(plan.strips.length, 2);
  assert.equal(plan.strips[0].donor, 1);
  assert.equal(plan.strips[1].donor, 3);
  assert.equal(plan.end, 800);
  const filled = await applyPageReconstruction(masked, plan, sources);
  assert.deepEqual(
    await raw(filled, 0, plan.top),
    await raw(masked, 0, plan.top),
  );
  assert.deepEqual(await raw(filled, 720, 80), await raw(after, 720, 80));
});
