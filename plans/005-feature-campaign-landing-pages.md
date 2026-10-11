# Plan 005 — Feature campaign landing pages

Plan ID: **005**. Task IDs: **FEAT-01–09**.
Depends on [Plan 001](001-login-layout-and-banners.md) and
[Plan 004](004-admin-and-customer-menus.md).
Lifecycle and current request: [PROJECT_STATE.md](../PROJECT_STATE.md#plan-status-registry).

The user requested a detailed implementation plan after approving an **Explore
Features** submenu, one primary CTA per landing page, confirmation-only behavior,
and feature/CTA tracking separate from the existing Savings Goals adoption funnel.
The user subsequently authorized implementation and deployment.

## Approved outcome and scope

- Keep the mobile-first Harbor theme and separate Admin and Customer menus.
- Add all twelve supplied campaigns under Customer Menu → Explore Features.
- Each menu item opens its authenticated feature landing page. The same page is
  selectable as a banner destination in Manage Banners.
- A landing page has a feature section title, supplied headline, basic description,
  benefits, one primary CTA, applicable supplied disclosure, and visible demo context.
- Activating the CTA gives an inline confirmation only. It creates no enrollment,
  account, application, credit inquiry, investment order, payment, or banking change.
- Promotional banners remain on **Account Summary only**. Feature landing and
  confirmation states do not render a rotating banner. Existing Summary promotion
  placement, rotation, persistence, and Savings Goals behavior remain intact.
- Record feature views and CTA clicks by feature, customer/run/visit, and actor.
  These are engagement observations, separate from confirmed Savings Goals adoption.
- Preserve independent sessions, data/history, admin privacy, and collection-off
  defaults. Real Clarity capture remains [Plan 002](002-clarity-validation.md).

Source: user-provided `temp/banking-features.md`. An unchanged durable reference is
saved as [feature campaign copy](references/005-banking-feature-campaigns.md).
The source explicitly labels hypothetical/unverified details as demo copy; this
plan does not independently verify Access Digital product capabilities. Keep the
existing fictional Harbor branding and the supplied feature/product names.

This phase uses existing admin image uploads. The report's visual concepts are
retained for artwork preparation; generating/uploading twelve new creatives or
changing the enabled banner set automatically is outside this implementation scope.
Secondary CTAs and the source's `/demo/.../enroll`, `/apply`, `/activate`, etc.
destinations are superseded by the approved single-CTA inline confirmation.

## Feature catalog and routes

Menu wording and route structure below are the implemented working choices. IDs preserve the
source report's identifiers and remain stable across menu, banner, events, and
later automation. **Savings & Certificates** is distinct from existing **Savings Goals**.

| Feature ID | Customer submenu label | Landing route | Primary CTA |
| --- | --- | --- | --- |
| `easycoin` | EasyCoin Crypto | `/features/easycoin` | Explore Crypto Investing |
| `easyvest-auto` | Automated Investing | `/features/easyvest-auto` | Build My Investment Plan |
| `easyvest-choice` | Self-Directed Investing | `/features/easyvest-choice` | Explore Stock Trading |
| `credit-monitor` | Credit Score Monitoring | `/features/credit-monitor` | View My Credit Score |
| `identity-protect` | Identity Protection | `/features/identity-protect` | Explore Identity Protection |
| `bnpl` | Buy Now, Pay Later | `/features/bnpl` | Explore Payment Plans |
| `auto-loan` | Auto Loans & Refinancing | `/features/auto-loan` | Explore Auto Loan Options |
| `savings` | Savings & Certificates | `/features/savings` | Explore Savings Options |
| `instant-pay` | Instant Payments | `/features/instant-pay` | Explore Instant Payments |
| `skip-pay` | Skip A Pay | `/features/skip-pay` | Check My Eligibility |
| `youth-banking` | Youth Banking | `/features/youth-banking` | Explore Youth Accounts |
| `business-invoice` | Business Invoicing | `/features/business-invoice` | Start Sending Invoices |

Landing copy uses the source's full product names where appropriate, including
EasyVest. Youth Banking addresses adult parents/guardians. No new demographic
profile, product eligibility model, or real personal-information form is needed.
All authenticated demo customers can explore the pages, including customers
ineligible for the separate Savings Goals service; no feature eligibility is implied.

## Inspected baseline and design choices

- `apps/web/src/shell.tsx` provides the shared flat, focus-contained dialog/menu.
  Its keyboard focus query already handles links/buttons, but active styles and
  navigation will need to account for nested links and a disclosure control.
- `apps/web/src/revision.tsx` owns customer section/route keys, Summary banner
  presentation, and interaction observations. `main.tsx` owns banking routes and
  customer bootstrap; admin routing/session ownership is independently implemented.
- `apps/api/src/revision.ts` owns the internal banner destination allowlist and
  interaction validation. Expanding the frontend alone would leave new routes
  rejected by the API and unavailable in the banner editor.
- `interaction_events.name` currently has six ENUM values. Feature observations
  require a committed additive migration, expected next version **0004**.
  Existing `route_key`, `target_key`, page/run/visit/selection references and
  dedupe keys can support this phase without new financial-product tables.
- The existing Clarity adapter hardcodes Savings Goals service/campaign context
  and has a bounded route allowlist. New features need accurate bounded context
  and explicit clearing when navigating away, even though collection stays off.
- The scenario contract under `scripts/lib/journey-scenarios.ts` currently names
  only existing banking sections. Extend feature navigation without building a
  scheduler or runner in this phase.

Use a shared, typed catalog accessible to frontend and API for public IDs, menu
names, landing routes, and CTA labels; keep marketing descriptions in the frontend
catalog if that gives a simpler build boundary. Avoid separate hand-maintained
lists drifting between banner validation, routing, analytics, and automation.
A single reusable landing component supplies the visual structure for all twelve.

## FEAT-01 — Establish the feature catalog and route contract

- [x] Implement the twelve stable IDs, menu labels, full names, landing copy,
  benefits, primary CTA labels, and supplied disclosures from the frozen report.
- [x] Define allowlisted `/features/:featureId` routing, static section/document
  titles, banner destination keys, and safe analytics/automation identifiers.
- [x] Preserve existing bank routes and the distinct Savings Goals service.
- [x] Handle missing/unknown feature IDs with a clear return link, without events
  tagged to invented IDs. Direct/reload/back/forward routes require customer auth.
- [x] Keep feature URLs free of usernames, free text, or private banking identifiers.

**Acceptance:** every listed ID resolves to one consistently named page and banner
option; unknown IDs are rejected or show a useful missing-page state.

## FEAT-02 — Add the Explore Features submenu

- [x] Add a Customer Menu disclosure button labeled **Explore Features**, with
  expanded state, controlled submenu, and twelve links in report order.
- [x] Use ordinary links/buttons inside the existing Customer Menu dialog rather
  than a second modal. Keep Admin Menu contents unchanged.
- [x] Expand the group on a feature route; show the selected child as active with
  `aria-current`. Opening the group does not navigate or advance a banner.
- [x] Preserve keyboard Tab/Shift+Tab containment through expanded links, Enter/
  Space disclosure operation, Escape/outside-close, close-on-link-selection,
  hamburger focus return, and main-content focus after navigation.
- [x] Keep the entire menu vertically scrollable at 360px width and short viewport
  heights, with readable long labels and at least 44px primary touch targets.
- [x] Preserve existing banking menu observations; record feature selections using
  stable allowlisted keys without counting group expansion as a feature view.

**Acceptance:** mobile/desktop users can open Explore Features, choose any page,
return to Account Summary, and use existing banking/admin navigation independently.

## FEAT-03 — Build shared landing pages and confirmation-only CTAs

- [x] Render the shared Harbor section shell, source headline/description/benefits,
  supplied disclosure where present, and one prominent primary CTA per page.
- [x] Keep rotating banners on Account Summary; provide an unobtrusive return link
  and the normal hamburger on feature pages. Do not add a second campaign CTA.
- [x] Show a feature-specific inline confirmation on CTA activation, with an
  accessible status announcement and clear simulated-action wording. For example:
  “Thanks for exploring [feature]. This demo does not activate a service or submit
  an application.” Never claim a credit score was retrieved or eligibility checked.
- [x] Persist the CTA observation through the protected API before reporting it as
  recorded. Handle pending/error/retry states and repeated activation without
  misleading success or duplicate counts; retry keeps the same request identity.
- [x] Confirmation state is local to the current page entry; a later visit/reload
  can exercise the CTA again. It is not persisted enrollment/activation state.
- [x] Preserve balances, goals, enrollment, run identity, and banner sequence on
  feature navigation and CTA actions. Collect no new personal or financial inputs.

**Acceptance:** all twelve pages have their supplied content and one working CTA;
clicking confirms only a demo action, while saved banking state is unchanged.

## FEAT-04 — Extend banner destinations and precise entry context

- [x] Extend the server-owned destination list and admin picker with all twelve
  feature landing pages. Keep external/raw URL destinations rejected.
- [x] Keep existing uploads, internal destinations, ordering, enable/disable,
  replacement, public immutable assets, and saved presentation snapshots working.
- [x] Feature banners do not carry the Savings Goals campaign association. Retain
  the current savings-only campaign validation and existing adoption trigger rules.
- [x] Retain once-per-login/full-Summary-document rotation and independent tab
  selections. Menu/feature returns, CTA actions, and API reads never advance it.
- [x] When arriving through a banner, carry the exact selected presentation as
  bounded per-tab navigation context. Validate user/run ownership and destination
  against the immutable presentation before attaching it to feature observations.
- [x] Menu/direct entry has no banner attribution, even if a previously displayed
  banner points to that feature. Clear stale context on a new entry/account/reset;
  a reload may retain context only when it still belongs to that same landing entry.
- [x] Preserve original banner visibility/click evidence on Account Summary.

**Acceptance:** an admin can target a feature with an uploaded banner; a click
lands on the correct page. Attribution never uses another tab/user's selection
or simply guesses from the current/last banner.

## FEAT-05 — Persist separate feature observations and expose activity

- [x] Define `feature_viewed` and `feature_cta_clicked` as engagement observations
  in `interaction_events`, separate from `adoption_events` and service enrollment.
  Record stable feature ID in the route key, with current run/visit/page and optional
  validated banner presentation. Derive user and human/automation actor server-side.
- [x] Create `0004_feature_interactions.sql` (or the next available version after
  status inspection), appending the new ENUM values while preserving existing
  values/order/data. Add an index only if the planned queries justify it.
- [x] Document MariaDB implicit-commit recovery, commit SQL before applying, and
  check exact target/status on `demo_test` and `demo`. Back up retained production
  data/ledger before the ALTER; do not modify applied 0001–0003.
- [x] Extend strict protected interaction validation for feature IDs/actions,
  same-origin/CSRF, current ownership, event time, and safe optional attribution.
  Reject unknown IDs, wrong-area actions, and cross-user/stale presentation context.
- [x] Deduplicate a feature view per page entry and CTA activation per page entry/
  request identity. StrictMode effects, rapid double clicks and network retries
  must not inflate events; returning to a feature creates a fresh page entry.
- [x] Make ordinary `page_view` and feature observations explicit distinct metrics;
  a landing view must not be counted twice by adding both event types together.
- [x] Add a protected **Feature Activity** section within Adoption Report using a
  dedicated API query. Show per-feature landing views and CTA clicks, with raw
  event totals distinguished from distinct users/runs. Reuse actor/variant/UTC
  cohort/observation-cutoff filters and retained history. Label these as engagement,
  not adopters, enrollments, eligibility, or confirmed use.
- [x] Keep Savings Goals report queries, denominators, and ordered funnel unchanged.
  Extend bounded selected-customer activity display to name the new observations.

**Acceptance:** database/API/report counts reconcile for click, skip, return, retry,
and reset cases. Feature activity changes no Savings Goals milestone or banking row.

## FEAT-06 — Prepare accurate Clarity context and automation controls

- [x] Allowlist feature routes and emit feature view/CTA observation events through
  the existing gated adapter after API acknowledgement; distinguish them from
  backend-confirmed Savings Goals business events.
- [x] Set bounded feature/route context and correct service/campaign/banner context.
  Clear/reset feature and attributed-banner values when leaving a feature; do not
  tag a menu/direct entry with a previously selected Summary banner or savings
  campaign. Keep stable pseudonymous user/run/visit identity and private-data masks.
- [x] Keep all admin descendants excluded, visitor opt-in behavior intact, and
  backend/build/deploy collection flags off. Existing live-capture acceptance in
  Plan 002 must use these final pages and submenu when collection is later enabled.
- [x] Extend the typed scenario contract to select a stable feature ID via the
  submenu and exercise or skip its primary CTA. Keep existing banking scenario
  names compatible, with stable accessible controls for later automation.
- [x] Add no scheduler, scenario-builder UI, automated traffic expansion, or real
  collection deployment to this phase.

**Acceptance:** collection-off checks remain quiet; adapter tests with a local stub
show correct allowlisted context and clearing. No claim of real playback/heatmap
acceptance is made until Plan 002 validates it in the actual Clarity project.

## FEAT-07 — Meaningful migration, API, browser, and HTTPS checks

- [x] Verify migration clean/upgrade/repeat application and unchanged old rows/ENUM
  values using the dedicated test schema and committed-migration workflow.
- [x] API tests cover feature/action allowlists, auth/CSRF/ownership, idempotency,
  time validation, attribution, actor separation, report cutoff/history, and zero
  changes to banking balances/enrollment or existing savings adoption counts.
- [x] At 360/390/1440px visit all twelve pages and activate each primary CTA; inspect
  content, one-CTA structure, confirmation, no banner, no overflow, and static titles.
- [x] Exercise submenu expansion/active state/keyboard/short viewport scrolling,
  customer sign-in/direct links/reload/back/forward/unknown feature, and both sessions.
- [x] Exercise banner-to-feature versus menu/direct entry, CTA click versus skip,
  rapid/retried activation, return visit/reset, and independent-tab attribution.
  Verify no rotation advance on feature/CTA/menu navigation.
- [x] Use owned test fixtures and uploaded artwork; remove only those fixtures.
  Preserve existing full banking/admin regressions and no-Clarity-request checks.
- [x] Run typecheck/build/format and applicable API/browser suites; visually inspect
  representative landing/submenu/confirmation/report screenshots at mobile/desktop.
- [x] Extend the public HTTPS smoke with a dedicated automation customer and safe
  feature CTA, returning to Summary and checking persisted banking state. If testing
  a temporary production banner destination, restore only that owned fixture's
  configuration and retain immutable published artwork/history.

**Acceptance:** checks demonstrate feature engagement and a complete banner/menu
journey without altering the established banking, reporting, or privacy behavior.

## FEAT-08 — Release and fresh-agent handoff

- [x] Update PRODUCT/ARCHITECTURE with implemented catalog/routes/tracking semantics;
  update LOCAL_SETUP/TESTING with actual migration, admin destinations/report, and
  verification procedures. Preserve the frozen content reference.
- [x] Apply only the reviewed committed migration after test acceptance and a scoped
  production backup. Verify no pending/checksum drift before the normal deployment.
- [x] Deploy through the existing scoped process once implementation is requested;
  keep Clarity off, persistent assets/data, and unrelated host resources intact.
- [x] Verify actual HTTPS child-route refresh, feature/CTA report observations,
  saved banking state, migration status, service health, and unrelated Nginx hashes.
- [x] Record release IDs and validate prior-app compatibility with the appended
  ENUM values before naming a rollback target. Keep new observations/schema/history;
  do not downgrade the database. Old app rollbacks will not expose feature routes.
- [x] Update FEAT checkboxes and the canonical status registry with actual evidence,
  commit implementation locally, and leave the exact Plan 002 resume task. No push.

**Exit criteria:** twelve authenticated feature pages can be reached from the
Explore Features submenu or a Summary banner; one CTA per page yields only a demo
confirmation; separate per-feature view/click observations and admin activity are
accurate; mobile/desktop, session/data/rotation, and privacy regressions pass on the
live demo. Actual Clarity recording/heatmap acceptance remains Plan 002 work.

## Completion evidence — 2026-10-11

FEAT-01–08 implemented and deployed as **2026-10-11T21-30-01-050Z**.
Migration 0004 was committed in **d0ec4c6** before applying to test/production.
The scoped 0600 production backup is
`/var/backups/softek/demo-before-0004-20261011T212954Z.sql`; both ledgers are
version 4, no pending/drift, repeat no-op. Existing ENUM rows/ordinals were
verified on an owned test probe. Prior authenticated API release
**2026-10-11T19-49-23-608Z** passed schema-4 state/report/activity compatibility
with both feature values present; rollback was not performed and loses new routes.

40 API/migration/context TAP entries passed. Browser coverage is 39 journeys at
360/390/1440px: 36 initial passes plus three corrected destination-picker selector
reruns, all passing. Typecheck/build/format passed. HTTPS smoke passed at 360/1440px
with exactly two owned feature views/one CTA, preserved banking/run/banner state,
separate Feature Activity, child refresh, independent sessions and reset. Retained
original data, persistent uploaded artwork, service health and unrelated Nginx
hashes/links are verified. Representative mobile/desktop screenshots were reviewed.

Clarity collection remains off; local stub context checks and quiet browser
requests do not establish actual SDK capture/heatmaps. Plan 002 is the next phase.
The source report remains untouched; no promotional artwork set was generated or
automatically enabled. Detailed current verification is in PROJECT_STATE.

## FEAT-09 — Compact landing headlines (user follow-up)

- [x] Remove the decorative star and redundant “Explore [feature]” line from the
  shared component used by all twelve pages.
- [x] Put the supplied headline first inside the card, using the green uppercase
  eyebrow typography at a larger responsive size (20–26px). Keep the page title
  and semantic h2, source wording, description, benefits and CTA.
- [x] Verify all twelve feature journeys at mobile/desktop sizes, visually review
  representative layouts, build and deploy, and update the fresh-agent handoff.

This is a presentation refinement; no schema or engagement behavior change.

FEAT-09 verification: existing all-twelve-feature journey passed at
360/390/1440px (three tests), typecheck/build/format passed, and representative
mobile/desktop screenshots were reviewed. Deployed **2026-10-11T21-46-00-510Z**;
public HTTPS smoke passed at 360/1440px with collection off. Original data and
persistent artwork are retained. No migration or API change was needed.
