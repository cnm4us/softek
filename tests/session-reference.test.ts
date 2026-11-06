import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { buildLegacyReferences } from '../scripts/lib/session-reference.js';
import type { ReplayFrame } from '../scripts/lib/recording-replay.js';
test('versioned page context supports partial/full sessions and isolates layout, selection and keyboard exclusions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'softek-session-reference-'));
  try {
    const image = await sharp({
      create: { width: 300, height: 200, channels: 3, background: '#205747' },
    })
      .jpeg()
      .toBuffer();
    const frame = (sequence: number, y: number, layout = 1): ReplayFrame => ({
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
          maskedKeyboard: false,
          anchoredPopover: false,
        },
        page: {
          version: 1,
          web: {
            version: 1,
            visit: 1,
            layout,
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
            bottom: y === 400,
          },
          image: {
            width: 300,
            height: 200,
            valid: { x: 0, y: 0, width: 300, height: 200 },
            excluded: [],
          },
        },
      },
    });
    const frames = [
      frame(1, 0),
      frame(2, 400),
      frame(3, 200),
      frame(4, 400, 2),
      frame(5, 200, 2),
      frame(6, 0, 2),
    ];
    frames[4].context!.page!.web.layer = 'selection';
    frames[5].context!.page!.image.valid.height = 100;
    frames[5].context!.page!.image.excluded = [
      { x: 0, y: 100, width: 300, height: 100 },
    ];
    frames[5].context!.surface!.maskedKeyboard = true;
    const result = await buildLegacyReferences({
      recordingId: 'fixture',
      frames,
      source: async () => image,
      directory,
    });
    assert.equal(result.manifest.mode, 'versioned-page-context');
    assert.equal(result.pages.length, 2);
    const [complete, partial] = result.manifest.pages;
    assert.equal(complete.coverageStatus, 'complete');
    assert.equal(complete.knownPixels, 288 * 600);
    assert.equal(partial.coverageStatus, 'partial');
    assert.equal(partial.knownPixels, 288 * 300);
    assert.deepEqual(partial.frames, [4, 6]);
    assert.equal(partial.bottomReached, true);
    assert.equal(partial.topReached, true);
    const region = await result.pages[1].canvas.view({
      x: 0,
      y: 0,
      width: 288,
      height: 600,
    });
    const p = await sharp(region)
      .extract({ left: 50, top: 150, width: 1, height: 1 })
      .raw()
      .toBuffer();
    assert.equal(p[3], 0, 'Keyboard-excluded pixels remain unknown');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('moving viewport pixels enter the canvas only after overlap verifies their placement', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'softek-moving-reference-'));
  try {
    const tall = await sharp(
      Buffer.from(
        `<svg width="720" height="1200"><rect width="720" height="1200" fill="#f5f6f1"/>${Array.from({ length: 22 }, (_, i) => `<rect x="${20 + (i % 3) * 10}" y="${i * 50}" width="${200 + i * 10}" height="24" fill="${i % 2 ? '#205747' : '#a54a30'}"/><text x="30" y="${i * 50 + 43}" font-size="18">Fictional entry ${i}</text>`).join('')}</svg>`,
      ),
    )
      .png()
      .toBuffer();
    const pictures = await Promise.all(
      [1, 121]
        .map((top) =>
          sharp(tall)
            .extract({ left: 0, top, width: 720, height: 500 })
            .jpeg()
            .toBuffer(),
        )
        .slice(0, 2),
    );
    pictures.push(
      await sharp({
        create: { width: 720, height: 500, channels: 3, background: '#a02272' },
      })
        .jpeg()
        .toBuffer(),
    );
    pictures.push(
      await sharp(tall)
        .extract({ left: 0, top: 0, width: 720, height: 500 })
        .jpeg()
        .toBuffer(),
    );
    const frames = pictures.map((image, i): ReplayFrame => ({
      sequence: i + 1,
      elapsedMs: (i + 1) * 1000,
      capturedAt: '2026-11-06T06:00:00Z',
      hash: createHash('sha256').update(image).digest('hex'),
      width: 720,
      height: 500,
      context: {
        reason: 'scroll',
        unstable: i === 1 || i === 2,
        uncertaintyMs: 100,
        geometry: {
          route: '/goals',
          width: 720,
          height: 500,
          scale: 1,
          offsetX: 0,
          offsetY: 0,
          scrollX: 0,
          scrollY: [0, 100, 120, 0][i],
          container: 'document',
          containerX: 0,
          containerY: [0, 100, 120, 0][i],
        },
        surface: {
          method: 'window-crop-v1',
          maskedKeyboard: false,
          anchoredPopover: false,
        },
        page: {
          version: 1,
          web: {
            version: 1,
            visit: 1,
            layout: 1,
            documentWidth: 720,
            documentHeight: 1200,
            clientWidth: 720,
            clientHeight: 500,
            scrollX: 0,
            scrollY: [0, 100, 120, 0][i],
            fontSize: 16,
            lineHeight: 24,
            layer: 'document',
            top: i === 0,
            bottom: false,
          },
          image: {
            width: 720,
            height: 500,
            valid: { x: 0, y: 0, width: 720, height: 500 },
            excluded: [],
          },
        },
      },
    }));
    const result = await buildLegacyReferences({
      recordingId: 'fixture',
      frames,
      directory,
      source: async (n) => pictures[n - 1],
    });
    assert.equal(result.placements.get(2)?.y, 120);
    assert.equal(result.placements.has(3), false);
    assert.equal(
      result.placements.has(4),
      false,
      'A return aligned one pixel above the origin stays viewport-only',
    );
    assert.equal(
      result.manifest.pages[0].observations[1].mapping?.method,
      'image-aligned',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
