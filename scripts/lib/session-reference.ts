import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { PageCanvas, CanvasLimit } from './page-canvas.js';
import { alignVertical, type ReplayFrame } from './recording-replay.js';

export function pageContextKey(frame: ReplayFrame) {
  const c = frame.context,
    p = c?.page?.web,
    g = c?.geometry;
  return p && g
    ? [
        g.route,
        p.visit,
        p.layout,
        p.clientWidth,
        p.documentWidth,
        p.documentHeight,
        p.fontSize,
        p.lineHeight,
        frame.width,
        frame.height,
      ].join(':')
    : null;
}

// A focus-style change can spoil the whole-image score after the keyboard
// closes. Require two separated, textured, full-width matching bands at the
// metadata-consistent displacement before extending only the unseen lower tail.
async function matchingBands(a: Buffer, b: Buffer, dy: number) {
  const [aa, bb] = await Promise.all(
    [a, b].map((image) =>
      sharp(image)
        .removeAlpha()
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true }),
    ),
  );
  if (aa.info.width !== bb.info.width || aa.info.height !== bb.info.height)
    return [];
  const width = aa.info.width,
    height = aa.info.height,
    bandHeight = 128;
  const begin = Math.max(2, -dy + 2),
    end = Math.min(height - 2, height - dy - 2);
  const gutter = Math.max(2, Math.ceil(width / 60));
  const bands: number[] = [];
  for (let top = begin; top + bandHeight <= end; top += bandHeight) {
    let count = 0,
      error = 0,
      matched = 0,
      edges = 0,
      edgeError = 0;
    for (let y = top; y < top + bandHeight; y++)
      for (let x = gutter; x < width - gutter; x++) {
        const ai = (y + dy) * width + x,
          bi = y * width + x;
        const diff = Math.abs(aa.data[ai] - bb.data[bi]);
        const ae = Math.abs(aa.data[ai] - aa.data[ai - 1]);
        const be = Math.abs(bb.data[bi] - bb.data[bi - 1]);
        count++;
        error += diff;
        matched += diff <= 15 ? 1 : 0;
        if (ae > 12 || be > 12) {
          edges++;
          edgeError += Math.abs(ae - be);
        }
      }
    if (
      edges >= 100 &&
      error / count < 3 &&
      matched / count > 0.97 &&
      edgeError / edges < 25
    )
      bands.push(top);
  }
  return bands.length >= 2 && bands.at(-1)! - bands[0] >= bandHeight * 2
    ? [bands[0], bands.at(-1)!]
    : [];
}

