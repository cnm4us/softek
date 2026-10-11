# Backlog

The ordered, active work lives in
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). This file holds later scope and
open questions. Promote an item into the plan when it becomes active; retain its ID.

## Deferred features

| ID | Priority | Item | Completion evidence |
| --- | --- | --- | --- |
| B-001 | Next | Transfers between fictional accounts | Atomic balance/history updates; duplicate submission does not double-transfer |
| B-002 | Next | Transaction history search, filters, details | Consistent results scoped to the participant; mobile usability |
| B-003 | Next | Bill pay, payees, scheduling, pending payments | Persisted schedule/pending views and coherent simulated balances/history |
| B-004 | Later | Card controls and notification preferences | State persists and does not leak between participant runs |
| B-005 | Next | Two or three configurable institutions | Same components/theme system; purchase/eligibility/branding differ through config |
| B-006 | Next | Full service center and extra optional services | Each service separates purchase, eligibility, enrollment, and use |
| B-007 | Next | Full experiment controls and deliberate friction | Labeled variants, stable assignment, report segmentation, reproducible reset |
| B-008 | Later | Retention/cleanup of archived demo runs | Explicit retention policy and scoped cleanup preserving chosen report data |
| B-009 | Later | Embedded-service fidelity evaluation | Verified iframe/canvas behavior using current Clarity guidance and a concrete sample |
| B-011 | Later | Split frontend bundles as scope grows | Current minified main bundle is about 523 kB (156 kB gzip); Vite emits a size advisory |
| B-010 | Later | Presentation narrative and findings | Repeatable walkthrough with evidence and stated evaluation limits |

`Next` means after the initial complete flow, not permission to expand M1.

## Open questions and dependencies

| ID | Question | Needed by | Current handling |
| --- | --- | --- | --- |
| Q-003 | Is Clarity project `yvs5hp3ivb` intended for this demo, and which collection settings apply? | M2-01 | Candidate project only; collection disabled |
| Q-004 | Which institution names/copy should appear in the presentation? | Before final M1 polish | Use clearly fictional working names; user can refine later |
| Q-005 | Which optional services reflect the intended business story? | M3 service expansion | Savings goals is the first working choice; no Access Softek offering is assumed |

M1 and banking deployment are complete. Q-003 is the next evaluation dependency:
verify the intended Clarity project, consent/masking settings, and required CSP
domains before enabling collection. Host/database operation is documented in
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
