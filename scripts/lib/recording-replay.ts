import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import {
  chmod,
  lstat,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type {
  CaptureContext,
  Interaction,
} from '../../apps/mobile/src/change-capture.js';
import { gestureFilters } from './interaction-replay.js';
import {
  applyKeyboardReconstruction,
  keyboardPlaceholder,
  type KeyboardReconstruction,
  applyPageReconstruction,
  type PageReconstruction,
} from './keyboard-replay.js';
export { keyboardPlaceholder } from './keyboard-replay.js';
import type { ReferenceFill } from './reference-fill.js';

export type ReplayFrame = {
  sequence: number;
  elapsedMs: number;
  capturedAt: string;
  hash: string;
  width: number;
  height: number;
  context?: CaptureContext | null;
};
export type ReplayInterval = {
  startMs: number;
  endMs: number;
  kind: 'gap' | 'hold' | 'scroll';
  source?: number;
  next?: number;
  dy?: number;
  confidence?: number;
  reason: string;
  motion?: { atMs: number; position: number }[];
  motionStartMs?: number;
};
export type Alignment = {
  dy: number;
  error: number;
  matched: number;
  edgeError: number;
  accepted: boolean;
};
export const replayFps = 30; // Generated animation only; never a phone capture cadence.
const maxScrollFraction = 0.75; // Retain at least a quarter viewport of matched pixels.
const digest = (b: Buffer) => createHash('sha256').update(b).digest('hex');

export function timeline(
  frames: ReplayFrame[],
  stopMs: number,
  policy: 'periodic-v1' | 'changes-v2' = 'periodic-v1',
): ReplayInterval[] {
  if (!Number.isInteger(stopMs) || stopMs <= 0 || stopMs > 901_000)
    throw new Error('Replay needs a bounded, measured Stop time.');
  const ordered = [...frames].sort((a, b) => a.elapsedMs - b.elapsedMs);
  if (!ordered.length || ordered.length > 900)
    throw new Error('Replay needs 1–900 source frames.');
  const ids = new Set<number>();
  for (const f of ordered) {
    if (
      !Number.isInteger(f.sequence) ||
      f.sequence < 1 ||
      f.sequence > 900 ||
      ids.has(f.sequence) ||
      !Number.isInteger(f.elapsedMs) ||
      f.elapsedMs < 0 ||
      f.elapsedMs > stopMs ||
      !Number.isFinite(Date.parse(f.capturedAt)) ||
      !/^[a-f0-9]{64}$/.test(f.hash)
    )
      throw new Error('Invalid replay source metadata.');
    ids.add(f.sequence);
  }
  const intervals: ReplayInterval[] = [];
  const add = (i: ReplayInterval) => {
    if (i.endMs > i.startMs) intervals.push(i);
  };
  add({
    startMs: 0,
    endMs: ordered[0].elapsedMs,
    kind: 'gap',
    reason: 'No screenshot yet',
  });
  for (let n = 0; n < ordered.length; n++) {
    const f = ordered[n],
      next = ordered[n + 1];
    const endMs = next?.elapsedMs ?? stopMs;
    const missing =
      (next && next.sequence !== f.sequence + 1) ||
      (policy === 'periodic-v1' && endMs - f.elapsedMs > 1600);
    const observedEnd = missing
      ? policy === 'changes-v2'
        ? f.elapsedMs
        : Math.min(endMs, f.elapsedMs + 1000)
      : endMs;
    add({
      startMs: f.elapsedMs,
      endMs: observedEnd,
      kind: 'hold',
      source: f.sequence,
      ...(next && !missing ? { next: next.sequence } : {}),
      reason: 'Observed screenshot; next state cuts unless aligned',
    });
    if (missing)
      add({
        startMs: observedEnd,
        endMs,
        kind: 'gap',
        reason: 'Missing legacy screenshot interval',
      });
  }
  return intervals;
}

async function gray(input: Buffer, width?: number) {
  return sharp(input)
    .removeAlpha()
    .greyscale()
    .resize(width ? { width } : {})
    .raw()
    .toBuffer({ resolveWithObject: true });
}

// Whole-viewport vertical registration only. Menus, fixed layers and changing
// layout should fail this conservative check and retain their observed cut.
export async function alignVertical(a: Buffer, b: Buffer): Promise<Alignment> {
  const [aa, bb] = await Promise.all([gray(a, 90), gray(b, 90)]);
  const fail = {
    dy: 0,
    error: 255,
    matched: 0,
    edgeError: 255,
    accepted: false,
  };
  if (aa.info.width !== bb.info.width || aa.info.height !== bb.info.height)
    return fail;
  const w = aa.info.width,
    h = aa.info.height;
  function score(
    ad: Buffer,
    bd: Buffer,
    width: number,
    height: number,
    dy: number,
    step: number,
  ) {
    let error = 0,
      matched = 0,
      edges = 0,
      edgeError = 0,
      count = 0;
    const begin = Math.max(2, -dy + 2),
      end = Math.min(height - 2, height - dy - 2);
    for (let y = begin; y < end; y += step) {
      // WebKit's transient scrollbar moves independently of page content.
      // Ignore only the narrow outer gutter when registering; composites still
      // use the original full-width images. Keep content thresholds unchanged.
      const gutter = Math.max(2, Math.ceil(width / 60));
      for (let x = gutter; x < width - gutter; x += step) {
        const ai = (y + dy) * width + x,
          bi = y * width + x;
        const d = Math.abs(ad[ai] - bd[bi]);
        const ae = Math.abs(ad[ai] - ad[ai - 1]),
          be = Math.abs(bd[bi] - bd[bi - 1]);
        error += d;
        matched += d <= 15 ? 1 : 0;
        count++;
        if (ae > 12 || be > 12) {
          edges++;
          edgeError += Math.abs(ae - be);
        }
      }
    }
    return {
      error: error / Math.max(1, count),
      matched: matched / Math.max(1, count),
      edgeError: edgeError / Math.max(1, edges),
      edges,
    };
  }
  let best = { dy: 0, ...score(aa.data, bb.data, w, h, 0, 1) };
  for (
    let dy = -Math.floor(h * maxScrollFraction);
    dy <= Math.floor(h * maxScrollFraction);
    dy++
  ) {
    const s = score(aa.data, bb.data, w, h, dy, 1);
    if (s.error + s.edgeError * 0.2 < best.error + best.edgeError * 0.2)
      best = { dy, ...s };
  }
  const [fullA, fullB] = await Promise.all([gray(a), gray(b)]);
  if (
    fullA.info.width !== fullB.info.width ||
    fullA.info.height !== fullB.info.height
  )
    return fail;
  const scale = fullA.info.height / h,
    predicted = Math.round(best.dy * scale);
  let refined = {
    dy: predicted,
    ...score(
      fullA.data,
      fullB.data,
      fullA.info.width,
      fullA.info.height,
      predicted,
      1,
    ),
  };
  for (
    let dy = predicted - Math.ceil(scale);
    dy <= predicted + Math.ceil(scale);
    dy++
  ) {
    const s = score(
      fullA.data,
      fullB.data,
      fullA.info.width,
      fullA.info.height,
      dy,
      1,
    );
    if (s.error + s.edgeError * 0.2 < refined.error + refined.edgeError * 0.2)
      refined = { dy, ...s };
  }
  return {
    dy: refined.dy,
    error: refined.error,
    matched: refined.matched,
    edgeError: refined.edgeError,
    accepted:
      Math.abs(refined.dy) >= 4 &&
      Math.abs(refined.dy) <= fullA.info.height * maxScrollFraction &&
      refined.edges >= 100 &&
      refined.error < 3 &&
      refined.matched > 0.97 &&
      refined.edgeError < 25,
  };
}

export async function registerIntervals(
  intervals: ReplayInterval[],
  source: (n: number) => Promise<Buffer>,
) {
  for (const i of intervals) {
    if (i.source === undefined || i.next === undefined) continue;
    const [a, b] = await Promise.all([source(i.source), source(i.next)]);
    if (digest(a) === digest(b)) {
      i.reason = 'Identical observed images';
      continue;
    }
    const match = await alignVertical(a, b);
    i.confidence = Number(match.matched.toFixed(4));
    if (match.accepted) {
      i.kind = 'scroll';
      i.dy = match.dy;
      i.reason =
        'Estimated vertical scroll from overlapping pixels; no gesture telemetry';
    }
  }
}

export async function compositeScroll(a: Buffer, b: Buffer, dy: number) {
  const meta = await sharp(a).metadata(),
    other = await sharp(b).metadata();
  const width = meta.width!,
    height = meta.height!,
    delta = Math.abs(dy);
  if (
    !Number.isInteger(dy) ||
    !dy ||
    width !== other.width ||
    height !== other.height ||
    delta > height * maxScrollFraction
  )
    throw new Error('Unsupported scroll geometry.');
  const strip = await sharp(b)
    .extract({
      left: 0,
      top: dy > 0 ? height - delta : 0,
      width,
      height: delta,
    })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width,
      height: height + delta,
      channels: 3,
      background: '#f4f5ef',
    },
  })
    .composite([
      { input: a, left: 0, top: dy > 0 ? 0 : delta },
      { input: strip, left: 0, top: dy > 0 ? height : 0 },
    ])
    .png()
    .toBuffer();
}

