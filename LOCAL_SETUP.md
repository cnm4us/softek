# Local setup and host runbook

The banking demo is live at **https://demo.bawebtech.com**. Here, local development
means the workspace on the same EC2 instance. Production and development have
separate API ports so they can run together.

## Environment and first checkout

Phoenix API-call tracing setup and inspection are documented at
[Plan 017 operations](#phoenix-api-call-tracing--plan-017).

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

## Contextual discovery walkthrough

- Customer Menu → **Savings & Investing** → **Explore investing** shows the
  EasyCoin invitation when preferences/cooldowns allow. Learn more opens the
  existing Crypto page; its CTA remains confirmation-only.
- Customer Menu → **Loans** → **Harbor auto loan** shows the Skip A Pay invitation.
  The personal-loan example is ineligible and does not show it. Make a demo
  payment offers a masked form, review and confirmation without moving money.
- Customer Menu → **Discovery preferences** controls these contextual invitations.
  The settings follow the customer across logins and survive banking reset.
- Only one contextual invitation is reserved per visit; use separate logins or
  customers to demonstrate the two features. Seen features rest 14 days and
  dismissals 90 days; fewer suggestions adds a seven-day interval. Existing
  banners and Savings Goals remain separate. Permanent Explore is always available.
- Admin Menu → **Adoption Report** includes **Contextual Discovery**, with the same
  actor/variant/time filters and impersonation excluded. It counts actual-visible
  impressions separately from reserved selections and linked feature engagement.

The two banking contexts are fictional demonstrations; no provider integration,
real eligibility decision, loan servicing or feature activation is implemented.
The current institution is Harbor; tenant switching is later scope. Rule/copy
configuration lives in `apps/api/src/discovery-config.ts`.

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
directory. The runtime cannot edit application code; only the banner directory is writable.
Plan 024 proposes a separate private recording directory; it is not provisioned.
`/api/health` checks the API
and DB; `/healthz` is only an Nginx marker. SPA routes support direct refresh;
unknown API paths return JSON 404 rather than the SPA. HTTP redirects to HTTPS;
participant/admin cookies are HttpOnly, Secure, and SameSite=Lax in production.

`smoke:public` creates dedicated admin-created automation users/runs on `demo`,
exercises login, menu, rotation, goals, persistence, reporting, and reset. It retains their retired history for the demo report. Routine
integration/browser tests use `demo_test` and remove only their own fixture users, runs, and uploaded assets.

## Rollback and renewal

### Owner-requested shutdown and restoration

The owner requested the demo stop on October 17, 2026 and resume on November 2,
2026. The retained release is running again. Current operational state and
verification are in [PROJECT_STATE](PROJECT_STATE.md#current-reality).
`deploy/nginx/demo.bawebtech.com.maintenance.conf` returns a plain HTTPS 503 for
application/API/assets, retaining HTTP redirects, TLS and ACME challenges. Only
`/etc/nginx/sites-available/012_demo.bawebtech.com` was replaced; shared Nginx and
MariaDB remain running. The dedicated API and Phoenix services were stopped and
disabled to preserve shutdown across reboots. No data or releases were deleted.

The exact prior live Nginx configuration and before-shutdown service/configuration
manifest are root-only under `/var/backups/softek/shutdown-20261017T160358Z/`.
After an owner request to resume, restore the retained release without rebuilding:

```bash
sudo systemctl enable --now softek-api.service softek-phoenix.service
curl --fail http://127.0.0.1:3100/api/health
sudo install -o root -g root -m 0644 /var/backups/softek/shutdown-20261017T160358Z/nginx.conf /etc/nginx/sites-available/012_demo.bawebtech.com
sudo nginx -t
sudo systemctl reload nginx
curl --fail https://demo.bawebtech.com/api/health
```

These restore steps were executed for the November 2 resumption. The replaced
maintenance site is retained at
`/var/backups/softek/resume-20261102T203120Z/maintenance-nginx.conf`.
If the API health check fails during a future restoration, keep the public
maintenance configuration installed while investigating. Existing
collection/tracing switches are retained; review current
owner instructions before resuming customer collection. A regular deployment
replaces the maintenance site and starts the API, so do not deploy or run public
smoke/capture tests merely as a check while the owner wants the demo stopped.

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

## Customer catalog navigation — Plan 012

Customer Menu → Explore more ways to bank opens authenticated `/explore`.
Direct visits prompt for login and then retain that destination. Five sections
start expanded; search filters full product names. Catalog feature links return
to the catalog; banners and contextual suggestions retain their existing return
paths. Plan 012 itself needed no migration; subsequent Plan 015 adds the
configuration-only 0010 migration.
The tracked smoke/pilot scripts now use the catalog; actual capture still requires
explicit collection authorization and the existing private capture controls.

## Customer account details — Plan 013

Account Summary widgets open `/accounts/checking`, `/accounts/savings` and
`/accounts/credit-card`. Login preserves a direct account destination. Pages use
current owned balances/history and labeled sample statement entries; refreshing or
viewing them does not seed or alter ledger data. No migration: schema stays 9.
Summary's standalone View savings options link is removed. Savings & Investing
in the menu still opens the existing educational context; new account-page Explore
placements await the owner discussion.

Plan 014 replaces linked Summary artwork with inactive compact placeholders on
Summary and account details. Admin assets and selection/history remain available;
no placeholder click or exposure is recorded. The existing `clarity:pilot` banner
pair requires adaptation before reuse (B-016); feature-menu journeys remain useful.

## Feature Explorer controls — Plan 015

Use Admin Menu → Feature Explorer (`/controls/feature-explorer`). Add a catalog
feature under a banner space, then select its title to upload/replace mobile
artwork, copy its URL and save accessible text, display order and inclusion in
future rotation. JPEG/PNG/WebP, at most 5 MiB/4096px per side; recommend 960×315.
Uploads use the existing persistent immutable WebP directory. Only the new
widget image-upload URL has an additional scoped Nginx 6 MiB body allowance.
Customer rotation is not activated by these settings; the owner chose admin-only
configuration in this phase. Migration 0010 is additive and needs no seed data.

Migration 0010 is applied to `demo` and `demo_test`; repeat application is a no-op.
Scoped root-only 0600 prechange backup:
`/var/backups/softek/demo-before-0010-20261013T205047Z.sql`.
The prior Plan 014 application can ignore this additive table during a code-only
rollback; keep the schema and configuration data rather than dropping the table.
No rollback was performed. Next migration number is 0011.

Feature Explorer rows and widget configuration also provide confirmed Delete.
This removes only that banner space's widget/settings and makes its feature
available to add again; the shared landing page and immutable images remain.

## Summary banner activation — Plan 016

Account Summary now displays enabled uploaded widgets from its Feature Explorer
space; select Include in rotation and saved order there. Other spaces remain
configuration-only. Images are centered/contained in the compact strip; recommend
960×315 mobile artwork. Login/full Summary refresh cycles the enabled list;
menu returns retain the exact selection, and empty/error states show a placeholder.
Legacy Manage Banners remains separate. The banner-click pilot can find the linked
Summary slot again; do not run real capture without its explicit collection scope.
Public smoke accepts a rendered banner or placeholder and retains capture-off use.

Migration 0011 adds only a Summary cursor. Root-only 0600 prechange backup:
`/var/backups/softek/demo-before-0011-20261014T000207Z.sql`.
Both schemas are version 11; repeat application is a no-op, next migration 0012.
A code rollback may leave the additive cursor/snapshots intact; do not drop data.
No rollback was performed.

## Phoenix API-call tracing — Plan 017

Admin Menu → **Clarity Settings → Clarity API-call tracing** has its own On/Off
switch. The deployment is configured, but tracing starts **Off**. Turning it on
does not enable Clarity or grant consent. After enabling, refresh the customer
page to load the current adapter; the customer must allow analytics. Existing
valid analytics consent can be used. Calls made before tracing starts are not
recovered. Ordinary Automation profiles and admin/impersonation visits stay excluded.

Use the **VS Code Ports** panel to forward remote port **6006** privately, then
open `http://localhost:6006`. Alternatively, on your local machine:

```bash
ssh -N -L 6006:127.0.0.1:6006 ubuntu@demo.bawebtech.com
```

Use the same SSH identity/configuration you normally use for this EC2 host. Do not
open port 6006 in the EC2 security group. Phoenix's UI and OTLP HTTP collector bind
only to `127.0.0.1:6006`. The project's launcher disables Phoenix's default gRPC
listener; the other existing telemetry listeners are untouched. The server can
also export through loopback without a browser tunnel.

After customer activity, select Phoenix project **softek-clarity-api**, then a
`clarity.event`, `clarity.set`, `clarity.identify`, `clarity.consentv2` or
`clarity.stop` span. **Input** shows the full readable call, for example
`clarity("event", "banner_clicked");`. It is also available under
**Attributes → clarity.call**; `clarity.arguments_json` retains the full supported
safe argument array. **Output** reports Queued for SDK, SDK invocation returned,
Invocation threw or Clarity SDK callable was unavailable. **Status** is OK when the
local invocation returned, including a queued call; ERROR covers thrown/unavailable
calls. **Error** shows the bounded status message only for ERROR. These fields apply
to newly exported spans; previously acknowledged spans retain their old presentation.

`user.id` matches the customer's opaque Clarity custom user ID; `session.id` is our
owned visit ID. Kind remains **unknown** for these ordinary application spans.
`softek.event_id` and document/sequence attributes support comparison with the
admin JSON export. Local invocation time is not Microsoft network latency, and OK
is not confirmation of Microsoft receipt or recording storage.

After Plans 019/020, a successful Summary reload sends one identity and nine
context tags once each. Identity, run/institution/actor/variant/route proceed while
the image loads; feature/service/campaign/banner wait for resolved artwork. No
loading-placeholder feature/banner none or service banking is emitted. Pending
banner-dependent audit metadata is omitted. Genuine empty/failed slots and pages
without banners retain appropriate absence context. Consent, page-view,
banner-visible, click and CTA calls remain separate; SDK upload batching is independent.

To compare one reload in Spans, filter by
`attributes["softek"]["document_id"] == "DOCUMENT_UUID"` from a new span. Use nested
attribute access for dotted keys, such as `attributes["clarity"]["command"] == "set"`;
REST output flattens those keys. Allow a few seconds for browser/server queues,
then refresh Phoenix if stale. Clearing Phoenix does not stop open-page timers
or discard queued calls; document filtering isolates the new reload.

For current Feature Explorer activity, Clarity custom tag **banner** uses readable
space-feature values. In the current Summary set, choose summary-business-invoice,
summary-identity-protect or summary-youth-banking. The exact value is also shown in
Admin → Feature Explorer → widget → Clarity banner value. The alias remains on its
banner-linked landing page; direct/menu entries retain their normal absence context.
Old Clarity/Phoenix history retains UUID values. Values identify a space/feature,
while first-party UUID/asset snapshots distinguish widgets and creative revisions.
Combine the tag with the exact Summary URL to find relevant Clarity sessions;
rotation within a session means those filters are not exact per-banner hit counts.

Plan 022 adds the action tag **cta-clicked**. In Clarity Filters → Custom tags,
select cta-clicked = summary-business-invoice (or summary-identity-protect /
summary-youth-banking) to find sessions with an acknowledged CTA reached through
that banner. This avoids combining a seen-banner tag with an unrelated generic
CTA elsewhere in the session. Values accumulate; saved filters identify sessions,
not exact click counts. The generic feature_cta_clicked event remains. A tag is
emitted only after backend acknowledgement, from an owned readable landing entry,
and is mirrored to Phoenix. Direct/menu/discovery entries and legacy entries
without the readable alias produce no cta-clicked tag. Refresh for the current
release; new filter values follow Microsoft's indexing window below.

The admin status distinguishes pending, collector-acknowledged and failed exports.
Acknowledgment is to Phoenix, not Microsoft. Accepted historical records finish
exporting after tracing is switched Off. Browser closure, lost authentication,
queue overflow and offline activity can cause gaps; reported omissions/failures
are bounded counters, not a guarantee of a complete browser log. Retention is
seven days in MariaDB and the dedicated Phoenix instance. Customer deletion
removes local diagnostics; already exported Phoenix copies expire independently.

### Clarity Data Export token and visibility

The owner supplied `CLARITY_API_TOKEN` in ignored private `.env`. It was verified
with one read-only request on October 14; see PROJECT_STATE for the actual result.
It is a server-side inspection credential, independent of customer consent and
the hosted JavaScript SDK. Existing application code does not use it, and it is
not added to the production runtime allowlist or frontend. Adding it requires no
application/Nginx restart and does not accelerate Clarity processing.

The [documented Data Export API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api)
returns processed dashboard metrics from
`GET https://www.clarity.ms/export-data/api/v1/project-live-insights`, authenticated
with a Bearer token loaded privately in process memory. Its windows are the last
24, 48 or 72 hours (`numOfDays=1`, `2` or `3`), with up to three supported breakdowns
such as URL, Browser and Device. Limit requests to ten per project per day; results
are capped at 1,000 rows without pagination. Avoid repeated diagnostic polling.
The documented interface has no raw SDK-call log, custom-tag lookup or recording
download. URL traffic alone cannot confirm a particular banner's tag or click.

Microsoft documents [30 minutes to two hours for new custom tags](https://learn.microsoft.com/en-us/clarity/filters/custom-tags#add-custom-tags-to-your-project).
Count from an actual consented customer's invocation, not deployment or SDK-stub
verification. Local/Phoenix evidence confirms application invocation only; the
export response does not establish when a custom-tag value becomes filterable.

Installed service and storage:

| Item | Location |
| --- | --- |
| Service | `softek-phoenix.service`, dedicated nonlogin `softek-phoenix` identity |
| Pinned runtime | Python 3.12.12, Phoenix 20.21.3, `/opt/softek-phoenix/` |
| Phoenix-only SQLite and persistence | `/var/lib/softek-phoenix/`, mode 0700 |
| Install/launch definitions | `scripts/install-phoenix.py`, `deploy/phoenix-http.py`, `deploy/systemd.softek-phoenix.service` |
| Python dependency pins | `deploy/phoenix-requirements.lock` |
| Private API environment | `/etc/softek/runtime.env`, installed by the existing deployment script |

Phoenix has external-resource access, telemetry, MCP, model providers and sandbox
providers disabled. Its service limits are 1 GiB memory and 50% CPU, with
loopback-only networking and writes limited to its own persistent directory.
The HTTP-only launcher is guarded to the pinned Phoenix version; reverify it
before upgrading. Softek's own persistence remains MariaDB.

Reproducible bootstrap on this host, from the repository root:

```bash
python3 -m venv artifacts/phoenix-bootstrap
artifacts/phoenix-bootstrap/bin/pip install uv==0.9.3
UV_PYTHON_INSTALL_DIR=/home/ubuntu/softek/artifacts/python artifacts/phoenix-bootstrap/bin/uv python install 3.12.12
python3 scripts/install-phoenix.py
sudo systemctl is-active softek-phoenix
curl --fail http://127.0.0.1:6006/
```

The installer changes only Softek's Phoenix runtime/service/storage. It needs the
existing sudo access, installs the committed pins and leaves other Python/services
alone. A running service must be restarted explicitly after changing its launcher
or pins. Never recreate its SQLite store to fix a startup problem.

Development defaults in `.env.example` leave both tracing gates false. The existing
`--clarity` evaluation build includes the frontend tracing capability; the private
runtime additionally needs `PHOENIX_TRACING_ENABLED=true`, matching
`VITE_PHOENIX_TRACING_ENABLED=true`, and the fixed loopback collector URL. These
readiness gates do not turn on the database switch. Verified production deployment:

```bash
CLARITY_CONFIG_VERIFIED=true npm run build -- --clarity
PHOENIX_TRACING_ENABLED=true CLARITY_CONFIG_VERIFIED=true npm run deploy -- --clarity
```

These commands require the existing private project/credential configuration and
applied migrations; they preserve the database collection/tracing switch values.
Current schema is 12. Migration 0012 was committed as **9a167b6** before application.
Private pre-upgrade schema/data/ledger backup, mode 0600:
`/var/backups/softek/demo-before-0012-20261014T153200Z.sql`.

To recover from an application issue, switch tracing Off and restore a compatible
application release, leaving the additive tables intact. Stop only
`softek-phoenix.service` if the collector itself needs recovery. This does not stop
existing Clarity collection. Use the migration contract for partial-DDL recovery;
never force a ledger entry or edit applied SQL.

## Expo iOS app — Plan 023

The Expo shell lives in `apps/mobile` and opens the existing HTTPS website. Its
native JavaScript is bundled in a signed preview; banking pages require network
access. The browser site and server sessions remain authoritative. Safari and
app cookies are separate. This phase adds no native recording SDK or recording
permissions. [Plan 023](plans/023-expo-ios-webview-poc.md) owns acceptance;
[PROJECT_STATE](PROJECT_STATE.md#current-reality) owns current signing/build status.

Use the existing Node 22.21.1 runtime. Install from the repository root with
`npm ci`; dependencies remain in the single root lockfile. The current Expo SDK
is 58, so an Expo Go preview requires an SDK-58-compatible Expo Go installation.
A signed preview does not require Expo Go. Mobile commands below are executable;
they do not imply signing/device acceptance has been completed.

```bash
cd /home/ubuntu/softek/apps/mobile
npm run typecheck
npm test
EXPO_NO_DOTENV=1 npm run doctor
EXPO_NO_DOTENV=1 npm run export:ios
```

For an optional live Expo Go preview from this remote EC2 server:

```bash
cd /home/ubuntu/softek/apps/mobile
EXPO_NO_DOTENV=1 npm run start:tunnel
```

This uses dedicated Metro port **8083**. Check availability before starting a
second instance. The terminal prints a changing Expo tunnel URL/QR; open it with
Expo Go on the phone. If opening the browser launch page, append `?platform=ios`
to `/_expo/loading` (the bare page returned a missing-platform error in this
setup). The tunnel `/status` endpoint should report `packager-status:running`.
Stop this development preview with Ctrl+C in its own terminal. It is not a
production service and does not survive host restarts. Do not stop the AWS
project's Metro/build processes. `start:dev-client` is available for a separately
built development client; it is not needed by the signed preview app.

An agent-started detached preview records its process-group leader in ignored
`artifacts/mobile-preview.pid` and writes `artifacts/mobile-metro.log`. For that
case, verify the recorded process is still running from this project's
`apps/mobile` directory before terminating its process group. PROJECT_STATE
records the currently observed PID and ephemeral URL; do not assume an old PID
still belongs to the preview.

### EAS identity and source upload

The app uses the separate Expo project `@mbcollins2/softek-ios-poc` and Apple
bundle ID `com.bawebtech.softek.poc`. `app.json` records the nonsecret project/team
identifiers. The `preview` profile is Release/internal with a bundled JS app and
`developmentClient: false`; `development` is an independent internal dev-client
profile for future SDK work. No TestFlight or App Store submission is configured.

`npm run eas -- ...` runs pinned EAS CLI 25.2.0, following the existing server
workflow. The wrapper uses ignored `artifacts/npm-cache` because the shared npx
cache failed during setup. It disables dotenv loading and uses EAS no-VCS mode
with the Softek repository root, so the upload omits Git history. Project identity
comes from `app.json`, not an upload of Git metadata. Authentication uses the
owner's existing Expo/Apple sessions; no credentials are copied into the app.

```bash
cd /home/ubuntu/softek/apps/mobile
npm run eas -- whoami
npm run archive:check
```

`archive:check` runs the actual EAS archive stage and checks every file against
an allowlist. It leaves an inspectable copy under ignored
`artifacts/mobile-archive-*/source`. The upload contains the mobile source,
artwork, root package/lockfile and web/API package manifests for npm workspace
resolution; it excludes web/API implementation, database/deployment files,
`.env`, signing files, `temp/`, artifacts and Git history. Run the archive check
again after changing build inputs, before a cloud build. The root website build
continues to build only web/API workspaces; it never invokes EAS.

### Apple signing and first installed preview

The owner completed Apple sign-in/2FA and configured a distinct Softek ad hoc
provisioning profile on November 4. It uses the existing team distribution
certificate and includes the owner's registered iPhone. Future signing maintenance
can use the following menu; keep passwords/codes in the terminal and out of chat
and committed files:

```bash
cd /home/ubuntu/softek/apps/mobile
npm run eas -- credentials --platform ios
```

Select `preview` and configure Build Credentials for this app under the selected
Apple team. Reuse a compatible distribution certificate if offered; do not revoke
or replace credentials belonging to the AWS app. EAS found one registered iPhone;
include the owner's intended phone in this app's ad hoc provisioning profile.
If enrollment is needed, `npm run eas -- device:create` provides the device flow.
Device UDIDs and raw device-list output belong only in ignored/private evidence.

Once signing is ready, check the upload and request the preview:

```bash
cd /home/ubuntu/softek/apps/mobile
npm run archive:check
npm run eas -- build --platform ios --profile preview --non-interactive --no-wait
```

The non-interactive build invocation now succeeds in submitting the preview;
PROJECT_STATE records its actual build status and installation evidence.
Use the returned ID to inspect progress:

```bash
npm run eas -- build:view a67d553b-02fd-4e28-ba45-9159d8a4ba11
```

Exiting the credential menu with Ctrl+C after successful setup produces npm
exit code 130; saved remote credentials remain available. Record the actual
build result before calling it delivered.
Install a successful internal build from its EAS link on the provisioned iPhone,
then perform the plan's device matrix with Metro stopped. Initial build 1 retained
valid cookies across relaunch. The owner-requested update 0.1.1 (2) uses temporary
web storage and must require sign-in after a fresh app launch; follow IOS-10 for
its actual device checks. Explicit sign-out must remain effective. An expired session should return to website login without a
loop. Do not substitute Expo Go/export results for signed-device acceptance.

The account currently reports pay-as-you-go build usage; inspect current EAS
billing for actual rates/limits rather than assuming included credits remain.
The website release, MariaDB schema and server collection/tracing switches were
not changed by this mobile work. Decline the existing website analytics consent
for routine phone testing; do not enable collection as part of app setup.

### Local-only capture diagnostic build

Plan 024's first phone check captured zero frames. Use the dedicated Release/
internal profile for the corrected local check:

```bash
cd /home/ubuntu/softek/apps/mobile
EXPO_PUBLIC_CAPTURE_CHECK=1 npm run export:ios
npm run archive:check
npm run eas -- build --platform ios --profile capture-check --non-interactive --no-wait
```

This profile bundles `EXPO_PUBLIC_CAPTURE_CHECK=1`. It opens **Local capture
check** directly and never mounts the banking shell/uploader. Tap **Start check**,
scroll/open the fictional menu/show the sample error, then **Review latest
screenshots**. It keeps at most eight local frames; no login, network, Photos
permission or EC2 security-group change is required. Report the full safe
stage/reason if capture fails; review also shows decoded image pixel dimensions.
The photographed size-check failure was traced to an unawaited async file copy;
build 8 waits for copy completion and reports missing/empty/invalid/oversized
metadata separately. This correction still requires actual phone image review.
Normal `preview` explicitly sets the flag to `0` and opens the banking shell. Give a later
integrated build a fresh iOS build number; do not distribute the superseded
pre-fix integrated build. PROJECT_STATE owns exact artifact/device results.

### Focus-outline CSS-only release and rollback — B-026

The focused November 4 release changes only main's focus-outline offset in the
served CSS, plus the HTML stylesheet reference. First focus-outline frontend
(retained, superseded by the input-zoom release below):
`/var/www/softek/releases/2026-11-04T18-56-14Z-focus-outline`.
It was cloned from the retained prior frontend, and the compiled CSS was checked
byte-for-byte to differ only by `#main:focus-visible{outline-offset:-7px}`.
Existing JavaScript, collection-profile marker, API process/release, runtime
settings and Nginx were retained. A normal full `deploy` was not used because
this correction requires no API restart or collection-profile change.

The installed native app loads the live website; use its Reload action to pick
up this stylesheet. No new IPA is required. The new stylesheet is
`/assets/index-C0yCtRro.css`; the previous CSS remains available to documents
loaded before the update. PROJECT_STATE records check evidence and pending
actual-phone acceptance. The build directory is a normal collection-off build;
do not infer its JavaScript/profile was deployed in this CSS-only operation.

The previous frontend and root-only operation manifest are retained at:

- `/var/www/softek/releases/2026-10-14T22-49-13-460Z`
- `/var/backups/softek/focus-outline-2026-11-04T18-56-14Z/state.json`

If reverting this CSS release is necessary, atomically restore only the public
frontend symlink using the retained path. The following is a recovery procedure,
not an operation performed during acceptance:

```bash
sudo python3 - <<'PY'
import os
from pathlib import Path
previous = Path('/var/www/softek/releases/2026-10-14T22-49-13-460Z')
link = Path('/var/www/softek/current')
assert (previous / 'index.html').is_file()
temporary = link.with_name('current.focus-rollback')
assert not temporary.exists() and not temporary.is_symlink()
os.symlink(previous, temporary)
os.replace(temporary, link)
PY
curl --fail https://demo.bawebtech.com/api/health
```

No service restart, API symlink change, Nginx edit or database reset is part of
that rollback. Use the existing full deployment runbook for future application
releases; preserve the owner-authorized collection profile explicitly.

### Input-zoom CSS follow-up — B-026

The outline-only release did not resolve the phone symptom. The owner confirmed
that pinching out restored the signed-in page's fit. The follow-up changes shared
input/select text from 15px to 16px to avoid small-input iPhone focus zoom; card
widths/margins and native settings remain unchanged. User pinch zoom is retained.

Current frontend: `/var/www/softek/releases/2026-11-04T19-17-29Z-input-zoom`,
stylesheet `/assets/index-DblOOSg2.css`. The copied frontend was verified to differ
only in that compiled CSS rule and its HTML stylesheet URL; JavaScript, collection
marker, API process/runtime and Nginx were retained. Manifest:
`/var/backups/softek/input-zoom-2026-11-04T19-17-29Z/state.json`.

To roll back only this follow-up, use the atomic frontend-symlink recovery
procedure above with `previous` set to
`/var/www/softek/releases/2026-11-04T18-56-14Z-focus-outline`.
That procedure was not executed during verification.

Phone acceptance: tap Reload for the new CSS, pinch out once to clear existing
zoom, then sign out and sign in again without pinching afterward. Check Summary
and an account detail page. Existing zoom can outlive a stylesheet reload;
preventing new input zoom is distinct from resetting an already enlarged view.
PROJECT_STATE records the owner's result. This follow-up requires no new IPA.

### Temporary iOS sessions — B-027

Native update **0.1.1 (2)** uses an in-memory WebKit website data store and disables
shared native-cookie import. It must be installed as an EAS app update; a website
Reload cannot change the installed wrapper's session policy. Keep the same bundle
ID so the update installs over Softek POC. PROJECT_STATE owns the current build ID,
installation link and actual phone acceptance. Prior build 0.1.0 (1) is retained
for history; its login-persistence result is not the updated acceptance criterion.

Within the same WebView, normal navigation/Reload and brief backgrounding retain
valid login. A fresh process after force-close requires sign-in. Recovery that
recreates a WebView also starts a fresh session. Build 9 did this for ordinary
connection errors; the offline check exposed that login loss. Build 10 retains
the same view for connection/HTTP/timeout recovery and uses an explicit fresh GET
when Try again is tapped. Only actual content-process termination uses
replacement-on-retry. Owner signed-phone recovery acceptance and a new upload
are confirmed; PROJECT_STATE owns the evidence. Browser-local
storage on a new WebView, including web-only
consent/preferences, starts fresh too. Saved banking state remains in MariaDB.
The server still expires its session records normally; no app-kill callback or
server revocation is claimed. The update does not read the old persistent cookie
jar or clear Safari's website session.

After installing build 2, verify first launch/login, ordinary Reload, a short app
switch, force-close/reopen to login, and re-login to the same saved banking data.
Check explicit sign-out and the retained normal-zoom layout. No dev server or
Expo Go should be running for signed-preview acceptance.

## Screenshot receiver preflight — Plan 024

The receiver is deployed after successful local phone capture. [Plan 024](plans/024-ios-screenshot-recording-poc.md#server-readiness-and-setup)
owns the measured preflight snapshot, provisioning checklist and acceptance.
These existing read-only commands can refresh readiness without enabling capture:

```bash
cd /home/ubuntu/softek
df -h /var/lib /var/www /opt
df -i /var/lib
free -m
timedatectl show -p NTPSynchronized -p TimeUSec
systemctl is-active softek-api softek-phoenix nginx mariadb
systemctl show softek-api -p User -p Group -p ReadWritePaths -p ProtectSystem -p ProtectHome -p PrivateTmp
sudo -n nginx -t
curl --fail --silent --show-error https://demo.bawebtech.com/api/health
npm run db:status
npm run db:status -- --test
```

Production has migration 0013, private recording storage and the checked-in
API/systemd/Nginx deployment; exact releases/evidence remain in PROJECT_STATE.
The screenshot feature uses `/var/lib/softek/recordings` only (other production
paths are refused), 0750 directories/0640 images owned by `softek:softek`.
The checked-in deploy provisions it and extends only this project's service write
allowlist. Only `/api/recordings/UUID/frames` receives the 2 MiB proxy exception;
normal requests retain 32 KB and API images are limited to 1 MiB. Do not use
public banner storage or expose screenshots through Nginx static-file aliases.
HTTPS 443 is the existing public entry point; no EC2 security-group change or
new public port is needed. API traffic remains on loopback 3100.

The runtime allowlist adds `RECORDING_DIR` and `SCREENSHOT_RECORDING_ENABLED`.
The recording gate defaults to false. The authorized live deployment sets
`SCREENSHOT_RECORDING_ENABLED=true` in its private runtime environment. This
permits approved recording sessions; capture still needs the user's Record tap.
It neither changes Clarity settings nor grants website analytics consent.
Preserve the live collection profile and database switch revisions when deploying.
The current live profile has collection and tracing gates enabled, while routine
workspace defaults stay off. To rebuild/deploy this same approved profile:

```bash
npm run build -- --clarity
SCREENSHOT_RECORDING_ENABLED=true PHOENIX_TRACING_ENABLED=true npm run deploy -- --clarity
```

Revalidate runtime/profile settings before reusing these commands; they preserve
the currently approved gates, not authorization to change collection settings.

These commands now exist. Cleanup defaults to read-only dry-run and requires
the selected schema to have migration 0013:

```bash
cd /home/ubuntu/softek
npm run recordings:cleanup -- --test
npm run recordings:cleanup -- --test --apply
```

After the production gate/setup and backup, `npm run recordings:cleanup` inspects
`demo`; adding `--apply` applies retention/reconciliation only to Softek recording
metadata/files. It cannot select an arbitrary schema or production directory.
The receiver defaults are in `apps/api/src/recordings.ts`; the plan explains the
limits and their rationale. New explicit approval replaces any unclosed recording
for that customer, allowing immediate restart after force-close without revoking
the banking login session. Two customers may record concurrently. Creation is
limited to ten new sessions/customer/minute; uploads to 180 requests/session/minute
including retries, within the existing overall API rate limit.

The deployment installs `softek-recording-cleanup.service` and its one-minute
timer. Its installed WorkingDirectory/ExecStart are pinned to that deployment's
retained API release, allowing cleanup to keep working if `/opt/softek/current`
is rolled back. Do not prune that pinned release while the timer references it.
The job marks stale sessions interrupted, enforces seven-day retention and
reconciles known orphan/temp/missing files under the same DB advisory lock as
uploads/deletion. Its private `.maintenance.json` aggregate result appears in
the authenticated recordings API. Inspect with:

```bash
systemctl status softek-recording-cleanup.timer --no-pager
sudo -n journalctl -u softek-recording-cleanup.service -n 30 --no-pager
```

`npm run recordings:smoke` is an explicit production receiver check for this host,
after rollout and with private `.env`/sudo prerequisites. It creates only an owned
Automation customer, uploads a generated JPEG exceeding 32 KB (no real screenshot),
verifies proxy/API limits, admin-only image delivery, integrity, independent UTC
timestamps and actual runtime file ownership/permissions, then deletes its
recording/customer and ends its own admin session. It contacts only the fixed
Softek HTTPS origin, rejects redirects and never prints credentials. Its private
report is `artifacts/recording-public-smoke.json`; inspect cleanup flags and owned
IDs if it fails. Its first actual HTTPS run passed; PROJECT_STATE owns results.
Do not run it before the receiver gate, or treat it as native
image/phone-network acceptance.

### Screenshot rollback and recovery

Before first rollout, back up retained `demo` data/schema/ledger and this site's
Nginx configuration, API unit, runtime environment and current web/API link targets
under root-only `/var/backups/softek/`. Record the exact manifest in PROJECT_STATE.
Apply only the committed migration with the runner after test validation; partial
DDL recovery follows the migration contract. Schema 0013 is additive and can
remain when returning to earlier application code. No drop/reset is a rollback.

To stop new capture ingestion, set the private recording gate false and restart
only Softek's API (or deploy the disabled gate with the preserved collection
profile). Existing native clients stop through bounded upload-failure/queue rules;
do not assume an immediate remote app-termination callback. Restore compatible
API/web links and the backed-up site/API unit/runtime environment, validate Nginx,
then restart only Softek's API/reload Nginx. Keep the pinned recording-cleanup
timer/service and private directory so retained bytes still expire and orphaned
customer files are reconciled. If cleanup itself fails, stop only its timer/job,
inspect the scoped failure and dry-run a repaired worker before resuming it.

Uploads interrupted before DB commit may leave an unacknowledged file; cleanup
removes it, or an identical retry safely republishes it. Deletion commits a
tombstone before unlinking, so cleanup can retry after a crash. Missing acknowledged
files become explicit interrupted/gap metadata, with corrected counts. Inspect
dry-run output before manual recovery. Never move screenshots into public assets.
POC schema/data backups alone do not back up image bytes; private images are
preserved across releases but are not promised recoverable after disk loss.
