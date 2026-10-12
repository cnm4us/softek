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

Commit and review each migration before applying it. Migrations 0001–0007 are
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


Use **Admin Menu → Clarity Settings** (`/controls/clarity`) to turn site-wide
collection on/off. The setting persists in MariaDB. Only a configured evaluation
deployment can enable it. Each signed-in customer must then choose **Allow
analytics** in the initial modal overlay; **Keep analytics off** or Escape declines
without contacting Clarity. Later controls at the bottom of the page allow changing
the choice. Withdrawal stops
the SDK, removes this site's Clarity cookies and reloads the document. Admin pages
are excluded. Consent belongs to the customer and collection revision in this tab;
logout, switching users, or a global off/on cycle requires fresh opt-in.
Open foreground customer pages check settings every five seconds and on focus;
background browser throttling can delay the check until the tab resumes.

The owner confirmed project `yvs5hp3ivb`: Balanced masking, cookies on, bot detection
off (changed by the owner on 2026-10-12 UTC), and required consent. These are
owner-reported settings. Actual dashboard
recordings, heatmaps and masking playback still require owner verification.
Chris's invitation is deferred until the owner is ready to involve him.

## Bulk customer generation

Open **Admin Menu → Manage Customers → Generate customers**
(`/controls/customers/generate`). Choose 1–200, a prefix and shared demo password,
then adjust checking/savings ranges, eligibility, campaign and activity settings.
Default count is 10, Human activity, Savings Goals eligible, Value variant, checking
$100–$10,000 and savings $0–$50,000. Amounts permit two decimal places and $0–$1M.
The generated balance is saved per customer and restored on explicit reset;
normal relogin resumes the current balance. Existing manual users stay unchanged.
Manual creation, bulk generation and banking reset share one starting-account
setup; no template dropdown is shown. Use the separate Savings Goals eligibility
checkbox. No migration or reset of retained users is needed for this simplification.

Download the customer list after success. CSV includes stable UUID, username,
display name, opening amounts and activity mode; passwords are omitted. Customers
use the shared password entered for that batch, and existing individual password
resets still work. A lost response can be retried with the same form/request;
Start new batch makes a new request. Large batches may take about 14 seconds.
Generation alone does not sign in users or grant Clarity consent. Select Human
for manual logins; Automation requires the existing private harness header.
This phase does not automatically generate the eventual 100–200 production cohort.

Migration 0006 creates only batch/opening-amount tables. Applied SQL stays immutable.
Before application inspect both ledgers and back up production schema/data/ledger.
Old APIs ignore generated opening amounts during resets; choose a compatible
rollback release and follow the collection-off boundaries above.

## Delete a customer

In **Admin Menu → Manage Customers** (`/controls/customers`), use the selected
card's Delete button and confirm its username. Deletion removes that customer's
login, all active/retired banking runs and local activity permanently. Their
sessions become invalid and local reports lose their history. Cancel retains them.
Shared templates, banners/assets and other customers remain intact.

Batch retry metadata remains; replaying its original request returns only surviving
customers (possibly none). Use Start new batch to create new customers. Previously
collected Clarity recordings are not removed by this local operation. There is no
schema migration or automatic deletion of existing customers during deployment.

## Impersonate a customer

Open **Admin Menu → Manage Customers → customer details**, then **Impersonate
customer**. Enabled Human and Automation customers both work without their
password. Account Summary uses their actual saved state; a **Viewing as [name]**
indicator remains visible while navigating. Actions and resets persist for that
customer. This uses your actual browser/device, not their automation preference.

In the Customer Menu, **Exit to Admin** is immediately above Sign out and returns
to that customer's details. Sign out instead opens customer login. Both end
impersonation while preserving admin access; neither restores an earlier customer
login. Entry ends this browser's previous ordinary customer session, leaving
other browsers unaffected. Other open customer tabs stop collection and return
to Admin during entry. Refresh retains mode in the initiating tab.

Impersonation expires with its initiating admin session (at most one hour).
Admin logout/expiry, customer password replacement, disable and deletion end
access. Expired access returns to Admin; a deleted target returns to the list.
Clarity is always off during impersonation, with no analytics opt-in shown.
Local customer history labels **Admin impersonation**; default Adoption and
Feature Activity counts exclude those observations. Admin-only runs join cohorts
only after a customer visit, using their original run-start dates. Persisted
admin enrollment is not counted as a customer enrollment.

Migration 0008 adds tables without changing existing table layouts. The pre-0008
backup is `/var/backups/softek/demo-before-0008-20261012T061846Z.sql`; tested API/web
build recovery bundle is `/var/backups/softek/schema8-tested-build-20261012-final.tar.gz`
with workspace package manifests, both root-only 0600. Recovery requires installing
matching API dependencies and the existing private runtime environment; no secrets
are in the build bundle. Prefer the tested schema-8 code for recovery. Earlier
releases ignore visit provenance and would mix impersonation observations into
reports; do not use them as public rollback targets after impersonation activity.
No rollback was executed. Applied migrations remain immutable.

