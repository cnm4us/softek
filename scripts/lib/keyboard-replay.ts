import sharp from 'sharp';
import type { ReplayFrame } from './recording-replay.js';

// Older window frames report masking but not its exact rectangle. Only decorate
// the verified, uniform blank area at the bottom; never estimate over page text.
async function blankRegionTop(image: Buffer, frame: ReplayFrame) {
  if (
    frame.context?.surface?.method !== 'window-crop-v1' ||
    !frame.context.surface.maskedKeyboard ||
    frame.width < 240
  )
    return null;
  if (frame.context.page)
    return Math.min(frame.height, frame.context.page.image.valid.height + 8);
  const { data, info } = await sharp(image)
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (
    info.width !== frame.width ||
    info.height !== frame.height ||
    info.channels !== 3
  )
    return null;
  const fill = [245, 246, 241]; // Native window-crop-v1 canvas color, JPEG tolerance.
  let row = info.height - 1;
  rows: for (; row >= 0; row--) {
    for (let x = 0; x < info.width; x++) {
      const index = (row * info.width + x) * 3;
      if (fill.some((value, c) => Math.abs(data[index + c] - value) > 3))
        break rows;
    }
  }
  return Math.min(info.height, row + 9);
}

export async function keyboardPlaceholder(
  image: Buffer,
  frame: ReplayFrame,
  minimumTop = 0,
) {
  const absent = { image, regionTop: null as number | null };
  const detected = await blankRegionTop(image, frame);
  if (detected === null) return absent;
  const regionTop = Math.max(detected, minimumTop),
    available = frame.height - regionTop;
  if (available < 128) return absent;
  const width = Math.min(420, frame.width - 48),
    height = Math.min(132, available - 24);
  const left = Math.floor((frame.width - width) / 2),
    top = regionTop + Math.floor((available - height) / 2);
  const titleSize = Math.min(26, Math.floor(width / 12)),
    captionSize = Math.min(20, titleSize);
  const panel = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="12" fill="#e7ebe8" stroke="#c4cec8"/><g text-anchor="middle" font-family="DejaVu Sans,sans-serif" fill="#435b50"><text x="${width / 2}" y="${height / 2 - 5}" font-size="${titleSize}" font-weight="600">Keyboard area</text><text x="${width / 2}" y="${height / 2 + 26}" font-size="${captionSize}">Not captured</text></g></svg>`,
  );
  return {
    image: await sharp(image)
      .composite([{ input: panel, left, top }])
      .png()
      .toBuffer(),
    regionTop,
  };
}

export type KeyboardReconstruction = {
  source: number;
  donor: number;
  donorElapsedMs: number;
  relativeMs: number;
  top: number;
  height: number;
  dy: number;
  matched: number;
  error: number;
};

// This borrows pixels from a different instant, never invents hidden content.
// Limit donors to the nearest stable, unmasked observation on each side within
// the same contiguous document route. Visible registration cannot prove that
// hidden content was unchanged, so provenance must accompany every filled frame.
export async function planKeyboardReconstruction(
  image: Buffer,
  frame: ReplayFrame,
  frames: ReplayFrame[],
  source: (sequence: number) => Promise<Buffer>,
  options: {
    searchAll?: boolean;
    minimumTop?: number;
    registrationTop?: number;
  } = {},
): Promise<KeyboardReconstruction | null> {
  const detected = await blankRegionTop(image, frame);
  let top = detected === null ? null : Math.max(0, detected - 8);
  if (top !== null) top = Math.max(top, options.minimumTop ?? 0);
  const g = frame.context?.geometry;
  if (
    top === null ||
    frame.height - top < 64 ||
    top < 300 ||
    !g ||
    g.container !== 'document' ||
    g.scale !== 1 ||
    g.offsetX !== 0 ||
    g.scrollX !== 0 ||
    frame.context?.unstable ||
    (frame.context?.page && frame.context.page.web.layer !== 'document')
  )
    return null;
  // JPEG ringing leaves a few faded rows at the clip edge. Recover at most
  // sixteen such rows; strong text/control pixels still stop the boundary.
  const rgb = await sharp(image).removeAlpha().raw().toBuffer();
  const strictTop = top;
  rows: while (
    !frame.context?.page &&
    top > Math.max(options.minimumTop ?? 0, strictTop - 16)
  ) {
    for (let x = 0; x < frame.width; x++) {
      const i = ((top - 1) * frame.width + x) * 3;
      if ([245, 246, 241].some((v, c) => Math.abs(rgb[i + c] - v) > 25))
        break rows;
    }
    top--;
  }
  const index = frames.findIndex((f) => f.sequence === frame.sequence);
  if (index < 0) return null;
  const donors: ReplayFrame[] = [];
  for (const direction of [-1, 1]) {
    for (
      let i = index + direction;
      i >= 0 && i < frames.length;
      i += direction
    ) {
      const d = frames[i],
        dg = d.context?.geometry;
      const previous = frames[i - direction];
      if (
        Math.abs(d.sequence - previous.sequence) !== 1 ||
        Math.abs(d.elapsedMs - frame.elapsedMs) > 30_000 ||
        !dg ||
        dg.route !== g.route ||
        dg.width !== g.width ||
        dg.scale !== g.scale ||
        dg.container !== 'document' ||
        dg.scrollX !== 0 ||
        dg.offsetX !== 0 ||
        d.width !== frame.width ||
        d.height !== frame.height ||
        d.context?.surface?.method !== 'window-crop-v1' ||
        (frame.context?.page &&
          (!d.context?.page ||
            d.context.page.web.visit !== frame.context.page.web.visit ||
            d.context.page.web.layout !== frame.context.page.web.layout))
      )
        break;
      if (
        !d.context.unstable &&
        !d.context.surface.maskedKeyboard &&
        !d.context.surface.anchoredPopover &&
        (!d.context.page || d.context.page.web.layer === 'document')
      ) {
        donors.push(d);
        if (!options.searchAll || donors.length >= 16) break;
      }
    }
  }
  const smallWidth = 120,
    ratio = smallWidth / frame.width;
  const target = await sharp(image)
    .removeAlpha()
    .greyscale()
    .resize({ width: smallWidth })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const visibleHeight = Math.floor((top - 16) * ratio);
  let best: KeyboardReconstruction | null = null;
  for (const donor of donors) {
    const donorImage = await source(donor.sequence);
    const dm = await sharp(donorImage).metadata();
    if (dm.width !== frame.width || dm.height !== frame.height) continue;
    const gray = await sharp(donorImage)
      .removeAlpha()
      .greyscale()
      .resize({ width: smallWidth })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const predicted = Math.round(
      ((g.containerY - donor.context!.geometry.containerY) * frame.width) /
        g.width,
    );
    // Metadata is only a search hint. Require agreement across textured visible
    // bands and the seam; reject changed layouts/menus even if geometry agrees.
    let match: {
      dy: number;
      error: number;
      matched: number;
      score: number;
    } | null = null;
    for (
      let shift = Math.round(predicted * ratio) - 4;
      shift <= Math.round(predicted * ratio) + 4;
      shift++
    ) {
      const begin = Math.max(
          2,
          Math.floor((options.registrationTop ?? 0) * ratio),
          -shift + 2,
        ),
        end = Math.min(visibleHeight, gray.info.height - shift - 2);
      if (end - begin < 50 || end < visibleHeight - 2) continue;
      let error = 0,
        matched = 0,
        count = 0,
        seamError = 0,
        seamCount = 0,
        texturedBands = 0;
      for (let band = 0; band < 4; band++) {
        let edges = 0,
          alignedEdges = 0;
        const first = begin + Math.floor(((end - begin) * band) / 4),
          last = begin + Math.floor(((end - begin) * (band + 1)) / 4);
        for (let y = first; y < last; y++)
          for (let x = 3; x < smallWidth - 3; x++) {
            const a = target.data[y * smallWidth + x],
              b = gray.data[(y + shift) * smallWidth + x];
            const diff = Math.abs(a - b);
            error += diff;
            matched += diff <= 15 ? 1 : 0;
            count++;
            if (y >= end - 24) {
              seamError += diff;
              seamCount++;
            }
            const ae = Math.abs(a - target.data[y * smallWidth + x - 1]);
            const be = Math.abs(
              b - gray.data[(y + shift) * smallWidth + x - 1],
            );
            if (ae > 15) {
              edges++;
              if (diff < 20 && Math.abs(ae - be) < 20) alignedEdges++;
            }
          }
        if (edges >= 25 && alignedEdges / edges > 0.65) texturedBands++;
      }
      const mean = error / count,
        fraction = matched / count,
        seam = seamError / Math.max(1, seamCount);
      // A reported validation bubble legitimately changes visible pixels. It
      // can relax the global score, but still needs two agreeing textured bands
      // and the same strict seam check; the bubble itself is never overwritten.
      const popover = frame.context?.surface?.anchoredPopover;
      const extending = (options.minimumTop ?? 0) > 0;
      if (
        mean > (popover && !extending ? 10 : 8) ||
        fraction < (popover && !extending ? 0.84 : 0.9) ||
        seam > (extending ? 3 : 6) ||
        texturedBands < (extending ? 1 : 2)
      )
        continue;
      const score = mean + seam * 0.5;
      if (!match || score < match.score)
        match = { dy: shift / ratio, error: mean, matched: fraction, score };
    }
    if (!match) continue;
    // Refine at full resolution to avoid a visibly misaligned seam. Scoring is
    // confined to the 128 visible rows above the mask, tolerating a native bubble
    // elsewhere while still requiring the page edge and controls to line up.
    const [a, b] = await Promise.all([
      sharp(image).removeAlpha().greyscale().raw().toBuffer(),
      sharp(donorImage).removeAlpha().greyscale().raw().toBuffer(),
    ]);
    let dy = Math.round(match.dy),
      minError = Infinity;
    for (
      let shift = Math.round(match.dy) - Math.ceil(1 / ratio);
      shift <= Math.round(match.dy) + Math.ceil(1 / ratio);
      shift++
    ) {
      let error = 0,
        count = 0;
      for (let y = Math.max(0, top - 160); y < top - 16; y += 2) {
        if (y + shift < 0 || y + shift >= frame.height) continue;
        for (let x = 12; x < frame.width - 12; x += 2) {
          error += Math.abs(
            a[y * frame.width + x] - b[(y + shift) * frame.width + x],
          );
          count++;
        }
      }
      if (count && error / count < minError) {
        minError = error / count;
        dy = shift;
      }
    }
    if (minError > 6 || top + dy < 0) continue;
    const height = Math.min(frame.height - top, donor.height - dy - top);
    if (height < (options.searchAll ? 8 : 64)) continue;
    const result: KeyboardReconstruction = {
      source: frame.sequence,
      donor: donor.sequence,
      donorElapsedMs: donor.elapsedMs,
      relativeMs: donor.elapsedMs - frame.elapsedMs,
      top,
      height,
      dy,
      matched: Number(match.matched.toFixed(4)),
      error: Number(minError.toFixed(3)),
    };
    // Prefer coverage, then proximity. Never seek a more distant observation
    // beyond the nearest eligible donor just to make a nicer-looking composite.
    if (
      !best ||
      height > best.height + 8 ||
      (Math.abs(height - best.height) <= 8 &&
        Math.abs(result.relativeMs) < Math.abs(best.relativeMs))
    )
      best = result;
  }
  return best;
}

export type PageReconstruction = {
  source: number;
  strips: KeyboardReconstruction[];
  top: number;
  end: number;
};

// Extend an observed viewport with several independently registered strips.
// Each added source is tested against the existing observed/reconstructed area;
// no global page bitmap is allowed to replace actual tooltip/input pixels.
export async function planPageReconstruction(
  image: Buffer,
  frame: ReplayFrame,
  frames: ReplayFrame[],
  source: (sequence: number) => Promise<Buffer>,
): Promise<PageReconstruction | null> {
  const strips: KeyboardReconstruction[] = [];
  let end = 0;
  for (let pass = 0; pass < 4; pass++) {
    const plan = await planKeyboardReconstruction(
      image,
      frame,
      frames,
      source,
      {
        searchAll: true,
        minimumTop: end,
        registrationTop: strips[0]?.top,
      },
    );
    if (!plan || plan.top + plan.height <= end) break;
    strips.push(plan);
    image = await applyKeyboardReconstruction(
      image,
      await source(plan.donor),
      plan,
    );
    end = plan.top + plan.height;
    if (end >= frame.height) break;
  }
  return strips.length
    ? { source: frame.sequence, strips, top: strips[0].top, end }
    : null;
}

export async function applyPageReconstruction(
  image: Buffer,
  plan: PageReconstruction,
  source: (sequence: number) => Promise<Buffer>,
) {
  for (const strip of plan.strips)
    image = await applyKeyboardReconstruction(
      image,
      await source(strip.donor),
      strip,
    );
  return image;
}

export async function applyKeyboardReconstruction(
  image: Buffer,
  donor: Buffer,
  plan: KeyboardReconstruction,
) {
  const meta = await sharp(image).metadata();
  const strip = await sharp(donor)
    .extract({
      left: 0,
      top: plan.top + plan.dy,
      width: meta.width!,
      height: plan.height,
    })
    .png()
    .toBuffer();
  return sharp(image)
    .composite([{ input: strip, left: 0, top: plan.top }])
    .png()
    .toBuffer();
}
