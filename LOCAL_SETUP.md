# Local setup and host runbook

The banking demo is live at **https://demo.bawebtech.com**. Here, local development
means the workspace on the same EC2 instance. Production and development have
separate API ports so they can run together.

## Environment and first checkout

Verified on 2026-10-11 UTC: Ubuntu 22.04.5, Node 22.21.1 through Ubuntu's NVM,
npm 10.9.4, Git 2.34.1, MariaDB 10.6.22, Nginx 1.18, Certbot 1.21.
Workspace: `/home/ubuntu/softek`; origin: `https://github.com/cnm4us/softek.git`.
Use `git status` and [PROJECT_STATE.md](PROJECT_STATE.md) for current Git state.

On this instance, keep the existing private `.env`. On a fresh checkout, copy
[.env.example](.env.example) and supply credentials and strong random secrets.
Never put secrets in `VITE_` settings, commands, logs, or commits.

```bash
npm ci
npm run db:status
npm run db:status -- --test
npm run db:migrate
npm run db:migrate -- --test
npm run db:seed
npm run db:seed -- --test
```

Commit and review each migration before applying it. Migrations 0001–0003 are
already applied on this instance; repeated migration is a verified no-op. Seeds upsert fictional templates and add absent starter banner fixtures,
preserving participant balances/goals/history and existing admin banner settings. Reset is a customer-run operation, never a database drop.

## Database access

All connections use local TCP `127.0.0.1:3306`, with explicit target validation.
Schemas use `utf8mb4` / `utf8mb4_unicode_ci`.

| Role | Private settings | Scope |
| --- | --- | --- |
| Application | `DB_NAME=demo`, `DB_USER`, `DB_PASSWORD` | CRUD on `demo` only |
| Test application | `TEST_DB_NAME=demo_test`, `TEST_DB_USER`, `TEST_DB_PASSWORD` | CRUD on `demo_test` only |
| Migration | `MIGRATION_DB_USER`, `MIGRATION_DB_PASSWORD` | CRUD and DDL on `demo` / `demo_test` only |
| Bootstrap admin | `ADMIN_DB_*` | Supplied administrative connection; never in the runtime service |

The user's corrected administrative password works over TCP and the socket.
Runtime cannot read `mysql.user`. Migration/test accounts have no global grants
or grant option. `npm run db:provision` rechecks/provisions additional scoped test
and migration resources; it does not replace migrations or recreate an existing
runtime database. The initial bootstrap used existing `sudo -n mariadb` access.

## Development and tests

```bash
npm run dev
```

Frontend: `http://127.0.0.1:5173`; development/test API: `127.0.0.1:3101`.
Vite proxies `/api` and `/media` to 3101. Production API remains on 3100. Use VS Code port
forwarding for 5173; stop dev servers with Ctrl+C without stopping production.

`PUBLIC_ORIGIN` must match the browser's exact origin for mutation requests. If
forwarding produces `http://localhost:5173`, set that value in the private `.env`
and restart the development API. Default is `http://127.0.0.1:5173`. Playwright
sets its own origin and port, independently of development preferences.

```bash
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run format:check
```

See [TESTING.MD](TESTING.MD) for coverage and cleanup boundaries. Fresh browser
setup: `npx playwright install chromium`. Tests force Clarity off and designate
journeys as automation using a private harness secret, without embedding it in
the frontend bundle.

## Application configuration

`.env` is `ubuntu:ubuntu`, mode `0600`, ignored. The deployed allowlist is
`/etc/softek/runtime.env`, `root:softek`, mode `0640`, inside a `0750` directory.
It contains runtime DB credentials and application secrets; it excludes all
admin DB, migration, and test credentials.

| Setting | Purpose |
| --- | --- |
| `HOST`, `PORT` | Loopback API listener; dev 3101 / deployed 3100 |
| `PUBLIC_ORIGIN` | Exact allowed origin; deployed HTTPS hostname |
| `SESSION_SECRET` | HMAC protection for session-scoped CSRF tokens; at least 32 characters |
| `DEMO_ADMIN_SECRET` | Password for `/controls`; at least 24 characters |
| `AUTOMATION_SECRET` | Trusted harness header; must match a dedicated automation user |
| `BANNER_ASSET_DIR` | Optional local asset path; production is `/var/lib/softek/banner-assets` |
| `CLARITY_ENABLED` | Server collection gate, false |
| `CLARITY_CONFIG_VERIFIED` | Explicit verification gate, false |
| `CLARITY_PROJECT_ID` | Candidate project must be verified before use |
| `VITE_CLARITY_ENABLED` | Public build gate, false |

