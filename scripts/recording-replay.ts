import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import {
  mkdir,
  readFile,
  writeFile,
  rm,
  lstat,
  statfs,
} from 'node:fs/promises';
import { join } from 'node:path';
import { setPriority } from 'node:os';
import mariadb from 'mariadb';
import { z } from 'zod';
import type { Interaction } from '../apps/mobile/src/change-capture.js';
import { fillFromReference, type ReferenceFill } from './lib/reference-fill.js';
import { guideMotion } from './lib/interaction-replay.js';
import {
  planKeyboardReconstruction,
  type KeyboardReconstruction,
  planPageReconstruction,
  type PageReconstruction,
} from './lib/keyboard-replay.js';
import {
  buildLegacyReferences,
  writeReferencePreview,
} from './lib/session-reference.js';
import sharp from 'sharp';
import { databaseConfig } from '../apps/api/src/config.js';
import { RecordingStore } from '../apps/api/src/recordings.js';
import {
  replayWorkReservation,
  replayOutputBytes,
} from '../apps/api/src/recording-replay-files.js';
import {
  timeline,
  registerIntervals,
  renderReplay,
  publishReplay,
  type ReplayFrame,
} from './lib/recording-replay.js';

// Config imports load the private environment before dropping root. Production
// mutations/encoding always run as softek, using only its runtime CRUD account.
const { values } = parseArgs({
  options: {
    recording: { type: 'string' },
    test: { type: 'boolean' },
    'sample-start-ms': { type: 'string' },
    replace: { type: 'boolean' },
    'reconstruct-keyboard': { type: 'boolean' },
    'session-reference': { type: 'boolean' },
    'recover-work': { type: 'boolean' },
  },
});
const id = z.string().uuid().parse(values.recording).toLowerCase(),
  test = values.test === true;
if (!test) {
  if (process.getuid?.() === 0) {
    process.setgroups!([]);
    process.setgid!('softek');
    process.setuid!('softek');
  }
  // Writable private storage is an intentional operator boundary; do not add
  // sudo file operations or broader directory overrides inside the renderer.
}
process.umask(0o027);
setPriority(10);
sharp.concurrency(1);
sharp.cache({ memory: 32, files: 0, items: 20 });
const pool = mariadb.createPool({
  ...databaseConfig('runtime', test),
  connectionLimit: 3,
  timezone: 'Z',
  bigIntAsNumber: true,
});
const store = new RecordingStore(pool, test),
  directory = join(store.directory, id),
  work = join(directory, '.replay-work');
const connection = await pool.getConnection();
const lock = `softek-replay-${test ? 'demo_test' : 'demo'}`;
let acquired = false,
  ownedWork = false,
  stage = 'preflight';
const started = Date.now(),
  deadline = started + 15 * 60_000;
