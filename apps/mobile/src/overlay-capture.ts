import { requireOptionalNativeModule } from 'expo-modules-core';
import { findNodeHandle, type View } from 'react-native';
import type { RefObject, ComponentRef } from 'react';
import { File } from 'expo-file-system';
import type { CapturedFile } from './capture-loop';
import { imageBounds, type ImageBounds } from './page-context';

export type OverlayImage = CapturedFile & {
  width: number;
  height: number;
  maskedKeyboard?: boolean;
  anchoredPopover?: boolean;
};
type Result = {
  uri: string;
  bytes: number;
  width: number;
  height: number;
  capturedAt: string;
  captureMs: number;
  maskedKeyboard: boolean;
  anchoredPopover: boolean;
  imageBounds?: ImageBounds;
};
const native = requireOptionalNativeModule<{
  prepare(): Promise<boolean>;
  capture(tag: number): Promise<Result>;
}>('SoftekOverlayCapture');

export const overlayAvailable = Boolean(native);
export async function prepareOverlayCapture() {
  if (!native)
    throw new Error('Candidate native module unavailable in this app build');
  return native.prepare();
}
export async function captureOverlay(
  view: RefObject<ComponentRef<typeof View> | null>,
): Promise<OverlayImage> {
  const tag = view.current ? findNodeHandle(view.current) : null;
  if (!tag || !native) throw new Error('Candidate native view unavailable');
  let result: Result;
  const capturedMonotonicMs = performance.now();
  try {
    result = await native.capture(tag);
  } catch (error) {
    // Export only known, fixed diagnostics, not arbitrary native paths/messages.
    const message = error instanceof Error ? error.message : '';
    const diagnostic = [
      'Candidate capture already in progress',
      'Candidate view or foreground window unavailable',
      'Candidate crop is outside its owning window',
      'Unrecognized native presentation; candidate skipped',
      'Candidate image dimensions exceed limits',
      'Candidate drawing unavailable or interrupted',
      'Candidate JPEG is empty or exceeds 1 MiB',
      'Candidate file could not be saved',
    ].find((text) => message.includes(text));
    throw new Error(diagnostic ?? 'Candidate native capture failed');
  }
  const validUri =
    /^file:\/\/\/[^?#]+\/softek-overlay-check\/[A-Fa-f0-9-]+\.jpg$/.test(
      result.uri,
    );
  if (!validUri) throw new Error('Candidate returned an invalid local file');
  let file: File | undefined;
  const dispose = () => {
    try {
      if (file?.exists) file.delete();
    } catch {
      /* Cleared at next local launch. */
    }
  };
  try {
    file = new File(result.uri);
    const info = file.info();
    if (
      !info.exists ||
      !Number.isSafeInteger(info.size) ||
      info.size !== result.bytes ||
      result.bytes < 1 ||
      result.bytes > 1_048_576 ||
      result.width !== 720 ||
      typeof result.maskedKeyboard !== 'boolean' ||
      typeof result.anchoredPopover !== 'boolean' ||
      !Number.isInteger(result.height) ||
      result.height < 1 ||
      result.height > 4096 ||
      result.width * result.height > 4_000_000 ||
      !Number.isFinite(Date.parse(result.capturedAt)) ||
      !Number.isFinite(result.captureMs) ||
      result.captureMs < 0 ||
      (result.imageBounds !== undefined &&
        (!imageBounds(result.imageBounds) ||
          result.imageBounds.width !== result.width ||
          result.imageBounds.height !== result.height))
    ) {
      throw new Error('Candidate file metadata failed validation');
    }
    return {
      ...result,
      dispose,
      capturedMonotonicMs,
      surface: {
        method: 'window-crop-v1',
        maskedKeyboard: result.maskedKeyboard,
        anchoredPopover: result.anchoredPopover,
      },
    };
  } catch (error) {
    dispose();
    throw new Error(
      error instanceof Error &&
        error.message === 'Candidate file metadata failed validation'
        ? error.message
        : 'Candidate local file unavailable',
    );
  }
}
