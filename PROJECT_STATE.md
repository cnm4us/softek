# Project state

Last updated: **2026-10-11 (America/Los_Angeles)**.
Current focus: **[002 — Clarity validation](plans/002-clarity-validation.md)** (next phase; collection remains off).
Latest completed work: **Plan 004 — separate Admin and Customer menus, verified and deployed**.
Current request: **Implement the approved menu revision — complete**.
Next task: **M2-01: prepare explicit evaluation deployment/CSP configuration and review consent/masking; real capture acceptance remains outstanding**.

## Plan status registry

This is the canonical lifecycle registry. The [roadmap](IMPLEMENTATION_PLAN.md)
owns sequence/dependencies; individual plans own detailed tasks and acceptance.
Active identifies the current focus and does not itself authorize new scope.

| ID | Plan | Status | Progress / dependency |
| --- | --- | --- | --- |
| 000 | [Foundation and first demo](plans/000-foundation-and-first-demo.md) | Completed | M0/M1 verified and deployed; historical checklists retained |
| 001 | [Login, layout, and rotating banners](plans/001-login-layout-and-banners.md) | Completed | M1-R01–08 application acceptance verified/deployed with collection off; Clarity acceptance stays in 002 |
| 002 | [Clarity validation](plans/002-clarity-validation.md) | Active | Next phase after completed 004; settings/hosting evidence retained; evaluation configuration and actual capture/access remain outstanding |
| 003 | [Automation journeys](plans/003-automation-journeys.md) | Deferred | Typed small scenario contract exists; pilot runner stays in 002; scheduler/UI awaits prioritization |
| 004 | [Admin and Customer menus](plans/004-admin-and-customer-menus.md) | Completed | MENU-01–07 verified and deployed; focused admin pages, independent sessions, 30 browser journeys and HTTPS smoke passed |

## Current reality

- Live: **https://demo.bawebtech.com**. Branded username/password login; no signup.
  Admin enters independently at `/controls`, then uses Manage Customers at
  `/controls/customers`, with the existing private
  `DEMO_ADMIN_SECRET`. No shared public customer password was seeded. Usernames
  accept email-style @ and + aliases within the existing 3–40-character limit;
  creation errors identify the invalid field without echoing entered values.
- Customer sessions use hashed opaque tokens with 24-hour expiry. Logout, expiry,
  and admin password replacement preserve the same banking run. Disable/password
  replacement revoke all user sessions. Explicit reset retires the run, retains
  report history, and keeps the stable user UUID and rotation cursor.
- Account Summary has the shared section-title header, upper-right keyboard menu,
  padded linked image, checking/savings/credit, activity, and goals. Transfers,
  Bill Pay, Cards, Statements and Support have themed simulated actions; existing
  savings details/enrollment/goals/contributions remain functional.
- **Admin Menu** has Manage Customers, Manage Banners, Adoption Report, and
  independent admin sign-out. **Customer Menu** has banking destinations and
  customer sign-out, with About/reset as secondary utilities. Both use the shared
  Harbor shell, upper-right hamburger, keyboard focus containment, and active links.
- Protected `/controls/*` pages separate customer list/search, creation, selected
  details/actions, banners, and reporting. Tools work without banking login or
  banking bootstrap. Report filters persist across admin menu navigation. Admin
  expiry clears private tool state; signing out of either area preserves the other
  session. The login footer links to admin; admin footer links to customer entry.
- Selected actions retain password replacement, enable/disable, reset/reconfigure,
  Clarity ID copy, and bounded activity. Banners retain upload/settings/replacement
  and immutable images. Reports keep existing distinct-run definitions. All admin
  descendants are masked and suppress customer analytics/consent/bootstrap.
- Banners use internal destination keys. Three starter creatives cycle in order
  on login and full Summary refresh; menu returns/data fetches preserve selection.
  Retry-safe transactions prevent double advance; tabs retain their selection.
  Zero-enabled and failed-image states leave banking access usable.