Open your private `.env` in VS Code to retrieve `DEMO_ADMIN_SECRET`, then sign in
at `/controls`. A banking login is not required for admin access. Open the
upper-right **Admin Menu → Manage Customers**, then **Create customer**, to create
a unique username (case-insensitive ASCII, 3–40 characters; email addresses with
@ and plus aliases are accepted within that limit), fictional display
label, password (8–128 characters), profile, eligibility, variant, and actor.
Use Human for ordinary demo logins; Automation requires the private harness
header. First login creates banking state; later login resumes the same state.
You can copy the Clarity lookup ID, inspect observations, replace passwords,
enable/disable, or explicitly reset/reconfigure a selected user. Password reset
and disable revoke authentication without clearing banking state. The report defaults to human activity. Switch to automated journeys
to view deployed smoke checks. Admin sessions expire after one hour.

Admin home is `/controls`; the customer list is `/controls/customers`, creation
is `/controls/customers/new`, and selected actions are under `/controls/customers/:userId`.
Adoption Report is `/controls/report`. Direct child links/reloads require the same
admin sign-in and preserve the requested destination. Report filters persist during
admin menu navigation, then reset on reload/sign-out. Missing pages/customers have
return links. Admin sign-out preserves a banking session; customer sign-out preserves
admin access. Customer navigation uses the separate **Customer Menu**. The customer
login footer links to admin sign-in; the admin footer links to the customer site.


Clarity needs both collection gates, a valid verified project ID, a matching
frontend build, visitor opt-in, and an approved Nginx CSP. The current CSP permits
only same-origin scripts/connections. Updating it for verified Clarity domains
belongs to M2; flipping flags alone is insufficient. No live collection is enabled. The owner reported Balanced masking, cookies on,
bot detection on, and required consent for `yvs5hp3ivb` on 2026-10-11 UTC. Actual
playback, account switching, consent behavior, and Chris's access remain M2 checks.

## Banner administration

Use **Admin Menu → Manage Banners** (`/controls/banners`) to upload, preview,
set accessible link text, choose an
internal destination, set order, enable/disable, or upload a replacement. JPEG,
PNG, and WebP are supported; maximum upload 5 MiB and dimensions 4096×4096.
Recommended artwork is 3:1 (1200×400), with important text inside image margins.
Output is WebP scaled to at most 1600 pixels wide. Existing image URLs remain
immutable and readable after replacement. Disabling avoids deleting history.

Three starter creatives target Savings Goals, Bill Pay and Cards. Login and full
Account Summary refresh cycle enabled images; menu returns/data fetches preserve
the current tab's selection. The user sequence survives logout and banking reset.
Public artwork is intentionally readable without login for replay rendering; use
fictional marketing content. Local files default to `artifacts/banner-assets`,
test files to `artifacts/test-banner-assets`; production storage is independent
of release paths. A disabled 'Deployment persistence check' creative is retained
as deployment evidence and does not join normal rotation.

## Production deployment

Only the dedicated Softek resources are changed. Existing host sites and MariaDB
installation remain in place.

| Resource | Location |
| --- | --- |
| Dedicated OS account | `softek`, system user, no login shell |
| API unit source | `deploy/systemd.softek-api.service` |
| Installed unit | `/etc/systemd/system/softek-api.service` |
| Runtime executable | `/opt/softek/runtime/bin/node` (22.21.1, independent of NVM home permissions) |
| API releases / active link | `/opt/softek/releases/` / `/opt/softek/current` |
| Frontend releases / active link | `/var/www/softek/releases/` / `/var/www/softek/current` |
| Available / enabled site | `/etc/nginx/sites-available/012_demo.bawebtech.com` / matching sites-enabled link |
| Nginx source | `deploy/nginx/demo.bawebtech.com.conf` |
| Original placeholder | `/var/www/softek/public`, `deploy/nginx/demo.bawebtech.com.placeholder.conf` |
| ACME webroot | `/var/www/softek/letsencrypt` |
| Certificate | `/etc/letsencrypt/live/demo.bawebtech.com/` |
| Nginx logs | `/var/log/nginx/softek.access.log`, `/var/log/nginx/softek.error.log` |
| API logs | `journalctl -u softek-api` |
| Private backups | `/var/backups/softek/` |
| Persistent public banner assets | `/var/lib/softek/banner-assets`, `softek:softek`, 0750 |

