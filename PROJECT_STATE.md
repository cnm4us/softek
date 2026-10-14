# Project state

Last updated: **2026-10-14 UTC**.
Current focus: **[017 — Clarity API-call tracing in Phoenix](plans/017-clarity-api-phoenix-tracing.md), delivered with tracing Off**.
Latest completed implementation: **Plan 017 — Clarity API-call tracing in Phoenix**.
Current request: **Implement Plan 017, deploy with tracing initially Off and preserve existing Clarity collection settings.**
Next task: **Owner may enable API-call tracing in Clarity Settings and inspect private Phoenix through port forwarding. Await the next priority; raw uploads, other banner spaces and the recording inquiry remain outside this delivered scope.**

## Plan status registry

This is the canonical lifecycle registry. The [roadmap](IMPLEMENTATION_PLAN.md)
owns sequence/dependencies; individual plans own detailed tasks and acceptance.
Active identifies focus and does not itself authorize additional scope.

| ID | Plan | Status | Progress / dependency |
| --- | --- | --- | --- |
| 000 | [Foundation and first demo](plans/000-foundation-and-first-demo.md) | Completed | M0/M1 verified/deployed; historical checklists retained |
| 001 | [Login, layout, and rotating banners](plans/001-login-layout-and-banners.md) | Completed | M1-R01–08 verified/deployed; real Clarity acceptance stays in 002 |
| 002 | [Clarity validation](plans/002-clarity-validation.md) | Deferred | Synthetic Dashboard activity accepted; missing automated saved recordings accepted, investigation ended; human masking/heatmap review remains; Chris deferred |
| 003 | [Automation journeys](plans/003-automation-journeys.md) | Deferred | Typed feature/banking scenario contract exists; no runner/scheduler/UI |
| 004 | [Admin and Customer menus](plans/004-admin-and-customer-menus.md) | Completed | MENU-01–07 verified/deployed with independent sessions and protected child routes |
| 005 | [Feature campaign landing pages](plans/005-feature-campaign-landing-pages.md) | Completed | FEAT-01–09 implemented, migration 0004 applied, API/browser/public acceptance verified and deployed |
| 006 | [Bulk customer generation](plans/006-bulk-customer-generation.md) | Completed | GEN-01–05 verified/deployed; 200-user test and small live batches; migration 0006 applied |
| 007 | [Customer device and browser profiles](plans/007-customer-device-browser-profiles.md) | Completed | DEV-01–05 verified/deployed; schema 7; compatible selectors and matching native profiles |
| 008 | [Simplify starting accounts](plans/008-simplify-starting-accounts.md) | Completed | ACCT-01–04 verified/deployed; no migration; eligibility independent, retained profiles/balances/history preserved |
| 009 | [Permanent customer deletion](plans/009-delete-customers.md) | Completed | DEL-01–04 verified/deployed; permanent linked-data removal, responsive cards and no batch-retry recreation |
| 010 | [Admin customer impersonation](plans/010-admin-customer-impersonation.md) | Completed | IMP-01–06 verified/deployed; schema 8, admin-bound sessions, conditional exit, labeled local history and report/Clarity exclusion |
| 011 | [Contextual feature discovery](plans/011-contextual-feature-discovery.md) | Completed | DISC-01–06 verified/deployed; schema 9; 83 API/migration entries, 48 existing + 9 discovery browser checks, 18 privacy checks and live HTTPS 360/1440px |
| 012 | [Explore more ways to bank](plans/012-grouped-feature-catalog.md) | Completed | CAT-01–05 verified/deployed; ordered twelve-product catalog, search/accordions, 63 browser and 18 privacy checks; schema 9 unchanged |
| 013 | [Account detail pages](plans/013-account-detail-pages.md) | Completed | DETAIL-01–08 verified/deployed; schema 9 unchanged; 83 API, 69 browser, three focused privacy checks and live HTTPS 360/1440px |
| 014 | [Compact banner placeholders](plans/014-compact-banner-placeholders.md) | Completed | STRIP-01–03 verified/deployed; 54 distinct account/banking cases, eight privacy checks, live HTTPS 360/1440px; schema 9 unchanged |
| 015 | [Feature Explorer controls](plans/015-feature-explorer-controls.md) | Completed | EXP-01–06 verified/deployed; schema 10; 88 API/migration entries, nine browser checks, three SDK-stub privacy checks and live HTTPS 360/1440px; customer activation deferred |
| 016 | [Summary feature banners](plans/016-summary-feature-banners.md) | Completed | SUM-01–04 verified/deployed; schema 11; 94 API/migration entries, 18 browser checks, six SDK-stub privacy checks and live HTTPS 360/1440px; Summary only |
| 017 | [Clarity API-call tracing in Phoenix](plans/017-clarity-api-phoenix-tracing.md) | Completed | PHX-01–07 verified/deployed Off; schema 12; 110 API/migration entries, 12 browser checks, 13 isolated collector checks and live HTTPS 360/1440px |

## Current reality

- Plan 017 is deployed with tracing **Off**, independently of existing Clarity
  collection **On**. All supported application calls use `Demo()`; consented safe
  snapshots are accepted under owned server contexts, stored in MariaDB and exported
  as custom protobuf OTLP spans. Admin Clarity Settings has the independent control,
  status/loss counters and filtered JSON download. Phoenix 20.21.3/Python 3.12.12
  runs privately as `softek-phoenix` on loopback 6006, with seven-day retention,
  isolated SQLite and HTTP-only launcher (no new gRPC listener). LOCAL_SETUP owns
  tunnel/inspection commands. Raw SDK uploads are B-018, not implemented.

- Live: **https://demo.bawebtech.com**. Branded username/password login; no signup.
  Admin signs in independently at `/controls` using the private `DEMO_ADMIN_SECRET`.
  Email-style usernames within the 3–40-character limit are supported.
- Manage Customers → **Generate customers** creates 1–200 fictional users with
  unique usernames/display names and sampled checking/savings cent amounts. Owner
  chooses count, prefix, shared password, ranges and existing assignment choices.
  Human is the default; no login/visit/analytics opt-in occurs during generation.
  Password-free CSV supports later automation. Saved starting amounts survive
  reset; current amounts persist across logins. Starting-account template selectors
  are removed from manual creation, generation and reset; Savings Goals eligibility
  is independent. Internal legacy fixtures remain for history/API compatibility.
- Device and Browser selectors are available in customer creation, generation and
  details, with an independent Save action. Existing customers default to Desktop/Chrome.
  Seven compatible pairs are enforced. Saving preserves banking/sessions/consent;
  manual visits keep their actual browser. The explicit pilot can use saved profiles,
  with matching engines; broader scheduling and dashboard classification stay deferred.
- The owner-requested cleanup left one preserved customer; the owner has since
  created another batch (batch 21). The current customer count is not rechecked.
  The authorized cleanup deleted 37 other customers through the protected API.
  Preserved identity/credentials, runs, accounts, goals and configuration matched
  their pre-cleanup snapshot; banners, assets, collection settings and anonymous
  runs were unchanged. Batch retry metadata remains.
- Every Manage Customers card has a separate details link and **Delete** button.
  Confirmation permanently removes the selected login, all owned active/retired
  runs and local report history; other customers and shared banners remain intact.
  Deletion revokes sessions. Batch retries return surviving customers, including
  an empty batch, without recreating deleted identities. Existing Clarity recordings
  are outside the local deletion operation.
- Customer details now offer **Impersonate customer** for enabled Human/Automation
  users. Account Summary and customer actions use their saved state, with a
  **Viewing as** indicator and conditional **Exit to Admin** above Sign out. Admin
  sessions bound to impersonation are checked on every customer request; expiry,
  logout, password replacement, disable and deletion revoke access. Clarity is
  always excluded, local visits retain provenance, and default reports exclude
  impersonated activity/admin-only cohorts. Other tabs return to Admin on entry.
- Customer sessions last 24 hours. Sign-out/expiry preserve banking state; password
  replacement/disable revoke that user's sessions. Reset retires the run and retains
  history, stable user UUID and rotation cursor. Admin and customer sign-outs are
  independent. New users use the common starting accounts; omitted-profile resets
  preserve existing internal assignments and restore saved starting amounts.
- Account Summary starts with the three account widgets, then a compact 105px
  full-width feature banner before Recent Activity. Enabled uploaded Summary
  widgets cycle by saved order/ID on login/full refresh; menu returns preserve
  the tab's exact selection. Proportional centered artwork links to its catalog
  page, with qualified visibility/click and feature/CTA attribution. Empty/error
  states show the placeholder. Other account details retain inactive strips.
  Summary Clarity tags use loaded artwork and clear on route/customer changes;
  these feature invitations do not feed the Savings Goals campaign.
  The View savings options link is removed; complete checking/savings/credit widgets
  link to `/accounts/checking`, `/accounts/savings`, `/accounts/credit-card`. Pages
  use owned balances and account-ID-associated recent activity, with stable labeled
  statement examples and fictional terms. Viewing writes no ledger data; details
  are masked and routes have ordinary banking page tags. Explore placements await
  the owner discussion.
  Retained selections still advance once on login/full Summary refresh; menu returns/
  data reads/feature CTAs do not. Independent tabs retain their exact selection. Savings Goals enrollment,
  goals and contributions remain functional; other banking sections use demo actions.
