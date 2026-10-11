# Plan 000 — Foundation and first demo

Plan ID: **000**. Milestones: **M0, M1**.
Lifecycle status: [PROJECT_STATE.md](../PROJECT_STATE.md#plan-status-registry).

This plan archives the original completed task checklists and acceptance scope.
Verification evidence is recorded in [PROJECT_STATE.md](../PROJECT_STATE.md#verification-evidence).
Live Clarity evaluation is covered separately by [Plan 002](002-clarity-validation.md).

## M0 — Project foundation

- [x] M0-01 Inspect workspace, runtime, and MariaDB server version.
- [x] M0-02 Initialize local Git on `main` and configure the supplied GitHub origin.
- [x] M0-03 Create the agent documentation and record corrected environment/design requirements.
- [x] M0-04 Scaffold npm workspaces, TypeScript frontend/API, and shared tooling.
- [x] M0-05 Add placeholder-only environment examples and startup/config validation.
- [x] M0-06 Establish dedicated Softek development/test schemas and scoped accounts.
- [x] M0-07 Implement the versioned SQL migration runner and migration status command.
- [x] M0-08 Verify empty-schema setup, repeated migration no-op, checksum rejection,
  concurrent-run prevention, and partial-failure reporting on MariaDB.
- [x] M0-09 Implement the shared mobile-first theme, page shell, and component primitives.
- [x] M0-10 Document working install/start/build/check commands and verify a local smoke run.
- [x] M0-11 Create a dedicated Nginx test site, issue its certificate, verify
  HTTP/HTTPS and renewal, and preserve existing site configurations.

Exit criteria: the frontend and API start on loopback, dedicated database
connections work, migration tooling passes its contract checks, and a shared shell
works at mobile/desktop sizes. No changes to unrelated Nginx sites or databases.

## M1 — One complete adoption experiment

- [x] M1-01 Finalize the minimal entity model and add `0001_demo_foundation.sql`.
- [x] M1-02 Seed one institution, two fictional profiles, account fixtures, savings goals,
  and one campaign. Repeat seeding without duplication or participant overwrite.
- [x] M1-03 Implement demo entry, isolated participant runs, visits, stable
  assignments, session security, and run reset.
- [x] M1-04 Build account overview with balances, recent activity, banner, and
  sidebar/inline promotion using the shared theme.
- [x] M1-05 Build service details and short multistep enrollment.
- [x] M1-06 Persist enrollment and savings-goal creation with transactional,
  idempotent API behavior. Add a qualifying action for a later visit.
- [x] M1-07 Implement visibility observation, structured adoption milestones,
  event deduplication, and backend-confirmed success events.
- [x] M1-08 Build the basic campaign/session controls and funnel report with
  explicit cohort denominators and separate human/automated views.
- [x] M1-09 Add the environment-controlled Clarity adapter, event/tag allowlists,
  and masking. Keep collection disabled until M2 verification.
- [x] M1-10 Verify mobile/desktop journeys, persistence, isolation, reset,
  invisible-promotion behavior, idempotency, and report reconciliation.

Exit criteria: all first-milestone acceptance requirements in
[PRODUCT.md](../PRODUCT.md) pass, except the separate live Clarity evaluation in M2.
The database report works even when Clarity is disabled.