Before a schema change, review status/target and recovery requirements. Retained
data needs a scoped backup before destructive changes. The login/banner upgrade
was backed up at `/var/backups/softek/demo-before-0002-20261011T165522Z.sql`.
Back up the persistent asset directory along with the schema, and keep published
files referenced by old presentations. Initial empty-schema
backup: `/var/backups/softek/before-0001-demo.sql`. Example scoped backup uses
socket administration and prints no credentials:

```bash
sudo sh -c 'umask 077; mariadb-dump --single-transaction --databases demo > /var/backups/softek/demo-before-change.sql'
```

Choose a new backup filename for each change; do not overwrite a retained backup.
MariaDB DDL is not transactional. If the runner records a failure, inspect partial
changes and restore the reviewed prechange backup before resolving the ledger.
Do not clear a failed entry and blindly retry.

After the applicable tests and committed migrations:

```bash
npm run build
npm run deploy
systemctl is-active softek-api
curl --fail https://demo.bawebtech.com/api/health
npm run smoke:public
```

`deploy` refuses pending or drifted migrations; it never runs SQL implicitly. It
installs production API dependencies as Ubuntu without lifecycle scripts, copies
built API/static files into new root-owned releases, provisions the persistent
asset directory and copies only missing starter assets, writes a runtime-only secret
allowlist over protected stdin, updates links, tests Nginx, and restarts only
`softek-api` before reloading Nginx. It forces Clarity off. It requires this host's
existing passwordless sudo access. No repository sources or `.env` are public.

The service starts on boot, restarts on failure, runs without sudo, and uses
`NoNewPrivileges`, `ProtectHome`, `ProtectSystem=strict`, and a private temporary
directory. The runtime cannot edit application code; only the banner directory is writable. `/api/health` checks the API
and DB; `/healthz` is only an Nginx marker. SPA routes support direct refresh;
unknown API paths return JSON 404 rather than the SPA. HTTP redirects to HTTPS;
participant/admin cookies are HttpOnly, Secure, and SameSite=Lax in production.

`smoke:public` creates dedicated admin-created automation users/runs on `demo`,
exercises login, menu, rotation, goals, persistence, reporting, and reset. It retains their retired history for the demo report. Routine
integration/browser tests use `demo_test` and remove only their own fixture users, runs, and uploaded assets.

## Rollback and renewal

Keep the prior API/frontend release paths from `readlink` before a deployment.
For an application rollback, choose an authenticated release compatible with
schema version 3 and point both `current` links at its existing release directories, restart `softek-api`, then verify public health and refresh.
Use `ln -s <reviewed-path> <current>.next` and `mv -T <current>.next <current>` for
atomic link replacement. Never select an unreviewed release by an assumed name.
A schema downgrade is separate and requires a reviewed recovery plan.

The pre-revision anonymous releases (including `2026-10-11T06-07-44-353Z`) do not
meet the current login boundary. If no compatible authenticated release is
available, use the scoped placeholder below as a maintenance fallback. Preserve
the database and persistent images; do not re-enable public anonymous access.
Uploaded image persistence was verified through a hardened service restart and
repeat deployment. An actual schema downgrade or rollback was not exercised.

Each deployment saves the prior dedicated Nginx config under
`/var/backups/softek/nginx-before-<release>.conf`. If configuration installation
fails, restore that specific file, test Nginx, and reload. To return to the initial
placeholder, install `demo.bawebtech.com.placeholder.conf`, test/reload Nginx, and
stop only `softek-api`. Do not delete other sites or stop shared Nginx/MariaDB.

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo journalctl -u softek-api --no-pager -n 30
sudo certbot renew --cert-name demo.bawebtech.com --dry-run --non-interactive --no-directory-hooks
```

Renewal dry run passed during HTTPS setup. The existing Certbot timer is active;
this certificate's persisted hook tests/reloads Nginx after renewal. Preserve
ACME routing. Nginx reload is asynchronous; allow new workers to start before
checking changed routing. Do not repeat ACME issuance to test application changes.
