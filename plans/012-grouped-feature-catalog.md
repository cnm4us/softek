# Plan 012 — Explore more ways to bank

Plan ID: **012**. Lifecycle: [PROJECT_STATE.md](../PROJECT_STATE.md#plan-status-registry).

## Scope

Replace the Customer Menu's Explore Features submenu with a link to `/explore`.
Use the owner's screenshot: Save & Invest (4), Borrow & Manage Payments (3),
Move Money (1), Protect & Understand (2), Family & Business (2), in that order.
Show full product names, the supplied introduction and FI configuration note.
Keep Harbor's shared theme, mobile-first layout and existing feature destinations.

Working choices: all groups start expanded; each group can collapse independently;
the search icon reveals a labeled name search. Catalog visits are ordinary page
views; only landing pages record feature views/CTAs. Catalog entries have a return
link to the catalog, without banner/contextual attribution. Discovery opt-out does
not hide this customer-initiated catalog. No schema or collection-setting change.

## Tasks and acceptance

- [x] CAT-01: single renamed menu link, authenticated catalog route/deep-link login,
  bounded route tracking, and unchanged Admin Menu.
- [x] CAT-02: five ordered expandable groups, correct twelve product links/counts,
  search/no-result/clear behavior, accessible keyboard controls and no overflow.
- [x] CAT-03: existing landing confirmations/attribution remain correct; update
  maintained automation navigation and regression coverage for the catalog.
- [x] CAT-04: typecheck, API/browser/privacy checks, build, responsive visual review,
  production deployment and collection-free live verification; update handoff docs.

- [x] CAT-05 follow-up: use the owner-requested full landing titles for EasyVest
  Automated Investing, EasyVest Self-Directed Investing, EasyCoin Cryptocurrency
  and Small Business Invoicing. Keep shared navigation/report labels consistent;
  verify mobile/desktop headings and deploy without a migration.

## Validation

Evidence and release belong in PROJECT_STATE. Routine tests use `demo_test` and
blocked/stubbed external services. Live checks use newly created owned Automation
fixtures with capture disabled, then delete only those fixtures. Existing customers,
banking balances, enabled banners and collection settings remain intact.
