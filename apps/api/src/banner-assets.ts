import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { projectRoot } from './config.js';

export function assetDirectory(test = false) {
  if (test) return resolve(projectRoot, 'artifacts/test-banner-assets');
  return (
    process.env.BANNER_ASSET_DIR ??
    resolve(projectRoot, 'artifacts/banner-assets')
  );
}
export async function publishAsset(
  buffer: Buffer,
  test = false,
  key = `${randomUUID()}.webp`,
) {
  const directory = assetDirectory(test);
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, buffer, { mode: 0o644 });
    await rename(temporary, join(directory, key));
  } finally {
    await unlink(temporary).catch(() => {});
  }
  return key;
}
export async function decodeBanner(buffer: Buffer) {
  const image = sharp(buffer, {
    limitInputPixels: 16_777_216,
    animated: false,
  });
  const metadata = await image.metadata();
  if (
    !['jpeg', 'png', 'webp'].includes(metadata.format ?? '') ||
    !metadata.width ||
    !metadata.height ||
    metadata.width > 4096 ||
    metadata.height > 4096 ||
    (metadata.pages ?? 1) > 1
  ) {
    throw new Error('INVALID_IMAGE');
  }
  return image
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 88 })
    .toBuffer({ resolveWithObject: true });
}