- Uploads accept bounded actual JPEG/PNG/WebP content and publish generated WebP
  URLs. Replacements retain old URLs/history. Production images live in
  `/var/lib/softek/banner-assets`, outside releases. A disabled 'Deployment
  persistence check' creative is retained as storage evidence.
- Business writes use READ COMMITTED and user/run locks; report snapshots use
  REPEATABLE READ. Receipt idempotency and transactional money/history/events
  remain intact. Placeholder observations cannot become confirmed adoption.
- Stable user UUID is the gated Clarity Identify value; run, visit, route and
  creative context remain separate. The optional `?banner=` heatmap URL has not
  been adopted and awaits real filter/screenshot evaluation in Plan 002.
- Migrations **0001–0003** are applied to **demo and demo_test**: version 3, no
  pending files or checksum drift. 0002/0003 were committed in `e239925` before
  test application. Applied migrations are immutable; next change is 0004.
- Pre-upgrade production backup (schema/data/ledger, 0600):
  `/var/backups/softek/demo-before-0002-20261011T165522Z.sql`.
  All ten original production run IDs and retained banking/history rows survived.
  Historical anonymous ownership remains NULL; legacy public entry returns 410.
- Runtime has scoped CRUD only; migrator has scoped DDL. Private `.env` remains
  ignored and 0600. `/etc/softek/runtime.env` is a runtime-only allowlist,
  root:softek 0640; no admin/migration/test DB credentials are deployed.
- Latest authenticated release: **2026-10-11T19-49-23-608Z**. Previous compatible
  authenticated release: **2026-10-11T18-56-25-765Z**. Active links are
  `/opt/softek/current` and `/var/www/softek/current`. Production API is enabled
  and active as nonlogin `softek` on loopback **3100**; development/test uses 3101.
- Hardened service cannot edit code; only persistent banner storage is writable.
  Dedicated Nginx config adds public media and a 6 MiB exact upload endpoint;
  other request limits, HTTPS/ACME and certificate configuration remain intact.
  All preexisting unrelated site hashes/symlink targets match the saved manifest.
- Pre-auth anonymous releases are not compatible public authentication rollback
  targets. Use an authenticated release or the scoped maintenance placeholder;
  preserve schema/history/images. Actual rollback/schema downgrade was not run.

## Plan 004 result

MENU-01–07 are complete. The selected route structure from Plan 004 is deployed:
`/controls`, `/controls/customers`, `/controls/customers/new`,
`/controls/customers/:userId`, `/controls/banners`, `/controls/report`.
No API/schema change was required. The old `/controls` bookmark remains valid.
The shared shell and independent session roots replace the previous combined
controls page/customer menu. Existing Alex/Jamie choices remain unchanged; the
earlier template simplification recommendation was not approved.

The full browser suite verifies selected customer email creation/search/password/
access/reset/activity, banner upload/settings/replacement, report filters,
independent cookies/sign-outs, expired child-route access, direct/reload/back/forward,
missing pages/customer, menu keyboard focus and no overflow at 360/390/1440px.
Collection-off admin navigation emits no customer state/events/Clarity requests.
Actual captured-document boundaries and masking fidelity still need Plan 002 playback.

The public HTTPS smoke passed at 360/1440px after deployment, preserving savings
state across login, checking rotation/menu/actions, separate admin pages/sign-out,
and reset. Original retained data and persistent banner storage remain intact.
All unrelated Nginx hashes/links match the original manifest. UI rollback to the
previous authenticated release restores combined controls; new child bookmarks
should return to `/controls` after that rollback. No schema downgrade is needed.

## Clarity configuration and remaining acceptance

Intended project: **`yvs5hp3ivb`**, owner confirmed. On 2026-10-11 UTC the owner
reported **Balanced masking, cookies on, bot detection on, cookie consent required**.
These are owner-reported settings, not direct dashboard inspection. Chris had not
been invited at the last access update; no later access confirmation exists.

**Collection remains disabled and real recordings/heatmaps remain unverified.**
Deployment forces backend/build gates off; CSP permits same-origin scripts and
connections only. Adapter/consent UI and explicit DOM masks are implemented but
must be verified against actual SDK behavior and playback. Existing loader and
project ID suffice; no Microsoft password or manual-install snippet is needed.