- Customer Menu → **Explore more ways to bank** opens authenticated `/explore`,
  a searchable catalog with five expanded-by-default groups and all twelve
  campaigns. Full product names link to the existing `/features/:featureId` routes. One shared Harbor landing component
  starts each card with a larger green uppercase headline, without the repeated
  Explore line or decorative star, then renders copy, benefits, disclosures and
  one primary CTA. CTA acknowledgement
  shows an inline demo confirmation, without changing banking/enrollment. No banners
  or financial input forms appear on feature pages. All customers may explore them.
- Customer Menu now includes **Savings & Investing** and **Loans**. Explicit
  investing exploration can show EasyCoin; the eligible fictional auto-loan payment
  screen can show Skip A Pay. The ineligible personal-loan example has no invitation.
  Learn more/Dismiss uses the existing feature pages. Payment form, review and
  confirmation are simulations without financial writes. Discovery preferences
  persist across logins/reset: one reservation per visit, 14-day seen cooldown,
  90-day dismissal and seven-day fewer-suggestion interval. These settings cover
  the new invitations; Summary banners/Goals remain separate. Contextual Discovery
  in Adoption Report has owned immutable attribution and existing actor/variant/
  time filters; impersonation is excluded.
- All twelve internal destinations are selectable in Manage Banners. No new artwork
  or enabled promotional set was created. Uploaded JPEG/PNG/WebP is re-encoded to
  immutable WebP; production assets remain outside releases in
  `/var/lib/softek/banner-assets`. Replacements retain prior URLs/history.
- Feature observations are `feature_viewed` / `feature_cta_clicked`, separate from
  Savings Goals adoption. The API validates owned run/visit, feature/action/time,
  CSRF and optional immutable banner entry; retries deduplicate per page/feature.
  Banner history state belongs to the exact landing entry; menu/direct entries do
  not inherit another tab's or the user's last banner attribution.
- Admin Menu contains Manage Customers, Manage Banners, Feature Explorer, Adoption Report and Clarity Settings at
  `/controls/*`. Feature Activity within the report shows raw views/clicks, distinct
  customers/runs and banner-attributed counts under actor/variant/UTC filters.
  Savings Goals funnel queries/denominators are unchanged. Selected-customer activity
  names feature observations. Admin descendants remain masked and analytics-excluded.
- Feature Explorer (`/controls/feature-explorer`) has four banner space headers:
  Account Summary, Everyday Checking, Harbor Savings and Harbor Credit Card. Add a
  catalog feature, open its title, upload/replace mobile artwork, view/copy its
  automatically derived URL and save accessible text/order/future inclusion.
  Recommend 960×315 for the compact mobile slot. One widget per feature per space;
  repeat features across spaces are allowed. Image-less inclusion is rejected.
  Widget rows/configuration also have confirmed Delete; only the chosen placement
  and settings are removed. Its feature is available again; other spaces/catalog
  and immutable artwork remain. Summary activation is delivered in Plan 016;
  checking/savings/credit spaces remain configuration-only.
- MariaDB is authoritative. Business writes use user/run locks and READ COMMITTED;
  savings reports use consistent snapshots; feature aggregates use one SQL statement.
  Runtime has scoped CRUD; migrator has scoped DDL. Private `.env` remains ignored
  and 0600. Runtime environment is an allowlist, root:softek 0640, with no DB admin,
  migration or test credentials.
- Migrations **0001–0012** applied to **demo and demo_test**, version 12 with no
  pending/checksum drift; repeat application is a no-op. 0007 adds device/browser
  preferences; committed **7eb7290** before application. Batch/balance tables and
  the collection switch/epoch remain intact. Next migration is **0013**. 0012 adds diagnostic configuration/contexts/calls, committed **9a167b6** before application. 0011 adds only the Summary cursor, committed **0cbb1cb** before application. 0010 adds only unseeded admin widget configuration, committed **c8f4204** before application. 0008 adds session/visit-context tables without changing existing table layouts; committed **c758cc4** before application. 0009 adds discovery preferences/presentations/attribution; committed **b3305a6** before application.
- Root-only 0600 pre-0011 schema/data/ledger backup:
  `/var/backups/softek/demo-before-0011-20261014T000207Z.sql`.
  Additive cursor and existing immutable snapshots may remain on code rollback.
- Root-only 0600 pre-0010 schema/data/ledger backup:
  `/var/backups/softek/demo-before-0010-20261013T205047Z.sql`.
  Prior code can ignore the additive table on code rollback; no rollback performed.
- Root-only 0600 pre-0008 schema/data/ledger backup:
  `/var/backups/softek/demo-before-0008-20261012T061846Z.sql`; tested schema-8
  API/web recovery build `/var/backups/softek/schema8-tested-build-20261012-final.tar.gz`.
  Earlier code ignores provenance and is unsuitable for report rollback after
  impersonation activity. No rollback performed.
- Root-only 0600 pre-0007 schema/data/ledger backup:
  `/var/backups/softek/demo-before-0007-20261012T004021Z.sql`.
  Earlier pre-0002/pre-0004/pre-0005/pre-0006 backups remain. All ten original runs and retained
  counts survived; anonymous ownership remains NULL; upload public hash unchanged.
- Current release: **2026-10-14T15-32-53-693Z**. Previous authenticated release:
  **2026-10-14T00-11-24-262Z**. Both current links point to the new release.
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
  Pre-generation code does not restore individual saved starting balances on
  reset; use code supporting schema 6 when generated customers exist. No rollback
  or old-code schema-6 compatibility check was performed this phase.
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

Owner has now reported seeing mouse-behavior playback in Clarity. This confirms
owner-observed capture/playback, not reviewed masks, attribution or heatmaps. The
owner emphasized the demo is still far from ready for Chris.

Project **`yvs5hp3ivb`** and settings are owner-confirmed: **Balanced masking,
cookies On, bot detection Off, consent Required**. The owner reported switching
Bot Detection Off on 2026-10-12 UTC (initially On). These are reported settings,
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

## October 12 authorized Playwright capture pilot

Owner requested testing whether Playwright activity appears in Clarity before
building the broader suite. The existing CLI now sets `pilot_run` and
`pilot_scenario` tags, names new users Clarity Pilot Click/Skip, includes scrolling
and about 55 seconds of reading pauses per journey, and correctly labels Bot
Detection as owner-reported Off. No app deployment, migration, collection-setting
change, existing-customer reset or broader runner was required.

`npm run clarity:pilot -- --collect --device=desktop --browser=chrome` passed two
actual Chromium journeys on public HTTPS on **2026-10-12 14:30:12–14:32:09 UTC**.
Clarity acknowledged **19 `/collect` uploads** (click 10, skip 9). Decline made no
vendor requests; withdrawal cleared cookies/stopped traffic; admin made no vendor
requests; no browser/CSP errors occurred. Independent protected-API history reads
confirmed one EasyCoin feature view each, with CTA counts **click 1 / skip 0**.
Typecheck, focused Prettier and Git whitespace checks passed; live health is
200/DB connected. Routine test suites were not rerun for this isolated pilot change.

- Project: `yvs5hp3ivb`; lookup tag `pilot_run`:
  `pilot-0ac80155-b681-45cf-bc70-5818483b4bdf`.
- Clarity Pilot Click user UUID: `1755bd32-8bab-482f-bba2-82668baf7015`.
- Clarity Pilot Skip user UUID: `55fdff84-4f23-4c24-a155-df4454ede3d0`.
- Two new Automation users/history are retained for dashboard lookup. Generated
  random passwords were not logged/saved. Existing users were not used or reset.
- Ignored 0600 evidence: `artifacts/clarity-pilot.json`, plus archived
  `artifacts/clarity-pilot-20261012T143012Z.json`. These contain no credentials or
  collection payloads; the latest manifest replaces the prior pilot's lookup file.

The agent browser opened the project recordings URL but displayed an expired
Microsoft sign-in session. **Actual recording inclusion, device/browser
classification, playback fidelity, masking and heatmaps remain unverified.** The
owner has been asked to find both recordings by UUID/time or the new custom tag
(filter values may take time to appear). Wait for this evidence before expanding
traffic. Plan 003 and Chris access remain deferred. No push performed.

