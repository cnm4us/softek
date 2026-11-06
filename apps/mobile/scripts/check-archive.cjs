const { spawnSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, readdirSync, lstatSync } = require('node:fs');
const { resolve, join, relative } = require('node:path');

const artifacts = resolve(__dirname, '../../../artifacts');
mkdirSync(artifacts, { recursive: true, mode: 0o700 });
const directory = join(
  mkdtempSync(join(artifacts, 'mobile-archive-')),
  'source',
);
const inspection = spawnSync(
  process.execPath,
  [
    resolve(__dirname, 'eas.cjs'),
    'build:inspect',
    '--platform',
    'ios',
    '--profile',
    process.argv[2] || 'preview',
    '--stage',
    'archive',
    '--output',
    directory,
  ],
  { stdio: 'inherit' },
);
if (inspection.status !== 0) process.exit(inspection.status ?? 1);

const rootFiles = new Set([
  'package.json',
  'package-lock.json',
  '.gitignore',
  '.easignore',
  '.prettierignore',
  '.prettierrc.json',
  'apps/web/package.json',
  'apps/api/package.json',
]);
const files = [];
function walk(path) {
  for (const entry of readdirSync(path)) {
    const target = join(path, entry);
    const stat = lstatSync(target);
    const name = relative(directory, target).split('\\').join('/');
    if (stat.isSymbolicLink()) throw Error(`Symlink in upload: ${name}`);
    if (stat.isDirectory()) walk(target);
    else if (stat.isFile()) {
      const parts = name.split('/');
      if (
        parts.some((part) =>
          /^(?:\.git|\.env(?:\..*)?|credentials\.json|node_modules|artifacts|temp|backups)$/.test(
            part,
          ),
        ) ||
        /\.(?:p8|p12|pem|key|mobileprovision|sql|dump|log)$/.test(name)
      )
        throw Error(`Private/generated input in upload: ${name}`);
      if (
        !rootFiles.has(name) &&
        !/^apps\/mobile\/(?:App\.tsx|index\.ts|app\.json|eas\.json|package\.json|tsconfig\.json|(?:src|assets|scripts|tests)\/.*|modules\/softek-overlay-capture\/(?:package\.json|expo-module\.config\.json|ios\/(?:SoftekOverlayCapture\.podspec|SoftekOverlayCaptureModule\.swift)))$/.test(
          name,
        )
      )
        throw Error(`Unexpected upload input: ${name}`);
      files.push(name);
    }
  }
}
walk(directory);
for (const needed of [
  'package.json',
  'package-lock.json',
  'apps/mobile/App.tsx',
  'apps/mobile/index.ts',
  'apps/mobile/app.json',
  'apps/mobile/eas.json',
  'apps/mobile/tsconfig.json',
  'apps/mobile/assets/icon.png',
  'apps/mobile/assets/splash.png',
  'apps/mobile/modules/softek-overlay-capture/package.json',
  'apps/mobile/modules/softek-overlay-capture/expo-module.config.json',
  'apps/mobile/modules/softek-overlay-capture/ios/SoftekOverlayCapture.podspec',
  'apps/mobile/modules/softek-overlay-capture/ios/SoftekOverlayCaptureModule.swift',
  'apps/web/package.json',
  'apps/api/package.json',
]) {
  if (!files.includes(needed))
    throw Error(`Required upload input missing: ${needed}`);
}
console.log(
  `Verified ${files.length} upload files; no private files, server sources or Git history.`,
);
console.log(`Inspected source: ${directory}`);