## Customer device and browser

Create Customer and Generate Customers include Device/Browser selectors. For an
existing customer, use Customer Details → Device and browser → Save device and
browser. This preserves accounts, goals, sessions and analytics consent. Missing
preferences default to Desktop/Chrome; bulk exports include both IDs.

Automation engines need `npx playwright install --with-deps chromium firefox webkit`.
This host has the matching browser binaries/dependencies installed. The resolver
uses seven supported pairs from the shared catalog; Safari is WebKit emulation and
Edge uses Chromium with the Edge preset. Normal logins use the actual browser.

For a deliberate authorized recording pilot only:

```bash
npm run clarity:pilot -- --collect --device=iphone --browser=safari
npm run clarity:pilot -- --collect --customer=YOUR_CUSTOMER_UUID
```

The second command reads the saved pair and username from the protected admin
API. Set `PILOT_CUSTOMER_PASSWORD` in ignored private `.env` beforehand; don't put
passwords on the command line. It requires an enabled Automation customer and
does not reset banking. The first command creates two labeled pilot customers
with that pair; default without profile flags is Desktop/Chrome. Collection still
requires the current evaluation deployment, global switch, capture header and
explicit consent. Never use this command as a routine test. Bot Detection is
owner-reported Off as of 2026-10-12 UTC; the manifest labels this as owner-reported.
The pilot sets `pilot_run` and `pilot_scenario` custom tags, includes reading pauses
and scrolling, and saves UUIDs/times/tag values in ignored 0600
`artifacts/clarity-pilot.json`. In project `yvs5hp3ivb`, filter recordings using
that `pilot_run` value or the customer Clarity lookup UUID. Observed uploads do
not establish dashboard classification or inclusion.

Migration 0007 is additive and preserves 0006 starting balances. Keep applied SQL
immutable; rollback code lacking these preferences ignores them. See PROJECT_STATE
for the scoped pre-0007 backup and verified release.

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
`softek-api` before reloading Nginx. With no arguments, build/deploy force collection off. It requires this host's
existing passwordless sudo access. No repository sources or `.env` are public.

For authorized Clarity evaluation, record `CLARITY_CONFIG_VERIFIED=true` and the
verified `CLARITY_PROJECT_ID` in private `.env`, then run:

```bash
npm run build -- --clarity
npm run deploy -- --clarity
```

Build writes a collection-profile marker; deploy refuses a mismatched profile
before changing the host. Evaluation deployment installs matching frontend/runtime
gates and permits `*.clarity.ms` scripts/connections/images and `c.bing.com`
connections/images only in this site's CSP. Default deployment restores the
same-origin CSP and disabled runtime gates; the stored requested toggle is retained.
After evaluation deployment, turn collection on in Admin Menu → Clarity Settings.
Routine public smoke still cannot collect from its automated users.

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
Prefer `npm run build` followed by `npm run deploy` to return the current code to
collection-off mode. Before pointing at an older release that lacks the database
switch, explicitly restore collection-off runtime flags and same-origin CSP;
otherwise that release could ignore the new toggle. Keep the additive 0005 table.
For an application rollback, choose an authenticated release compatible with
schema version 7 and point both `current` links at its existing release directories, restart `softek-api`, then verify public health and refresh.
Pre-generation code can read existing customers but does not restore saved individual
balances on reset. Choose code supporting 0006 when generated customers exist.
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

## Feature campaigns and activity — Plan 005

Customer Menu → Explore Features opens twelve authenticated landing pages. Their
primary CTAs show demo confirmations only; all customers may explore regardless
of separate Savings Goals eligibility. Confirmation is local to a page entry.
There are no feature enrollment/payment/investment actions or new inputs.

In Manage Banners, select any feature's internal destination. Upload artwork with
the existing controls and choose order/enabled explicitly; this release does not
create or enable twelve promotional images. Feature banners have no Savings Goals
campaign association. Banner display/rotation remains on Account Summary only.

Adoption Report → Feature Activity shows per-feature raw landing views/CTA clicks,
distinct customers/runs and banner-attributed observations. Its actor, variant,
run-start UTC dates and cutoff use the same filters as the separate Savings Goals
report. Customer activity also names feature observations; these are engagement,
not enrollment or adoption. Normal navigation/reload can produce new page entries.

Schema 0004 only appends two interaction ENUM names; old values/order remain.
Back up schema/data/ledger before applying it, then run migration status and a
repeat no-op. Never modify applied files or downgrade the ENUM to roll back UI.
Historical compatibility was checked on schema 4. The current schema is version
7; follow the rollback section above, including collection-off runtime/CSP before
using pre-switch code. See the verified releases and backups in PROJECT_STATE.
