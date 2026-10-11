# Implementation plan

Active milestone: **M2 — Clarity evaluation and presentation readiness**.
M0 and M1 are verified; the banking application is deployed through Nginx/HTTPS.

Checkboxes mean acceptance evidence exists, not merely that code was written.
Work in order unless a concrete dependency or user direction justifies changing
the order. Update [PROJECT_STATE.md](PROJECT_STATE.md) at handoff.

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
[PRODUCT.md](PRODUCT.md) pass, except the separate live Clarity evaluation in M2.
The database report works even when Clarity is disabled.

## M2 — Clarity evaluation and presentation readiness

- [ ] M2-01 Verify project `yvs5hp3ivb`, intended hostname, current collection/
  consent requirements, and masking settings against current official guidance.
- [x] M2-02 Inspect the relevant existing Nginx configuration and agree the
  exposure/deployment scope before modifying host routing.
- [x] M2-03 Add the project-specific service/startup configuration, HTTPS routing,
  and a reproducible migration/build/deploy runbook for the identified target.
  Complete: dedicated hardened API service, static release deployment, HTTPS
  proxy/SPA routing, deployment/rollback runbook, and public browser smoke checks.
- [ ] M2-04 Run human walkthroughs and verify recordings, navigation, masking,
  custom events, tags, and heatmaps.
- [ ] M2-05 Run separately labeled synthetic demonstration journeys; record
  whether Clarity actually captures them rather than assuming it does.
- [ ] M2-06 Record findings, limitations, and a repeatable presentation/reset sequence.

Exit criteria: the identified presentation site is reachable, collection settings
are verified, the demo can be reset/repeated, and findings clearly distinguish
observed behavior from unsupported adoption-improvement claims.

## M3 — Expanded banking and white-label demonstration

Pull prioritized items from [BACKLOG.md](BACKLOG.md) after M1 is stable. Add one
feature at a time with its migrations and meaningful acceptance checks.

## Session completion checklist

- Update task status only for work actually checked.
- Record verification outcomes, unresolved failures, and current Git state.
- Record any new design decision or dependency affecting the next agent.
- Leave one concrete resume task and enough context to execute it.
- Do not repeat passed tests unless a later change or unresolved issue warrants it.
