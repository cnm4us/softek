import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import '../apps/api/src/config.js';
import { collectionMode } from './lib/collection-mode.js';
const enabled = collectionMode(process.argv.slice(2));
rmSync('apps/web/dist/collection-mode.json', { force: true });
execFileSync(
  'npm',
  ['run', 'build', '-w', '@softek/web', '-w', '@softek/api'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_CLARITY_ENABLED: String(enabled),
      VITE_PHOENIX_TRACING_ENABLED: String(enabled),
    },
  },
);
writeFileSync(
  'apps/web/dist/collection-mode.json',
  JSON.stringify({ clarity: enabled }),
);
console.log(
  `Built ${enabled ? 'Clarity evaluation' : 'collection-off'} profile.`,
);
