import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const replayWorkReservation = 1024 ** 3;
export const replayNames = [
  'sample.mp4',
  'full.mp4',
  'manifest.json',
  'report.json',
  'canvas-preview.png',
  'canvas.json',
] as const;
export type ReplayName = (typeof replayNames)[number];

// The only nested derivatives are bounded, hash-named canvas tile versions.
// Reject symlinks/unknown layouts instead of silently excluding bytes from quota.
export async function canvasDirectoryBytes(folder: string) {
  const directory = join(folder, 'canvas');
  const root = await lstat(directory).catch((e: NodeJS.ErrnoException) => {
    if (e.code === 'ENOENT') return null;
    throw e;
  });
  if (!root) return 0;
  if (!root.isDirectory())
    throw new Error('Invalid canvas derivative directory');
  const pages = await readdir(directory, { withFileTypes: true });
  if (pages.length > 64) throw new Error('Canvas page limit exceeded');
  let bytes = 0,
    files = 0;
  for (const page of pages) {
    if (!page.isDirectory() || !/^page-[1-9][0-9]?$/.test(page.name))
      throw new Error('Invalid canvas page directory');
    for (const file of await readdir(join(directory, page.name), {
      withFileTypes: true,
    })) {
      if (
        (file.name !== 'preview.png' && ++files > 4096) ||
        !file.isFile() ||
        (file.name !== 'preview.png' && !/^[a-f0-9]{64}\.png$/.test(file.name))
      )
        throw new Error('Invalid canvas tile file');
      bytes += await regularSize(join(directory, page.name, file.name));
    }
  }
  if (bytes > 128 * 1024 ** 2)
    throw new Error('Canvas derivative byte limit exceeded');
  return bytes;
}

export async function replayOutputBytes(folder: string) {
  let bytes = await canvasDirectoryBytes(folder);
  for (const name of replayNames)
    bytes += await regularSize(join(folder, name));
  return bytes;
}

async function regularSize(path: string) {
  const s = await lstat(path).catch((e: NodeJS.ErrnoException) => {
    if (e.code === 'ENOENT') return null;
    throw e;
  });
  if (!s) return 0;
  if (!s.isFile())
    throw new Error('Replay storage contains a non-regular file.');
  return s.size;
}
export async function replayDirectoryBytes(recordingDirectory: string) {
  const folder = join(recordingDirectory, 'replay');
  const s = await lstat(folder).catch((e: NodeJS.ErrnoException) => {
    if (e.code === 'ENOENT') return null;
    throw e;
  });
  if (!s) return 0;
  if (!s.isDirectory()) throw new Error('Invalid replay directory.');
  return replayOutputBytes(folder);
}

// Image bytes remain in the existing DB counter. Derived files and the single
// bounded working reservation are counted separately without a schema change.
export async function replayUsage(directory: string) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    (e: NodeJS.ErrnoException) => {
      if (e.code === 'ENOENT') return [];
      throw e;
    },
  );
  let derivedBytes = 0,
    reservedBytes = 0;
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[a-f0-9-]{36}$/.test(entry.name)) continue;
    const folder = join(directory, entry.name);
    derivedBytes += await replayDirectoryBytes(folder);
    const work = await lstat(join(folder, '.replay-work')).catch(
      (e: NodeJS.ErrnoException) => {
        if (e.code === 'ENOENT') return null;
        throw e;
      },
    );
    if (work) {
      if (!work.isDirectory()) throw new Error('Invalid replay workspace.');
      reservedBytes += replayWorkReservation;
    }
  }
  return { derivedBytes, reservedBytes };
}

export async function replaySummary(recordingDirectory: string) {
  try {
    if (!(await replayDirectoryBytes(recordingDirectory))) return null;
    const file = join(recordingDirectory, 'replay', 'report.json');
    if ((await regularSize(file)) > 65536) return null;
    const r = JSON.parse(await readFile(file, 'utf8'));
    if (r.version !== 1 || !r.sample || !r.full) return null;
    return {
      version: 1,
      sample: r.sample,
      full: r.full,
      reconstructedIntervals: r.reconstructedIntervals,
      sessionReference: r.sessionReference?.enabled ? r.sessionReference : null,
      note: r.sessionReference?.enabled
        ? 'Session page references combine observed regions from different capture times. Page fills are reconstructed and labeled with source snapshots; unobserved regions remain unavailable.'
        : r.eventCount
          ? 'Movement is reconstructed from screenshots and recorded interaction timing. Markers show recorded taps/swipes.'
          : 'Scrolling is reconstructed from screenshots. Gesture locations and exact movement timing were not recorded.',
    };
  } catch {
    return null;
  }
}
