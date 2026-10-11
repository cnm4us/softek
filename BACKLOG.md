# Backlog

The roadmap lives in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md); detailed
tasks live in its linked `plans/` files. [PROJECT_STATE.md](PROJECT_STATE.md#plan-status-registry)
owns lifecycle statuses and the current focus. This file holds later scope and
open questions. Promote an item into an individual plan when prioritized; retain
its backlog ID.

## Deferred features

| ID | Priority | Item | Completion evidence |
| --- | --- | --- | --- |
| B-001 | Next | Transfers between fictional accounts | Atomic balance/history updates; duplicate submission does not double-transfer |
| B-002 | Next | Transaction history search, filters, details | Consistent results scoped to the participant; mobile usability |
| B-003 | Next | Bill pay, payees, scheduling, pending payments | Persisted schedule/pending views and coherent simulated balances/history |
| B-004 | Later | Card controls and notification preferences | State persists and does not leak between participant runs |
| B-005 | Next | Two or three configurable institutions | Same components/theme system; purchase/eligibility/branding differ through config |
| B-006 | Next | Full service center and extra optional services | [Plan 005](plans/005-feature-campaign-landing-pages.md) covers twelve engagement-only feature pages; actual purchase/eligibility/enrollment/use models remain later scope |
| B-007 | Next | Full experiment controls and deliberate friction | Labeled variants, stable assignment, report segmentation, reproducible reset |
| B-008 | Later | Retention/cleanup of archived demo runs | Explicit retention policy and scoped cleanup preserving chosen report data |
| B-009 | Later | Embedded-service fidelity evaluation | Verified iframe/canvas behavior using current Clarity guidance and a concrete sample |
| B-011 | Later | Split frontend bundles as scope grows | Current minified main bundle is about 578 kB (170 kB gzip); Vite emits a size advisory |
| B-012 | Later | Automation scheduler and scenario-builder UI | [Plan 003](plans/003-automation-journeys.md) outlines assigned-user scheduling/scenarios; Plans 001/002 prepare a small harness first |
| B-010 | Later | Presentation narrative and findings | Repeatable walkthrough with evidence and stated evaluation limits |

`Next` means after the initial complete flow, not permission to expand M1.

## Open questions and dependencies

| ID | Question | Needed by | Current handling |
| --- | --- | --- | --- |
| Q-003 | Which collection, consent, and masking settings apply to Clarity project `yvs5hp3ivb`? | M2-01 | Owner reported Balanced masking, cookies/bot detection on, consent required; actual playback and Chris access pending; collection disabled |
| Q-004 | Which institution names/copy should appear in the presentation? | Before final M1 polish | Use clearly fictional working names; user can refine later |
| Q-005 | Which optional services reflect the intended business story? | Plan 005 / later service expansion | User supplied twelve campaigns, captured in Plan 005; page/CTA engagement is scoped, real service models and independent product verification remain outside this phase |

M1 and Plan 001 are complete. [Plan 004](plans/004-admin-and-customer-menus.md)
covers the completed Admin/Customer menu organization and focused protected pages.
[Plan 005](plans/005-feature-campaign-landing-pages.md) implements the Explore
Features submenu, twelve confirmation-only landing pages and separate activity
reporting. Actual product activation remains deferred. Q-003 remains the subsequent Clarity evaluation dependency:
verify consent/masking behavior and required CSP domains in a controlled pilot.
Owner-reported settings are recorded in PROJECT_STATE.md; actual playback and
Chris's project access remain unverified. Host/database operation is documented in
`LOCAL_SETUP.md`.

## Resolved requirements

- Development is already on EC2; Windows/local MySQL guidance is superseded.
- MariaDB is the sole database target; no cross-database portability work.
- The interface is mobile first and uses a uniform theme with desktop adaptation.
- Schema changes use versioned migrations.
- Q-001: `demo_test`, scoped `softek_test_app`, and `softek_migrator` are provisioned.
- Q-002: user confirmed `demo.bawebtech.com`; dedicated site
  `/etc/nginx/sites-available/012_demo.bawebtech.com` is enabled with HTTPS.
- Q-006: user authorized public test hosting on that hostname. The banking demo is
  live; production API runs on loopback behind the dedicated HTTPS proxy.
