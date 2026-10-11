# Project state

Last updated: **2026-10-11 UTC**.
Current focus: **[002 — Clarity validation](plans/002-clarity-validation.md)** (owner-only evaluation).
Latest completed implementation: **Plan 002 collection controls and M2-C06 initial consent modal**.
Current request: **Show initial customer analytics consent in a modal overlay; implemented and deployed**.
Next task: **M2-04: owner reviews actual human recordings, masking and heatmaps in the Clarity dashboard**.

## Plan status registry

This is the canonical lifecycle registry. The [roadmap](IMPLEMENTATION_PLAN.md)
owns sequence/dependencies; individual plans own detailed tasks and acceptance.
Active identifies focus and does not itself authorize additional scope.

| ID | Plan | Status | Progress / dependency |
| --- | --- | --- | --- |
| 000 | [Foundation and first demo](plans/000-foundation-and-first-demo.md) | Completed | M0/M1 verified/deployed; historical checklists retained |
| 001 | [Login, layout, and rotating banners](plans/001-login-layout-and-banners.md) | Completed | M1-R01–08 verified/deployed; real Clarity acceptance stays in 002 |
| 002 | [Clarity validation](plans/002-clarity-validation.md) | Active | Admin collection control and real SDK transport verified/deployed; owner dashboard playback/heatmaps pending; Chris deferred |
| 003 | [Automation journeys](plans/003-automation-journeys.md) | Deferred | Typed feature/banking scenario contract exists; no runner/scheduler/UI |
| 004 | [Admin and Customer menus](plans/004-admin-and-customer-menus.md) | Completed | MENU-01–07 verified/deployed with independent sessions and protected child routes |
| 005 | [Feature campaign landing pages](plans/005-feature-campaign-landing-pages.md) | Completed | FEAT-01–09 implemented, migration 0004 applied, API/browser/public acceptance verified and deployed |

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
  starts each card with a larger green uppercase headline, without the repeated
  Explore line or decorative star, then renders copy, benefits, disclosures and
  one primary CTA. CTA acknowledgement
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
- Admin Menu contains Manage Customers, Manage Banners, Adoption Report and Clarity Settings at
  `/controls/*`. Feature Activity within the report shows raw views/clicks, distinct
  customers/runs and banner-attributed counts under actor/variant/UTC filters.
  Savings Goals funnel queries/denominators are unchanged. Selected-customer activity
  names feature observations. Admin descendants remain masked and analytics-excluded.
- MariaDB is authoritative. Business writes use user/run locks and READ COMMITTED;
  savings reports use consistent snapshots; feature aggregates use one SQL statement.
  Runtime has scoped CRUD; migrator has scoped DDL. Private `.env` remains ignored
  and 0600. Runtime environment is an allowlist, root:softek 0640, with no DB admin,
  migration or test credentials.
- Migrations **0001–0005** applied to **demo and demo_test**, version 5 with no
  pending/checksum drift; repeat application is a no-op. 0005 creates the persistent
  singleton collection switch/epoch; committed **69fb54e** before application.
  Next migration is **0006**. Existing banking/history tables are unchanged.
- Root-only 0600 pre-0005 schema/data/ledger backup:
  `/var/backups/softek/demo-before-0005-20261011T222313Z.sql`.
  Earlier pre-0002/pre-0004 backups remain. All ten original runs and retained
  counts survived; anonymous ownership remains NULL; upload public hash unchanged.
- Current release: **2026-10-11T22-42-00-516Z**. Previous authenticated release:
  **2026-10-11T22-24-55-744Z**. Both current links point to the new release.
  Service enabled/active as nonlogin `softek` on loopback **3100**, health 200/DB
  connected. Evaluation flags On, project `yvs5hp3ivb`, database switch **On**.
  Matching build/deploy profiles and site-specific Clarity CSP are installed.
  Private development flags remain off. No development/test listeners remain.
- Earlier authenticated API **2026-10-11T19-49-23-608Z** was explicitly tested
  against schema 4 containing both
  feature ENUM values: owned state, original interactions, report, users and retained
  activity work. That rollback loses feature routes/reporting but preserves schema
  and history; never downgrade the ENUM. Actual rollback was not performed.
  This was prior schema-4 evidence, not a schema-5 rollback check. Before rolling
  back to pre-switch code, restore collection-off runtime flags/CSP; older code
  cannot honor the new switch. Prefer a current-code default-off deployment.
  Pre-auth anonymous releases remain incompatible public rollback targets.
- Dedicated Nginx/HTTPS/upload configuration and persistent assets are intact.
  All unrelated Nginx configuration hashes and enabled symlink targets match the
  original manifest. The service cannot edit code; only banner storage is writable.

## Plan 005 initial result and verification

All FEAT-01–09 are complete. The untouched original report remains untracked in
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

## FEAT-09 compact headline follow-up

User-requested shared presentation refinement: remove the star and Explore line;
move the semantic headline to the top of each card with green uppercase eyebrow
styling at 20–26px. Supplied wording, page title, CTA and tracking are retained.
No API/schema change or migration was required.

Focused existing all-twelve-feature journey passed at 360/390/1440px (three tests),
including CTA retry/deduplication, unchanged banking state and no overflow/Clarity.
Typecheck, production build and format passed; bundle ~577 kB / 170 kB gzip.
Representative mobile/desktop screenshots were visually reviewed. Release
**2026-10-11T21-46-00-510Z** deployed, and public HTTPS smoke passed at 360/1440px.
Service/DB health, original data, immutable upload and unrelated Nginx hashes/links
remain verified; credential scan passed. The earlier full API/browser baseline
above was not rerun for this presentation-only change. No failing check remains.

## Clarity control, transport and remaining acceptance

