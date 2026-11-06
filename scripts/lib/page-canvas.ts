import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';

export type PixelRect = { x: number; y: number; width: number; height: number };
export type CanvasSource = {
  sequence: number;
  elapsedMs: number;
  capturedAt: string;
  hash: string;
  mapping?: {
    method: 'metadata' | 'image-aligned' | 'image-anchors' | 'legacy-inferred';
    expectedY: number;
    placedY: number;
    matched?: number;
    anchorBands?: number[];
  };
};
export type CanvasObservation = CanvasSource & {
  x: number;
  y: number;
  image: Buffer;
  valid: PixelRect;
};
type TileVersion = { revision: number; file: string; bytes: number };
type Tile = { x: number; y: number; known: number; versions: TileVersion[] };
export class CanvasLimit extends Error {}

// Per-recording, per-layout instance. Files are derived, immutable tile versions;
// transparent pixels are unknown, never evidence of an empty document region.
export class PageCanvas {
  readonly tileSize = 256;
  private tiles = new Map<string, Tile>();
  private files = new Map<string, number>();
  private observations: (CanvasSource & {
    revision: number;
    rect: PixelRect;
    changedTiles: number;
  })[] = [];
  private totalBytes = 0;
  private patchCount = 0;
  restrictBudget(remainingBytes: number, remainingPatches: number) {
    this.limits = {
      bytes: this.totalBytes + Math.max(0, remainingBytes),
      patches: this.patchCount + Math.max(0, remainingPatches),
    };
  }
  private extent: { width: number; height: number; gutter: number } | null =
    null;
  private topSeen = false;
  private bottomSeen = false;
  setMeasuredExtent(width: number, height: number, gutter = 12) {
    if (
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width < 1 ||
      width > 1080 ||
      height < 1 ||
      height > 10_000_000 ||
      gutter < 0 ||
      gutter >= width
    )
      throw new Error('Invalid measured page extent');
    if (
      this.extent &&
      (this.extent.width !== width ||
        this.extent.height !== height ||
        this.extent.gutter !== gutter)
    )
      throw new Error('A new extent requires a new layout segment');
    this.extent = { width, height, gutter };
  }
  noteBoundaries(top: boolean, bottom: boolean) {
    this.topSeen ||= top;
    this.bottomSeen ||= bottom;
  }
  sourceObservations(rect: PixelRect, atMs = Infinity) {
    return this.observations
      .filter(
        (o) =>
          o.elapsedMs <= atMs &&
          o.rect.x < rect.x + rect.width &&
          o.rect.x + o.rect.width > rect.x &&
          o.rect.y < rect.y + rect.height &&
          o.rect.y + o.rect.height > rect.y,
      )
      .map(({ sequence, elapsedMs, capturedAt, hash }) => ({
        sequence,
        elapsedMs,
        capturedAt,
        hash,
      }));
  }
  constructor(
    readonly directory: string,
    readonly identity: string,
    private limits = { bytes: 128 * 1024 ** 2, patches: 4096 },
  ) {}