// This project targets Ubuntu EC2. Exchange nonempty directories atomically so
// a replacement failure leaves the previous complete replay available. After a
// successful exchange the old output is inside this job's private workspace and
// is removed by normal CLI cleanup. Source screenshots are never renamed.
export async function publishReplay(
  output: string,
  live: string,
  replace = false,
) {
  const old = await lstat(live).catch((e: NodeJS.ErrnoException) => {
    if (e.code === 'ENOENT') return null;
    throw e;
  });
  if (!old) {
    await rename(output, live);
    return;
  }
  if (!replace || !old.isDirectory() || !(await lstat(output)).isDirectory())
    throw new Error(
      'Replay replacement requires complete private directories and --replace.',
    );
  execFileSync(
    '/usr/bin/python3',
    [
      '-c',
      String.raw`
import ctypes,os,sys
libc=ctypes.CDLL(None,use_errno=True)
renameat2=libc.renameat2
renameat2.argtypes=[ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint]
renameat2.restype=ctypes.c_int
if renameat2(-100,os.fsencode(sys.argv[1]),-100,os.fsencode(sys.argv[2]),2):
 raise OSError(ctypes.get_errno(),'Replay directory exchange failed')
`,
      output,
      live,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 },
  );
}

// No shell, URLs or client-supplied FFmpeg expressions. stderr stays bounded and
// private; callers report an operation stage rather than raw paths/arguments.
export async function videoTool(
  command: 'ffmpeg' | 'ffprobe',
  args: string[],
  cwd: string,
  timeout = 120_000,
) {
  return new Promise<{ stdout: string; maxRssKiB: number }>(
    (resolve, reject) => {
      const child = spawn(
        '/usr/bin/time',
        [
          '-f',
          '%M',
          '-o',
          'tool-rss.txt',
          '/usr/bin/nice',
          '-n',
          '10',
          `/usr/bin/${command}`,
          ...args,
        ],
        { cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      let stdout = '',
        stderr = '';
      const timer = setTimeout(() => {
        if (child.pid) process.kill(-child.pid, 'SIGKILL');
      }, timeout);
      child.stdout.on('data', (b) => {
        stdout = (stdout + b).slice(-65536);
      });
      child.stderr.on('data', (b) => {
        stderr = (stderr + b).slice(-8192);
      });
      child.once('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.once('close', async (code) => {
        clearTimeout(timer);
        if (code !== 0)
          return reject(
            new Error(`${command} failed (${code}); ${stderr.slice(-1800)}`),
          );
        const rss = await readFile(join(cwd, 'tool-rss.txt'), 'utf8').catch(
          () => '0',
        );
        resolve({ stdout, maxRssKiB: Number.parseInt(rss) || 0 });
      });
    },
  );
}

export async function renderReplay(options: {
  frames: ReplayFrame[];
  intervals: ReplayInterval[];
  startMs: number;
  endMs: number;
  work: string;
  output: string;
  source: (sequence: number) => Promise<Buffer>;
  progress?: (done: number, total: number) => void;
  deadline?: number;
  events?: Interaction[];
  keyboardReconstructions?: Map<number, KeyboardReconstruction>;
  pageReconstructions?: Map<number, PageReconstruction>;
  referenceFill?: (
    frame: ReplayFrame,
    image: Buffer,
  ) => Promise<ReferenceFill | null>;
}) {
  const { frames, intervals, startMs, endMs, work, output, source } = options;
  const first = frames[0],
    width = first.width,
    height = Math.max(...frames.map((f) => f.height));
  if (
    width > 1080 ||
    height > 4096 ||
    width * height > 4_000_000 ||
    width < 100 ||
    height < 100
  )
    throw new Error('Unsupported replay dimensions.');
  if (frames.some((f) => f.width !== width))
    throw new Error('Mixed viewport dimensions need a new replay segment.');
  const band = 108,
    paddedHeight = Math.ceil((height + band) / 2) * 2;
  const selected = intervals.filter(
    (i) => i.endMs > startMs && i.startMs < endMs,
  );
  const segmentFiles: string[] = [];
  const segmentDurations: number[] = [];
  let segmentBytes = 0;
  let maxRssKiB = 0,
    done = 0,
    keyboardPlaceholderFrames = 0,
    keyboardReconstructionFrames = 0,
    keyboardReconstructionPartialFrames = 0,
    canvasReferenceFrames = 0,
    retrospectiveFillFrames = 0,
    suppressedGestureMarkers = 0;
  for (const interval of selected) {
    if (options.deadline && Date.now() > options.deadline)
      throw new Error('Replay render time limit reached.');
    const begin = Math.max(startMs, interval.startMs),
      end = Math.min(endMs, interval.endMs);
    const firstTick = Math.ceil(((begin - startMs) * replayFps) / 1000);
    const lastTick = Math.ceil(((end - startMs) * replayFps) / 1000);
    const count = lastTick - firstTick;
    if (count <= 0) continue;
    const frame = frames.find((f) => f.sequence === interval.source);
    let placeholder = false;
    let canvasFill: ReferenceFill | null = null;
    const pageReconstruction =
      interval.kind === 'hold' && frame
        ? options.pageReconstructions?.get(frame.sequence)
        : undefined;
    const reconstruction =
      interval.kind === 'hold' && frame
        ? options.keyboardReconstructions?.get(frame.sequence)
        : undefined;
    let image: Buffer;
    if (frame) {
      image = await source(frame.sequence);
      if (interval.kind === 'scroll')
        image = await compositeScroll(
          image,
          await source(interval.next!),
          interval.dy!,
        );
      if (interval.kind === 'hold' && frame.context?.surface?.maskedKeyboard) {
        if (options.referenceFill && frame.context.page)
          canvasFill = await options.referenceFill(frame, image);
        if (canvasFill) {
          image = canvasFill.image;
          keyboardReconstructionFrames++;
          canvasReferenceFrames++;
          if (canvasFill.missingPixels) keyboardReconstructionPartialFrames++;
          if (canvasFill.usedLater) retrospectiveFillFrames++;
        } else if (pageReconstruction) {
          image = await applyPageReconstruction(
            image,
            pageReconstruction,
            source,
          );
          keyboardReconstructionFrames++;
          if (pageReconstruction.end < frame.height)
            keyboardReconstructionPartialFrames++;
        } else if (reconstruction) {
          image = await applyKeyboardReconstruction(
            image,
            await source(reconstruction.donor),
            reconstruction,
          );
          keyboardReconstructionFrames++;
          if (reconstruction.top + reconstruction.height < frame.height)
            keyboardReconstructionPartialFrames++;
        }
        const decorated = canvasFill
          ? { image, regionTop: null }
          : await keyboardPlaceholder(
              image,
              frame,
              pageReconstruction?.end ??
                (reconstruction
                  ? reconstruction.top + reconstruction.height
                  : 0),
            );
        image = decorated.image;
        placeholder = decorated.regionTop !== null;
        if (placeholder) keyboardPlaceholderFrames++;
      }
    } else {
      image = await sharp({
        create: { width, height, channels: 3, background: '#17372f' },
      })
        .png()
        .toBuffer();
    }
    await writeFile(
      join(work, 'input.png'),
      await sharp(image).png().toBuffer(),
      { mode: 0o640 },
    );
    let label = frame
      ? `Snapshot ${frame.sequence} captured ${frame.capturedAt}\n${reconstruction ? `Keyboard fill: snapshot ${reconstruction.donor} (${reconstruction.relativeMs >= 0 ? '+' : ''}${(reconstruction.relativeMs / 1000).toFixed(1)}s), reconstructed${reconstruction.top + reconstruction.height < frame.height ? ' / partial' : ''}` : frame.context?.surface?.maskedKeyboard ? (placeholder ? 'Keyboard area not captured - labeled placeholder' : 'Keyboard area not captured') : interval.kind === 'scroll' ? (interval.motion ? 'Reconstructed scroll - recorded movement timing' : 'Reconstructed scroll - movement timing estimated') : 'Last observed screenshot - hold / cut to next state'}`
      : `${interval.reason}\nNo captured image is available for this interval`;
    if (frame && pageReconstruction) {
      const donors = pageReconstruction.strips
        .slice(0, 2)
        .map(
          (s) =>
            `#${s.donor} (${s.relativeMs >= 0 ? '+' : ''}${(s.relativeMs / 1000).toFixed(1)}s)`,
        )
        .join(', ');
      label = `Snapshot ${frame.sequence} captured ${frame.capturedAt}\nPage fill: ${donors}; reconstructed${pageReconstruction.end < frame.height ? ' / partial' : ''}`;
    }
    if (frame && canvasFill)
      label = `Snapshot ${frame.sequence} captured ${frame.capturedAt}\n${canvasFill.label}`;
    await writeFile(join(work, 'label.txt'), label, { mode: 0o640 });
    const actualStart = startMs + (firstTick * 1000) / replayFps;
    const part = `part-${done}.mp4`;
    const offset = interval.dy && interval.dy < 0 ? -interval.dy : 0;
    const motionStart = interval.motionStartMs ?? interval.startMs;
    const movement =
      interval.kind === 'scroll'
        ? interval.motion
          ? `${offset}+` +
            interval.motion
              .slice(1)
              .map(
                (p, n) =>
                  `(${p.position - interval.motion![n].position})*min(1,max(0,(t+${(actualStart - interval.motion![n].atMs) / 1000})/${Math.max(1, p.atMs - interval.motion![n].atMs) / 1000}))`,
              )
              .join('+')
          : `${offset}+(${interval.dy})*min(1,max(0,(t+${(actualStart - motionStart) / 1000})/${(interval.endMs - motionStart) / 1000}))`
        : '0';
    const markers = gestureFilters(
      options.events ?? [],
      frame,
      actualStart,
      end,
      band,
    );
    suppressedGestureMarkers += markers.suppressed;
    const filter =
      `crop=${width}:${frame?.height ?? height}:0:'${movement}':exact=1,pad=ceil(iw/2)*2:${paddedHeight}:0:${band}:color=0x17372f,` +
      `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=label.txt:expansion=none:fontcolor=white:fontsize=19:x=12:y=12:line_spacing=8,` +
      `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='Elapsed %{pts\\:hms\\:${actualStart / 1000}}':fontcolor=white:fontsize=20:x=12:y=75` +
      (markers.filters.length ? ',' + markers.filters.join(',') : '');
    const result = await videoTool(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-nostdin',
        '-y',
        '-threads',
        '2',
        '-filter_threads',
        '1',
        '-loop',
        '1',
        '-framerate',
        String(replayFps),
        '-i',
        'input.png',
        '-vf',
        filter,
        '-frames:v',
        String(count),
        '-an',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '20',
        '-threads',
        '2',
        '-pix_fmt',
        'yuv420p',
        part,
      ],
      work,
    );
    maxRssKiB = Math.max(maxRssKiB, result.maxRssKiB);
    segmentFiles.push(part);
    segmentDurations.push(count / replayFps);
    segmentBytes += (await stat(join(work, part))).size;
    if (segmentBytes > 384 * 1024 ** 2)
      throw new Error('Replay working-file limit reached.');
    done++;
    options.progress?.(done, selected.length);
  }
  if (!segmentFiles.length)
    throw new Error('Replay range has no output frames.');
  await writeFile(
    join(work, 'parts.txt'),
    segmentFiles
      .map((p, n) => `file '${p}'\nduration ${segmentDurations[n].toFixed(9)}`)
      .join('\n'),
    { mode: 0o640 },
  );
  const result = await videoTool(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-y',
      '-f',
      'concat',
      '-safe',
      '1',
      '-i',
      'parts.txt',
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      '-fs',
      String(128 * 1024 ** 2 + 1),
      output,
    ],
    work,
  );
  maxRssKiB = Math.max(maxRssKiB, result.maxRssKiB);
  await chmod(output, 0o640);
  const probe = await videoTool(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration:stream=width,height,codec_name',
      '-of',
      'json',
      output,
    ],
    work,
  );
  const metadata = JSON.parse(probe.stdout);
  const durationMs = Number(metadata.format.duration) * 1000;
  if (Math.abs(durationMs - (endMs - startMs)) > 1000 / replayFps + 1)
    throw new Error('Replay duration mismatch.');
  await videoTool(
    'ffmpeg',
    ['-v', 'error', '-threads', '2', '-i', output, '-f', 'null', '-'],
    work,
  );
  const bytes = (await stat(output)).size;
  if (bytes > 128 * 1024 ** 2) throw new Error('Replay exceeds output limit.');
  for (const p of segmentFiles) await rm(join(work, p));
  return {
    startMs,
    endMs,
    durationMs,
    durationErrorMs: durationMs - (endMs - startMs),
    bytes,
    maxRssKiB,
    width: metadata.streams[0].width,
    height: metadata.streams[0].height,
    fps: replayFps,
    suppressedGestureMarkers,
    keyboardPlaceholderFrames,
    keyboardReconstructionFrames,
    keyboardReconstructionPartialFrames,
    canvasReferenceFrames,
    retrospectiveFillFrames,
  };
}
