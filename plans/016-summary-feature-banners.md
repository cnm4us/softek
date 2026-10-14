# Plan 016 — Activate Account Summary feature banners

Plan ID: **016**. Lifecycle: [PROJECT_STATE.md](../PROJECT_STATE.md#plan-status-registry).

## Scope and decisions

Owner now authorizes showing the three configured Account Summary widgets.
Activate **Summary only**; checking/savings/credit detail spaces stay inactive.
Enabled Summary widgets with artwork rotate by saved order/ID, once on login or
full Summary document refresh, preserving the tab's exact selection on menu
returns/data refetches. Use existing compact 105px/full-content-width strip and
catalog-owned destinations. Preserve mobile image proportions on desktop with
contained, centered artwork; no stretching or text cropping. Empty/error slots
fall back to the existing placeholder. Do not alter owner artwork/settings.

Reuse immutable `banner_presentations` and existing feature/banner observations
for owned entry/CTA attribution and current Feature Activity reporting. A reserved
`explorer-summary:` request-key prefix distinguishes these presentations from
legacy banner selections. Legacy current-selection lookups exclude this prefix.
Migration 0011 adds only a per-user Summary widget cursor; no legacy layout/ENUM
changes. Deleting/replacing/disabling a widget cannot invalidate historical snapshots;
a fresh visit validates configuration and recovers gracefully. No Savings Goals
campaign attribution is assigned to these feature invitations.

Clarity tags come only from loaded/rendered Summary artwork, and clear when leaving
Summary or switching customers. Existing consent, actor, admin/impersonation and
collection gates remain. Routine tests block/intercept Microsoft traffic.

## Tasks and acceptance

- [x] SUM-01: committed additive migration; scoped/idempotent Summary selection,
  enabled/artwork filtering, fallback, retained snapshots and legacy separation.
- [x] SUM-02: compact customer banner with real links, refresh cycling, stable tab/
  menu return/reset handling, image-failure placeholder and accurate Clarity context.
- [x] SUM-03: API/browser/privacy checks for rotation/retries/ownership, metadata
  changes, feature/CTA attribution, empty/error states, unchanged banking and inactive
  account-detail slots; mobile/desktop artwork review.
- [ ] SUM-04: backup retained demo/ledger, apply/verify migration in test then demo,
  evaluation build/deploy and live HTTPS checks using owned capture-disabled customers;
  retain all owner widgets/assets/settings, delete only fixtures and update handoff.

Other banner spaces, timer/carousel rotation, audience/eligibility logic, new
artwork, scheduler work and the stopped recording inquiry are outside this scope.