try {
  const [r] = await connection.query('SELECT GET_LOCK(?,0) AS acquired', [
    lock,
  ]);
  if (Number(r.acquired) !== 1)
    throw new Error('Another replay render is running.');
  acquired = true;
  const frames: ReplayFrame[] = [];
  const events: Interaction[] = [];
  let policy = 'periodic-v1' as 'periodic-v1' | 'changes-v2',
    lostEvents = 0;
  let stopMs = 0;
  let sourceImageBytes = 0;
  await store.locked(async (c) => {
    const [recording] = await c.query(
      "SELECT * FROM screenshot_recordings WHERE id=? AND state IN ('stopped','interrupted') AND retained_until>UTC_TIMESTAMP(6)",
      [id],
    );
    if (!recording || recording.stop_elapsed_ms === null)
      throw new Error(
        'Choose a retained finalized recording with a measured Stop time.',
      );
    const existing = await lstat(join(directory, 'replay')).catch(
      (e: NodeJS.ErrnoException) => {
        if (e.code === 'ENOENT') return null;
        throw e;
      },
    );
    if (existing && !values.replace)
      throw new Error(
        'A replay already exists; preserve it rather than overwrite.',
      );
    await store.capacity(c, replayWorkReservation);
    stopMs = Number(recording.stop_elapsed_ms);
    policy = recording.capture_policy;
    lostEvents = Number(recording.lost_events);
    const rows = await c.query(
      'SELECT f.*,c.context_json FROM screenshot_frames f LEFT JOIN screenshot_frame_context c ON c.recording_id=f.recording_id AND c.sequence_number=f.sequence_number WHERE f.recording_id=? ORDER BY elapsed_ms,sequence_number',
      [id],
    );
    for (const f of rows)
      frames.push({
        sequence: f.sequence_number,
        elapsedMs: f.elapsed_ms,
        capturedAt: new Date(f.captured_at).toISOString(),
        hash: f.image_hash,
        width: f.width,
        height: f.height,
        context:
          typeof f.context_json === 'string'
            ? JSON.parse(f.context_json)
            : (f.context_json ?? null),
      });
    const eventRows = await c.query(
      'SELECT payload_json FROM screenshot_events WHERE recording_id=? ORDER BY elapsed_ms,sequence_number LIMIT 12000',
      [id],
    );
    for (const e of eventRows)
      events.push(
        typeof e.payload_json === 'string'
          ? JSON.parse(e.payload_json)
          : e.payload_json,
      );
    timeline(frames, stopMs, policy); // Validate before creating a workspace.
    if (values['recover-work']) {
      const previous = await lstat(work).catch((e: NodeJS.ErrnoException) => {
        if (e.code === 'ENOENT') return null;
        throw e;
      });
      if (previous && !previous.isDirectory())
        throw new Error('Invalid abandoned replay workspace');
      // Both the global render lock and recording storage lock are held here.
      // Only this exact session's private derived workspace may be recovered.
      if (previous) await rm(work, { recursive: true });
    }
    await mkdir(work, { mode: 0o750 });
    ownedWork = true;
    await mkdir(join(work, 'source'), { mode: 0o750 });
    await mkdir(join(work, 'output'), { mode: 0o750 });
    // Copy briefly under the same lock as deletion/cleanup. Encoding holds only
    // the separate render lock, so normal screenshot uploads remain available.
    for (const frame of frames) {
      const path = store.framePath(id, frame.sequence),
        s = await lstat(path);
      if (!s.isFile() || s.size > 1_048_576)
        throw new Error('Invalid source file.');
      const image = await readFile(path);
      sourceImageBytes += image.length;
      if (createHash('sha256').update(image).digest('hex') !== frame.hash)
        throw new Error('Source hash mismatch.');
      await writeFile(join(work, 'source', `${frame.sequence}.jpg`), image, {
        mode: 0o640,
      });
    }
  });
  const source = (n: number) => readFile(join(work, 'source', `${n}.jpg`));
  stage = 'image alignment';
  const intervals = timeline(frames, stopMs, policy);
  await registerIntervals(intervals, source);
  if (policy === 'changes-v2')
    guideMotion(intervals, frames, events, lostEvents);
  const scrolls = intervals.filter((i) => i.kind === 'scroll');
  const sampleStart =
    values['sample-start-ms'] === undefined
      ? Math.max(
          0,
          (scrolls[0]?.motionStartMs ??
            scrolls[0]?.startMs ??
            frames[0].elapsedMs) - 1500,
        )
      : Number(values['sample-start-ms']);
  if (
    !Number.isInteger(sampleStart) ||
    sampleStart < 0 ||
    sampleStart >= stopMs
  )
    throw new Error('Invalid sample start.');
  const sampleEnd = Math.min(stopMs, sampleStart + 15_000);
  if (
    policy === 'periodic-v1' &&
    !scrolls.some((i) => i.endMs > sampleStart && i.startMs < sampleEnd)
  )
    throw new Error('Sample has no reconstructed movement.');
  const output = join(work, 'output');
  const reference = values['session-reference']
    ? await buildLegacyReferences({
        recordingId: id,
        frames,
        source,
        directory: join(output, 'canvas'),
        deadline,
      })
    : null;
  const referenceResult = reference
    ? await writeReferencePreview(
        reference,
        output,
        frames.find((f) => f.context?.surface?.maskedKeyboard)?.context
          ?.geometry.route,
      )
    : null;
  const referencePreview = referenceResult?.preview ?? null;
  const referenceSummaries = referenceResult?.references ?? [];
  const referenceFills = new Map<number, Omit<ReferenceFill, 'image'>>();
  const referenceFill = reference
    ? async (frame: ReplayFrame, image: Buffer) => {
        const fill = await fillFromReference(frame, image, reference);
        if (fill) {
          const { image: _, ...provenance } = fill;
          referenceFills.set(frame.sequence, provenance);
        }
        return fill;
      }
    : undefined;
  const pageReconstructions = new Map<number, PageReconstruction>();
  const keyboardReconstructions = new Map<number, KeyboardReconstruction>();
  if (values['reconstruct-keyboard'] || values['session-reference']) {
    stage = 'keyboard reconstruction';
    for (const frame of frames) {
      if (!frame.context?.surface?.maskedKeyboard) continue;
      if (Date.now() > deadline)
        throw new Error('Replay render time limit reached.');
      if (values['session-reference']) {
        if (
          frame.context?.page ||
          reference?.pages.some(
            (p) => p.limitedAt !== undefined && frame.sequence >= p.limitedAt,
          )
        )
          continue;
        const plan = await planPageReconstruction(
          await source(frame.sequence),
          frame,
          frames,
          source,
        );
        if (plan) pageReconstructions.set(frame.sequence, plan);
        continue;
      }
      const plan = await planKeyboardReconstruction(
        await source(frame.sequence),
        frame,
        frames,
        source,
      );
      if (plan) keyboardReconstructions.set(frame.sequence, plan);
    }
  }
  const manifest = {
    version: 1,
    rendererRevision: 11,
    sessionReference: reference
      ? {
          enabled: true,
          preview: referencePreview,
          frames: [...pageReconstructions.values()],
          canvasFills: [] as Omit<ReferenceFill, 'image'>[],
        }
      : { enabled: false },
    recordingId: id,
    policy,
    events,
    lostEvents,
    stopMs,
    frames,
    intervals,
    geometry:
      'whole-viewport vertical translation only; unsupported layers/layout use cuts',
    motion:
      policy === 'changes-v2'
        ? 'Image-aligned motion; recorded scroll timing where geometry agrees, estimated movement otherwise; recorded tap/swipe markers'
        : 'estimated from image overlap; gesture telemetry absent',
    sample: { startMs: sampleStart, endMs: sampleEnd },
    keyboardPlaceholder:
      'Keyboard area / Not captured; badge placed only in confirmed masked uniform blank pixels. Inferred placement, not exact recorded keyboard bounds.',
    keyboardReconstruction: {
      enabled: values['reconstruct-keyboard'] === true,
      note: 'Experimental hidden page fill from the nearest registered unmasked observation on either side in the same document route, up to 30 seconds away. Hidden state at capture time is unknown. No actual keyboard pixels. Unrecoverable areas retain the placeholder.',
      frames: [...keyboardReconstructions.values()],
    },
  };
  await writeFile(
    join(output, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    { mode: 0o640 },
  );
  stage = 'sample encoding';
  const sample = await renderReplay({
    frames,
    intervals,
    startMs: sampleStart,
    endMs: sampleEnd,
    work,
    output: join(output, 'sample.mp4'),
    source,
    deadline,
    events,
    keyboardReconstructions,
    pageReconstructions,
    referenceFill,
  });
  console.log(JSON.stringify({ stage: 'sample ready', ...sample }));
  stage = 'full-session encoding';
  const full = await renderReplay({
    frames,
    intervals,
    startMs: 0,
    endMs: stopMs,
    work,
    output: join(output, 'full.mp4'),
    source,
    deadline,
    events,
    keyboardReconstructions,
    pageReconstructions,
    referenceFill,
    progress: (done, total) => {
      if (done % 20 === 0)
        console.log(JSON.stringify({ stage: 'encoding', done, total }));
    },
  });
  if (
    manifest.sessionReference.enabled &&
    'canvasFills' in manifest.sessionReference
  ) {
    manifest.sessionReference.canvasFills = [...referenceFills.values()];
    await writeFile(
      join(output, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      { mode: 0o640 },
    );
  }
  stage = 'publication';
  const report = {
    version: 1,
    rendererRevision: 11,
    sessionReference: reference
      ? {
          enabled: true,
          preview: referencePreview,
          references: referenceSummaries,
          pages: reference.pages.length,
          patchCount: reference.manifest.patchCount,
          storedBytes: reference.manifest.storedBytes,
          previewBytes: referenceResult?.previewBytes ?? 0,
        }
      : null,
    keyboardReconstructionEnabled: values['reconstruct-keyboard'] === true,
    createdAt: new Date().toISOString(),
    sourceFrames: frames.length,
    sourceImageBytes,
    sourceStopMs: stopMs,
    policy,
    eventCount: events.length,
    lostEvents,
    observedMotionIntervals: intervals.filter((i) => i.motion).length,
    onsetGuidedIntervals: intervals.filter((i) => i.motionStartMs !== undefined)
      .length,
    reconstructedIntervals: scrolls.length,
    reconstructedMs: scrolls.reduce((n, i) => n + i.endMs - i.startMs, 0),
    gaps: intervals.filter((i) => i.kind === 'gap').slice(0, 64),
    gapCount: intervals.filter((i) => i.kind === 'gap').length,
    sample,
    full,
    renderWallMs: Date.now() - started,
    nodeMaxRssKiB: process.resourceUsage().maxRSS,
    note: values['reconstruct-keyboard']
      ? 'Experimental keyboard-area fill borrows nearby screenshots; source snapshot and time offset are labeled in the video. Hidden content at that moment is unknown. Unrecovered areas remain excluded. Scroll motion is reconstructed.'
      : policy === 'changes-v2'
        ? 'Reconstructed motion with recorded timing where supported; tap/swipe locations are recorded metadata.'
        : 'Reconstructed motion, estimated timing; no recorded tap/swipe locations.',
  };
  await writeFile(
    join(output, 'report.json'),
    JSON.stringify(report, null, 2),
    { mode: 0o640 },
  );
  const publishedBytes = await replayOutputBytes(output);
  if (publishedBytes > 384 * 1024 ** 2)
    throw new Error('Replay output budget exceeded.');
  await store.locked(async (c) => {
    const [r] = await c.query(
      "SELECT id FROM screenshot_recordings WHERE id=? AND state IN ('stopped','interrupted') AND retained_until>UTC_TIMESTAMP(6)",
      [id],
    );
    if (!r) throw new Error('Source deleted or expired during rendering.');
    const fs = await statfs(store.directory);
    if (Number(fs.bavail) * Number(fs.bsize) < 5 * 1024 ** 3)
      throw new Error('Recording filesystem low on space.');
    await publishReplay(
      output,
      join(directory, 'replay'),
      values.replace === true,
    );
  });
  console.log(
    JSON.stringify({ stage: 'published', recordingId: id, ...report }, null, 2),
  );
} catch (error) {
  // Do not expose DB errors, secrets or native/private filesystem paths.
  console.error(
    `Replay failed during ${stage}. Source data is retained; inspect scoped tooling and storage.`,
  );
  if (
    error instanceof Error &&
    /^(ffmpeg|ffprobe|Replay|Source|Invalid|Choose|No reliable|A replay|Another replay)/.test(
      error.message,
    )
  )
    console.error(error.message);
  process.exitCode = 1;
} finally {
  if (ownedWork) await rm(work, { recursive: true, force: true });
  if (acquired) await connection.query('SELECT RELEASE_LOCK(?)', [lock]);
  connection.release();
  await pool.end();
}
