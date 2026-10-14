import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  databaseConfig,
  projectRoot,
  serverConfig,
} from '../apps/api/src/config.js';
import { migrationStatus } from './lib/migrations.js';

import { collectionMode } from './lib/collection-mode.js';

const collection = collectionMode(process.argv.slice(2));
const profile = JSON.parse(
  readFileSync(join(projectRoot, 'apps/web/dist/collection-mode.json'), 'utf8'),
);
if (profile.clarity !== collection)
  throw new Error('Build and deployment collection profiles must match.');
// Publish only already built files. No database migration is hidden in deployment.
serverConfig();
databaseConfig('runtime');
const status = await migrationStatus();
if (status.pending.length || status.problems.length)
  throw new Error('Resolve pending/drifted migrations before deployment.');
for (const file of ['apps/web/dist/index.html', 'apps/api/dist/server.js'])
  if (!existsSync(join(projectRoot, file)))
    throw new Error('Build the application before deploying.');
if (
  !process.env.SESSION_SECRET ||
  !process.env.DEMO_ADMIN_SECRET ||
  !process.env.AUTOMATION_SECRET
)
  throw new Error('Private application secrets must be configured.');
const release = new Date().toISOString().replace(/[:.]/g, '-');
const staging = mkdtempSync(join(tmpdir(), 'softek-release-'));
const run = (command: string, args: string[], input?: string) =>
  execFileSync(command, args, {
    cwd: staging,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...(input ? { input } : {}),
  });