At approximately **14:39 UTC**, the owner reported neither recording visible and
no `pilot_run` custom-tag filter. This is about seven minutes after the last
journey; inclusion remains unconfirmed. Microsoft documents **30 minutes to two
hours** for new custom tags to appear in project filters:
[custom tags](https://learn.microsoft.com/en-us/clarity/filters/custom-tags).
Recheck today's recordings without restrictive filters after processing; do not
treat the missing early filter as proof of either capture failure or success.

The owner then confirmed each Custom User ID was searched separately and Today's
unfiltered recordings were empty. One additional new **Clarity Pilot Diagnostic**
Automation customer was created (none of the owner's ten generated customers or
personal account was used/reset). The ignored host-local helper
`artifacts/diagnose-clarity-capture.ts` ran an approximately 80-second actual
Chromium journey starting **14:46:45 UTC**, with Summary scrolling, Explore
Features → EasyCoin, CTA confirmation and ordinary logout. It inspects collection
payloads only in memory and saves boolean/count metadata, never raw bodies.

- Diagnostic customer UUID: `6494fb69-1b44-4efd-beda-90a038877848`.
- SDK `0.8.72` reports project `yvs5hp3ivb`, native Clarity user ID `owexj9`,
  session ID `114qxaa`, playback enabled and analytics consent granted.
- **Six HTTP 204 uploads** matched the project; four included playback events,
  all six included the customer's SHA-256 custom identity, and the diagnostic
  `pilot_run` tag was present. No END command, browser/analyzer error or private
  automation/capture header sent to Microsoft was observed.
- The owner confirmed **“I can see the live session”** when checking Clarity's
  live-users panel using the native ID. This establishes owner-observed synthetic
  live-session visibility, not completed recording availability or replay quality.
- Evidence: ignored 0600 `artifacts/clarity-capture-diagnostic.json`; owner live
  confirmation is recorded separately from the still-false playback acceptance.
- Owner replay inspection is requested. The two original recordings/tag filter
  have not yet been confirmed; do not attribute their absence definitively to
  processing delay. Keep traffic small until replay is reviewed.

Owner playback feedback: the diagnostic shows screen changes, clicks and the
EasyCoin CTA confirmation; scrolling was not observed. This confirms those live
replay elements only. A collection-free geometry check used admin impersonation
of the owned diagnostic customer (no banking changes) and found both pages can
scroll at 1280×720. It recorded physical movements and made **zero vendor
requests**; ignored evidence is `artifacts/pilot-scroll-geometry.json`. The
original capture did not measure scroll offsets, so the cause of its unseen
scrolling is not established; joining live after an earlier scroll is a possibility.

One focused follow-up, **Clarity Pilot Scroll**, ran **07:56:48–07:58:12 PDT**
(14:56:48–14:58:12 UTC) in Chromium at 1280×600. It verifies physical document
offsets after each wheel input and pauses eight seconds between movements:
Summary **4→504→4→404→4 px**; EasyCoin **0→300→0 px**, followed by the CTA
confirmation. All six movement assertions passed. **Eleven HTTP 204 uploads**
matched the project and included **eight Scroll events** plus playback data,
custom identity and the diagnostic tag. No browser/analyzer error or private
headers on collection uploads occurred. Raw payloads were inspected only in
memory and not saved.

- Scroll customer UUID: `0497d1dc-dfd4-4401-b661-873a70cac906`; native Clarity user
  ID **`91iamz`**, session `1oi305m`.
- Ignored host-local helper: `artifacts/diagnose-clarity-scroll.ts`; 0600 evidence:
  `artifacts/clarity-scroll-diagnostic.json`.
- There are now **four newly created pilot customers** retained for lookup. The
  owner's account and ten generated customers were not used/reset. Impersonation
  geometry visits on the diagnostic are labeled/excluded from normal reports.
- The owner initially saw no scrolling in the focused full recording from the
  beginning, then reported **“in mobile view I'm seeing scrolling.”** This adds
  owner-observed visible scrolling to the confirmed page/click/CTA replay. The
  earlier desktop display discrepancy remains unexplained; speed/Skip inactivity
  settings, the precise mobile-view control and recording identity for that
  observation were not independently verified. All four captures used Desktop
  Chrome; this observation does **not** establish a new mobile-profile capture or
  Clarity's native mobile classification. No further capture is needed merely to
  repeat the already verified physical scroll movements.
  Completed recording availability and the original two recordings remain
  unconfirmed. Live visibility is not full presentation readiness. No broader traffic run,
  deployment, application-code change or migration was required for diagnostics.

The owner noted Live entries disappear when the customer stops. Microsoft
documents inactive watched entries in that list for five minutes and a distinct
processed-recording retention period (normally 30 days). Live has fewer supported
filters; do not use missing live custom-tag filters as proof of upload failure.
References: [Live recordings](https://learn.microsoft.com/en-us/clarity/session-recordings/clarity-real-time),
[recording retention](https://learn.microsoft.com/en-us/clarity/faq#how-long-are-my-recordings-retained).
Microsoft's [inline player guide](https://learn.microsoft.com/en-us/clarity/session-recordings/inline-player)
documents Highlights, full playback, speed/Skip inactivity controls and Scroll
events under More details. Raw payload bodies were discarded, so prior decoded
scroll coordinates cannot be recovered from the count-only manifests. Owner
mobile-view scrolling is now confirmed; completed-recording lookup, desktop
display, masking and heatmaps remain separate acceptance checks.

Earlier owner dashboard observation: **Today shows one unique user**, native
Clarity user ID **`1fwxlgf`**. This is a user-count observation, not yet a matched
pilot/completed recording. It differs from known diagnostic IDs `owexj9` and
`91iamz`; native IDs were not retained for the original click/skip users. Owner
replied that **“Those recordings are no longer found”** when asked to open a
recording and check its start time and `actor` tag. No recording start time or
tag was obtained; this native user remains unmatched. Earlier observed live
playback remains valid evidence, but post-session searchable recording availability
is still unverified. The cause of the unavailable recordings is unknown; do not
infer deletion, bot filtering, or completed processing from this observation.

Latest owner observation: **two sessions labeled Headless Chrome appear in the
Dashboard, not in Recordings**. This confirms owner-observed dashboard session
counts for that browser label, not saved-recording availability or a match to
specific pilot customers. Live replay was observed earlier; post-session recording
availability remains unresolved. No additional capture was run for this update.

## October 12 evening — authorized feature-menu capture

The owner requested one run using **Explore Features** to visit each feature once.
The ignored host-local helper `artifacts/run-feature-menu-pilot.ts --collect` ran
at **18:04:50–18:07:45 PDT on October 12** (October 13 01:04:50–01:07:45 UTC).
It created one new Automation customer, **Clarity Feature Menu Pilot**, used a
fresh Desktop/Chrome context and actual customer login, clicked **Allow analytics**,
then opened every feature via the menu in catalogue order. Each page had a
12-second reading pause; no banner or feature CTA was clicked. It signed out
normally and closed the browser/admin session. No existing customer was used/reset.

- Customer UUID: `dfa52b47-f007-41fe-9f94-0e5de360461f`; native Clarity user ID
  **`1sblz1g`**, session **`1q6lmba`**.
- Custom `pilot_run`: `feature-menu-e54d91f4-d953-44f7-9b12-efb66e4b4f43`;
  `pilot_scenario`: `all-features-menu-views-only`.
- SDK 0.8.72 reported playback enabled, analytics storage granted, advertising
  storage denied, and 13 pages (Summary plus the 12 features) in this session.
- **26 HTTP 204 uploads** matched project `yvs5hp3ivb`; 25 included playback data.
  Custom identity and lookup tag were observed in memory. No END command, browser
  page/CSP error or private header sent to Microsoft was observed.
- Protected local interaction history independently confirms **exactly one view
  of each of the 12 features and zero feature CTA clicks** in the owned run.
- Owner confirmed live visibility and described all 12 feature pages in order,
  ending with Business Invoicing. The earlier “Waiting for additional activity”
  overlay did not prevent subsequent page playback. Completed-recording lookup,
  classification, masking and heatmaps remain unverified.
- Ignored 0600 evidence: `artifacts/clarity-feature-menu-2026-10-13T01-04-50-178Z.json`.
  Raw capture payloads and the generated password were not retained. The new
  customer/history remain available for dashboard lookup. No application code,
  deployment, schema, collection setting or unrelated service changed.

### Feature-menu post-session follow-up

Owner now reports **all feature pages appear in Dashboard, but the test is absent
from All Recordings**. With filters/saved segments cleared and **Last 7 days**
selected, **manual recordings appear; the test remains missing**. This narrows the
observed discrepancy to the automated session rather than an entirely empty
recording list. It does not establish that headless mode or bot filtering caused it.

Read-only review reconfirmed all 26 uploads succeeded and 25 contained playback
data, with no captured errors/END command. Microsoft's
[Dashboard troubleshooting](https://learn.microsoft.com/en-us/clarity/insights/troubleshooting-dashboard)
documents Dashboard activity without playable recordings when received replay
data is insufficient, and suggests broadening filters; that is a possible
explanation, not a diagnosis. Our agent browser still shows expired Microsoft
sign-in, so dashboard evidence remains owner-observed. No account/service setting
was changed and no new real capture was made.

The proposed controlled comparison was to repeat the same menu-only journey with
headed Chromium, keeping consent, capture gates and synthetic labeling intact.
Playwright uses a separate headless shell by default versus regular Chromium for
headed operation ([browser documentation](https://playwright.dev/docs/browsers#chromium)).
Host `Xvfb`/`xvfb-run` is available; Google Chrome is not on PATH. A result would
test browser-mode behavior, not prove a Microsoft filtering policy. If still
missing, the existing project/user/session/time evidence supports a Microsoft
support case; no message to Microsoft has been authorized or sent.

## October 12 night — authorized headed feature-menu comparison

Owner explicitly authorized the same all-feature test in headed mode. The
headed Chromium preflight on `about:blank` passed without website/vendor traffic.
The host-local comparison then ran:

```bash
xvfb-run -a npx tsx artifacts/run-feature-menu-headed.ts --collect
```

Capture timestamps: **21:11:38–21:14:35 PDT on October 12** (October 13
04:11:38–04:14:35 UTC). One new **Clarity Headed Feature Menu Pilot** Automation
customer used actual customer login and clicked Allow analytics. The twelve
Explore Features links, catalogue order, 12-second pauses, no banner/CTA clicks,
final pause and ordinary sign-out matched the earlier headless journey. Browser
and admin session closed. Other customers were not used/reset.

- Customer UUID: `86284506-770b-4f7d-89cb-82a29da67830`.
- Native Clarity user **`1mwvoop`**, session **`qlil7v`**. Owner opened the session
  details and reports browser label **Chrome**; owner subsequently reports the
  saved recording is **still not visible**.
- `pilot_run`: `feature-menu-headed-97a261e8-7a18-4485-874f-500bf484e261`;
  scenario remains `all-features-menu-views-only`; extra `pilot_browser_mode` tag is `headed`.
- Actual launch uses `headless: false` with a temporary Xvfb display and full
  Chromium 156.0.8078.4, Desktop/Chrome preset, viewport 1280×720. Native
  `navigator.webdriver` remains true. No automation-detection override was used.
- SDK 0.8.72 reports playback enabled, analytics storage granted, advertising
  storage denied and 13 pages under the same native session.
- **26 HTTP 204 uploads**, all project-matched, 25 with playback events; identity
  and pilot tag verified in memory. No browser/CSP/analyzer errors, END command,
  or private automation/capture headers sent to Microsoft were observed.
- Local protected interaction history confirms **exactly one view per feature
  (12 total), zero feature CTA clicks**. The live API health check passed.
- Ignored 0600 evidence:
  `artifacts/clarity-feature-menu-headed-2026-10-13T04-11-38-660Z.json`.
  Helper is also ignored/0600; it is a host-local diagnostic, not a new package
  command or general automation suite. Original headless helper/evidence retained.
  Generated password/raw payloads were not saved; customer/history retained for lookup.

No application code, deployment, schema, collection setting or unrelated service
changed. Runtime journey/assertions and evidence review passed; broad app suites
were not repeated for the host-local browser-mode comparison. The Chrome label
does not establish saved-recording acceptance or explain the earlier missing run.

October 13 PDT follow-up: owner reports headed recording still missing and
suggests `clarity('set', 'test_run', 'automated-suite')`. Both menu runs already
use `set` for unique `pilot_run` and shared `pilot_scenario`; headed also sends
`pilot_browser_mode`. Reinspection confirms one acknowledged payload per run
contains the exact pilot tag and all 26 contain custom identity. Tags are sent
after consent/SDK readiness. Microsoft's [custom-tag guidance](https://learn.microsoft.com/en-us/clarity/filters/custom-tags)
documents segmentation; no bot exemption is documented for `set`. The
[cited SEJ article](https://www.searchenginejournal.com/microsoft-clarity-ab-test/486432/)
discusses A/B labels, not the quoted bot-filtering advice. Adding a `test_run`
alias is not an established fix. Headless mode alone cannot explain both missing
runs. Next review consent/session shutdown and assemble support evidence; no
new capture, setting change or support contact was made. Microsoft sign-in is
still required in the agent browser. Do not contact others without authorization.

Human-like-action advice follow-up: the two menu runs already pause 12 seconds
per feature; earlier capture also verified mouse/scroll input and uploaded Scroll
events. Login typing occurs before collection/consent, so slower login typing
would not supply recorded behavioral input. The linked
[Microsoft issue 520](https://github.com/microsoft/clarity/issues/520) reports live
replay missing from saved sessions. Microsoft support comments describe missing
data/low-confidence replay; a later user reports a consent-integration cause in
their own setup. This is not evidence of a mandatory human-like action sequence.
The referenced YouTube page was throttled; its content was not verified.
Read-only local audit confirms customer sign-out calls `beginCustomerTransition`
and `finishCustomerTransition`, both reaching `stopCollection`, which sends
ConsentV2 analytics denied before SDK stop and cookie removal. Whether that
shutdown affects saved replay is unproven. Next proposed controlled capture:
keep the same consent/actions/pauses but close the browser without application
sign-out, isolating this path. Do not weaken real decline/withdrawal handling or
claim a fix until saved-recording behavior is observed. No capture/code change
was performed for this advice review.

## October 13 — owner accepts the automated recording limitation

Owner accepts the demonstrated outcome for the current demo: automated Playwright
activity appears in Dashboard, while saved human recordings are available.
Automated saved recordings remain missing; cause is unknown and no fix is claimed.
This is an accepted limitation and no longer a blocker. Stop this investigation;
the proposed no-sign-out capture and Microsoft support case are not to proceed
unless the owner explicitly reopens it. Retain existing evidence and labeled
test customers; no cleanup, capture, application/consent change or support contact
was requested. Product acceptance and M2-05 now reflect this owner decision.
This does not complete remaining human masking/heatmap review, authorize the
broader suite, or authorize Chris's access/presentation.

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

## Plan 006 result and verification

All GEN-01–05 complete. Protected bulk creation is atomic and retry-safe. Unique
batch/position markers distinguish generated identities across batches. Checking
and savings use sampled integer cents, saved by user UUID for first login and
both reset paths. Passwords are independently salted; the local CSV omits them.
Credit accounts and recent activity remain fictional template samples.

| Check actually run | Result |
| --- | --- |
| `npm test` | **51/51 TAP entries passed**, including five generation scenarios and existing banking/features/collection/migration coverage |
| 200-user batch | **~14 seconds**, all distinct identities/hashes, varied bounded amounts, no premature runs; concurrent retries return the same batch |
| Integrity | Changed-payload conflict, late collision rolling back earlier inserts, real Human login, contribution/relogin persistence, customer/admin reset restore saved amounts |
| `npm run test:e2e` | **42/42** banking journeys at 360/390/1440px; three focused generation journeys also passed after using the shared checkbox style |
| Typecheck/build/format | Passed; Clarity evaluation build ~594 kB / 173 kB gzip; B-011 size advisory remains |
| Migration/repeat | 0006 committed before test/production application; scoped pre-0006 backup; both ledgers version 6, no pending/drift; repeated application no-op |
| `npm run deploy -- --clarity` | Release **2026-10-11T23-07-29-587Z**, evaluation profile and existing database switch On preserved |
| Live generation | HTTPS 360/1440px: three users each, default Human choice, chosen Automation test activity, ranges, same-request retry, password-free CSV, customer details, login/relogin/reset and no Clarity traffic |
| Public banking smoke | HTTPS 360/1440px passed enrollment/goals/contribution, rotation, relogin, feature CTA/report, independent admin sign-out and reset |
| Retained host/data | Original ten runs/counts/upload hash intact; service/DB health, loopback binding, Nginx syntax, unrelated site hashes/links and private runtime allowlist/permissions verified |
| Visual/credentials | Mobile/desktop form and results reviewed; secret scan passed across 99 source/document/build files |

An initial concurrent retry exposed a MariaDB lock-upgrade deadlock; the exclusive
upsert lock fixed it and the complete API suite passed. The first public banking
smoke filled a temporary enrollment form before the final Goals route remounted
it; the harness now waits for the destination acknowledgement, and both widths
passed. That correction changes the harness only. No unresolved check failure
remains. Six labeled `test.live-bulk.*` Automation users and public smoke history
are intentionally retained; no full 100–200 production cohort was generated.
Ignored, 0600 `artifacts/live-generation-check.json` records only identities,
starting amounts and checked run IDs, without passwords.

## Plan 007 result and verification

DEV-01–05 complete: saved Device/Browser choices in create/bulk/details, independent
protected save, compatible pairs and CSV columns; matching Playwright resolver and
saved-customer option for the explicit pilot. Preferences preserve banking runs,
balances, sessions and consent. Private pilot headers are scoped to our origin.

| Check actually run | Result |
| --- | --- |
| `npm test` | **64/64 TAP entries passed**; protected updates, legacy defaults, SQL/API pair validation, manual/bulk persistence, retry/conflict, banking/session/consent preservation and both resets |
| Browser suite | **45 journeys covered** at 360/390/1440px: 39 initial passes; all six affected bulk/profile tests passed on focused rerun after switching test locators to accessible combobox names |
| Native profile checks | All seven pairs launch matching Chromium/Firefox/WebKit and prove UA, screen/viewport, density and actual tap/click delivery; vendor traffic intercepted |
| Header isolation | Intercepted browser verifies private automation/capture headers on own origin and absent on vendor requests |
| Typecheck/build/format | Passed; evaluation build ~597 kB / 174 kB gzip; existing B-011 advisory remains |
| Migration/repeat | 0007 committed **7eb7290** before test/production application; scoped 0600 pre-0007 backup; both ledgers version 7, no drift/pending; repeats no-op |
| Deploy | **2026-10-12T00-46-07-747Z**, matched evaluation profile; existing database collection switch On preserved |
| Live profile checks | All seven saved pairs on public HTTPS: login, same owned banking run, mouse/tap menu and feature CTA; no vendor requests. One owned Automation check user retained |
| Live admin/bulk checks | 360/1440px: profile selectors/save/reload, batch pairs, retry, CSV, login/relogin/reset; six owned generated check customers retained |
| Public smoke | Both 360/1440px existing banking/enrollment/goals/contribution, rotation, feature/report, independent sign-outs and reset passed without Clarity |
| Host/data/credentials | Health/DB connected, loopback service, Nginx syntax and unrelated hashes/links, permissions/allowlist/gates, original ten runs/counts/upload hash intact; secret scan passed across 108 source/document/build files |

Initial UI failures were test label selectors, corrected to accessible combobox
roles. WebKit reports no Android-style maxTouchPoints; tests now prove real
`touchstart` delivery. No unresolved application failure remains. No real SDK
collection was run this phase. The modified pilot's actual upload/withdrawal and
Clarity's browser/device classification still require a deliberate later recording
check; no classification guarantee or bot-filter evasion is claimed. Ignored 0600
`artifacts/live-browser-profiles.json` and `artifacts/live-generation-check.json`
record only test identities/profiles/run evidence, without passwords.

## Plan 008 — shared starting-account controls

Removed redundant Alex/Jamie and Eligible/Standard selectors from manual creation,
bulk generation and banking reset. Fixtures share identical accounts/activity.
New requests default to the internal Alex fixture; resets preserve the locked
user's internal profile when omitted. Eligibility is independent, including an
ineligible Alex customer and an eligible legacy Jamie customer. Generated amounts,
user identity and archived history remain intact. No migration was required.

| Check actually run | Result |
| --- | --- |
| API/native suite | 64 entries covered: 54 outside the revision suite passed initially; after fixing a comparison of regenerated account IDs, all 10 revision entries passed on focused rerun |
| Focused browser suite | 9/9 at 360/390/1440px: manual creation, omitted-profile reset/eligibility, bulk retry/CSV and individual amounts; no template selectors or Clarity requests |
| Typecheck/build/format | Passed; matched evaluation build 595.53 kB / 173.57 kB gzip, existing B-011 advisory |
| Migration status | Both schemas version 7, no pending/checksum drift; no SQL applied |
| Deploy | Release **2026-10-12T01-14-03-090Z**, existing evaluation flags/switch preserved |
| Live focused check | 360/1440px: bulk retry/CSV, ineligible default profile, login/relogin, customer reset and admin reset to eligible; saved starting amounts preserved, no Clarity traffic |
| Public HTTPS smoke | 360/1440px banking, features/report, independent sessions and reset passed |
| Host/data | Active service, DB health, loopback 3100, matching release links, Nginx syntax/unrelated hashes/links, runtime permissions/allowlist/gates; ten original runs/counts and immutable image hash intact |
| Credentials/docs | Secret scan passed; changed-document local links and Git whitespace checks passed |

The failed reset assertion was a test-only issue: fresh account IDs are expected
on a new run; financial fields are compared independently. No unresolved failure
remains. Six owned generation-check users and public-smoke fixtures are retained
with password-free evidence in ignored `artifacts/plan008-live-generation-check.json`
(0600). Real SDK collection and dashboard classification were not run this phase.

## Plan 009 — permanent customer deletion

Owner requested plain Delete on each `/controls/customers` card. DEL-01–04 are
complete: protected strict endpoint, user-locked transaction and FK-ordered removal
of all local user/run data, safe repeated deletion, independent link/button,
identified confirmation, cancel/error/pending behavior and filtered-list refresh.
MariaDB's no-op batch upsert is distinguished from first insert, so replay cannot
recreate deleted customers even when the whole batch is gone. No migration needed.

| Check actually run | Result |
| --- | --- |
| `npm test` | **66/66 TAP entries passed**, including deletion auth/CSRF/origin/body/UUID, linked tables, retired/active runs, sessions/login, concurrent repeats/isolation and partial/empty generation retry |
| Focused browser checks | **12/12** at 360/390/1440px: deletion/cancel/error/keyboard, original creation/navigation/reset/independent sessions; deletion rerun **3/3** after adding pending-button assertions |
| Typecheck/build/format | Passed; matched evaluation build 596.13 kB / 173.73 kB gzip; B-011 advisory remains |
| Migration status | Both schemas version 7 without pending changes or drift; no SQL applied |
| Deploy | **2026-10-12T04-47-42-220Z**; matching links, existing evaluation flags and database switch On preserved |
| Public deletion check | 360/1440px cancel/confirm, active/retired run removal, revoked session, surviving customer navigation and partial/empty batch retry; only newly owned fixtures deleted, no Clarity requests |
| Public smoke | Both 360/1440px complete existing banking/features/report/session/reset journeys passed |
| Host/data | Service active/DB healthy/loopback 3100; Nginx syntax and unrelated files/links intact; private runtime permissions/allowlist; original ten runs/counts and uploaded asset hash retained |
| Credentials/docs | Secret scan passed across 110 source/document/build files; changed local links and Git whitespace verified |

An initial live harness reset omitted X-Browser-Session and was rejected with 400.
Corrected the harness and reran successfully; four identified failed-setup fixtures
were removed through the protected endpoint. Successful deletion fixtures are also
removed; retry-protection batch metadata remains. Password-free evidence is ignored
0600 `artifacts/live-delete-check.json`. Public smoke history is intentionally
retained. No unresolved check failure or new real SDK collection remains.

## Owner-requested customer cleanup — Plan 009 follow-up

Deleted **37 of 38 production customers** through the existing protected delete
endpoint, preserving the exact owner-designated username and its stable UUID.
Checked the live admin list against the DB before mutation and verified exactly
one customer remained afterward. Before/after snapshots confirmed the preserved
identity/credentials, all runs, accounts, transactions, enrollments, goals, receipts,
current mapping, saved amounts and preferences were unchanged. Shared banners/
assets, collection settings and anonymous historical runs were also unchanged.
Deleted user ownership/session/preference rows are absent. The temporary admin
session was signed out. No migration, deployment, customer login or analytics
collection was performed. Private password-free evidence: ignored 0600
`artifacts/customer-cleanup.json`; no snapshot contents or credentials were saved.

Earlier owned production smoke/pilot histories for deleted customers have now
been removed by this explicit owner cleanup. Clarity's prior recordings remain
external to the local operation. Public smoke creates customers; it was not run
for this cleanup. The owner has since generated batch 21; inspect the current
cohort rather than relying on earlier test-cohort manifests.

## Plan 010 — admin customer impersonation

Owner approved implementation after reviewing the plan. IMP-01–06 are complete.
Customer details have password-free admin entry; the shared customer shell shows
Viewing as and Exit to Admin immediately above Sign out. Entry ends this browser's
previous customer session; other browsers remain independent. Refresh preserves
mode. Exit returns to the selected admin details, or list for a deleted target;
customer Sign out opens login, preserving admin access. Cross-tab transitions
stop prior collection, clear stale state and direct other customer tabs to Admin.
A context ID plus separate cookie/CSRF prevents stale pages acting on another user.

Hashed sessions bind to initiating admin/target/expiry, with user → admin → session
locks and per-request checks. Customer disable/password/deletion and admin expiry/
logout revoke access. Retry uses an HMAC-derived token to reissue the same cookie,
run and banner after a lost response; ended requests cannot resurrect a session.
Actual banking changes persist. Actor/profile preferences remain unchanged.

Migration 0008 adds two tables, preserving original layouts/data and historical
source interpretation. New visit provenance survives session termination. Default
Adoption/Feature Activity counts exclude impersonation; admin-only runs enter
cohorts after a customer visit using original run-start dates. Source-aware event
keys/first-use checks and context-bound receipts separate real observations.
Customer history labels Admin impersonation. Clarity is server/client excluded,
even with prior consent/capture headers; no analytics prompt appears in this mode.

| Check actually run | Result |
| --- | --- |
| API/native/migration suite | **76/76 TAP entries passed**, including eight impersonation cases and exact committed migration probes; retained visits/layout and repeat/FK checks |
| Banking browser suite | **48/48** at 360/390/1440px; existing state/features/reports/admin/delete/generation behavior |
| Clarity-stub privacy suite | **18/18** at the same widths; nine new impersonation checks, prior-consent cross-tab stop, error/retry and expiry recovery; no real SDK |
| Typecheck/build/format | Passed; matched evaluation bundle 599.45 kB / 174.57 kB gzip; existing B-011 advisory |
| Migration/deploy | 0008 committed **c758cc4**, scoped root-only backup, both ledgers version 8 with no pending/drift, repeats no-op; final release **2026-10-12T06-30-44-829Z** |
| Public HTTPS | 360/1440px entry, CTA/menu/refresh, actual enrollment/goal, correct exit, ordinary login preserving goal and independent sign-outs; two owned fixtures deleted afterward |
| Preservation | Original customer/banking/history/session/settings fingerprints unchanged; shared assets and unrelated Nginx hashes/links intact; active loopback 3100, HTTPS/DB health and release links matched |
| Collection | Zero vendor requests/page errors in live checks; current evaluation flags and global toggle On preserved; no new actual Clarity recording |
| Credentials/docs | Secret scan and local links/Git whitespace checked; runtime allowlist/permissions and root-only recovery files verified |

Initial new tests used an incorrect feature ID/CTA selector and a Human fixture
under the automation-only harness header; corrected. One run was disrupted by an
API hot reload during edits; final complete suites passed. A final exit-error fix
prevents other tabs remaining paused after a failed request; three focused
mobile/desktop recovery checks passed, followed by a rebuilt deployment and
repeated public verification. The live harness first
needed BigInt-safe snapshot serialization and a readiness wait after API restart;
no customer fixture existed in those failed setup attempts. Successful public
fixtures were removed; ignored 0600 `artifacts/plan010-live.json` contains only
password-free results. No unresolved failure, public rollback or real SDK capture
remains. The owner declined an independent OS selector; existing presets remain.

## Plan 011 — verified contextual discovery result

DISC-01–06 complete. The selected EasyCoin and Skip A Pay journeys, saved
preferences, visibility/cooldown/cap rules and independent reporting are deployed.
Broader two-FI/experiment scope remains B-014/B-007; no activation,
money movement or loan servicing is implied by these educational confirmations.

| Check actually run | Result |
| --- | --- |
| API/rules/migrations | **83/83 TAP entries**; new owned-context/strict input/CSRF, concurrent cap, cooldown boundaries, retry attribution, relogin/reset preferences, actor/impersonation separation and exact committed 0009 clean/repeat probes |
| Banking/discovery browsers | **48 existing checks passed** at 360/390/1440px; after the preference loading fix **9/9 new discovery checks passed** on focused rerun |
| Privacy SDK stub | **18 checks covered/passed**: mobile six passed before external SIGTERM; wide/mobile + desktop twelve passed on scoped rerun; no real vendor collection |
| Typecheck/build/format | Passed; matched evaluation profile, main bundle ~622 kB / 179 kB gzip, existing B-011 advisory |
| Migration/deploy | 0009 committed **b3305a6** before test/production apply; both schemas version 9, no drift/pending; repeats no-op; release **2026-10-13T16-23-08-166Z** |
| Live HTTPS | **360/1440px** both invitations, linked feature views/CTAs, ineligible loan suppression, masked payment review/confirmation, preserved accounts and opt-out relogin; report matched one visible/view/CTA per feature for each scoped check |
| Hosting/collection | Service/DB healthy, matched release links, Nginx syntax valid; collection settings unchanged, external requests/page errors zero in public checks; test listeners stopped |
| Credentials/docs | Credential scan passed across **130 source/document/build files**; maintained local links, section structure and Git whitespace checks passed |

Root-only 0600 pre-0009 backup:
`/var/backups/softek/demo-before-0009-20261013T161812Z.sql`. 0009 only creates
tables; do not downgrade/drop them for code recovery. Previous Plan 010 release
retains existing layouts, but does not provide the discovery UI/report. Prefer
forward recovery and consult LOCAL_SETUP before a deliberate rollback.

The public helper created two owned Automation customers and deleted both through
protected Delete after checks; no owner customer was used/reset. Ignored 0600
`artifacts/plan011-live.json` contains password-free evidence. Public screenshots
and the ignored helper are under `artifacts/`; no raw capture data was retained.
Initial test setup mistakenly passed an extra login field/reset request ID; strict
validation rejected them and the harness was corrected. The preference browser
failure exposed controls showing a default choice before the saved setting loaded;
controls are now hidden until loaded. One privacy runner was externally interrupted;
only verified owned test process groups were stopped before the remaining checks.
No unresolved application/check failure remains. Automated recording investigation
and further actual capture remain stopped by owner decision.


## Plan 012 verification — 2026-10-13 UTC

Source commit **99abd9d**. Release **2026-10-13T17-01-20-049Z**, matched API/web
links. Customer Menu opens `/explore`, with the five screenshot groups, full product
names/counts, independently collapsible sections and search. Existing feature
landings/CTAs retain their routes and reporting; catalog entries return to the catalog
without banner/contextual attribution. Admin Menu and collection configuration remain.
No migration: production and test schemas stay at version 9, without pending/drift.

| Check actually run | Result |
| --- | --- |
| Routine browsers | **63/63** at 360/390/1440px; includes six new catalog checks plus existing feature/banner/discovery/controls journeys |
| Privacy SDK stub | **18/18**, vendor requests intercepted; consent, withdrawal, switch and impersonation boundaries preserved |
| API regression | Full run **81/83 passing entries**; the impersonation exclusion assertion assumed zero retained feature activity. Changed it to compare pre-entry counts; focused rerun **9/9** passes, resolving the failed subtest and parent. Other API/migration entries passed unchanged |
| Static/build | Typecheck, format, Git whitespace passed; matched Clarity evaluation build, ~626.75 kB main JS / 180.11 kB gzip (existing B-011 advisory) |
| Responsive review | Catalog screenshots inspected at 360/390/1440px; all rows readable, no horizontal overflow |
| Live HTTPS | At **360/1440px**, deep-link login, search, all twelve feature links/returns, Skip A Pay confirmation and unchanged accounts; each scoped customer had twelve views/one CTA with no banner attribution |
| Hosting/collection | API/DB healthy, Nginx syntax valid, matching release links, no dev/test listeners. Live checks had zero external requests/browser errors and verified collection settings unchanged |
| Documentation/credentials | 86 local link targets and Git whitespace passed; credential scan passed across 121 source/plan/build files plus 10 root documents |

Live helper created two owned Automation customers and deleted both through the
protected Delete endpoint, without using/resetting owner accounts. Password-free
0600 evidence: ignored `artifacts/plan012-live.json`; helper/screenshots/logs also
remain ignored. Missing automated recordings remain an accepted limitation;
no actual Clarity capture or investigation was performed for this release.

### CAT-05 title follow-up — 2026-10-13 UTC

Source **9235495**, release **2026-10-13T17-23-41-174Z**. Page/browser titles now
use EasyVest Automated Investing, EasyVest Self-Directed Investing, EasyCoin
Cryptocurrency and Small Business Invoicing. Shared banner/report labels follow
these names; IDs, paths, headlines and CTA behavior remain unchanged.
Typecheck, format, evaluation build and **9/9 focused browser checks** passed at
360/390/1440px (all-twelve feature journey plus EasyCoin discovery/opt-out).
Live HTTPS verified all twelve headings/links at 360/1440px, with screenshots of
the four updated titles; API/DB health and release links matched. The two owned
Automation fixtures were deleted; zero external requests/page errors, accounts
and collection settings unchanged. Evidence: ignored 0600
`artifacts/feature-titles-live.json`. No migration or actual vendor capture.

## Plan 013 verification — 2026-10-13 UTC

Source **bdd15e1**, release **2026-10-13T17-57-03-153Z**. Three read-only account
pages use saved balances/identity, existing owned activity and deterministic labeled
statement examples. `/api/state` adds `accountId` to transactions for association;
no migration or retained-data seed/update. Checking, savings and credit information
are masked, with bounded banking page-view tags; no feature/adoption event on view.

| Check actually run | Result |
| --- | --- |
| API/rules/migration regression | **83/83 TAP entries**, including existing funding, ownership, persistence, feature separation and bounded account route context |
| Routine browsers | **69/69** at 360/390/1440px, including six new account journeys; saved balance/activity updates after real demo goal funding, relogin/customer isolation, sample refresh stability, banner preservation and no ledger changes on view |
| Focused privacy SDK stub | **3/3** consent/masks/withdrawal/admin/shared-browser journeys; each visits all three accounts to verify mask containers and banking-only tags; no actual vendor loaded |
| Static/build | Typecheck, format, Git whitespace and matched evaluation build passed; main JS 638.24 kB / 182.28 kB gzip (existing B-011 advisory) |
| Schema/hosting | Production/test schema 9, no pending/drift; matched API/web release links, active service, DB/public HTTPS health and Nginx syntax passed; no test/dev listeners remain |
| Live HTTPS | **360/1440px**: direct-login path, all three widget/detail links, exact balances and saved activity, stable sample rows on refresh, masked information, Summary return/banner retention; no financial writes or feature observations |
| Documentation/credentials | 88 local link targets and credential scan across 136 source/document/build files passed before deployment; final handoff links/whitespace checked |

Two owned live Automation users were created/deleted through protected controls;
owner accounts and global collection settings were untouched. External requests and
browser errors were zero. Password-free 0600 evidence is ignored
`artifacts/plan013-live.json`; the helper and screenshots/logs remain ignored.
Mobile and desktop screenshots were inspected. Initial new-test navigation raced
the logout document transition; waiting for the sign-in form resolved the harness
failure, with six focused and all 69 routine checks passing afterward. No unresolved
application/check failure remains. Explore links are B-015 discussion scope only.

### DETAIL-05 savings layout follow-up — 2026-10-13 UTC

Source **74ddd64**, release **2026-10-13T18-19-30-775Z**. Savings balance card
removes the generic heading/subtitle/icon, positions the separately masked last-four
number upper-right and places the balance/available-balance label lower-left.
Typecheck, format, evaluation build and **6/6 focused account browser checks** passed
at 360/390/1440px. Mobile/desktop savings screenshots inspected; live HTTPS at
360/1440px verified balances/history, sample refresh, route/return/banner behavior,
number masking and zero vendor requests/errors. Both owned fixtures deleted and
collection settings unchanged. Ignored 0600 `artifacts/savings-layout-live.json`
holds password-free evidence. API/DB health and matching release links verified.
Focused SDK-stub assertions reported **3/3**; the initial npm parent exited 143
with no test failure or remaining listeners. Direct CLI confirmation passed **3/3**
with exit 0; no unresolved check failure remains.

### DETAIL-06 savings card consolidation — 2026-10-13 UTC

Source **42eef8f**, release **2026-10-13T18-35-10-471Z**. Personal Savings is
upper-left, masked last-four upper-right, Interest 1.25% / Compounded Monthly
middle-left, balance/label lower-left. Savings Account Information is removed;
Recent Activity uses the full width. Terms remain fictional display examples.
Typecheck, format and evaluation build passed; **6/6 focused account journeys**
at 360/390/1440px, then **2/2 visual reruns** after tightening rate-line spacing,
and **3/3 consent/masking SDK-stub journeys** passed with exit 0. Screenshots
inspected. Live HTTPS 360/1440px confirmed the new labels, absent information
widget, masking, unchanged owned balances/history, stable samples and return/banner
behavior. Zero external requests/errors, collection settings unchanged, both owned
fixtures deleted. API/DB health and release links matched; no test listeners.
Evidence: ignored 0600 `artifacts/savings-content-live.json`. No migration/capture.

### DETAIL-07 credit card consolidation — 2026-10-13 UTC

Source **49a2acf**, release **2026-10-13T18-58-19-642Z**. Savings/credit share
compact-card styling. Credit Card is upper-left, masked number upper-right;
Available Credit/Credit Limit are middle, current amount owed lower-left. Credit's
Account Information panel is removed and Recent Activity uses the full width.
The fictional credit limit and available-credit calculation are preserved.
Typecheck, format, evaluation build, **6/6 account browser checks** at 360/390/1440px
and **3/3 consent/masking SDK-stub checks** passed, all with exit 0. Screenshots
inspected. Live HTTPS 360/1440px verified labels, removed panel, masked number/
credit figures, exact owned balances/history, stable samples and return/banner
behavior. Zero external requests/errors, collection settings unchanged and both
owned fixtures deleted. API/DB health and matched release links verified; no test
listeners remain. Evidence: ignored 0600 `artifacts/credit-layout-live.json`.
No migration or real vendor capture; Explore placements still await discussion.

### DETAIL-08 checking card consolidation — 2026-10-13 UTC

Source **850839f**, release **2026-10-13T19-57-01-817Z**. All three account pages
now share compact-card styling. Personal Checking is upper-left, masked number
upper-right and available balance/label lower-left. Its separate Account Information
panel is removed, with full-width Recent Activity immediately below.
Typecheck, format, evaluation build, **6/6 account browser checks** at 360/390/1440px
and **3/3 consent/masking SDK-stub checks** passed with exit 0. Screenshots inspected.
The initial account run caught an accidentally broadened test assertion; its original
checking exception was restored before the successful full focused rerun.
Live HTTPS 360/1440px verified labels, removed panel, masks, exact owned balances/
history, stable samples and return/banner behavior. Zero external requests/errors,
collection settings unchanged and both owned fixtures deleted. API/DB health and
matched release links verified; no test listeners remain. Evidence: ignored 0600
`artifacts/checking-layout-live.json`. No migration or real vendor capture;
Explore placements still await discussion.

## Plan 014 verification — 2026-10-13 UTC

Source **815cbe3**, release **2026-10-13T20-28-58-806Z**. Removed the large Summary
linked image; account widgets now start beneath its header. Shared inactive More
ways to bank strips follow Summary accounts and each detail balance card, above
Recent Activity. Shared height token: balance cards minimum 210px, strips 105px;
full padded content width, mobile and desktop. No link/image/exposure/click; Summary
Clarity tags carry no invisible banner/feature/campaign context. Admin creatives,
selection persistence and historical attribution remain; future rotation is B-016.
The public smoke was adapted to retained selections and the active Goals sidebar.

Typecheck, format, evaluation build and documentation links/diff checks passed.
**54 distinct account/banking browser cases** at 360/390/1440px passed across
batches/reruns, plus **eight SDK-stub privacy checks** (all six mobile scenarios
and consent/masking on wide-mobile/desktop). Screenshots inspected. An obsolete
login helper initially matched two elements after both pages gained strips; fixed.
An interrupted browser parent left test-only fixtures and duplicate upload labels;
removed 12 owned test users/three uploads from `demo_test`, completed remaining
cases and reran failed checks successfully. No unresolved check failure or test
listener remains. Broad 83 API/69 browser results above are earlier Plan 013 evidence,
not a claim of rerunning those whole suites for this change.

Live HTTPS 360/1440px verified all four placements, full width/half-height, absence
of old linked artwork/actionable content, masked owned balances/activity, stable
samples, reload/return and retained selection behavior. Banking/global collection
settings unchanged; no banner visibility/click/feature observations, external
requests or browser errors. Both owned Automation fixtures deleted. API/DB health,
active service and matched API/web release links verified. No migration or real
vendor capture. Evidence: ignored 0600 `artifacts/strip-layout-live.json` and
`artifacts/strip-*.log`; logs/helpers/screenshots remain uncommitted.

## Plan 015 verification — 2026-10-13 UTC

Owner chose **admin controls only** and clarified that each page name is a banner
space header. Source/migration **c8f4204**, verified UI/test follow-up **b52045c**;
release **2026-10-13T20-55-23-121Z**. Feature Explorer is the fifth Admin Menu/Home
entry, with four space sections, twelve catalog choices, widget-title configuration,
read-only/copyable automatic URL, mobile upload/preview/replacement, accessible
text/order and inclusion in future rotation. Image-less inclusion is rejected.
No customer reader, artwork activation, rotation, impressions or CTA attribution
was introduced. Plan 014 customer placeholders remain inactive.

| Check actually run | Result |
| --- | --- |
| API/migration suite | `npm test`: **88 TAP entries passed**, including five new Feature Explorer entries; no failure/skip |
| Browser | **9/9**: new admin configuration and both account journeys at 360/390/1440px; persisted artwork/settings/URLs, four spaces, menu/Home, no overflow/errors; screenshots reviewed |
| Privacy | **3/3** consent/masking SDK-stub journeys crossing into `/controls/feature-explorer`; admin excluded and masked, no real Microsoft capture |
| Build/quality | Typecheck, format, evaluation build and documentation link/diff checks passed; existing bundle advisory remains B-011 |
| Migration | 0010 committed before application, tested on `demo_test`, then applied to retained `demo`; both ledgers version **10**, no pending/drift, repeats no-op; one additive unseeded table |
| Backup | Root-only 0600 `/var/backups/softek/demo-before-0010-20261013T205047Z.sql`, including schema/data/ledger |
| Live HTTPS | Admin spaces/configuration at 360/1440px; a valid >32 KiB PNG crossed the new scoped Nginx upload allowance; actual WebP preview, saved settings and derived URLs verified |
| Customer boundary | Own customers on Summary and three account details retain non-actionable placeholders, unchanged owned balances/history/goals, no new banner/feature observations; global collection settings unchanged |

Initial browser test assumed an Admin Home menu item that does not exist; corrected
the test to close the menu and open the Home route, then all nine checks passed.
No unresolved failure or dev/test listener remains. Live checks removed only their
own eight widgets, two assets and two Automation customers; no configuration was
seeded for retained customers. Production widget table is empty after cleanup.
No external requests/browser errors; matched release links, active service and API/
DB health verified. Evidence: ignored 0600 `artifacts/explorer-live.json`; helpers,
logs/screenshots remain ignored. New runtime-table data remains independent of
legacy banner history and account state. Customer rotation is still explicitly
owner-deferred (B-016), with further contextual placements separate (B-015).

### EXP-06 widget deletion — 2026-10-13 UTC

Source **01f082a**, release **2026-10-13T21-16-17-030Z**. Confirmed Delete appears
on each feature widget row and its configuration page. The private admin endpoint
locks and permanently deletes only the selected row/settings; repeated deletion
succeeds. Shared catalog pages, other spaces and immutable artwork remain; the
feature may be re-added with fresh settings. Configuration deletion returns to
Feature Explorer; errors preserve the current UI for retry.

Focused API **6/6 TAP entries** and browser **6/6 journeys** at 360/390/1440px
passed: access/CSRF, scoped deletion, immutable images, repeat requests, cancellation,
failure/retry, persistence and re-adding. Initial API assertion expected 401 for an
unauthenticated POST; existing CSRF middleware correctly returns 403, so the test
was corrected and passed. Typecheck, format and evaluation build passed; screenshots
reviewed. No full API or privacy-suite rerun was needed for this admin-only follow-up.
Live HTTPS 360/1440px verified row/configuration cancellation/deletion, correct
return, unaffected other space, restored catalog choice and idempotent retry.
Only four newly created fixtures were deleted; original configuration/global Clarity
settings matched before/after. No external requests/errors or test listeners; API/DB
health, active service and matched release links verified. Schema stays **10**;
no migration/customer activation. Ignored 0600 evidence:
`artifacts/explorer-delete-live.json`; checks/logs/screenshots remain ignored.

## Plan 016 verification — 2026-10-14 UTC

Source/migration **0cbb1cb**, acceptance tests **fe66eea**, public smoke adaptation
**e204138**, admin-preview cursor preservation **ba786dd**. Current release
**2026-10-14T00-11-24-262Z**. Owner's three enabled Summary widgets (Identity
Protection, Small Business Invoicing, Youth Banking) now appear one at a time in
saved order, with login/refresh rotation and exact menu/tab selection restoration.
Actual uploaded artwork stays proportional in the compact strip. Customer account
pages retain placeholders. Reporting reuses owned immutable snapshots/feature
observations without Savings Goals campaign attribution; Clarity context uses loaded
artwork, clears on exit, and respects existing consent/collection gates.

| Check actually run | Result |
| --- | --- |
| API/migration suite | **94 TAP entries passed**, no failures/skips; ordering/concurrent retry, ownership/tabs, legacy separation, deleted/disabled/empty recovery, immutable CTA attribution and unchanged banking |
| Browser | **18/18** at 360/390/1440px: Summary rotation/link/visibility/CTA/fallback, existing account journeys and Feature Explorer creation/deletion; screenshots inspected |
| Privacy | **6/6** SDK-stub checks at all three widths: existing consent/masks/admin/shared identity plus loaded Summary tags/events and account-route clearing; no real Microsoft requests |
| Build/quality | Typecheck, formatting and evaluation build passed; existing bundle advisory remains B-011; documentation links/diff checked |
| Schema | 0011 committed before applying to test/demo; both version **11**, no pending/drift, repeat production application no-op; root-only 0600 backup `demo-before-0011-20261014T000207Z.sql` includes schema/data/ledger |
| Live HTTPS | 360/1440px: all three owner images loaded, exact order/wraparound, correct feature links/CTA attribution, qualified visibility, stable returns, inactive account slots and unchanged banking |
| Admin preview | Live impersonation of own fixtures retained the current banner/cursor and returned correctly to Admin; capture excluded |

No owner widget/settings/image was changed; before/after configuration/global Clarity
settings and all three artwork SHA-256 values matched. Only two new Automation
customers were used and deleted, with their banking/events/presentations/cursors.
Zero external requests/browser errors in live checks; matched release links, active
service and API/DB health verified; no test listeners remain. Ignored 0600 evidence:
`artifacts/summary-banners-live.json`; logs/helpers/screenshots remain ignored.
Public smoke accepts the active compact banner or empty placeholder. The generic
banner-click pilot can find the slot again, but was not run or sent to Microsoft.
Broader banking/privacy-suite counts above are historical evidence, not additional
reruns for this phase. Other banner spaces and the recording inquiry stay deferred.

## Plan 017 verification — 2026-10-14 UTC

Migration **9a167b6**; implementation **f00c785**; final acceptance **6fa782e**.
Release **2026-10-14T15-32-53-693Z**. PHX-01–07 complete; source and runtime preserve
Clarity calls/consent while tracing is Off. No Microsoft pilot or owner recording
investigation was run. Earlier checks above remain historical evidence.

| Check actually run | Result |
| --- | --- |
| API/migration | **110 TAP entries passed**, no failures/skips; adapter fidelity, strict context/ownership, consent/actor/impersonation, retries/conflicts, terminal close, reset/deletion and additive/repeat schema |
| Browser/privacy | **12/12**, 360/390/1440px: new mirror/audit-failure journey, existing consent/masking/shared identity, impersonation stopping, Summary tags/events; hosted SDK stubbed and no real Microsoft traffic |
| Real Phoenix | **13/13** focused checks with isolated port-6008 instance; accepted MariaDB arguments/event ID matched REST readback and generic span Attributes in real UI; HTTP failure, partial rejection, timeout and expired lease covered |
| Capacity | 200 synthetic identities × 100 calls acknowledged/persisted in isolated SQLite; initial 20-second REST readback was incomplete while insertion drained, later read-only counts confirmed 20,000; collector-only evidence, not a full banking cohort/production throughput claim |
| Quality | Typecheck, format check, evaluation build and diff/link checks passed; existing bundle advisory remains B-011 |
| Schema | test/demo version **12**, no pending/drift; repeat production application no-op; private 0600 schema/data/ledger backup `demo-before-0012-20261014T153200Z.sql` |
| Live HTTPS | 360/1440px admin control ready/Off, no overflow, customer Summary banner and feature CTA work; zero diagnostic/vendor calls/browser errors; original user/widget/collection/tracing fingerprints unchanged; two owned Automation fixtures created/deleted |
| Host | matched API/web release links, API/DB health, active scoped API/Phoenix services, loopback-only Phoenix HTTP and no new gRPC/public ingress; isolated test collector stopped |

Evidence is ignored: `artifacts/phoenix-live.json`, `phoenix-real-span.png`,
`phoenix-volume.json` and `plan017-*.log`. Invocation/queued/collector acknowledgment
are explicitly distinct from Microsoft receipt/processing. Browser delivery is
best effort with bounded losses; remote Phoenix copies can outlive local deletion
or an in-flight request and expire independently. No push or rollback performed.

## Exact resume point

1. Read AGENTS/START_HERE, state and PRODUCT; inspect actual Git and live release.
   Plan 017 is delivered Off. If the owner wants to inspect calls, use Admin →
   Clarity Settings to enable the independent switch and private port-6006 forwarding
   documented in LOCAL_SETUP. Customers still need analytics consent. Do not infer
   raw SDK upload observation or resumed recording investigation from this delivery.
2. Plans 013/014/015/016 are complete and deployed; verify live release/schema/Git
   before new work. Walk through Summary's three ordered feature banners and their
   links/report attribution. Account detail banner slots remain inactive; discuss
   their activation and wider Explore placements (B-016/B-015) before implementing.
   Existing `/savings` education and `/loans` journeys retain their one-per-visit
   invitation cap, independent of Summary banners. Wider institution configuration
   remains deferred; do not infer authorization from the broader supplied brief.
3. Both feature-menu captures are complete. Owner accepts automated Dashboard
   activity plus human saved recordings and ended the missing-recording inquiry.
   Await the next priority; do not resume consent/shutdown experiments or support
   escalation unless explicitly reopened. Plan 003 and broader profile validation
   remain deferred. Keep existing presets; no OS selector is requested.
4. Plan 016 restores the linked Summary slot; the generic banner-click pilot can
   find it again. If owner explicitly requests recording evaluation, use
   `clarity:pilot -- --collect` with
   explicit pair flags or `--customer=UUID` and private PILOT_CUSTOMER_PASSWORD.
   Verify actual dashboard classification/recordings/masks/heatmaps, not just
   uploads. Bot Detection is owner-reported Off as of 2026-10-12 UTC; the pilot's
   evidence label already reflects that owner-reported setting.
   OS identities are preset-derived; no independent OS selector is implemented.
   Verify user agent/platform consistency and actual Clarity classification before
   claiming OS emulation acceptance. Owner has reported mouse playback; Chris
   remains deferred until the owner says the demo is ready.

## Git and operational handoff

Prior menu commit **162be9d**; committed 0004 migration **d0ec4c6**; initial feature
implementation **bd6a774**; consent modal **a145d30**; 0006 migration **de1f8e1**.
0007 migration **7eb7290**. Plans 005/006/007/008/009/010/011/012/013/014/015/016/017 and the current Clarity implementation/checks/docs are
committed locally on `main`; Plan 013 application **bdd15e1**; Plan 012 application **99abd9d**; Plan 011 application **0d7fbd8**, SQL/plan **b3305a6**; Plan 010 application **b00d520**, SQL **c758cc4**; inspect `git log -1` for the latest handoff commit. **No push** was made. Origin is
`https://github.com/cnm4us/softek.git`. Only user-provided `temp/` remains untracked
and untouched. Plan 017 source/migration/acceptance is committed; final durable
documentation is included in the handoff commit (inspect `git log -1`). No push
was made. Ignored artifacts hold screenshots/manifests and owned checks.
No credentials are committed; production intentionally continues running.
LOCAL_SETUP owns backup/rollback/renewal, TESTING owns commands and cleanup boundaries.
