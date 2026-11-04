const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

// A project-owned cache avoids the host's corrupted shared npx cache. Authentication
// still uses the owner's existing Expo session; no credentials are copied here.
const result = spawnSync(
  'npx',
  ['--yes', 'eas-cli@25.2.0', ...process.argv.slice(2)],
  {
    cwd: resolve(__dirname, '..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      NPM_CONFIG_CACHE: resolve(__dirname, '../../../artifacts/npm-cache'),
      EXPO_NO_DOTENV: '1',
      // Upload only the inspected working files, without the web/API Git history.
      EAS_NO_VCS: '1',
      EAS_PROJECT_ROOT: resolve(__dirname, '../../..'),
    },
  },
);
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