Plan 002 must implement deliberate evaluation deployment, narrow CSP allowances,
consent/masking checks, actual stable-ID lookup and shared-browser account
separation, historical artwork rendering, and creative-specific heatmap checks.
Bot detection is on: do not treat routine Playwright success as proof of synthetic
capture. Keep dedicated actors and document observed filtering in the pilot.
Full scheduling/scenario UI is deferred; the current typed contract is not a runner.

## Verification evidence

| Check actually run | Result |
| --- | --- |
| `npm run typecheck` | Frontend/API/scripts/tests passed |
| `npm run build` | Production frontend/API passed |
| `npm test` | **32 TAP entries** passed: 12 existing API, 8 migration, 9 revision scenarios, 3 parents |
| `npm run test:e2e` | **30 Chromium journeys** passed at 360/390/1440px, including both menus, selected actions, immutable replacement, history navigation, expired admin access and independent sign-outs; final runner exited 0 |
| `npm run format:check` | Passed |
| Migration status/repeat | Both ledgers version 3, no pending/drift; no migration needed or applied for 004 |
| Production data preservation | All ten original runs retained; no drop in original banking/history counts |
| `npm run deploy` | Release **2026-10-11T19-49-23-608Z** deployed successfully |
| `npm run smoke:public` | Actual HTTPS 360/1440px email creation/login, saved goals/contribution, rotation/menu/action, separate admin report/customers/banners, admin logout/reload preserving customer access, relogin/reset; no Clarity/browser errors |
| Production upload/storage | Earlier protected upload retained; same public image hash after Plan 004 deployment/restart; replacement/old URL verified in browser and API suites |
| Short mobile login | 360×500 form scrollable, no horizontal overflow |
| Public host/service | Health 200 + DB connected, service active; Nginx syntax passed; prior routing/cookie protections preserved |
| Shared-host isolation | All prior unrelated Nginx config hashes and symlink targets unchanged |
| Visual review | Mobile/desktop account, report, admin list/home/menu and live banner screens inspected; screenshots in ignored artifacts |
| Credentials | Private secret values absent from all 75 candidate source/document/build files |

No known failing application check remains. The initial noninteractive browser
runner reported all 30 journeys passed but exited during server shutdown; the
final terminal run passed all 30 with exit 0. Screenshot timing was corrected to
wait for Admin Home before capture. Vite's ~559 kB / 164 kB gzip bundle advisory
is tracked as B-011. Real devices and Clarity playback are not established by tests.

## Exact resume point

1. Read AGENTS/START_HERE, this state, PRODUCT, and Plan 002; inspect Git and
   deployed release before relying on documentation.
2. Plan 004 implementation is complete. Next is M2-01: review the final DOM masks,
   prepare a deliberate evaluation mode that defaults off, and verify the narrow
   Clarity CSP using official guidance. Preserve normal collection-off deployment
   and test behavior. Do not claim actual SDK masking/capture from routine tests.
3. Actual Clarity acceptance needs project access: owner/Chris can inspect the
   dashboard or provide observed evidence. Chris's Member invitation remains
   unverified; do not send invitations without instruction. Then verify the small
   human/automation pilot, stable-ID lookup, switching, consent, replay and heatmaps.

## Git and operational handoff

Foundation `1f759d9`; M1 `546459c`; planning/additive migrations `e239925`;
main revision `ab9f2e9`; email-username fix `d05d0ee`.
Plan 004 menu implementation, its plan, updated browser/public checks and durable
documentation are committed locally on `main`; inspect `git log -1` for the exact
commit. **No push** was made. Origin is `https://github.com/cnm4us/softek.git`.

No pending migration or development listener remains. Production intentionally
continues running. Ignored artifacts contain screenshots/check manifests; no
credentials are committed. LOCAL_SETUP.md owns admin/upload, backup, rollback and
renewal operations; TESTING.MD owns verification and fixture cleanup boundaries.
