# Project state

Last updated: **2026-10-11 UTC**.
Current focus: **[002 — Clarity validation](plans/002-clarity-validation.md)**.
Latest completed work: **M1-R08 email username support and useful user-creation validation, deployed**.
Current request: **Fix user creation rejecting an email-style username with a generic error**.
Next task: **Resume M2-01 explicit evaluation mode and consent/masking checks, then inspect actual pilot recordings with project access**.

## Plan status registry

This is the canonical lifecycle registry. The [roadmap](IMPLEMENTATION_PLAN.md)
owns sequence/dependencies; individual plans own detailed tasks and acceptance.
Active identifies the current focus and does not itself authorize new scope.

| ID | Plan | Status | Progress / dependency |
| --- | --- | --- | --- |
| 000 | [Foundation and first demo](plans/000-foundation-and-first-demo.md) | Completed | M0/M1 verified and deployed; historical checklists retained |
| 001 | [Login, layout, and rotating banners](plans/001-login-layout-and-banners.md) | Completed | M1-R01–08 application acceptance verified/deployed with collection off; Clarity acceptance stays in 002 |
| 002 | [Clarity validation](plans/002-clarity-validation.md) | Active | Owner-reported settings recorded; existing M2-02/03 hosting complete; evaluation mode, actual capture, playback and Chris access remain pending |
| 003 | [Automation journeys](plans/003-automation-journeys.md) | Deferred | Typed small scenario contract exists; pilot runner stays in 002; scheduler/UI awaits prioritization |

## Current reality

- Live: **https://demo.bawebtech.com**. Branded username/password login; no signup.
  Admin creates users independently at `/controls` using the existing private
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
- Protected controls manage users, reset/reconfigure selected users, copy Clarity
  IDs, inspect bounded interactions, and upload/configure/replace banners.
  Reports retain distinct-run denominators and human/automation separation.
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
- Latest authenticated release: **2026-10-11T18-56-25-765Z**. Previous compatible
  authenticated release: **2026-10-11T17-04-38-549Z**. Active links are
  `/opt/softek/current` and `/var/www/softek/current`. Production API is enabled
  and active as nonlogin `softek` on loopback **3100**; development/test uses 3101.
- Hardened service cannot edit code; only persistent banner storage is writable.
  Dedicated Nginx config adds public media and a 6 MiB exact upload endpoint;
  other request limits, HTTPS/ACME and certificate configuration remain intact.
  All preexisting unrelated site hashes/symlink targets match the saved manifest.
- Pre-auth anonymous releases are not compatible public authentication rollback
  targets. Use an authenticated release or the scoped maintenance placeholder;
  preserve schema/history/images. Actual rollback/schema downgrade was not run.

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
| `npm run test:e2e` | Prior full run: **24 Chromium journeys** passed at 360/390/1440px; after M1-R08, targeted admin creation/upload/email-login checks passed at all three widths |
| `npm run format:check` | Passed |
| Migration status/repeat | Both ledgers version 3, no pending/drift; production repeat no-op |
| Production data preservation | All ten original runs retained; no drop in original banking/history counts |
| `npm run deploy` | Initial authenticated deployment and repeat deployment passed |
| `npm run smoke:public` | After M1-R08, actual HTTPS mobile/desktop email-username creation/login, persistent goals/contribution, rotation, menu/action, reporting, relogin/reset, no Clarity/browser errors |
| Production upload/storage | Protected multipart upload succeeded under hardened service; same public image hash after service restart and repeat deployment |
| Short mobile login | 360×500 form scrollable, no horizontal overflow |
| Public host/service | Health 200 + DB connected, service active; Nginx syntax passed; prior routing/cookie protections preserved |
| Shared-host isolation | All prior unrelated Nginx config hashes and symlink targets unchanged |
| Visual review | Mobile/desktop account screens inspected; production/login evidence in ignored artifacts |
| Credentials | Private secret values absent from candidate source/doc files and public build |

M1-R08: the reported email-style username failed the original @-excluding
allowlist, while the password length met requirements. Added @/+ to both create
and login validation, corrected the browser pattern's literal-hyphen escaping,
added visible requirements, and mapped protected creation failures to static
field-specific messages. No schema change was needed. API regression verifies
normalization, duplicate uniqueness, login and safe errors. Browser regression
verifies native space rejection and email creation/login at all three widths.

Initial browser checks exposed test-helper naming/locator issues; corrected.
One intermediate visibility check was interrupted by editing a watched API file;
the final uninterrupted 24-check run passed. Concurrency tests exposed a stale
transaction snapshot; READ COMMITTED plus owned-row locking fixed it and retry
and concurrent-first-login regression checks pass. No known failing application
check remains. Vite's ~546 kB / 161 kB gzip bundle advisory is tracked as B-011.
Real devices and Clarity playback are not established by these tests.

## Exact resume point

1. Read AGENTS/START_HERE, this state, PRODUCT, and active Plan 002; inspect Git,
   migration status and public health before changes.
2. Continue M2-01 using the owner-reported settings above. Review DOM masks,
   consent decline/withdrawal and deployment's unconditional collection-off
   behavior. Prepare deliberate evaluation build/runtime/CSP configuration while
   keeping normal development/test/deployment off by default.
3. Actual recording acceptance needs project access: owner/Chris can inspect
   the dashboard or provide observed evidence. Chris's Member invitation is an
   owner action and remains unverified; do not send invitations without instruction.
4. Run a small labeled human/automation pilot, then verify user lookup, switching,
   masking, replay, artwork and heatmaps. Keep all unverified M2 tasks unchecked.

## Git and operational handoff

Foundation `1f759d9`; M1 `546459c`; planning/additive migrations `e239925`;
main revision `ab9f2e9`.
The application revision, tests, deployment sources and current documentation are
committed locally on `main`; inspect `git log -1` for the latest hash. **No push**
was made. Origin is `https://github.com/cnm4us/softek.git`.

No pending migration or development listener remains. Production intentionally
continues running. Ignored artifacts contain screenshots/check manifests; no
credentials are committed. LOCAL_SETUP.md owns admin/upload, backup, rollback and
renewal operations; TESTING.MD owns verification and fixture cleanup boundaries.