export async function buildLegacyReferences(options: {
  recordingId: string;
  frames: ReplayFrame[];
  source: (n: number) => Promise<Buffer>;
  directory: string;
  deadline?: number;
}) {
  const { frames, source, directory, recordingId } = options;
  const pages: {
    canvas: PageCanvas;
    route: string;
    frames: number[];
    limited: boolean;
    limitedAt?: number;
    key: string | null;
    lastFull?: ReplayFrame;
    lastFullY?: number;
  }[] = [];
  const placements = new Map<number, { page: number; x: number; y: number }>();
  let active: (typeof pages)[number] | null = null,
    last: ReplayFrame | null = null;
  let lastRoute: string | null = null,
    totalBytes = 0,
    totalPatches = 0;
  const measuredPages = new Map<string, (typeof pages)[number]>();
  const lastKeyboard = new Map<string, number>();
  for (const frame of frames) {
    if (options.deadline && Date.now() > options.deadline)
      throw new Error('Replay reference time limit reached');
    const c = frame.context,
      g = c?.geometry;
    if (c?.page && g) {
      const { web, image: bounds } = c.page;
      const key = pageContextKey(frame)!;
      if (
        c.surface?.maskedKeyboard &&
        web.layer === 'document' &&
        g.container === 'document'
      )
        lastKeyboard.set(key, frame.elapsedMs);
      if (
        (c.unstable && bounds.excluded.length > 0) ||
        web.layer !== 'document' ||
        g.container !== 'document' ||
        g.scale !== 1 ||
        web.scrollX !== 0 ||
        web.scrollY < 0 ||
        c.surface?.anchoredPopover ||
        bounds.valid.height === 0 ||
        Math.abs(web.documentWidth - web.clientWidth) > 1
      )
        continue;
      const ratio = frame.width / web.clientWidth;
      const extentWidth = Math.round(web.documentWidth * ratio),
        extentHeight = Math.round(web.documentHeight * ratio);
      let page = measuredPages.get(key);
      if (!page) {
        if (pages.length >= 64) break;
        page = {
          canvas: new PageCanvas(
            join(directory, `page-${pages.length + 1}`),
            `${recordingId}:${key}`,
            {
              bytes: 128 * 1024 ** 2 - totalBytes,
              patches: 4096 - totalPatches,
            },
          ),
          route: g.route,
          frames: [],
          limited: false,
          key,
        };
        page.canvas.setMeasuredExtent(extentWidth, extentHeight, 12);
        pages.push(page);
        measuredPages.set(key, page);
      }
      const x = Math.round(web.scrollX * ratio),
        expectedY = Math.round(web.scrollY * ratio);
      let y = expectedY,
        aligned = false,
        matched: number | undefined;
      let anchorBands: number[] = [];
      let tailTop = 0;
      const image = await source(frame.sequence);
      const full =
        bounds.excluded.length === 0 && bounds.valid.height === frame.height;
      const delta = expectedY - (page.lastFullY ?? expectedY);
      if (
        full &&
        page.lastFull &&
        Math.abs(delta) <= frame.height * 0.75 + 128
      ) {
        const previousImage = await source(page.lastFull.sequence);
        const match = await alignVertical(previousImage, image);
        const tolerance = c.unstable
          ? Math.min(128, Math.max(6, c.uncertaintyMs * 0.8))
          : 6;
        const accepted =
          match.accepted ||
          (Math.abs(match.dy) < 4 &&
            match.error < 3 &&
            match.matched > 0.97 &&
            match.edgeError < 25);
        if (accepted && Math.abs(match.dy - delta) <= tolerance) {
          y = page.lastFullY! + match.dy;
          aligned = true;
          matched = match.matched;
        } else if (
          !c.unstable &&
          c.reason === 'scroll' &&
          match.dy > 0 &&
          frame.elapsedMs - (lastKeyboard.get(key) ?? -Infinity) <= 10_000 &&
          Math.abs(match.dy - delta) <= 6 &&
          match.matched > 0.9 &&
          match.error < 6 &&
          match.edgeError < 25
        ) {
          const placedY = page.lastFullY! + match.dy;
          const observed = page.canvas.manifest().observedBounds;
          const cropTop = observed
            ? observed.y + observed.height - placedY
            : frame.height;
          if (cropTop >= frame.height / 2 && cropTop < frame.height) {
            anchorBands = await matchingBands(previousImage, image, match.dy);
            if (anchorBands.length) {
              y = placedY;
              aligned = true;
              matched = match.matched;
              tailTop = cropTop;
            }
          }
        }
      }
      if (c.unstable && !aligned) continue;
      if (
        full &&
        page.lastFull &&
        !aligned &&
        Math.abs(delta) <= frame.height * 0.75 &&
        c.reason === 'scroll'
      )
        continue;
      // A registered return scroll can land just above the document origin
      // because capture and geometry sample different instants. Preserve that
      // viewport rather than clamping its pixels into a false page position.
      if (y < 0 || y >= extentHeight) continue;
      const valid = {
        ...bounds.valid,
        y: tailTop,
        width: Math.min(bounds.valid.width - 12, extentWidth - 12 - x),
        height: Math.min(bounds.valid.height, extentHeight - y) - tailTop,
      };
      if (valid.width <= 0 || valid.height <= 0) continue;
      try {
        page.canvas.restrictBudget(
          128 * 1024 ** 2 - totalBytes,
          4096 - totalPatches,
        );
        const result = await page.canvas.add({
          sequence: frame.sequence,
          elapsedMs: frame.elapsedMs,
          capturedAt: frame.capturedAt,
          hash: frame.hash,
          image,
          mapping: {
            method: anchorBands.length
              ? 'image-anchors'
              : aligned
                ? 'image-aligned'
                : 'metadata',
            expectedY,
            placedY: y,
            ...(matched === undefined ? {} : { matched }),
            ...(anchorBands.length ? { anchorBands } : {}),
          },
          x,
          y,
          valid,
        });
        totalBytes += result.newBytes;
        totalPatches += result.changedTiles;
        if (totalBytes > 128 * 1024 ** 2 || totalPatches > 4096)
          throw new CanvasLimit('Canvas derivative limit reached');
        page.canvas.noteBoundaries(
          web.top && y <= 1,
          web.bottom && bounds.excluded.length === 0,
        );
        page.frames.push(frame.sequence);
        placements.set(frame.sequence, { page: pages.indexOf(page), x, y });
        if (full && !anchorBands.length) {
          page.lastFull = frame;
          page.lastFullY = y;
        }
      } catch (error) {
        if (!(error instanceof CanvasLimit)) throw error;
        page.limited = true;
        page.limitedAt = frame.sequence;
        break;
      }
      continue;
    }
    if (!g || g.route !== lastRoute) {
      active = null;
      last = null;
      lastRoute = g?.route ?? null;
    }
    if (c?.reason === 'ui') {
      active = null;
      last = null;
      continue;
    }
    if (
      !g ||
      !c ||
      c.unstable ||
      g.container !== 'document' ||
      g.scale !== 1 ||
      g.offsetX !== 0 ||
      g.scrollX !== 0 ||
      g.containerY < 0 ||
      c.surface?.maskedKeyboard ||
      c.surface?.anchoredPopover
    )
      continue;
    const image = await source(frame.sequence);
    let x = 0,
      y = Math.round((g.containerY * frame.width) / g.width);
    if (active && last) {
      const old = last.context!.geometry;
      if (
        last.width !== frame.width ||
        last.height !== frame.height ||
        old.width !== g.width ||
        old.scale !== g.scale
      ) {
        active = null;
        last = null;
      } else {
        const match = await alignVertical(await source(last.sequence), image);
        const expected =
          ((g.containerY - old.containerY) * frame.width) / g.width;
        const aligned =
          (match.accepted ||
            (Math.abs(match.dy) < 4 &&
              match.error < 3 &&
              match.matched > 0.97 &&
              match.edgeError < 25)) &&
          Math.abs(match.dy - expected) <= 6;
        if (aligned) {
          const before = placements.get(last.sequence)!;
          y = before.y + match.dy;
        } else {
          active = null;
          last = null;
        }
      }
    }
    if (!active) {
      if (pages.length >= 64) break;
      active = {
        canvas: new PageCanvas(
          join(directory, `page-${pages.length + 1}`),
          `${recordingId}:${pages.length + 1}`,
          { bytes: 128 * 1024 ** 2 - totalBytes, patches: 4096 - totalPatches },
        ),
        route: g.route,
        frames: [],
        limited: false,
        key: null,
      };
      pages.push(active);
    }
    if (y < 0) continue;
    try {
      const result = await active.canvas.add({
        sequence: frame.sequence,
        elapsedMs: frame.elapsedMs,
        capturedAt: frame.capturedAt,
        hash: frame.hash,
        image,
        x,
        y,
        valid: { x: 0, y: 0, width: frame.width - 12, height: frame.height },
      });
      totalBytes += result.newBytes;
      totalPatches += result.changedTiles;
      if (totalBytes > 128 * 1024 ** 2 || totalPatches > 4096)
        throw new CanvasLimit('Canvas derivative limit reached');
      active.frames.push(frame.sequence);
      placements.set(frame.sequence, { page: pages.indexOf(active), x, y });
      last = frame;
    } catch (error) {
      if (!(error instanceof CanvasLimit)) throw error;
      active.limited = true;
      active.limitedAt = frame.sequence;
      break;
    }
  }
  const manifests = pages.map((p) => ({
    ...p.canvas.manifest(),
    route: p.route,
    frames: p.frames,
    limited: p.limited,
    limitedAt: p.limitedAt ?? null,
  }));
  return {
    pages,
    placements,
    manifest: {
      version: 1,
      recordingId,
      mode: frames.some((f) => f.context?.page)
        ? 'versioned-page-context'
        : 'legacy-inferred',
      note: frames.some((f) => f.context?.page)
        ? 'Per-recording latest-observed mosaics. Extent/endpoints are client-reported for compatible layouts; the scrollbar gutter is excluded. Off-screen freshness is unknown.'
        : 'Per-recording latest-observed mosaics. Extent/endpoints unknown. Overlap is image-verified; layout/freshness outside observed regions is not established.',
      storedBytes: totalBytes,
      patchCount: totalPatches,
      pages: manifests,
    },
  };
}

