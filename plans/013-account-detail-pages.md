# Plan 013 — Checking, savings and credit card details

Plan ID: **013**. Lifecycle: [PROJECT_STATE.md](../PROJECT_STATE.md#plan-status-registry).

## Scope and decisions

Remove Account Summary's View savings options link. Turn each complete checking,
savings and credit card widget into a keyboard-accessible link to its own account
detail page. Use the authenticated customer's saved account name, masked number
and balance, with fictional account information and statement activity in the
existing Harbor theme. Include a return to Account Summary.

Working choices: `/accounts/checking`, `/accounts/savings`,
`/accounts/credit-card`, with direct-login destination preservation. Pages are
read-only. Existing saved activity is associated by account ID; additional sample
entries and illustrative terms are deterministic display fixtures, labeled as
examples, and never write ledger balances or history. No migration is needed.
Existing Savings & Investing, Loans, feature/catalog pages and collection gates
remain. New account routes receive ordinary bounded page-view tags, not feature
engagement or adoption events. Explore placements await the owner's next discussion.

## Tasks and acceptance

- [x] DETAIL-01: linked Summary widgets, removed savings-options link,
  authenticated account routes, correct titles, deep-link login and return.
- [x] DETAIL-02: checking/savings/credit detail layout, consistent owned balance,
  account information, saved activity plus labeled stable sample entries; masking
  and responsive keyboard navigation, no financial writes or Explore promotions.
- [x] DETAIL-03: verify account association, refresh/relogin persistence, distinct
  customers and changed savings/checking balances after existing goal funding;
  route tracking and existing banking/discovery/privacy regression checks.
- [x] DETAIL-04: build/deploy with current collection profile; live HTTPS mobile/
  desktop checks without vendor capture, cleanup owned fixtures, update docs/state.

## Validation boundaries

Use `demo_test` for routine tests with collection disabled/intercepted. Live checks
create owned Automation fixtures and delete only those fixtures. Preserve owner
accounts, banners, global collection settings and existing ledger data. Evidence
and the actual deployment release belong in PROJECT_STATE.