  async add(observation: CanvasObservation) {
    const { image, valid, x, y, ...source } = observation;
    for (const n of [x, y, valid.x, valid.y, valid.width, valid.height])
      if (!Number.isSafeInteger(n) || n < 0 || n > 10_000_000)
        throw new Error('Invalid canvas rectangle');
    if (
      !valid.width ||
      !valid.height ||
      !/^[a-f0-9]{64}$/.test(source.hash) ||
      !Number.isInteger(source.sequence) ||
      source.sequence < 1 ||
      !Number.isSafeInteger(source.elapsedMs) ||
      source.elapsedMs < 0 ||
      !Number.isFinite(Date.parse(source.capturedAt))
    )
      throw new Error('Invalid canvas source');
    const previous = this.observations.at(-1);
    if (
      previous &&
      (source.sequence <= previous.sequence ||
        source.elapsedMs < previous.elapsedMs)
    )
      throw new Error('Canvas sources must be in capture order');
    const metadata = await sharp(image, {
      limitInputPixels: 4_000_000,
    }).metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width > 1080 ||
      metadata.height > 4096 ||
      valid.x + valid.width > metadata.width ||
      valid.y + valid.height > metadata.height
    )
      throw new Error('Invalid canvas image bounds');
    if (createHash('sha256').update(image).digest('hex') !== source.hash)
      throw new Error('Canvas source hash mismatch');
    const input = await sharp(image)
      .toColourspace('srgb')
      .ensureAlpha()
      .raw()
      .toBuffer();
    const rect = {
      x: x + valid.x,
      y: y + valid.y,
      width: valid.width,
      height: valid.height,
    };
    if (
      this.extent &&
      (rect.x + rect.width > this.extent.width - this.extent.gutter ||
        rect.y + rect.height > this.extent.height)
    )
      throw new Error('Observation exceeds measured page domain');
    const updates: {
      key: string;
      tile: Tile;
      pixels: Buffer;
      png: Buffer;
      file: string;
      known: number;
    }[] = [];
    for (
      let ty = Math.floor(rect.y / 256);
      ty <= Math.floor((rect.y + rect.height - 1) / 256);
      ty++
    )
      for (
        let tx = Math.floor(rect.x / 256);
        tx <= Math.floor((rect.x + rect.width - 1) / 256);
        tx++
      ) {
        const key = `${tx}:${ty}`,
          old = this.tiles.get(key);
        const pixels = old
          ? await sharp(
              await readFile(join(this.directory, old.versions.at(-1)!.file)),
            )
              .ensureAlpha()
              .raw()
              .toBuffer()
          : Buffer.alloc(256 * 256 * 4);
        const left = Math.max(rect.x, tx * 256),
          top = Math.max(rect.y, ty * 256),
          right = Math.min(rect.x + rect.width, (tx + 1) * 256),
          bottom = Math.min(rect.y + rect.height, (ty + 1) * 256);
        let changed = false,
          known = old?.known ?? 0;
        for (let py = top; py < bottom; py++)
          for (let px = left; px < right; px++) {
            const target = ((py - ty * 256) * 256 + px - tx * 256) * 4;
            const origin = ((py - y) * metadata.width + px - x) * 4;
            if (input[origin + 3] !== 255)
              throw new Error('Canvas sources must be opaque');
            if (!pixels[target + 3]) {
              known++;
              changed = true;
            }
            // JPEG recapture noise below eight channel levels is not a semantic
            // change. Actual observed frames always remain authoritative in replay.
            else if (
              [0, 1, 2].some(
                (c) => Math.abs(pixels[target + c] - input[origin + c]) > 8,
              )
            )
              changed = true;
          }
        if (!changed) continue;
        for (let py = top; py < bottom; py++)
          for (let px = left; px < right; px++) {
            const target = ((py - ty * 256) * 256 + px - tx * 256) * 4,
              origin = ((py - y) * metadata.width + px - x) * 4;
            input.copy(pixels, target, origin, origin + 4);
          }
        const png = await sharp(pixels, {
          raw: { width: 256, height: 256, channels: 4 },
        })
          .png()
          .toBuffer();
        const file = createHash('sha256').update(png).digest('hex') + '.png';
        updates.push({
          key,
          tile: old ?? { x: tx * 256, y: ty * 256, known: 0, versions: [] },
          pixels,
          png,
          file,
          known,
        });
      }
    const newFiles = new Map(
      updates
        .filter((u) => !this.files.has(u.file))
        .map((u) => [u.file, u.png]),
    );
    const newBytes = [...newFiles.values()].reduce((n, b) => n + b.length, 0);
    if (
      this.totalBytes + newBytes > this.limits.bytes ||
      this.patchCount + updates.length > this.limits.patches
    )
      throw new CanvasLimit('Canvas derivative limit reached');
    await mkdir(this.directory, { recursive: true, mode: 0o750 });
    for (const [file, png] of newFiles)
      await writeFile(join(this.directory, file), png, {
        mode: 0o640,
        flag: 'wx',
      });
    const revision = this.observations.length + 1;
    for (const u of updates) {
      u.tile.versions.push({ revision, file: u.file, bytes: u.png.length });
      u.tile.known = u.known;
      this.tiles.set(u.key, u.tile);
    }
    for (const [file, png] of newFiles) this.files.set(file, png.length);
    this.totalBytes += newBytes;
    this.patchCount += updates.length;
    this.observations.push({
      ...source,
      revision,
      rect,
      changedTiles: updates.length,
    });
    return { revision, changedTiles: updates.length, newBytes };
  }

  async view(rect: PixelRect, atMs = Infinity) {
    if (
      ![rect.x, rect.y, rect.width, rect.height].every(Number.isSafeInteger) ||
      rect.x < 0 ||
      rect.y < 0 ||
      rect.width < 1 ||
      rect.height < 1 ||
      rect.width > 1080 ||
      rect.height > 4096 ||
      rect.width * rect.height > 4_000_000
    )
      throw new Error('Canvas preview exceeds decoded bounds');
    const revision =
      [...this.observations].reverse().find((o) => o.elapsedMs <= atMs)
        ?.revision ?? 0;
    const input: OverlayOptions[] = [];
    for (const tile of this.tiles.values()) {
      const v = [...tile.versions]
        .reverse()
        .find((v) => v.revision <= revision);
      if (!v) continue;
      const x = Math.max(rect.x, tile.x),
        y = Math.max(rect.y, tile.y),
        right = Math.min(rect.x + rect.width, tile.x + 256),
        bottom = Math.min(rect.y + rect.height, tile.y + 256);
      if (right <= x || bottom <= y) continue;
      input.push({
        input: await sharp(await readFile(join(this.directory, v.file)))
          .extract({
            left: x - tile.x,
            top: y - tile.y,
            width: right - x,
            height: bottom - y,
          })
          .png()
          .toBuffer(),
        left: x - rect.x,
        top: y - rect.y,
      });
    }
    return sharp({
      create: {
        width: rect.width,
        height: rect.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(input)
      .png()
      .toBuffer();
  }

  manifest() {
    const observed = this.observations.map((o) => o.rect);
    const minX = observed.length ? Math.min(...observed.map((r) => r.x)) : 0,
      minY = observed.length ? Math.min(...observed.map((r) => r.y)) : 0;
    const knownPixels = [...this.tiles.values()].reduce(
      (n, t) => n + t.known,
      0,
    );
    const complete = Boolean(
      this.extent &&
      this.topSeen &&
      this.bottomSeen &&
      knownPixels ===
        (this.extent.width - this.extent.gutter) * this.extent.height,
    );
    return {
      version: 1,
      identity: this.identity,
      tileSize: 256,
      extentStatus: this.extent ? 'measured' : 'unknown',
      coverageStatus: complete ? 'complete' : 'partial',
      documentExtent: this.extent,
      coverageDomain: this.extent
        ? {
            x: 0,
            y: 0,
            width: this.extent.width - this.extent.gutter,
            height: this.extent.height,
          }
        : null,
      topReached: this.extent ? this.topSeen : null,
      bottomReached: this.extent ? this.bottomSeen : null,
      observedBounds: {
        x: minX,
        y: minY,
        width: observed.length
          ? Math.max(...observed.map((r) => r.x + r.width)) - minX
          : 0,
        height: observed.length
          ? Math.max(...observed.map((r) => r.y + r.height)) - minY
          : 0,
      },
      knownPixels,
      storedBytes: this.totalBytes,
      patchCount: this.patchCount,
      observations: this.observations,
      tiles: [...this.tiles.values()],
      note: 'Latest observed mosaic, not a simultaneous whole-page capture. Transparent pixels are unknown; old regions may be stale.',
    };
  }
}
