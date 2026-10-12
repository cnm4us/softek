# Plan 010 — Admin customer impersonation

Lifecycle: [PROJECT_STATE.md](../PROJECT_STATE.md#plan-status-registry).
Depends on Plans 001/004 (independent sessions and customer navigation), 002
(collection boundaries), and 006–009 (customer state and administration).

The owner approved implementation after reviewing this plan. IMP-01–06 are
implemented, verified and deployed; release/evidence is in PROJECT_STATE.
No real Clarity recording was started during this phase.

## Intended experience

1. An authenticated admin opens `/controls/customers/:userId` and clicks
   **Impersonate customer**. No customer password is needed.
2. The application opens that customer's **Account Summary**, with their saved
   checking/savings amounts, eligibility, goals and enrollment. Starting a visit
   does not reset banking or change their Human/Automation assignment.
3. A compact shared-shell indicator says **Viewing as [display name]** on every
   authenticated customer page. A short note on the admin action explains that
   changes made while impersonating persist for the customer.
4. Normal navigation, feature confirmations and banking actions work. The current
   browser/device is used; saved automation profiles are not applied.
5. The Customer Menu shows **Exit to Admin** immediately above **Sign out** only
   while impersonation is active. It ends impersonation and returns to the
   same customer's admin details page.
6. **Sign out** instead ends impersonation and opens customer login. The admin
   login remains available. Ordinary customer sessions never show Exit to Admin.

Disabled customers cannot be impersonated. Missing/deleted customers produce an
actionable error. If a customer disappears during impersonation, return to the
customer list rather than a broken details page.

## Session and authorization design

Use a dedicated server-side impersonation session and HttpOnly cookie, separate
from both `softek_admin` and ordinary `softek_user` authentication. Store only
token hashes. Bind the impersonation session to the initiating admin session,
target customer and expiration, bounded by the admin session's remaining life.
The shared admin login currently has no named-admin identity: attribution means
the authenticated admin session, without inventing an administrator name.

- Validate the matching admin cookie, active admin session, impersonation session
  and enabled target on every customer API request. Admin logout/expiry, customer
  disable/password replacement/deletion revoke impersonation access.
- A stale impersonation cookie or stale browser context must fail closed, never
  fall back to another customer session. Keep normal Human/Automation password
  login rules intact; only this protected admin entry permits either assignment.
- Entering impersonation ends this browser's current ordinary customer session
  and clears its cookie. Other browsers' customer sessions remain valid. Exit
  does not restore a previous customer login.
- Use the impersonation token for customer CSRF protection. Keep admin CSRF and
  same-origin validation for entry/exit. Return only nonsecret session metadata
  needed to identify the mode and guard stale pages; URLs contain no tokens.
- Browser cookies are shared across tabs. Clear cached customer/banner/consent
  context on entry, switching and exit; signal other tabs to stop collection and
  reload. Guard requests against stale session context so an old tab cannot act
  on a newly selected customer. Server checks remain authoritative.
- Serialize entry/revocation with existing user locks and a consistent admin
  session lock order. Concurrent start, repeated exit and customer deletion must
  not resurrect access or create duplicate active banking runs.
- Use fresh documents at identity/admin boundaries. Exit clears impersonation
  even if admin access has expired, then opens admin sign-in. After revocation,
  no further customer data or actions are available.

Proposed API contract:

| Endpoint | Purpose and authority |
| --- | --- |
| `POST /api/admin/users/:id/impersonate` | Admin session + admin CSRF/origin; strict UUID/request ID; enter an enabled customer with retry-safe visit/banner initialization |
| `POST /api/auth/impersonation/exit` | Revoke this browser's impersonation, clear its cookie/context and return a server-derived internal admin destination; support cleanup after admin expiry |
| Existing `/api/state` and `/api/analytics` | Expose validated impersonation status; analytics disabled for this mode |
| Existing customer mutation routes | Resolve effective session centrally; preserve ownership, eligibility, locking and customer CSRF checks |
| Existing `/api/auth/logout` | End impersonation when active, preserving admin login; ordinary customer behavior remains unchanged |

Exit accepts no arbitrary return URL. Repeated entry requests must not advance the
banner twice; define how a lost response safely reissues the same session cookie.
Do not leave a committed, inaccessible session as the only result of a retry.

## Banking, banners and analytics

Impersonation uses the customer's current run, creating it from their saved
starting amounts only if they have never entered the demo. Entry advances the
ordered banner once, like login; Summary refresh advances once and menu returns
preserve the selected presentation. Exit does not reset the run or rotation.

**Clarity remains off for the entire impersonation visit**, including customers
whose ordinary visits can collect or already have consent. Enforce this in
server collection policy and frontend initialization. Hide the consent prompt and
collection controls in this mode. Clear previous consent/context and stop any
already loaded SDK before crossing identities. No recording opt-in is added in
this phase; a later deliberate recording feature is separate work.

Label local activity using a server-derived visit source:
`customer` or `admin_impersonation`. Preserve the customer's existing run-level
Human/Automation actor and campaign variant. The two concepts remain separate.

- Classify existing visits as `customer` without rewriting rows; every new visit is assigned its source
  by authentication, not client input. Visit reuse includes source/session context,
  so ordinary and impersonated activity cannot share one visit.
- Adoption and Feature Activity reports exclude impersonated observations from
  their default counts for all existing actor filters, including All. Runs entered
  only by impersonation do not inflate customer cohort denominators; admit them
  once they have a genuine customer visit, retaining existing run-start date rules
  and explaining this behavior in report guidance.
- Selected-customer history retains impersonated actions and visibly labels them
  **Admin impersonation**. No new aggregate impersonation-report UI is required.
- Make event deduplication and first/repeat-use determination source-aware. An
  impersonated banner exposure or first use must not consume the uniqueness key
  or qualify a later genuine customer milestone. Retry receipts must not cross
  authentication contexts accidentally.
- Persisted business effects still exist when the customer next signs in. For
  example, an admin-created goal remains visible and an admin enrollment remains
  active; do not fabricate customer enrollment events for it. A reset can establish
  a clean experiment when desired.

## Planned schema migration

Committed migration **0008_admin_impersonation.sql** adds impersonation sessions
and `visit_contexts`, preserving existing table layouts and historical rows.
Missing historical context classifies as customer activity. Both ledgers are
version 8 with no pending work/checksum drift; repeated application was a no-op.

Use explicit foreign-key/revocation behavior for admin and customer deletion.
Retain visit provenance after session removal so historical classification does
not disappear. Update hardcoded positional `INSERT ... VALUES` statements that
would break when a column is added; use explicit column lists.

Commit SQL before application. Test clean/upgrade/repeat execution in `demo_test`,
back up retained production data/ledger, apply only to `demo`, and verify both
ledgers. Plan an application/migration deployment order that prevents old SQL
writers from running against the new schema. Establish a compatible rollback
artifact before deployment; do not assume today's release remains compatible.
Applied SQL remains immutable; partial failure follows the migration runbook.

## Implementation tasks

- [x] IMP-01 — Finalize authentication context, schema, retry semantics, revocation
  and report attribution. Record design in ARCHITECTURE; commit the additive SQL
  and verify migration contracts before production application.
- [x] IMP-02 — Implement protected entry/exit, shared session resolution and CSRF;
  integrate normal logout, admin revocation, password replacement, disable and
  deletion. Reuse locked run creation and ordered banner selection.
- [x] IMP-03 — Add the details-page button, pending/error behavior, persistent
  viewing indicator and conditional menu action. Clear stale context, handle
  cross-tab transitions and expired/missing customers. Reuse shared mobile theme.
- [x] IMP-04 — Enforce collection exclusion, visit provenance and source-aware
  events/report denominators. Label customer history; preserve ordinary actor,
  consent, feature and banking behavior.
- [x] IMP-05 — Complete API/browser acceptance below, typecheck/build/format and
  migration checks. Record actual results and limitations; no vendor collection.
- [x] IMP-06 — Once implementation is authorized, apply/deploy using the existing
  evaluation profile without changing the global collection switch or project
  settings. Verify public HTTPS with newly owned fixtures only; remove those
  fixtures through the protected delete API. Update state/runbooks/testing.

## Acceptance checks

| Area | Required evidence |
| --- | --- |
| Entry protection | Non-admin/expired admin denied; CSRF/origin, strict body and UUID validation; disabled/missing target errors; client source/actor forgery rejected |
| State and isolation | Human and Automation targets both work; existing run/balances/goals retained, first entry uses saved amounts; mutations affect only the selected customer; ordinary login restrictions unchanged |
| Retry and races | Duplicate/lost-response entry advances once; concurrent first entry creates one run; start versus disable/delete/password reset/admin logout cannot leave usable unauthorized access |
| Session lifecycle | Refresh/deep links retain mode; customer Sign out preserves admin; Exit returns to correct details; expired admin ends access and allows cleanup; back button and stale tabs cannot restore impersonation or act on another target |
| Menu and layout | Button/indicator readable at 360/390/1440px; keyboard/focus/pending/error behavior; Exit directly above Sign out, absent for ordinary customers |
| Banners and features | Entry/refresh/menu rotation rules preserved; feature views/confirmation CTA and Savings Goals actions work; reset retains session mode and creates correctly classified visits |
| Reports and history | Mixed ordinary/impersonated visits retain source after exit/deletion of sessions; default reports exclude impersonated events and admin-only cohorts; history labels; genuine milestones not suppressed by admin deduplication/first-use keys |
| Collection boundary | With evaluation flags/global switch on and stale granted consent present, impersonation loads no SDK and sends no vendor requests; entry/exit stop prior SDK and clear identity; admin pages remain excluded |
| Migration and operations | Clean/upgrade/repeat, retained state, ledger drift checks and compatible rollback verified; scoped host/service/assets/credentials unchanged except intended release/schema |

Run MariaDB/API suites and browser suites sequentially. Use meaningful integration
tests for authorization, ownership and attribution, plus focused Playwright banking
and Clarity-stub journeys. Commands already available: `npm test`,
`npm run test:e2e`, `npm run test:clarity`, `npm run typecheck`,
`npm run format:check`, and explicit matching `build/deploy -- --clarity` profiles.
Routine tests and the live impersonation smoke collect no real Clarity data.

Completion requires deployed entry/navigation/exit and verified session/report/
collection boundaries. A written plan or successful redirect alone is insufficient.

Verified: 76 API/native/migration TAP entries, 48 banking browser checks and
18 Clarity-stub privacy checks, including nine new impersonation checks across
360/390/1440px. Typecheck, evaluation build and format passed. Public 360/1440px
checks used two temporary Automation customers, verified actual persistent goals
and ordinary login, and deleted them afterward. No vendor requests occurred;
original customer/state fingerprints and shared host/assets/settings matched.
The scoped schema/data backup and tested schema-8 build recovery archive are
root-only 0600. No rollback or real SDK recording was performed.

Final refinement: failed Exit broadcasts recovery to other tabs. Three focused
error/expiry checks passed; the final rebuild/deployment and public checks passed.
