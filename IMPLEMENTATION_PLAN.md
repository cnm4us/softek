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
| 012 | [Explore more ways to bank](plans/012-grouped-feature-catalog.md) | CAT-01–04; grouped customer catalog/menu/search; depends on 005/011 |
| 013 | [Account detail pages](plans/013-account-detail-pages.md) | DETAIL-01–08; linked checking/savings/credit widgets and read-only detail pages; depends on 001/011/012 |
| 014 | [Compact banner placeholders](plans/014-compact-banner-placeholders.md) | STRIP-01–03; shared half-height strip on Summary and account pages; depends on 013 |
| 015 | [Feature Explorer controls](plans/015-feature-explorer-controls.md) | EXP-01–06; catalog widgets/mobile banners by section; depends on 005/013/014 |
| 016 | [Summary feature banners](plans/016-summary-feature-banners.md) | SUM-01–04; Summary-only configured artwork/rotation/attribution; depends on 014/015 |
| 017 | [Clarity API-call tracing in Phoenix](plans/017-clarity-api-phoenix-tracing.md) | PHX-01–07; mirrored application calls, durable audit/export and private Phoenix; depends on existing consent and 005/010/011/016 |
| 018 | [Phoenix span presentation](plans/018-phoenix-span-presentation.md) | VIEW-01–03; readable calls, local outcomes and Phoenix columns; depends on 017 |
| 019 | [Clarity context deduplication](plans/019-clarity-context-deduplication.md) | CTX-01–03; changed-only identity/tags, events preserved; depends on 017/018 |
| 020 | [Summary banner analytics readiness](plans/020-summary-banner-analytics-readiness.md) | READY-01–03; defer unresolved banner tags, preserve actual events; depends on 016/019 |
| 021 | [Readable banner analytics IDs](plans/021-readable-banner-analytics-ids.md) | LABEL-01–03; readable analytics values, internal UUIDs retained; depends on 015/016/017/020 |
| 022 | [Banner CTA custom tag](plans/022-banner-cta-custom-tag.md) | CTA-01–03; directly filter banner-attributed confirmed CTAs; depends on 005/016/017/021 |
| 023 | [Expo iOS WebView POC](plans/023-expo-ios-webview-poc.md) | IOS-01–06; separate Expo app around the hosted website, EAS preview build and iPhone acceptance; reuses existing web/API, no recording in this phase |
| 024 | [iOS screenshot recording POC](plans/024-ios-screenshot-recording-poc.md) | REC-01–08; authorized 1 Hz native snapshots, Record/Stop, private receiver/timestamps/storage and admin review; depends on 023's installed baseline; device proof and rollout tracked in state |
| 025 | [Change-triggered screenshots and animated video replay](plans/025-change-triggered-video-replay.md) | VID-01–07; authorized existing-image FFmpeg experiment first, then versioned change-triggered capture/gesture metadata after visual review; depends on 024's functional POC |
| 026 | [iOS native overlay capture experiment](plans/026-ios-native-overlay-capture-experiment.md) | OVL-01–09; keyboard replay placeholder and opt-in underlying-page reconstruction, local comparison for actual validation-popover pixels, bounded owning-window crop, signed EAS preview and conditional private integration; depends on 025's working capture path; local-first implementation authorized |
| 027 | [Session page references and image diffs](plans/027-session-page-references-and-image-diffs.md) | CAN-01–09; progressive per-recording page coverage, versioned image patches and viewport replay; partial references valid; depends on 025/026's existing capture/replay; implementation authorized after plan review |
| 028 | [Automatic replay and 30 fps](plans/028-automatic-replay-and-30fps.md) | AUTO-01–05; durable final-Stop queue, isolated automatic renderer, admin status/retry and 30fps generated output; owner authorized directly; depends on025/027 |
| 002 | [Clarity validation](plans/002-clarity-validation.md) | M2-01–06; final capture acceptance follows 001/004/005; settings/access review can proceed independently |
| 003 | [Automation journeys](plans/003-automation-journeys.md) | B-012 scope outline; broader scheduling/scenario UI follows 001 and observed results from 002 |

Plan numbers reflect creation order. The current execution sequence is
**000 → 001 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012 → 013 → 014 → 015 → 016 → 017 → 018 → 019 → 020 → 021 → 022 → remaining 002 → 003**; existing IDs and completed task evidence are
preserved. Plans 004/005 implement the final menu and feature surfaces. Remaining
Plan 002 capture acceptance follows their verified release; completed settings and
hosting evidence is retained. See PROJECT_STATE for release/check results.
Plan 017 is delivered with tracing Off. It does not depend on reopening the
accepted missing-recording limitation; raw SDK upload capture remains B-018.

Plan 023 is the owner's current implementation priority, ahead of deferred Plans
002/003. It depends on the existing website and the owner's Expo/Apple build
access, not completion of the deferred Clarity work. The owner authorized
implementation after reviewing the plan. Later mobile recording/gesture/error evaluation is tracked separately
in BACKLOG and does not extend this first app milestone.

Plan 024 now scopes the screenshot portion of B-025 at the owner's requested
**one snapshot per second**, with server preflight/provisioning and review.
The owner authorized implementation and deployment. Phone capture/local review now
work and the receiver/admin review are deployed; integrated upload, review and
normal/offline/lifecycle device checks are accepted (REC-02/03/04/05/06).
Profiling/operational validation remains in Plan 024. Remaining Plan 023 acceptance stays
open. Gesture/error events, real-bank masking and support sharing remain later.

Plan 025 scopes the owner's next video experiment: reconstruct motion from existing
overlapping screenshots before changing the capture system. Its second stage plans
change-triggered images and lightweight gesture/scroll timing. The owner authorized
implementation and explicitly advanced from Stage A to Stage B. New receiver/web/
native policy and event-guided replay are implemented; phone acceptance remains.
Real-bank masking and
support sharing remain deferred. Existing Plan 023/024 follow-ups stay tracked.

Plan 026 is a focused follow-up to Plan 025's native validation-popover limitation.
It starts with local pixel/exclusion proof before private upload/replay integration;
remaining Plan 025 lifecycle/profiling work stays open. The owner has authorized implementation. Build the local comparison first;
integrated private uploads depend on physical pixel/exclusion proof. The separately
discussed image-diff/full-page direction is now scoped separately in Plan 027;
the owner authorized its staged implementation after reviewing the plan.

Plan 027 follows the owner's clarification that each recording may build a partial
page reference from its own captured regions. It starts with an existing-image
canvas experiment, then bounded versioned diffs and precise capture geometry before
compatible server/native rollout and iPhone acceptance. A complete admin sweep,
one-shot full-page capture and cross-session reuse are not prerequisites. Plan
implementation was subsequently authorized; Plan 024–026 lifecycle/profiling
follow-ups stay open.

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
