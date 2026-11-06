import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { PageCanvas, CanvasLimit } from '../scripts/lib/page-canvas.js';
import { replayOutputBytes } from '../apps/api/src/recording-replay-files.js';
const image = async (color: string) =>
  sharp({ create: { width: 300, height: 200, channels: 3, background: color } })
    .png()
    .toBuffer();
const observation = (b: Buffer, n: number, y = 0) => ({
  image: b,
  sequence: n,
  elapsedMs: n * 1000,
  capturedAt: '2026-11-06T02:00:00Z',
  hash: createHash('sha256').update(b).digest('hex'),
  x: 0,
  y,
  valid: { x: 0, y: 0, width: 300, height: 200 },
});
const pixel = async (b: Buffer, x: number, y: number) => [
  ...(await sharp(b)
    .extract({ left: x, top: y, width: 1, height: 1 })
    .ensureAlpha()
    .raw()
    .toBuffer()),
];

test('partial canvas preserves explicit holes, observed bounds and historical states', async () => {
  const work = await mkdtemp(join(tmpdir(), 'softek-canvas-'));
  try {
    const c = new PageCanvas(work, 'recording:route:layout');
    await c.add(observation(await image('#123456'), 1, 200));
    await c.add(observation(await image('#abcdef'), 2, 500));
    const m = c.manifest();
    assert.equal(m.coverageStatus, 'partial');
    assert.equal(m.topReached, null);
    assert.equal(m.bottomReached, null);
    assert.equal(m.knownPixels, 120_000);
    const whole = await c.view({ x: 0, y: 0, width: 300, height: 700 });
    assert.deepEqual(await pixel(whole, 100, 100), [0, 0, 0, 0]);
    assert.deepEqual(await pixel(whole, 100, 300), [18, 52, 86, 255]);
    assert.deepEqual(await pixel(whole, 100, 450), [0, 0, 0, 0]);
    assert.deepEqual(await pixel(whole, 100, 550), [171, 205, 239, 255]);
    const earlier = await c.view({ x: 0, y: 0, width: 300, height: 700 }, 1000);
    assert.deepEqual(
      await pixel(earlier, 100, 550),
      [0, 0, 0, 0],
      'Later coverage is not backdated',
    );
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test('diff versions retain small real changes and erasures while unchanged/noisy observations retain provenance without patches', async () => {
  const work = await mkdtemp(join(tmpdir(), 'softek-canvas-'));
  try {
    const c = new PageCanvas(work, 'recording:page');
    const white = await image('#ffffff');
    await c.add(observation(white, 1));
    const repeated = await c.add(observation(white, 2));
    assert.equal(repeated.changedTiles, 0);
    const noisy = await image('#fbfbfb');
    assert.equal((await c.add(observation(noisy, 3))).changedTiles, 0);
    const changed = await sharp(white)
      .composite([
        {
          input: Buffer.from(
            '<svg width="3" height="3"><rect width="3" height="3" fill="black"/></svg>',
          ),
          left: 50,
          top: 50,
        },
      ])
      .png()
      .toBuffer();
    assert.equal((await c.add(observation(changed, 4))).changedTiles, 1);
    assert.equal((await c.add(observation(white, 5))).changedTiles, 1);
    assert.deepEqual(
      await pixel(
        await c.view({ x: 0, y: 0, width: 300, height: 200 }, 4000),
        50,
        50,
      ),
      [0, 0, 0, 255],
    );
    assert.deepEqual(
      await pixel(
        await c.view({ x: 0, y: 0, width: 300, height: 200 }, 5000),
        50,
        50,
      ),
      [255, 255, 255, 255],
    );
    assert.equal(c.manifest().observations.length, 5);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test('invalid hashes/bounds/order and derivative caps fail before adding a revision', async () => {
  const work = await mkdtemp(join(tmpdir(), 'softek-canvas-'));
  try {
    const b = await image('#123456'),
      c = new PageCanvas(work, 'recording:page', {
        bytes: 128 * 1024 ** 2,
        patches: 1,
      });
    await assert.rejects(c.add(observation(b, 1)), CanvasLimit);
    assert.equal(c.manifest().observations.length, 0);
    const normal = new PageCanvas(work, 'recording:page');
    await assert.rejects(
      normal.add({ ...observation(b, 1), hash: 'a'.repeat(64) }),
      /hash/,
    );
    await assert.rejects(
      normal.add({
        ...observation(b, 1),
        valid: { x: 0, y: 0, width: 400, height: 200 },
      }),
      /bounds/,
    );
    await normal.add(observation(b, 1));
    await assert.rejects(normal.add(observation(b, 1)), /capture order/);
    await assert.rejects(
      normal.view({ x: 0, y: 0, width: 720, height: 10000 }),
      /decoded bounds/,
    );
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test('quota includes hash-named canvas derivatives and rejects unexpected files/symlinks', async () => {
  const work = await mkdtemp(join(tmpdir(), 'softek-canvas-quota-'));
  try {
    const c = new PageCanvas(join(work, 'canvas', 'page-1'), 'recording:page');
    await c.add(observation(await image('#123456'), 1));
    await writeFile(join(work, 'canvas-preview.png'), Buffer.alloc(10));
    assert.equal(await replayOutputBytes(work), c.manifest().storedBytes + 10);
    await symlink(
      join(work, 'canvas-preview.png'),
      join(work, 'canvas', 'page-1', 'a'.repeat(64) + '.png'),
    );
    await assert.rejects(replayOutputBytes(work), /Invalid canvas tile/);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test('measured endpoints do not imply complete coverage until the intervening page region is observed', async () => {
  const work = await mkdtemp(join(tmpdir(), 'softek-canvas-extent-'));
  try {
    const c = new PageCanvas(work, 'recording:page');
    c.setMeasuredExtent(300, 600, 0);
    await c.add(observation(await image('#123456'), 1, 0));
    c.noteBoundaries(true, false);
    await c.add(observation(await image('#abcdef'), 2, 400));
    c.noteBoundaries(false, true);
    assert.equal(c.manifest().coverageStatus, 'partial');
    assert.equal(c.manifest().topReached, true);
    assert.equal(c.manifest().bottomReached, true);
    await c.add(observation(await image('#234567'), 3, 200));
    assert.equal(c.manifest().coverageStatus, 'complete');
    assert.throws(() => c.setMeasuredExtent(300, 700, 0), /new layout/);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test('a shared budget can shrink between observations without changing the last valid revision', async () => {
  const work = await mkdtemp(join(tmpdir(), 'softek-canvas-budget-'));
  try {
    const c = new PageCanvas(work, 'recording:page');
    await c.add(observation(await image('#123456'), 1));
    const before = c.manifest().observations.length;
    c.restrictBudget(0, 0);
    await assert.rejects(
      c.add(observation(await image('#abcdef'), 2)),
      CanvasLimit,
    );
    assert.equal(c.manifest().observations.length, before);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});
