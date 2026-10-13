# Implementation roadmap

This file is the ordered index. Detailed tasks and acceptance criteria live in
individual files under `plans/`. Current lifecycle statuses, active focus,
verification evidence, and the resume point live in
[PROJECT_STATE.md](PROJECT_STATE.md#plan-status-registry).

## Plan sequence

| ID | Plan | Scope and dependencies |
| --- | --- | --- |
| 000 | [Foundation and first demo](plans/000-foundation-and-first-demo.md) | Original M0/M1 checklists and acceptance history |
| 001 | [Login, layout, and rotating banners](plans/001-login-layout-and-banners.md) | M1-R01–08; depends on 000 |
| 004 | [Admin and Customer menus](plans/004-admin-and-customer-menus.md) | MENU-01–07; depends on 001; sequenced ahead of remaining Clarity capture work |
| 005 | [Feature campaign landing pages](plans/005-feature-campaign-landing-pages.md) | FEAT-01–08; twelve pages/submenu/confirmation CTAs/separate engagement; depends on 001/004 |
| 006 | [Bulk customer generation](plans/006-bulk-customer-generation.md) | GEN-01–05; unique identities and persistent varied balances; depends on 001/004 |
| 007 | [Customer device and browser profiles](plans/007-customer-device-browser-profiles.md) | DEV-01–05; saved compatible choices and pilot emulation; depends on 006 |
| 008 | [Simplify starting accounts](plans/008-simplify-starting-accounts.md) | ACCT-01–04; shared account setup and independent eligibility; depends on 006/007 |
| 009 | [Permanent customer deletion](plans/009-delete-customers.md) | DEL-01–04; card controls, linked-data removal and retry protection; depends on 006–008 |
| 010 | [Admin customer impersonation](plans/010-admin-customer-impersonation.md) | IMP-01–06; protected entry/exit, session provenance and analytics exclusion; depends on 001/002/004 and 006–009 |
| 011 | [Contextual feature discovery](plans/011-contextual-feature-discovery.md) | DISC-01–06; EasyCoin savings/investing exploration and Skip A Pay loan-payment context, preferences and first-party reporting; depends on 005/010 |
| 002 | [Clarity validation](plans/002-clarity-validation.md) | M2-01–06; final capture acceptance follows 001/004/005; settings/access review can proceed independently |
| 003 | [Automation journeys](plans/003-automation-journeys.md) | B-012 scope outline; broader scheduling/scenario UI follows 001 and observed results from 002 |

Plan numbers reflect creation order. The current execution sequence is
**000 → 001 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → remaining 002 → 003**; existing IDs and completed task evidence are
preserved. Plans 004/005 implement the final menu and feature surfaces. Remaining
Plan 002 capture acceptance follows their verified release; completed settings and
hosting evidence is retained. See PROJECT_STATE for release/check results.

## Later banking scope

The original M3 direction remains later work: expanded banking, configurable
institutions, additional services, and fuller experiment controls. Pull individual
items from [BACKLOG.md](BACKLOG.md) only when prioritized; create a numbered plan
for a coherent feature rather than extending this index with implementation tasks.

## Maintaining plans

- Use sequential filenames `NNN-short-description.md`; keep IDs and paths stable.
- A plan owns its scope, dependencies, task IDs, checklists, and acceptance criteria.
- PROJECT_STATE.md owns the lifecycle status registry. Link to it from plans
  instead of maintaining duplicate status tables.
- Active means the current focus, including planning; it does not itself authorize
  execution. Preserve the current user-request scope in the state handoff.
- Planned work is sequenced but not started; deferred work waits for prioritization.
  Completed means the plan's acceptance criteria have supporting evidence.
- Preserve earlier task IDs when splitting or reorganizing plans. Checked tasks
  represent verified results; do not reset historical completed work.
- Add a new plan to this roadmap and the state registry. Keep superseded or
  completed plans as history and document replacements rather than deleting them.
- At handoff, update affected task checkboxes and PROJECT_STATE.md with actual
  results, unresolved issues, uncommitted work, and one concrete resume task.
