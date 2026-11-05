const assert = require('node:assert/strict');
const { test } = require('node:test');
const { build } = require('esbuild');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');

// Execute the actual adapter. Native boundaries model the iOS bare-path result
// and Expo's strict file-URI constructor; these are not native pixel tests.
async function adapter(options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'softek-capture-file-test-'));
  const outfile = join(directory, 'capture.cjs');
  const ports = {
    ratio: 3,
    original: '/private/var/mobile/tmp/ReactNative/screen #1?.jpg',
    bytes: 12345,
    captures: [],
    copies: [],
    releases: [],
    deleted: [],
    copied: false,
    sizeReads: 0,
    ...options,
  };
  global.__softekCaptureFile = ports;
  await build({
    entryPoints: [resolve(__dirname, '../../src/capture-file.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
    plugins: [
      {
        name: 'native-file-boundaries',
        setup(bundle) {
          bundle.onResolve(
            {
              filter:
                /^(react-native|expo-file-system|react-native-view-shot)$/,
            },
            (args) => ({ path: args.path, namespace: 'native' }),
          );
          bundle.onLoad({ filter: /.*/, namespace: 'native' }, (args) => ({
            contents:
              args.path === 'react-native'
                ? `exports.PixelRatio={get:()=>global.__softekCaptureFile.ratio};`
                : args.path === 'react-native-view-shot'
                  ? `
            exports.captureRef=async(view,options)=>{const p=global.__softekCaptureFile;p.captures.push(options);if(p.snapshotError)throw Error(p.snapshotError);return p.original;};
            exports.releaseCapture=path=>{const p=global.__softekCaptureFile;p.releases.push(path);if(p.releaseError)throw Error('release failed');};`
                  : `
            exports.Paths={cache:'file:///cache/'};
            exports.Directory=class {constructor(...parts){this.uri=parts.join('/');}create(){}get exists(){return false;}};
            exports.File=class {
              constructor(...parts){this.uri=parts.map(x=>typeof x==='string'?x:x.uri).join('/');if(!this.uri.startsWith('file:///'))throw Error('wrong type: invalid file URL');}
              async copy(to){const p=global.__softekCaptureFile;p.copies.push([this.uri,to.uri]);if(p.copyPending)await p.copyPending;if(p.copyError)throw Error('permission denied at /private/secret/path');p.copied=true;}
              get size(){const p=global.__softekCaptureFile;p.sizeReads++;if(p.sizeError)throw Error('permission denied');return p.copied?p.bytes:0;}
              info(){const p=global.__softekCaptureFile;return {exists:p.copied&&!p.missing,size:this.size};}
              get exists(){return true;}
              delete(){const p=global.__softekCaptureFile;p.deleted.push(this.uri);if(p.deleteError)throw Error('delete failed');}
            };`,
          }));
        },
      },
    ],
  });
  return {
    ports,
    ...require(outfile),
    close: () => rmSync(directory, { recursive: true, force: true }),
  };
}

test('iOS bare paths become encoded file URIs; output stays 720 physical pixels at each device scale', async () => {
  for (const ratio of [1, 2, 3]) {
    const a = await adapter({ ratio });
    try {
      const frame = await a.captureFile({ current: {} }, 440, 700);
      assert.equal(
        a.ports.copies[0][0],
        'file:///private/var/mobile/tmp/ReactNative/screen%20%231%3F.jpg',
      );
      assert.equal(a.ports.captures[0].width * ratio, 720);
      assert.equal(
        a.ports.captures[0].height * ratio,
        Math.round((720 * 700) / 440),
      );
      assert.deepEqual(a.ports.releases, [a.ports.original]);
      assert.equal(frame.bytes, 12345);
      assert.ok(frame.capturedAt.endsWith('Z'));
      frame.dispose();
      assert.equal(a.ports.deleted.length, 1);
    } finally {
      a.close();
    }
  }
});

test('capture waits for the asynchronous copy before checking size or releasing its source', async () => {
  let complete;
  const copyPending = new Promise((resolve) => {
    complete = resolve;
  });
  const a = await adapter({ copyPending });
  try {
    let settled = false;
    const pending = a.captureFile({ current: {} }, 440, 700);
    // Observe rejection as well, so the deliberately broken implementation
    // reports an assertion instead of an unhandled promise rejection.
    const result = pending.then(
      (frame) => {
        settled = true;
        return { frame };
      },
      (error) => {
        settled = true;
        return { error };
      },
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(a.ports.copies.length, 1);
    assert.equal(settled, false);
    assert.equal(a.ports.sizeReads, 0);
    assert.deepEqual(a.ports.releases, []);
    complete();
    const finished = await result;
    assert.equal(finished.error, undefined);
    assert.equal(finished.frame.bytes, 12345);
    assert.deepEqual(a.ports.releases, [a.ports.original]);
  } finally {
    complete();
    a.close();
  }
});

test('existing file URIs are preserved and release failure does not discard a valid owned copy', async () => {
  const a = await adapter({
    original: 'file:///cache/screen.jpg',
    releaseError: true,
  });
  try {
    const frame = await a.captureFile({ current: {} }, 440, 700);
    assert.equal(a.ports.copies[0][0], a.ports.original);
    assert.equal(frame.bytes, 12345);
  } finally {
    a.close();
  }
});

test('diagnostics identify the failed stage without exposing paths, including cleanup failures', async () => {
  for (const [options, stage, detail] of [
    [
      { snapshotError: 'No view found with reactTag: 42' },
      'snapshot',
      'view not found',
    ],
    [
      { snapshotError: 'drawViewHierarchyInRect was not successful' },
      'snapshot',
      'view drawing failed',
    ],
    [{ original: 'https://example.invalid/frame' }, 'uri', 'invalid file URI'],
    [{ copyError: true, deleteError: true }, 'copy', 'file permission denied'],
    [{ sizeError: true }, 'size', 'file permission denied'],
    [{ missing: true }, 'size', 'copied image is missing'],
    [{ bytes: 0 }, 'size', 'empty image (0 bytes)'],
    [{ bytes: undefined }, 'size', 'invalid file byte count'],
    [{ bytes: NaN }, 'size', 'invalid file byte count'],
    [
      { bytes: 1024 * 1024 + 1 },
      'size',
      'image has 1048577 bytes; limit is 1048576',
    ],
  ]) {
    const a = await adapter(options);
    try {
      await assert.rejects(
        a.captureFile({ current: {} }, 440, 700),
        (error) => {
          assert.equal(error.stage, stage);
          assert.equal(error.detail, detail);
          assert.doesNotMatch(error.message, /private|secret|example|42/);
          return true;
        },
      );
      if (!options.snapshotError) assert.equal(a.ports.releases.length, 1);
    } finally {
      a.close();
    }
  }
});
