const assert = require('node:assert/strict');
const { test } = require('node:test');
const { build } = require('esbuild');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
async function adapter(options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'softek-overlay-test-')),
    outfile = join(directory, 'test.cjs');
  const result = {
    uri: 'file:///private/app/Library/Caches/softek-overlay-check/1234-ABCD.jpg',
    bytes: 1234,
    width: 720,
    height: 1000,
    capturedAt: '2026-11-05T00:00:00.000Z',
    captureMs: 40,
    maskedKeyboard: true,
    anchoredPopover: true,
    ...options.result,
  };
  const ports = { deleted: 0, tags: [], ...options, result };
  global.__softekOverlay = ports;
  await build({
    entryPoints: [resolve(__dirname, '../../src/overlay-capture.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
    plugins: [
      {
        name: 'native',
        setup(b) {
          b.onResolve(
            { filter: /^(expo-modules-core|react-native|expo-file-system)$/ },
            (a) => ({ path: a.path, namespace: 'stub' }),
          );
          b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({
            contents:
              a.path === 'expo-modules-core'
                ? `exports.requireOptionalNativeModule=()=>global.__softekOverlay.missing?null:{prepare:async()=>true,capture:async tag=>{const p=global.__softekOverlay;p.tags.push(tag);if(p.error)throw Error(p.error);return p.result;}};`
                : a.path === 'react-native'
                  ? `exports.findNodeHandle=()=>42;`
                  : `exports.File=class {constructor(uri){if(global.__softekOverlay.constructorError)throw Error('/private/secret');}get exists(){return true;}delete(){global.__softekOverlay.deleted++;}info(){const p=global.__softekOverlay;if(p.infoError)throw Error('/private/secret');return {exists:true,size:p.size??p.result.bytes};}};`,
          }));
        },
      },
    ],
  });
  return {
    ...require(outfile),
    ports,
    close: () => rmSync(directory, { recursive: true, force: true }),
  };
}
test('candidate adapter validates its owned native file and preserves dimensions/mask/provenance', async () => {
  const a = await adapter();
  try {
    assert.equal(await a.prepareOverlayCapture(), true);
    const image = await a.captureOverlay({ current: {} });
    assert.deepEqual(a.ports.tags, [42]);
    assert.equal(image.width, 720);
    assert.equal(image.maskedKeyboard, true);
    assert.equal(image.anchoredPopover, true);
    image.dispose();
    assert.equal(a.ports.deleted, 1);
  } finally {
    a.close();
  }
});
test('candidate unavailable in an old native build fails without requesting a screenshot', async () => {
  const a = await adapter({ missing: true });
  try {
    assert.equal(a.overlayAvailable, false);
    await assert.rejects(
      () => a.captureOverlay({ current: {} }),
      /unavailable/,
    );
    assert.deepEqual(a.ports.tags, []);
  } finally {
    a.close();
  }
});
test('candidate rejects other directories and bad size/dimensions and disposes invalid owned files', async () => {
  for (const options of [
    { result: { uri: 'file:///private/unrelated.jpg' } },
    { size: 0 },
    { result: { width: 1080 } },
    { result: { height: 5000 } },
  ]) {
    const a = await adapter(options);
    try {
      await assert.rejects(
        () => a.captureOverlay({ current: {} }),
        /invalid local file|metadata failed validation/,
      );
      assert.equal(a.ports.deleted, options.result?.uri ? 0 : 1);
    } finally {
      a.close();
    }
  }
});
test('candidate diagnostics never expose native exception paths from drawing or local file operations', async () => {
  for (const options of [
    { error: 'failure at /private/secret' },
    { infoError: true },
    { constructorError: true },
    {
      error: 'Candidate drawing unavailable or interrupted at /private/secret',
    },
  ]) {
    const a = await adapter(options);
    try {
      await assert.rejects(
        () => a.captureOverlay({ current: {} }),
        (e) =>
          !e.message.includes('/private/') && e.message.startsWith('Candidate'),
      );
    } finally {
      a.close();
    }
  }
});
