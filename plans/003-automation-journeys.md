# Plan 003 — Automation journeys

Plan ID: **003**. Backlog dependency: **B-012**.
Lifecycle status: [PROJECT_STATE.md](../PROJECT_STATE.md#plan-status-registry).

This is a deferred scope outline, not an executable implementation plan.
Expand and prioritize it when the user requests the broader automation work.
It depends on [Plan 001](001-login-layout-and-banners.md) and the observed capture
results from [Plan 002](002-clarity-validation.md).
[Plan 005](005-feature-campaign-landing-pages.md) extends the typed feature/submenu
controls before capture evaluation; this does not implement a scheduler or runner.

## Scope boundary

Plan 001 prepares stable controls, user identity, observations, and trusted
automation labeling. Plan 002 supplies a small click/skip pilot. This plan covers
the later system for assigning and repeatedly executing many user journeys.
[Plan 007](007-customer-device-browser-profiles.md) prepares saved device/browser
preferences and the explicit pilot resolver. Use that shared compatibility catalog
when this plan is activated; preference saving does not schedule execution.

## Intended capabilities

- Assign dedicated demo users to named journey definitions.
- Use saved compatible device/browser profiles; configure pauses, banner click/skip, destination/action click/skip,
  and menu navigation back to Account Summary or another section.
- Run each user in an isolated browser context with credentials from private
  configuration; retain stable user identity and server-derived actor labels.
- Add scheduling, bounded execution/concurrency, and a scenario-builder interface
  only after their requirements are established.
- Report execution results separately from database observations and actual
  Clarity recordings. Reuse the confirmed consent/masking/bot settings.

## Work needed before activation

- [ ] Define scenario storage, runner location, scheduling, and concurrency needs.
- [ ] Review Plan 002's actual synthetic capture results and limitations.
- [ ] Write numbered implementation tasks, any required migrations, meaningful
  acceptance checks, and an operational stop/recovery procedure.
- [ ] Update the roadmap dependencies and the canonical state registry when this
  plan becomes active. Preserve its ID and file path.

Completion should demonstrate repeatable assigned-user journeys with clear
execution/capture evidence. Successful automation alone is not an adoption claim.
