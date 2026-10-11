# Project state

Last updated: **2026-10-11 (America/Los_Angeles)**.
Current focus: **[002 — Clarity validation](plans/002-clarity-validation.md)** (next phase).
Latest completed implementation: **Plan 005 — feature campaign landing pages, verified and deployed**.
Current request: **Approved Plan 005 implementation/deployment is complete; collection remains off**.
Next task: **M2-01: prepare deliberate evaluation configuration/CSP and review collection boundaries before an authorized capture pilot**.

## Plan status registry

This is the canonical lifecycle registry. The [roadmap](IMPLEMENTATION_PLAN.md)
owns sequence/dependencies; individual plans own detailed tasks and acceptance.
Active identifies focus and does not itself authorize additional scope.

| ID | Plan | Status | Progress / dependency |
| --- | --- | --- | --- |
| 000 | [Foundation and first demo](plans/000-foundation-and-first-demo.md) | Completed | M0/M1 verified/deployed; historical checklists retained |
| 001 | [Login, layout, and rotating banners](plans/001-login-layout-and-banners.md) | Completed | M1-R01–08 verified/deployed; real Clarity acceptance stays in 002 |
| 002 | [Clarity validation](plans/002-clarity-validation.md) | Active | Next phase after 005; owner-reported settings/hosting retained, capture/access unverified; collection off |
| 003 | [Automation journeys](plans/003-automation-journeys.md) | Deferred | Typed feature/banking scenario contract exists; no runner/scheduler/UI |
| 004 | [Admin and Customer menus](plans/004-admin-and-customer-menus.md) | Completed | MENU-01–07 verified/deployed with independent sessions and protected child routes |
| 005 | [Feature campaign landing pages](plans/005-feature-campaign-landing-pages.md) | Completed | FEAT-01–08 implemented, migration 0004 applied, API/browser/public acceptance verified and deployed |

## Current reality

- Live: **https://demo.bawebtech.com**. Branded username/password login; no signup.
  Admin signs in independently at `/controls` using the private `DEMO_ADMIN_SECRET`.
  Email-style usernames within the 3–40-character limit are supported.
- Customer sessions last 24 hours. Sign-out/expiry preserve banking state; password
  replacement/disable revoke that user's sessions. Reset retires the run and retains
  history, stable user UUID and rotation cursor. Admin and customer sign-outs are
  independent. Existing Alex/Jamie template choices remain unchanged.
- Account Summary retains accounts/activity/goals and its padded rotating banner.
  Login and full Summary refresh advance once; menu returns/data reads/feature CTAs
  do not. Independent tabs retain their exact selection. Savings Goals enrollment,
  goals and contributions remain functional; other banking sections use demo actions.
- Customer Menu → **Explore Features** contains all twelve supplied campaigns at
  authenticated `/features/:featureId` routes. One shared Harbor landing component
  renders supplied copy, benefits, disclosures and one primary CTA. CTA acknowledgement
  shows an inline demo confirmation, without changing banking/enrollment. No banners
  or financial input forms appear on feature pages. All customers may explore them.
- All twelve internal destinations are selectable in Manage Banners. No new artwork
  or enabled promotional set was created. Uploaded JPEG/PNG/WebP is re-encoded to
  immutable WebP; production assets remain outside releases in
  `/var/lib/softek/banner-assets`. Replacements retain prior URLs/history.
- Feature observations are `feature_viewed` / `feature_cta_clicked`, separate from
  Savings Goals adoption. The API validates owned run/visit, feature/action/time,
  CSRF and optional immutable banner entry; retries deduplicate per page/feature.
  Banner history state belongs to the exact landing entry; menu/direct entries do
  not inherit another tab's or the user's last banner attribution.
- Admin Menu retains Manage Customers, Manage Banners and Adoption Report at
  `/controls/*`. Feature Activity within the report shows raw views/clicks, distinct
  customers/runs and banner-attributed counts under actor/variant/UTC filters.
  Savings Goals funnel queries/denominators are unchanged. Selected-customer activity
  names feature observations. Admin descendants remain masked and analytics-excluded.
- MariaDB is authoritative. Business writes use user/run locks and READ COMMITTED;
  savings reports use consistent snapshots; feature aggregates use one SQL statement.
  Runtime has scoped CRUD; migrator has scoped DDL. Private `.env` remains ignored
  and 0600. Runtime environment is an allowlist, root:softek 0640, with no DB admin,
  migration or test credentials.
- Migrations **0001–0004** are applied to **demo and demo_test**, version 4 with no
  pending files/checksum drift; repeat application is a no-op. 0004 was committed in
  **d0ec4c6** before application and only appends two interaction ENUM names.
  Next schema change uses **0005**; applied migrations are immutable.
- Scoped schema/data/ledger backup before 0004 (root-only, 0600):
  `/var/backups/softek/demo-before-0004-20261011T212954Z.sql`.
  Earlier pre-0002 backup remains. All ten original production run IDs and retained
  banking/history counts survived; historical anonymous ownership remains NULL.
