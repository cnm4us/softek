# Implementation roadmap

This file is the ordered index. Detailed tasks and acceptance criteria live in
individual files under `plans/`. Current lifecycle statuses, active focus,
verification evidence, and the resume point live in
[PROJECT_STATE.md](PROJECT_STATE.md#plan-status-registry).

## Plan sequence

| ID | Plan | Scope and dependencies |
| --- | --- | --- |
| 000 | [Foundation and first demo](plans/000-foundation-and-first-demo.md) | Original M0/M1 checklists and acceptance history |
| 001 | [Login, layout, and rotating banners](plans/001-login-layout-and-banners.md) | M1-R01–07; depends on 000 |
| 002 | [Clarity validation](plans/002-clarity-validation.md) | M2-01–06; capture acceptance follows 001, settings/access review can start earlier |
| 003 | [Automation journeys](plans/003-automation-journeys.md) | B-012 scope outline; broader scheduling/scenario UI follows 001 and observed results from 002 |

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