try {
  for (const p of ['apps/api', 'apps/web'])
    mkdirSync(join(staging, p), { recursive: true });
  for (const f of [
    'package.json',
    'package-lock.json',
    'apps/api/package.json',
    'apps/web/package.json',
  ])
    cpSync(join(projectRoot, f), join(staging, f));
  cpSync(join(projectRoot, 'apps/api/dist'), join(staging, 'apps/api/dist'), {
    recursive: true,
  });
  // Install without lifecycle scripts, as the development user, outside public paths.
  run('npm', [
    'ci',
    '--omit=dev',
    '--workspace=@softek/api',
    '--ignore-scripts',
  ]);
  const env: Record<string, string> = {
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: '3100',
    PUBLIC_ORIGIN: 'https://demo.bawebtech.com',
    BANNER_ASSET_DIR: '/var/lib/softek/banner-assets',
    CLARITY_ENABLED: String(collection),
    VITE_CLARITY_ENABLED: String(collection),
    VITE_PHOENIX_TRACING_ENABLED: String(collection),
    PHOENIX_TRACING_ENABLED:
      process.env.PHOENIX_TRACING_ENABLED === 'true' ? 'true' : 'false',
    SOFTEK_PHOENIX_ENDPOINT: 'http://127.0.0.1:6006/v1/traces',
    SOFTEK_RELEASE: release,
    CLARITY_CONFIG_VERIFIED: String(collection),
    ...(collection
      ? { CLARITY_PROJECT_ID: process.env.CLARITY_PROJECT_ID! }
      : {}),
  };
  for (const name of [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'SESSION_SECRET',
    'DEMO_ADMIN_SECRET',
    'AUTOMATION_SECRET',
  ])
    env[name] = process.env[name]!;
  // Secrets go over stdin, never shell arguments or logs; root writes an allowlist.
  const helper = String.raw`
import json,os,pwd,shutil,subprocess,sys
p=json.load(sys.stdin)
try: pwd.getpwnam('softek')
except KeyError: subprocess.run(['useradd','--system','--user-group','--home-dir','/nonexistent','--shell','/usr/sbin/nologin','softek'],check=True)
for path in ['/opt/softek/releases','/opt/softek/runtime/bin','/etc/softek','/var/www/softek/releases','/var/backups/softek','/var/lib/softek/banner-assets']:
 os.makedirs(path,exist_ok=True)
os.chmod('/etc/softek',0o750)
os.chmod('/var/backups/softek',0o700)
uid=pwd.getpwnam('softek').pw_uid;gid=pwd.getpwnam('softek').pw_gid
os.chown('/etc/softek',0,gid)
os.chown('/var/lib/softek/banner-assets',uid,gid);os.chmod('/var/lib/softek/banner-assets',0o750)
# Copy immutable seeded creatives only when absent; uploads remain outside releases.
if os.path.isdir(p['bannerAssets']):
 for name in os.listdir(p['bannerAssets']):
  if name.endswith('.webp') and not name.startswith('.'):
   target='/var/lib/softek/banner-assets/'+name
   if not os.path.exists(target):shutil.copy2(os.path.join(p['bannerAssets'],name),target);os.chown(target,uid,gid);os.chmod(target,0o644)
release='/opt/softek/releases/'+p['release']
shutil.copytree(p['staging'],release,ignore=shutil.ignore_patterns('install.py','nginx.conf'))
# Runtime can read the release, but cannot edit code or credentials.
for root,dirs,files in os.walk(release):
 os.chmod(root,0o755)
 for f in files:
  path=os.path.join(root,f)
  if not os.path.islink(path): os.chmod(path,0o644)
shutil.copy2(p['node'],'/opt/softek/runtime/bin/node.next');os.chmod('/opt/softek/runtime/bin/node.next',0o755);os.replace('/opt/softek/runtime/bin/node.next','/opt/softek/runtime/bin/node')
web='/var/www/softek/releases/'+p['release']
shutil.copytree(p['web'],web)
for root,dirs,files in os.walk(web):
 os.chmod(root,0o755)
 for f in files: os.chmod(os.path.join(root,f),0o644)
# systemd EnvironmentFile double quotes; no expansion of dollars/backticks.
def quote(v):
 if '\n' in v or '\r' in v or '\x00' in v: raise ValueError('Multiline environment value refused')
 return '"'+v.replace('\\','\\\\').replace('"','\\"').replace('$','\\$').replace('\x60','\\\x60')+'"'
path='/etc/softek/runtime.env'
fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o640)
with os.fdopen(fd,'w') as f: f.write('\n'.join(k+'='+quote(v) for k,v in p['env'].items())+'\n')
os.chmod(path,0o640);os.chown(path,0,gid)
for target,link in [(release,'/opt/softek/current'),(web,'/var/www/softek/current')]:
 temp=link+'.next'
 if os.path.lexists(temp):os.unlink(temp)
 os.symlink(target,temp);os.replace(temp,link)
shutil.copy2(p['unit'],'/etc/systemd/system/softek-api.service');os.chmod('/etc/systemd/system/softek-api.service',0o644)
nginx='/etc/nginx/sites-available/012_demo.bawebtech.com'
shutil.copy2(nginx,'/var/backups/softek/nginx-before-'+p['release']+'.conf')
shutil.copy2(p['nginx'],nginx);os.chmod(nginx,0o644)
subprocess.run(['/usr/sbin/nginx','-t'],check=True)
subprocess.run(['systemctl','daemon-reload'],check=True)
subprocess.run(['systemctl','enable','softek-api.service'],check=True)
subprocess.run(['systemctl','restart','softek-api.service'],check=True)
subprocess.run(['systemctl','reload','nginx'],check=True)
`;
  const nginxPath = join(staging, 'nginx.conf');
  let nginx = readFileSync(
    join(projectRoot, 'deploy/nginx/demo.bawebtech.com.conf'),
    'utf8',
  );
  if (collection)
    nginx = nginx
      .replace("script-src 'self'", "script-src 'self' https://*.clarity.ms")
      .replace(
        "connect-src 'self'",
        "connect-src 'self' https://*.clarity.ms https://c.bing.com",
      )
      .replace(
        "img-src 'self' data:",
        "img-src 'self' data: https://*.clarity.ms https://c.bing.com",
      );
  writeFileSync(nginxPath, nginx);
  const helperPath = join(staging, 'install.py');
  writeFileSync(helperPath, helper, { mode: 0o600 });
  // Root's copy excludes the installer; secrets remain stdin-only.
  const input = JSON.stringify({
    release,
    staging,
    node: process.execPath,
    web: join(projectRoot, 'apps/web/dist'),
    unit: join(projectRoot, 'deploy/systemd.softek-api.service'),
    nginx: nginxPath,
    env,
    bannerAssets: join(projectRoot, 'artifacts/banner-assets'),
  });
  const output = run('sudo', ['-n', 'python3', helperPath], input);
  if (output.trim()) console.log(output.trim());
  console.log(
    `Deployed release ${release}. Verify systemd and public HTTPS health; see LOCAL_SETUP.md for rollback.`,
  );
} catch {
  // Do not print child-process objects: they can contain the protected stdin payload.
  console.error(
    'Deployment failed. Inspect the dedicated service/configuration and follow LOCAL_SETUP.md rollback.',
  );
  process.exitCode = 1;
} finally {
  rmSync(staging, { recursive: true, force: true });
}
