import type { ComponentRef, RefObject } from 'react';
import { PixelRatio, type View } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import type { CapturedFile } from './capture-loop';

const directory = new Directory(Paths.cache, 'softek-recording-frames');
type CaptureStage = 'layout' | 'snapshot' | 'uri' | 'storage' | 'copy' | 'size';

export class CaptureFileError extends Error {
  constructor(
    readonly stage: CaptureStage,
    readonly detail: string,
  ) {
    super(`Capture ${stage}: ${detail}`);
  }
}

// Do not display native paths or arbitrary exception text in the diagnostic UI.
function diagnostic(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/No view found|findNodeHandle/i.test(message)) return 'view not found';
  if (/drawViewHierarchyInRect/i.test(message)) return 'view drawing failed';
  if (/RNViewShot.*undefined|could not be found|not linked/i.test(message))
    return 'native capture module unavailable';
  if (/permission|not permitted|not readable|not writable/i.test(message))
    return 'file permission denied';
  if (/directory path|wrong type|file URL|scheme/i.test(message))
    return 'invalid file URI';
  if (/exist|no such file/i.test(message)) return 'file unavailable';
  return 'native operation failed';
}

export function clearCaptureFiles() {
  try {
    if (directory.exists) directory.delete();
    directory.create({ intermediates: true, idempotent: true });
    return true;
  } catch {
    return false;
  }
}
export async function captureFile(
  view: RefObject<ComponentRef<typeof View> | null>,
  width: number,
  height: number,
): Promise<CapturedFile> {
  if (!view.current || width <= 0 || height <= 0)
    throw new CaptureFileError('layout', 'capture view unavailable');
  let original = '';
  let file: File | undefined;
  let stage: CaptureStage = 'snapshot';
  try {
    const capturedAt = new Date().toISOString();
    const capturedMonotonicMs = performance.now();
    // iOS view-shot uses device-independent units and renders at device scale.
    const scale = PixelRatio.get();
    original = await captureRef(view, {
      format: 'jpg',
      quality: 0.7,
      width: 720 / scale,
      height: Math.round((720 * height) / width) / scale,
      result: 'tmpfile',
    });
    stage = 'uri';
    // view-shot's iOS implementation returns an absolute path, not a file URI.
    // Keep the original string for releaseCapture's native path check.
    const uri = original.startsWith('/')
      ? `file://${encodeURI(original).replace(/#/g, '%23').replace(/\?/g, '%3F')}`
      : original;
    if (!uri.startsWith('file:///'))
      throw new CaptureFileError('uri', 'invalid file URI');
    const source = new File(uri);
    stage = 'storage';
    directory.create({ intermediates: true, idempotent: true });
    file = new File(
      directory,
      `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
    );
    stage = 'copy';
    // SDK 56+ copy() returns a Promise. The source must remain alive until it
    // resolves, and the destination cannot be measured/queued before then.
    await source.copy(file);
    stage = 'size';
    // Unlike File.size's zero fallback, info() exposes failed metadata reads.
    const info = file.info();
    if (!info.exists)
      throw new CaptureFileError('size', 'copied image is missing');
    const bytes = info.size;
    if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 0)
      throw new CaptureFileError('size', 'invalid file byte count');
    if (bytes === 0)
      throw new CaptureFileError('size', 'empty image (0 bytes)');
    if (bytes > 1024 * 1024)
      throw new CaptureFileError(
        'size',
        `image has ${bytes} bytes; limit is 1048576`,
      );
    const owned = file;
    return {
      uri: owned.uri,
      bytes,
      capturedAt,
      capturedMonotonicMs,
      captureMs: Math.round(performance.now() - capturedMonotonicMs),
      dispose: () => {
        try {
          if (owned.exists) owned.delete();
        } catch {
          /* Retry stale-file cleanup at the next launch. */
        }
      },
    };
  } catch (error) {
    try {
      if (file?.exists) file.delete();
    } catch {
      // Preserve the capture failure; stale-file cleanup retries next launch.
    }
    throw error instanceof CaptureFileError
      ? error
      : new CaptureFileError(stage, diagnostic(error));
  } finally {
    try {
      if (original) releaseCapture(original);
    } catch {
      // The owned copy remains valid if releasing a native temporary file fails.
    }
  }
}