export async function writeReferencePreview(
  result: Awaited<ReturnType<typeof buildLegacyReferences>>,
  output: string,
  route?: string,
) {
  const references: {
    page: number;
    route: string;
    rect: { x: number; y: number; width: number; height: number };
    truncated: boolean;
    coverageStatus: string;
    extentStatus: string;
    topReached: boolean | null;
    bottomReached: boolean | null;
    limited: boolean;
    coveragePercent: number | null;
    sourceCount: number;
    firstCapturedAt: string;
    lastCapturedAt: string;
  }[] = [];
  let previewBytes = 0;
  await mkdir(output, { recursive: true, mode: 0o750 });
  for (let index = 0; index < result.pages.length; index++) {
    const p = result.pages[index],
      m = p.canvas.manifest();
    if (!m.knownPixels) continue;
    const bounds = m.observedBounds;
    const rect = {
      ...bounds,
      height: Math.min(
        bounds.height,
        3900,
        Math.floor(3_800_000 / bounds.width),
      ),
    };
    const page = await p.canvas.view(rect);
    const coverage =
      m.coverageStatus === 'complete'
        ? 'Complete supported page area · scrollbar gutter excluded'
        : m.extentStatus === 'measured'
          ? 'Partial coverage · captured regions only'
          : 'Partial coverage · full extent / endpoints unknown';
    const label = Buffer.from(
      `<svg width="${rect.width}" height="110"><rect width="100%" height="100%" fill="#17372f"/><g fill="white" font-family="DejaVu Sans,sans-serif" font-size="18"><text x="12" y="28">Session page reference · ${p.route}</text><text x="12" y="55">Latest observed regions · captured at different times</text><text x="12" y="82">${coverage}</text></g></svg>`,
    );
    const checker = Buffer.from(
      `<svg width="${rect.width}" height="${rect.height}"><defs><pattern id="unknown" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#eee"/><rect width="12" height="12" fill="#bbb"/><rect x="12" y="12" width="12" height="12" fill="#bbb"/></pattern></defs><rect width="100%" height="100%" fill="url(#unknown)"/></svg>`,
    );
    const body = await sharp(checker)
      .composite([{ input: page, left: 0, top: 0 }])
      .png()
      .toBuffer();
    const png = await sharp(body)
      .extend({ top: 110, bottom: 0, left: 0, right: 0, background: '#17372f' })
      .composite([{ input: label, left: 0, top: 0 }])
      .png()
      .toBuffer();
    if (
      result.manifest.storedBytes + previewBytes + png.length >
      128 * 1024 ** 2
    )
      continue;
    await writeFile(join(p.canvas.directory, 'preview.png'), png, {
      mode: 0o640,
    });
    previewBytes += png.length;
    references.push({
      page: index,
      route: p.route,
      rect,
      truncated: rect.height < bounds.height,
      coverageStatus: m.coverageStatus,
      extentStatus: m.extentStatus,
      topReached: m.topReached,
      bottomReached: m.bottomReached,
      limited: p.limited,
      coveragePercent: m.coverageDomain
        ? Math.min(
            100,
            Math.round(
              (1000 * m.knownPixels) /
                (m.coverageDomain.width * m.coverageDomain.height),
            ) / 10,
          )
        : null,
      sourceCount: m.observations.length,
      firstCapturedAt: m.observations[0].capturedAt,
      lastCapturedAt: m.observations.at(-1)!.capturedAt,
    });
  }
  const selected =
    references
      .filter((r) => !route || r.route === route)
      .sort(
        (a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height,
      )[0] ?? references[0];
  if (selected)
    await writeFile(
      join(output, 'canvas-preview.png'),
      await readFile(
        join(result.pages[selected.page].canvas.directory, 'preview.png'),
      ),
      { mode: 0o640 },
    );
  await writeFile(
    join(output, 'canvas.json'),
    JSON.stringify(
      {
        ...result.manifest,
        preview: selected ?? null,
        references,
        previewBytes,
      },
      null,
      2,
    ),
    { mode: 0o640 },
  );
  return { preview: selected ?? null, references, previewBytes };
}
