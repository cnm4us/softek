import sharp from 'sharp';
import type { ReplayFrame } from './recording-replay.js';
import {
  pageContextKey,
  type buildLegacyReferences,
} from './session-reference.js';
export type ReferenceFill = {
  image: Buffer;
  source: number;
  reference: string;
  rect: { x: number; y: number; width: number; height: number };
  knownPixels: number;
  missingPixels: number;
  usedLater: boolean;
  outsideDocumentPixels: number;
  sourceIds: number[];
  sourceCount: number;
  sourceIdsTruncated: boolean;
  timeRangeMs: { min: number; max: number } | null;
  label: string;
};

export async function fillFromReference(
  frame: ReplayFrame,
  image: Buffer,
  references: Awaited<ReturnType<typeof buildLegacyReferences>>,
): Promise<ReferenceFill | null> {
  const context = frame.context,
    page = context?.page;
  if (
    !page ||
    context?.unstable ||
    page.web.layer !== 'document' ||
    !context.surface?.maskedKeyboard ||
    context.geometry.scale !== 1 ||
    context.geometry.container !== 'document' ||
    page.web.scrollX !== 0
  )
    return null;
  const reference = references.pages.find(
    (p) => p.key === pageContextKey(frame),
  );
  if (
    !reference ||
    (reference.limitedAt !== undefined && frame.sequence >= reference.limitedAt)
  )
    return null;
  const ratio = frame.width / page.web.clientWidth,
    originY = Math.round(page.web.scrollY * ratio);
  const top = page.image.valid.height,
    documentHeight = Math.round(page.web.documentHeight * ratio);
  const height = Math.min(frame.height - top, documentHeight - originY - top),
    width = frame.width;
  if (height <= 0 || originY < 0) return null;
  const rect = { x: 0, y: originY + top, width, height };
  const [past, later] = await Promise.all([
    reference.canvas.view(rect, frame.elapsedMs),
    reference.canvas.view(rect),
  ]);
  const [a, b] = await Promise.all([
    sharp(past).ensureAlpha().raw().toBuffer(),
    sharp(later).ensureAlpha().raw().toBuffer(),
  ]);
  let knownPixels = 0,
    missingPixels = 0,
    usedLater = false;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width - 12; x++) {
      const i = (y * width + x) * 4;
      if (a[i + 3]) knownPixels++;
      else if (b[i + 3]) {
        b.copy(a, i, i, i + 4);
        knownPixels++;
        usedLater = true;
      } else {
        const shade = (Math.floor(x / 12) + Math.floor(y / 12)) % 2 ? 220 : 240;
        a[i] = a[i + 1] = a[i + 2] = shade;
        a[i + 3] = 255;
        missingPixels++;
      }
    }
  if (!knownPixels) return null;
  const overlay = await sharp(a, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
  const filled = await sharp(image)
    .composite([{ input: overlay, left: 0, top }])
    .png()
    .toBuffer();
  const sources = reference.canvas.sourceObservations(
    rect,
    usedLater ? Infinity : frame.elapsedMs,
  );
  const times = sources.map((s) => s.elapsedMs - frame.elapsedMs);
  const format = (ms: number) =>
    (ms >= 0 ? '+' : '') + (ms / 1000).toFixed(1) + 's';
  const range = times.length
    ? `${format(Math.min(...times))} to ${format(Math.max(...times))}`
    : 'unknown';
  return {
    image: filled,
    source: frame.sequence,
    reference: reference.canvas.identity,
    rect,
    knownPixels,
    missingPixels,
    usedLater,
    outsideDocumentPixels:
      Math.max(0, frame.height - top - height) * (width - 12),
    sourceIds: sources.slice(0, 64).map((s) => s.sequence),
    sourceCount: sources.length,
    sourceIdsTruncated: sources.length > 64,
    timeRangeMs: times.length
      ? { min: Math.min(...times), max: Math.max(...times) }
      : null,
    label: `Reference fill: ${range}; reconstructed${missingPixels ? ' / partial' : ''}`,
  };
}