Project **`yvs5hp3ivb`** and settings are owner-confirmed: **Balanced masking,
cookies On, bot detection On, consent Required**. These are reported settings,
not dashboard inspection. The owner authorized enabling collection and the admin
control. **Chris is deferred until the owner says the demo is ready.**

Admin Menu → **Clarity Settings** (`/controls/clarity`) persists site-wide on/off
with protected, conflict/retry-safe writes. Customer opt-in is required; advertising
storage is denied. Consent belongs to user UUID/revision in the tab. Off/on, logout,
shared-browser switching and captured admin entry require a fresh opt-in/document.
Foreground pages poll every five seconds/on focus without visits or banner changes;
background timers can be throttled. Policy failure closes collection. Withdrawal
stops SDK, clears first-party Clarity cookies, and reloads.

| Check actually run this phase | Result |
| --- | --- |
| `npm test` | **45 TAP entries passed** including four new collection/control scenarios |
| `npm run test:clarity` | **6/6** SDK-stub journeys at 360/390/1440px; all external traffic intercepted; no real collection |
| Banking browser suite | **39 journeys covered**: 38 passed initially; all three affected admin-create journeys passed after scoping a selector that collided with a loading status |
| Typecheck, both build profiles, format | Passed; default-off and explicit evaluation builds verified; existing ~583 kB bundle advisory remains B-011 |
| Profile mismatch refusal | Default deploy rejects an evaluation build before host mutation, as intended |
| Migration/repeat | Both ledgers version 5, no pending/drift; repeat no-op; retained data/assets verified |
| Evaluation deploy | Release **2026-10-11T22-24-55-744Z**; admin switch enabled through protected API |
| Real SDK pilot | Two labeled mobile click/skip journeys; **10 acknowledged `/collect` uploads**, real cookie creation/withdrawal, no requests after withdrawal or on admin pages, no browser/CSP errors |
| Public HTTPS smoke | 360/1440px passes with automated users still excluded and no Clarity requests; route-transition wait added after an initial goal-form timing failure |
| Host/privacy | Nginx syntax, service/DB health, root:softek runtime permissions/allowlist, evaluation gates, unrelated site hashes/links verified |

Real pilot observed `www.clarity.ms`, `scripts.clarity.ms`, `c.clarity.ms`,
`u.clarity.ms`, `z.clarity.ms` and `c.bing.com`, within the dedicated CSP allowlist.
Lookup evidence with UUID/run/visit/scenario/time is ignored, 0600
`artifacts/clarity-pilot.json`; pilot timestamps **22:25:50–22:25:58 UTC**.
Owned automation users/history remain. Bot detection was not changed and may filter
these recordings. **Network success does not establish dashboard recordings,
heatmaps, or masking playback.** Public smoke/test timing fixes changed harnesses
only; no unresolved application check failure remains.

Clarity session tags accumulate values; sending `none` on navigation describes
current context but does not erase earlier session tags. Compare the event timeline
and database attribution for exact entries. Events before opt-in are not backfilled.
The optional public `?banner=` heatmap parameter remains deferred.

## M2-C06 consent modal follow-up

The initial unanswered customer consent now uses a centered native modal over a
dimmed account page. Shared Harbor tokens, two full-width choices, a scrollable
card for short viewports, background inertness and page-scroll locking apply.
Keep analytics off receives initial focus; Escape declines. A saved choice dismisses
the modal and survives navigation/reload; page-bottom controls still allow changing
it. Existing user/revision gates and withdrawal behavior remain unchanged.

Relevant verification: all nine privacy journeys covered at 360/390/1440px
(eight initially passed; all three global-off cases passed after the harness fix),
including six modal/short-viewport journeys. An initial harness timeout was fixed
by choosing consent before trying to use the now-inert menu; the global-off harness
was adjusted to await the expected reload rather than evaluate during navigation.
Typecheck/evaluation build/format passed; source and live mobile/desktop visuals
reviewed. Release **2026-10-11T22-42-00-516Z** deployed. Focused HTTPS checks verify
modal/focus/decline/navigation/saved choice without vendor traffic at 360/1440px.
Service/DB health and credential scan (94 files) passed. No unresolved check
failure remains. No migration/API changes. The previous API/banking baseline and real SDK transport
pilot above were not rerun for this UI change. Dashboard acceptance is still pending.

## Exact resume point

1. Read AGENTS/START_HERE, state, PRODUCT and Plan 002; inspect Git/live settings.
2. Owner-only human walkthrough: sign into a Human customer, choose Allow analytics,
   click/skip banners, explore a feature/CTA, use Savings Goals, navigate/reload,
   withdraw/sign out, and repeat with another user. Copy UUID from Manage Customers.
3. In project `yvs5hp3ivb`, find actual recordings by that ID and inspect masks,
   artwork/CSS, menu routes and separate feature-versus-adoption events. Review
   creative/layout heatmaps and document processing delay/limitations.
4. Check M2-04/05 dashboard acceptance based on observed results, not upload counts.
   Do not invite Chris yet or expand automation to Plan 003. The pilot command
   intentionally collects only when explicitly invoked with `--collect`.

## Git and operational handoff

Prior menu commit **162be9d**; committed 0004 migration **d0ec4c6**; initial feature
implementation **bd6a774**. Plan 005 including FEAT-09 and the current Clarity implementation/checks/docs are
committed locally on `main`; inspect `git log -1` for the implementation hash. **No push** was made. Origin is
`https://github.com/cnm4us/softek.git`. Only user-provided `temp/` remains untracked
and untouched. Ignored artifacts hold screenshots/manifests and owned checks.
No credentials are committed; production intentionally continues running.
LOCAL_SETUP owns backup/rollback/renewal, TESTING owns commands and cleanup boundaries.
