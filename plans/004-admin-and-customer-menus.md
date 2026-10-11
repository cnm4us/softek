# Plan 004 — Admin and Customer menus

Plan ID: **004**. Task IDs: **MENU-01–07**.
Depends on: [Plan 001](001-login-layout-and-banners.md).
Lifecycle status and current request: [PROJECT_STATE.md](../PROJECT_STATE.md#plan-status-registry).

The user requested an implementation plan after approving two distinct menus:
**Admin Menu** and **Customer Menu**. Both customer management and demo-wide
controls belong to the Admin Menu. This plan covers navigation and the organization
of existing features. The user subsequently authorized implementation and deployment.

## Approved outcome

| Admin Menu | Customer Menu |
| --- | --- |
| Manage Customers | Account Summary |
| Manage Banners | Transfers |
| Adoption Report | Bill Pay |
| Admin sign-out | Cards |
| | Savings Goals |
| | Statements |
| | Support |
| | Customer sign-out |

Manage Customers includes creation, password replacement, enable/disable,
explicit banking reset/reconfiguration, eligibility, campaign variant, activity
mode, copied Clarity lookup ID, and individual activity. Manage Banners includes
upload, preview, accessible text, internal destination, order, enable/disable,
and replacement. Adoption Report retains its current filters and definitions.

Use the existing mobile-first Harbor theme and upper-right hamburger on mobile
and desktop. Clearly label the open navigation **Admin Menu** or **Customer Menu**.
Administrators authenticate with the existing independent admin login; customers
authenticate with their individual credentials.

## Inspected baseline

- `apps/web/src/main.tsx` has one customer-oriented hamburger, including a
  `Demo controls` link, even on `/controls`. Admin state currently lives inside
  `Controls`, so the outer header does not know whether the admin is signed in.
- `/controls` is one long page: `RevisionControls` renders every user's forms and
  the banners, followed by the adoption report. It also references the currently
  signed-in customer and uses that customer's refresh callback after admin edits.
- `apps/web/src/revision.tsx` already has the customer section registry and working
  user/banner operations. These should be reorganized rather than replaced.
- Admin and customer cookies/API protections are already separate. Existing
  `/api/admin/status`, login/logout, users, banners, interactions, and report
  endpoints can support this change without a new role system.
- Admin detection and analytics suppression currently test exact `/controls`.
  New child routes require one consistent admin-route boundary everywhere.
- Browser tests and public smoke currently enter controls through the mixed
  menu and assume all admin tools are on one page. Their navigation must change.

## Proposed routes and working defaults

These are implementation choices, distinct from the approved menu names/content.

| Route | Screen / behavior |
| --- | --- |
| `/controls` | Admin entry/home; existing bookmarks remain valid; three links/cards to the admin tools |
| `/controls/customers` | Compact searchable customer list with a Create customer action |
| `/controls/customers/new` | Create customer form, preserving existing rules and settings |
| `/controls/customers/:userId` | Selected customer details and management actions |
| `/controls/banners` | Existing banner management, upload, and replacement tools |
| `/controls/report` | Existing adoption report and filters |

Customer routes remain `/`, `/transfers`, `/bill-pay`, `/cards`, `/goals`,
`/statements`, and `/support`. Savings details `/savings-goals` and enrollment
`/enroll` remain part of the Savings Goals journey.

Recommended defaults:

- A shared admin guard displays the admin sign-in form at an unauthenticated
  admin destination. Successful sign-in opens that destination. Admin home is
  the default after signing in through `/controls`.
- Show the Admin Menu after admin authentication. Before authentication show
  branded admin sign-in/loading state without customer banking navigation.
- Keep the admin entry link on the customer login footer. Remove it from the
  Customer Menu. Direct `/controls` access remains available independently.
- Keep About this demo and the existing customer reset as secondary demo utilities,
  separate from the main banking destination list. They must never expose admin
  tools; customer reset keeps its confirmation and retained-history behavior.
- Start with client-side customer search over the existing protected list for
  this small demo. Search username or display label; show status/activity mode
  and whether banking state exists. No new server search/pagination is needed.
- A selected customer page resolves an existing ID using the protected list and
  loads bounded activity on demand. Handle missing IDs with a clear message and
  return link; introduce a single-customer API only if implementation needs it.
- Reuse the existing templates and assignment controls. Removing Alex/Jamie or
  changing starting balances is separate from this navigation revision.

## MENU-01 — Separate route areas and session ownership

- [x] Establish a shared admin-route predicate covering `/controls` and its
  descendants; use it for routing, header/menu, document titles, and analytics.
- [x] Introduce an admin layout/session boundary that owns admin status, CSRF,
  sign-in, sign-out, and session-expiry handling across all admin pages.
- [x] Separate customer bootstrap from admin bootstrap. Admin tools must work
  without customer authentication or a customer-state refresh dependency.
- [x] Keep the existing protected server APIs authoritative. A hidden menu or
  frontend guard is not authorization; customer credentials cannot access admin.
- [x] Preserve `/controls` as the admin entry and support direct child-route
  loads, reload, back/forward, invalid routes, and loading/error states.
- [x] On expired/revoked admin access clear loaded private admin state and show
  sign-in. Do not reset customer banking data or silently sign in as a customer.

**Acceptance:** an admin can open every tool with no customer session; a customer
session alone cannot reveal admin data; direct admin routes require the same admin
authentication; existing customer login/deep-link behavior still works.

## MENU-02 — Build the two menus and shared visual treatment

- [x] Reuse the menu presentation, theme tokens, focus styles, and section shell
  with separate route/action registries for Admin Menu and Customer Menu.
- [x] Admin destinations are Manage Customers, Manage Banners, Adoption Report,
  and admin sign-out. Customer destinations match the approved banking list
  plus customer sign-out, with demo utilities separated as described above.
- [x] Use visible menu titles and distinct accessible dialog names. Retain a
  stable accessible hamburger control, expanded state, and active-link indication.
- [x] Preserve Escape/outside-close, close-on-selection, keyboard focus containment,
  focus return, route focus, touch targets, and no horizontal page overflow.
- [x] Give each admin screen a static section/document title such as Manage
  Customers or Customer Details. Keep private customer names out of document titles.
- [x] Place sign-out consistently and ensure its action targets the current
  area's session, including when both cookies exist in the same browser.

**Acceptance:** each authenticated area presents its own menu on mobile and
desktop. Admin navigation contains admin tools; customer navigation contains
banking destinations. Signing out of one area preserves the other session.

## MENU-03 — Move customer administration into list, creation, and details

- [x] Extract the customer functions from `RevisionControls` into focused screens
  sharing the existing API/error handling and UI components.
- [x] Build the compact list/search, clear empty/no-match states, creation link,
  and a details link for each customer. Avoid rendering every customer's forms.
- [x] Preserve email-style usernames, normalization/uniqueness, 3–40-character
  limit, password rules, field-specific errors, and entered values on failure.
- [x] Preserve creation settings: fictional display label, template, eligibility,
  campaign variant, and human/automation mode. Successful creation opens or
  clearly links to the new customer's details and clears the password field.
- [x] On the selected page retain enable/disable, password replacement, explicit
  reset/reconfiguration, Clarity ID copy, and bounded individual activity.
- [x] Make the selected customer unmistakable for reset/password/status actions.
  Keep banking reset confirmation and historical state; do not reset on selection.
- [x] Update relevant visible admin wording from Demo users to Manage Customers;
  retain underlying user UUIDs/table/API names and stable Clarity identity.

**Acceptance:** create an email-username customer, find/select them, change only
their access/settings, and inspect their activity. Other customers' data and
sessions are unaffected. Merely browsing details does not advance banners or
change banking runs.

## MENU-04 — Extract banner management and adoption reporting

- [x] Move banner tools to `/controls/banners` and report UI to `/controls/report`.
  Load each tool's data when needed instead of fetching every admin feature.
- [x] Preserve image validation/limits, preview, safe internal links, ordering,
  enable/disable, immutable replacement URLs, and persistent asset storage.
- [x] Preserve report UTC filters, eligible denominators, distinct-run counts,
  ordered funnel, direct entry, retained history, and human/automation separation.
- [x] Preserve report filters during admin menu navigation using bounded admin
  UI state or safe filter parameters. Do not include private customer data in URLs.
- [x] Remove the misleading global Current profile text and customer refresh
  coupling. Admin edits refresh the relevant admin data; customer views reconcile
  their state through the existing authenticated customer flow.
- [x] Keep each tool usable after direct reload and graceful on request errors.

**Acceptance:** banners and reporting work independently without a banking login;
navigation between tools neither clears customer data nor advances rotation.

## MENU-05 — Preserve banking behavior and the analytics boundary

- [x] Keep Account Summary composition, functional savings flow, placeholders,
  customer menu observations, and allowlisted target keys compatible with the
  existing API and later automation contract.
- [x] Keep menu/SPA returns from advancing banners. A true full Summary document
  load still follows the existing once-per-document refresh rule.
- [x] Preserve cookie/session isolation, user identity, explicit reset, visit
  semantics, and confirmed adoption rules; admin navigation is not customer use.
- [x] Suppress Clarity initialization/consent UI and customer page/menu events on
  every admin route, including customer detail/creation pages and unknown children.
- [x] Keep the whole admin area masked. If crossing from an already captured
  customer document, retain the consent shutdown/full-document boundary before
  showing admin content; do not depend on Identify to stop existing capture.
- [x] Keep all collection flags off. Actual recordings and masking fidelity
  remain [Plan 002](002-clarity-validation.md) acceptance.

**Acceptance:** customer navigation still preserves state/selection and records
customer observations; admin navigation generates no customer interaction events
or live Clarity requests in collection-off checks.

## MENU-06 — Meaningful regression checks

- [x] Adapt existing browser journeys to enter admin via `/controls` and use
  named admin destinations rather than the removed Demo controls customer link.
- [x] At 360/390/1440px verify both menus, keyboard operation, active section,
  no overflow, direct routes/reload, and protected loading/login states.
- [x] Test customer-only, admin-only, both-session, and signed-out cases, including
  correct independent logout and expired admin access on a child route.
- [x] Exercise customer search/create/details, email login, selected-user actions,
  banner upload/settings, and report filters. Clean only test-owned fixtures.
- [x] Retain the existing enrollment/goal/contribution, ownership, reset/history,
  observation, and deterministic banner regression coverage. Run API checks when
  API/auth wiring changes; avoid tests that only mirror component structure.
- [x] Update the public smoke for separate admin routes. Verify actual HTTPS
  login, both areas, reporting, rotation, and retained banking state with dedicated
  automation accounts; collection remains off.
- [x] Run typecheck, build, formatting, applicable API/browser checks, and inspect
  representative mobile/desktop screenshots. Record actual results, not assumed
  historical counts.

**Acceptance:** checks prove both surfaces and independent authentication while
the existing banking/reporting behavior passes its meaningful regressions.

## MENU-07 — Release and durable handoff

- [x] Update ARCHITECTURE, LOCAL_SETUP, TESTING, and PRODUCT with implemented
  routes, menu/session boundaries, entry instructions, and verified coverage.
- [x] Verify migration status. No schema change is expected; never create a
  migration solely to reorganize navigation. Any discovered schema requirement
  must follow the committed-migration contract before application.
- [x] Deploy using the existing scoped release process after authorization to
  implement. Preserve the asset directory, saved customer data, dedicated host
  resources, and collection-off configuration.
- [x] Verify production health, SPA child-route refresh, both sign-in/menu flows,
  public smoke, and unchanged unrelated Nginx sites. No routing config change is
  expected because the existing SPA fallback supports these paths.
- [x] Record release IDs and a compatible authenticated rollback target. A UI
  rollback restores the earlier combined controls at `/controls`; new child
  bookmarks may need users to return to that entry. Do not downgrade the schema.
- [x] Update checked tasks and the state registry, commit locally, and leave the
  exact next task for Plan 002. Do not push or enable Clarity as part of this change.

## Scope and completion boundary

This plan adds no real banking services, new account templates, customer signup,
admin roles, customer impersonation, automation scheduler, or live Clarity capture.
Existing API/schema/business behavior is reused. Implementation may adjust the
proposed route/component organization if evidence warrants it; record material
choices without reopening the approved menu distinction.

**Exit criteria:** the deployed demo has separate Admin and Customer menus;
customer management, banner management, and reporting have focused protected
pages; all existing customer/admin functions remain available; independent
sessions, persisted state, banner rules, and the analytics boundary are verified.


## Completion evidence (2026-10-11, America/Los_Angeles)

MENU-01–07 verified and deployed in release **2026-10-11T19-49-23-608Z**.
Typecheck, build, formatting, 32 API/migration TAP entries, and all 30 Chromium
journeys passed. Actual HTTPS smoke passed at 360/1440px. Both schemas remain
at version 3 without pending/drift; no SQL change was necessary. Original runs,
persistent artwork, and unrelated Nginx hashes/links are retained. Previous
compatible release is **2026-10-11T18-56-25-765Z**; its combined admin entry is
`/controls`. Current detailed evidence and next task are in PROJECT_STATE.md.
Clarity collection remains off; live playback acceptance stays with Plan 002.
