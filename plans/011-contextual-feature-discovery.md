# Plan 011 — Contextual discovery: EasyCoin and Skip A Pay

Plan ID: **011**. Lifecycle: [PROJECT_STATE.md](../PROJECT_STATE.md#plan-status-registry).
Source: owner-supplied `temp/ACCESS_DIGITAL_FEATURE_DISCOVERY_CODEX.md`.

## Scope and decisions

Owner selected EasyCoin in savings/investment exploration and Skip A Pay on an
eligible fictional loan-payment screen. Build enough interactive banking context
to demonstrate these invitations; existing feature CTAs remain confirmation-only.
Use the current React/Router/Harbor tokens, Express API, and MariaDB. This is the
existing fictional Softek demo, not Access Digital production integration.

Reuse all twelve existing educational pages and Explore Features. The rotating
Account Summary banner and Savings Goals funnel remain their existing experiments.
The one-recommendation cap applies to the new contextual invitations. Multi-FI
branding, all-module placement coverage, catalogue regrouping, home discovery
cards, control/contextual/home experiment assignments and simulated activation
are later phases. No new third-party tracking is added in this phase; existing
consent-gated Clarity remains as configured. Missing automated saved recordings
remain an owner-accepted limitation.

## File-level implementation

- `apps/api/src/discovery-config.ts`: shared typed placement/policy definitions,
  the two feature invitations, and explicitly fictional loan fixtures. No balance
  or transaction-based targeting.
- `apps/api/src/discovery.ts` and `app.ts`: authenticated recommendation selection,
  user preferences, visibility/dismiss/click observations and protected reporting.
- `db/migrations/0009_contextual_discovery.sql`: additive user preferences,
  immutable per-visit presentations and feature-observation attribution. Preserve
  existing table layouts and event ENUMs.
- `apps/web/src/discovery.tsx`: shared inline card, actual-visible impression
  observer and preference controls. `banking-contexts.tsx`: savings/investing
  exploration and loan-payment review/confirmation simulations.
- `main.tsx`, `revision.tsx`, `feature-page.tsx`, `feature-context.ts`, `admin.tsx`,
  `theme.css`: navigation, account entry, existing-page links/attribution and report.
- Focused API/engine/browser tests and maintained setup/state documentation.

## Tasks and acceptance

- [x] DISC-01: shared deterministic rules: one reserved recommendation per visit,
  14-day same-feature impression cooldown, 90-day dismissal suppression, opt-out,
  fewer-suggestion frequency (one in seven days), current enabled features and
  explicit demo loan eligibility. Preferences/history belong to the customer;
  a new banking run does not clear them. Permanent Explore is exempt. Current
  confirmations do not constitute adoption; no invented activation state.
- [x] DISC-02: commit 0009 before applying; verify clean/additive/repeat behavior
  in `demo_test`; back up retained `demo` before production application. Tables
  cascade only with owned customer/run/visit data. Recover partial DDL by inspecting
  the runner ledger/table definitions and using the scoped backup; do not blindly
  retry or modify applied SQL.
- [x] DISC-03: Savings & Investing uses saved savings account data, existing goals
  links and an explicit investing-education choice before EasyCoin is suggested.
  Loan screens use labeled fictional fixtures with eligible/ineligible examples;
  normal payment actions remain prominent. Payment review/confirmation is a
  simulation that does not change accounts or loan obligations.
- [x] DISC-04: Learn more links to existing pages; Dismiss persists; visible
  impressions require >=50% for one continuous second in a foreground tab.
  Hide suggestions during core payment review, confirmation, errors, preferences,
  login and support. Preferences persist across devices/logins; banking reset
  preserves them. No promotional overlays.
- [x] DISC-05: first-party report separates presentations, actual impressions,
  dismissals, Learn more clicks and linked feature views/CTAs from Savings Goals
  adoption. Validate immutable owned attribution; deduplicate retries. Exclude
  impersonation from default reports and preserve normal actor/variant/time filters.
  No names, balances, account numbers, raw inputs or transaction descriptions in
  discovery observation payloads. Existing financial/form DOM masks apply.
- [x] DISC-06: meaningful API/rules tests and mobile/desktop keyboard/navigation
  checks; no real Clarity traffic in routine checks. Run typecheck, formatting,
  build and relevant regressions. Deploy the authorized site changes with the
  existing collection configuration; verify public HTTPS without vendor capture.

## Reopening later scope

Completed October 13 PDT; runtime/API/browser/SQL/public verification and release
evidence are recorded in PROJECT_STATE.md. Initial preference browser failures
were fixed by hiding the controls until the saved setting loads; nine focused
journeys passed afterward. No automated Clarity recording investigation reopened.

Two-FI configuration/tenant switching requires its own data-isolation and branding
phase. Further contextual features reuse the placement engine once selected by
the owner. Full money movement, loan servicing and actual feature activation
remain separate banking work; no production/provider API is mocked as successful.