- Current release: **2026-10-11T21-30-01-050Z**. Previous authenticated release:
  **2026-10-11T19-49-23-608Z**. Both current links point to the new release.
  Production API is enabled/active as nonlogin `softek` on loopback **3100**.
  No development/test listener remains. API health is 200 with DB connected.
- Prior authenticated API was explicitly tested against schema 4 containing both
  feature ENUM values: owned state, original interactions, report, users and retained
  activity work. That rollback loses feature routes/reporting but preserves schema
  and history; never downgrade the ENUM. Actual rollback was not performed.
  Pre-auth anonymous releases remain incompatible public rollback targets.
- Dedicated Nginx/HTTPS/upload configuration and persistent assets are intact.
  All unrelated Nginx configuration hashes and enabled symlink targets match the
  original manifest. The service cannot edit code; only banner storage is writable.

## Plan 005 result and verification

All FEAT-01–08 are complete. The untouched original report remains untracked in
`temp/`; its identical durable reference is in `plans/references/`. This is supplied
fictional/demo marketing copy, not independent Access Digital product verification.
Architecture, product, setup, testing and roadmap reflect the implemented phase.

| Check actually run | Result |
| --- | --- |
| `npm test` | **40 TAP entries passed**: 34 nested scenarios, four parents, two standalone migration/context checks |
| Browser suite | **39 Chromium journeys covered** at 360/390/1440px: 36 passed initially; three banner journeys passed on focused rerun after correcting a destination-picker test selector |
| Feature browser evidence | All twelve pages/CTAs; lost-response retry and rapid activation; banking/adoption unchanged; banner/direct/menu/tab/reload attribution; auth/unknown routes; short viewport/keyboard; separate reporting |
| Typecheck/build/format | Passed; frontend ~578 kB / 170 kB gzip size advisory remains B-011 |
| Migration status/repeat | Both ledgers version 4, no pending/drift, repeated migration no-op; old ENUM rows/ordinals verified on owned probe |
| Prior API compatibility | Previous authenticated release works on dedicated schema 4 with stored feature values; owned fixtures cleaned |
| `npm run deploy` | Release **2026-10-11T21-30-01-050Z** deployed successfully |
| `npm run smoke:public` | HTTPS 360/1440px banking/login/rotation, feature submenu/CTA/child reload, exactly two owned feature views/one CTA, saved accounts/goals/run, separate report, independent sign-out and reset; no browser errors/Clarity requests |
| Retained production data/assets | All ten original runs retained, original table counts not reduced; earlier uploaded image has identical public hash |
| Host/privacy | Nginx syntax passed, service active/loopback, health 200, runtime allowlist/permissions and three collection flags off; unrelated site hashes/links unchanged |
| Visual review | Representative mobile/desktop submenu, landing/confirmation and report reviewed; source and live screenshots in ignored artifacts |
| Credentials | Secret scan passed across 84 candidate source/document/build files |

No unresolved application failure remains. The browser selector correction changed
only the test; visual review separated the banner count notes from report totals.
Real devices and real Clarity playback are not established by these checks.
Public smoke's owned automation users/history are intentionally retained.

## Clarity configuration and remaining acceptance

Intended project: **`yvs5hp3ivb`**, owner confirmed. Owner reported on 2026-10-11 UTC:
**Balanced masking, cookies on, bot detection on, cookie consent required**.
These are owner-reported settings, not dashboard inspection. Chris's project access
remains unverified; do not send invitations without an instruction.

**Collection remains disabled; recordings and heatmaps remain unverified.** Normal
deployment forces all collection gates off and same-origin CSP. The adapter now
prepares accurate bounded feature/service/campaign/banner context and clears stale
tags; its local stub passes. Actual opt-in/withdrawal, masking, account switching,
creative rendering/filtering and synthetic capture still need Plan 002 playback.
The optional public `?banner=` heatmap parameter remains deferred pending evaluation.

## Exact resume point

1. Read AGENTS/START_HERE, this state, PRODUCT and Plan 002. Inspect Git/current
   release before assuming documented environment facts still hold.
2. Plan 005 is complete. For the next authorized phase, begin M2-01: review official
   SDK/CSP/consent guidance, final DOM masks and existing deploy defaults; prepare an
   explicit evaluation mode that leaves normal deployments/tests collection-off.
   Actual collection enablement/pilot is separate from the completed feature request.
3. Verify Chris access and actual recordings/heatmaps with the owner; no Microsoft
   password or manual-install snippet is needed. Use dedicated labeled pilot users.
4. Implement only the small Plan 002 pilot first. Bot detection is on; browser
   success is not proof Clarity records automation. Broad scheduling remains Plan 003.

## Git and operational handoff

Prior menu commit **162be9d**; committed 0004 migration **d0ec4c6**. Plan 005 code,
checks, plan/reference and durable documentation are committed locally on `main`;
inspect `git log -1` for the implementation hash. **No push** was made. Origin is
`https://github.com/cnm4us/softek.git`. Only user-provided `temp/` remains untracked
and untouched. Ignored artifacts hold screenshots/manifests and owned checks.
No credentials are committed; production intentionally continues running.
LOCAL_SETUP owns backup/rollback/renewal, TESTING owns commands and cleanup boundaries.
