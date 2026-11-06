# Project state

Last updated: **2026-11-06 UTC**.
Current focus: **Accepted capture/replay implementation committed locally; SDK extraction remains a discussion direction.**
Latest completed implementation: **Plan 028 — Automatic replay generation and 30 fps output**, plus accepted Plan027 CAN-10 keyboard-tail correction.
Current request: **Owner requested outstanding commits before further work. Implementation b13de94 and this delivery record commit the existing source/tests/docs; no push or new SDK implementation requested.**
Next task: **This commit request is complete. Await the next scoped instruction. Discussion direction is a reusable web package, wrapper adapter/host contract and independent server, using Expo as the reference host while Access Softek's actual wrapper remains unknown. That extraction is not implemented or separately authorized yet. Preserve the accepted recorder/replay and the remaining Plan027 physical acceptance checklists.**

## Plan status registry

This is the canonical lifecycle registry. The [roadmap](IMPLEMENTATION_PLAN.md)
owns sequence/dependencies; individual plans own detailed tasks and acceptance.
Active identifies focus and does not itself authorize additional scope.

| ID | Plan | Status | Progress / dependency |
| --- | --- | --- | --- |
| 000 | [Foundation and first demo](plans/000-foundation-and-first-demo.md) | Completed | M0/M1 verified/deployed; historical checklists retained |
| 001 | [Login, layout, and rotating banners](plans/001-login-layout-and-banners.md) | Completed | M1-R01–08 verified/deployed; real Clarity acceptance stays in 002 |
| 002 | [Clarity validation](plans/002-clarity-validation.md) | Deferred | Synthetic Dashboard activity accepted; missing automated saved recordings accepted, investigation ended; human masking/heatmap review remains; Chris deferred |
| 003 | [Automation journeys](plans/003-automation-journeys.md) | Deferred | Typed feature/banking scenario contract exists; no runner/scheduler/UI |
| 004 | [Admin and Customer menus](plans/004-admin-and-customer-menus.md) | Completed | MENU-01–07 verified/deployed with independent sessions and protected child routes |
| 005 | [Feature campaign landing pages](plans/005-feature-campaign-landing-pages.md) | Completed | FEAT-01–09 implemented, migration 0004 applied, API/browser/public acceptance verified and deployed |
| 006 | [Bulk customer generation](plans/006-bulk-customer-generation.md) | Completed | GEN-01–05 verified/deployed; 200-user test and small live batches; migration 0006 applied |
| 007 | [Customer device and browser profiles](plans/007-customer-device-browser-profiles.md) | Completed | DEV-01–05 verified/deployed; schema 7; compatible selectors and matching native profiles |
| 008 | [Simplify starting accounts](plans/008-simplify-starting-accounts.md) | Completed | ACCT-01–04 verified/deployed; no migration; eligibility independent, retained profiles/balances/history preserved |
| 009 | [Permanent customer deletion](plans/009-delete-customers.md) | Completed | DEL-01–04 verified/deployed; permanent linked-data removal, responsive cards and no batch-retry recreation |
| 010 | [Admin customer impersonation](plans/010-admin-customer-impersonation.md) | Completed | IMP-01–06 verified/deployed; schema 8, admin-bound sessions, conditional exit, labeled local history and report/Clarity exclusion |
| 011 | [Contextual feature discovery](plans/011-contextual-feature-discovery.md) | Completed | DISC-01–06 verified/deployed; schema 9; 83 API/migration entries, 48 existing + 9 discovery browser checks, 18 privacy checks and live HTTPS 360/1440px |
| 012 | [Explore more ways to bank](plans/012-grouped-feature-catalog.md) | Completed | CAT-01–05 verified/deployed; ordered twelve-product catalog, search/accordions, 63 browser and 18 privacy checks; schema 9 unchanged |
| 013 | [Account detail pages](plans/013-account-detail-pages.md) | Completed | DETAIL-01–08 verified/deployed; schema 9 unchanged; 83 API, 69 browser, three focused privacy checks and live HTTPS 360/1440px |
| 014 | [Compact banner placeholders](plans/014-compact-banner-placeholders.md) | Completed | STRIP-01–03 verified/deployed; 54 distinct account/banking cases, eight privacy checks, live HTTPS 360/1440px; schema 9 unchanged |
| 015 | [Feature Explorer controls](plans/015-feature-explorer-controls.md) | Completed | EXP-01–06 verified/deployed; schema 10; 88 API/migration entries, nine browser checks, three SDK-stub privacy checks and live HTTPS 360/1440px; customer activation deferred |
| 016 | [Summary feature banners](plans/016-summary-feature-banners.md) | Completed | SUM-01–04 verified/deployed; schema 11; 94 API/migration entries, 18 browser checks, six SDK-stub privacy checks and live HTTPS 360/1440px; Summary only |
| 017 | [Clarity API-call tracing in Phoenix](plans/017-clarity-api-phoenix-tracing.md) | Completed | PHX-01–07 verified/deployed Off; schema 12; 110 API/migration entries, 12 browser checks, 13 isolated collector checks and live HTTPS 360/1440px |
| 018 | [Phoenix span presentation](plans/018-phoenix-span-presentation.md) | Completed | VIEW-01–03 verified/deployed; 16 focused entries, real isolated REST/UI presentation, live settings preserved |
| 019 | [Clarity context deduplication](plans/019-clarity-context-deduplication.md) | Completed | CTX-01–03 verified/deployed; 14 TAP entries, 12 browser cases, 16-call live stub reload visible in Phoenix |
| 020 | [Summary banner analytics readiness](plans/020-summary-banner-analytics-readiness.md) | Completed | READY-01–03 verified/deployed; 16 TAP entries, 12 browser cases, 13-call live stub reload visible in Phoenix |
| 021 | [Readable banner analytics IDs](plans/021-readable-banner-analytics-ids.md) | Completed | LABEL-01–03 verified/deployed; 23 TAP entries, 12 browser cases, readable 13-call live reload visible in Phoenix |
| 022 | [Banner CTA custom tag](plans/022-banner-cta-custom-tag.md) | Completed | CTA-01–03: 13 unit entries, 12 browser cases, deployed exact tag visible in Phoenix; no Microsoft test traffic |
| 023 | [Expo iOS WebView POC](plans/023-expo-ios-webview-poc.md) | Active | IOS-01–04/07/08 baseline verified; IOS-09 temporary-session update built/inspected. IOS-10 phone checks and remaining IOS-05/06 are open; capture stays B-025 |
| 024 | [iOS screenshot recording POC](plans/024-ios-screenshot-recording-poc.md) | Active | Functional POC accepted; REC-02/03/04/05/06 verified/deployed, build-10 upload 13/13 and offline/lifecycle pass. REC-01/07 profiling and REC-08 operational validation remain explicit follow-ups |
| 025 | [Change-triggered screenshots and animated video replay](plans/025-change-triggered-video-replay.md) | Active | VID-01–04 verified. Build-11 phone upload, idle holds and Stop confirmed; full replay useful overall per owner; revision-5 transitions both smoother per owner. Inline error pixels verified; native validation bubble omitted. VID-05–07 lifecycle acceptance/profiling and capture-boundary follow-up remain |
| 026 | [iOS native overlay capture experiment](plans/026-ios-native-overlay-capture-experiment.md) | Active | OVL-01–04 verified for the local gate: three tooltip trials, reset, keyboard exclusion and dismissal. OVL-05 verified by actual build-14 window recording: tooltip/keyboard pixels and provenance received. Real replay visually accepted by owner. OVL-06/07 lifecycle/fallback/offline and phone resource observations remain; OVL-08 placeholder accepted; OVL-09 opt-in page reconstruction verified and regenerated for review |
| 027 | [Session page references and image diffs](plans/027-session-page-references-and-image-diffs.md) | Active | CAN-01–04/06/07/10 verified: keyboard-tail correction plus references/diffs, strict metadata, compatible persistence, budgets and automated/server checks. Live private review and build15 actual 49/49-frame uploads verified, complete measured sweeps and one keyboard fill. CAN-05/08/09 complete sweep quality accepted by owner; partial/mutation/keyboard/lifecycle/resource acceptance remains |
| 028 | [Automatic replay and 30 fps](plans/028-automatic-replay-and-30fps.md) | Completed | AUTO-01–05: schema15 durable queue, isolated release-pinned worker, bounded recovery/retry, admin automatic status, 30fps FFmpeg output; 35 focused TAP +20 browser cases and live Stop→ready smokes verified |

## Current reality

- **CAN-10 keyboard-tail correction (2026-11-06 UTC).** Latest release
  **2026-11-06T16-58-10-085Z**, matched API/web and release-pinned renderer11 worker.
  Prior config/unit/link/site backup:
  `/var/backups/softek/keyboard-tail-20261106T165626Z/`. Schema15 unchanged; all
  existing capture/canvas/worker/collection/tracing gates/settings preserved.
  Health/DB and services active; all17 Nginx hashes and13 retained recording rows
  unchanged. No new app build, capture changes, migration or other service change.

  Owner's first actual automatic recording **a34bc9c6-2d09-482b-9506-998aedb7bccb**
  has39 screenshots/179 events, Stop35,357ms, no reported loss, jobready. Owner
  reports generally good replay but checkerboard at27→28 when the keyboard appears.
  Snapshot28 has706px real viewport plus621px exclusion. The prior reference filled
  only294 of595 valid hidden-page rows; bottom301px remained unknown despite clear
  later donor30. Whole-viewport match27→30 had95.04% agreement (below97%) because
  focus styling changed, so that otherwise usable image was rejected.

  The new narrow rule verifies metadata shift1841px and two separated128px
  textured bands (donor rows2/386), then imports only donor30's unseen lower301px
  into document rows2867–3168. Prior observed pixels remain unchanged. Full-frame
  matching thresholds/moving/overlay fences are unchanged. As-of coverage still
  excludes later pixels; replay labels retrospective fill and retains checkerboard
  for genuinely unknown areas. New /goals reference has complete measured supported
  coverage. Snapshot28 fill now has421,260 known/0 missing pixels;26px outside the
  measured document stays plain native matte. Original tooltip remains visible.

  Only this affected export was atomically replaced. Short clip now20,000–35,000ms,
  15.000s/1,241,487bytes; full35.367s/2,768,544bytes (+10ms, within one30fps frame).
  Both30fps. Render43,579ms, Nodepeak254,060KiB; separate sample/full child peaks
  179,288/183,428KiB. **26 focused image/keyboard/FFmpeg regression entries pass**,
  including recent-keyboard/time/layout/moving/mismatched/unrelated/blank rejection,
  untouched visible prefix and historical unknown coverage. Initial synthetic
  pattern was too periodic for unambiguous displacement; corrected the fixture
  to use irregular text positions before the passing run. Typecheck/build/format/
  diff pass. Deployed renderer hash matches build. Actual encoded25s frame visibly
  includes bubble, paragraph/buttons and footer without checkerboard. All39 source
  hashes verified; both videos decode and private HTTPS hashes/range/no-store/
  anonymous denial, WebKit440/Chromium1440 play/seek/all previews pass. Temporary
  admin session removed. Evidence: `artifacts/keyboard-transition-regression-tests.log`,
  `keyboard-transition-candidate.log`, `keyboard-transition-final-report.json`,
  `keyboard-tail-private-check.json`, `keyboard-tail-rollout-check.json`.
  Owner confirms “Footer and tooltip look correct”; CAN-10 visual acceptance
  passes. Earlier Plan027 remaining physical checks are not marked complete; no push or unrelated feature commit.


- **Plan 028 delivered (2026-11-06 UTC).** Release
  **2026-11-06T16-30-16-185Z** with matching API/web links; separate
  `softek-replay-worker` pinned to this release. REPLAY_WORKER_ENABLED=true;
  existing screenshot/change/window/page-canvas/Phoenix gates and evaluation
  collection settings preserved. Migration **0015** committed as **e2b5c8a** before
  application; demo/demo_test both schema15, no pending/drift. Exact migration
  target127.0.0.1:3306, dedicated `softek_migrator@127.0.0.1`; runtime CRUD unchanged.
  Scoped prechange schema/data/ledger +runtime/unit/link/site backup:
  `/var/backups/softek/auto-replay-20261106T162317Z/` (root-only, dump1,705,454 bytes).
  Previous compatible release2026-11-06T07-51-52-485Z retained; rollback stops worker
  and disables new automatic enqueueing, preserving schema/readers/cleanup.

  Final Stop transaction creates one durable job after upload drain for nonempty
  measured recordings. Worker polls3s, serializes independently of API, recovers
  interrupted jobs/workspaces under existing render/storage locks, and retries at
  most3 attempts (30s/120s delays). Admin review displays queued/rendering/failed,
  polls to ready and offers CSRF-protected failed retry. Source deletion/expiry
  still prevents publication. Worker runs assoftek with Nice10, CPU150%, 1GiB
  service cap/64tasks, a256MiB renderer heap and existing two-thread encoding limits.
  Renderer10 produces30fps sample/full videos, including static legacy holds.
  Existing accepted24fps videos remain unchanged; no historical jobs backfilled.
  Server/web-only: all37 mobile source inputs match build15; root package/lock
  add a build-only esbuild dependency, not a native/app source change.

  **Verification:** 35 core/API/queue/real-FFmpeg TAP entries; focused6-entry queue
  rerun after connection-release hardening;20 browser cases across Chromium
  360/390/1440 and WebKit440, including failed→Retry→queued→rendering→ready without
  reload. Typecheck/evaluation build/format/diff pass. systemd unit verification
  has only existing unrelated host unit warnings (netplan permission/snapd key).
  Public baseline and page-context generated-fixture smokes passed without manual
  render invocation, first-attempt queued→rendering→ready, encoded30/1 output,
  full decode, measured duration within one30fps frame, private image/video and
  generated page preview delivery. Page-context variant also recovered a seeded
  abandoned workspace and preserved partial spatial coverage. All owned recordings,
  customers/admin sessions removed; no jobs left from smokes. No real Microsoft
  requests; 12 retained recording rows and collection/tracing fingerprints unchanged.
  Existing accepted replay also passes live WebKit/Chromium play/seek/preview
  after the final deployment; its temporary admin session was removed.
  API/DB health connected and dedicated services active; no new public port or
  security-group rule. All17 Nginx site hashes preserved.

  Evidence: `artifacts/auto-replay-core-tests.log`, `auto-replay-queue-final-tests.log`,
  `auto-replay-browser-tests.log`, `auto-replay-typecheck.log`, `auto-replay-build.log`,
  `recording-public-auto-replay-smoke.json`, `recording-public-auto-canvas-smoke.json`,
  `auto-replay-rollout-check.json`. An actual phone automatic-generation result is now confirmed in CAN-10 above; native capture was unchanged and this does not complete
  Plan027's remaining physical checks. Feature source/tests/docs remain uncommitted
  except migration commits51cc902/e2b5c8a; main ahead2. No push; owner image/temp intact.


- **Plan 027 implementation deployed; initial physical uploads verified, quality acceptance pending.** Owner
  authorized implementation. CAN-01–04/06/07 are checked. Sparse 256px tiles retain
  immutable hash-named timestamped revisions, explicit unknown pixels and source
  hashes; as-of views preserve historical coverage. Measured document extent,
  top/bottom and actual coverage are separate. The 12px scrollbar gutter is outside
  the supported reference domain. New visits/layout/font metrics split references;
  unsafe layers/zoom/scroll mapping retain viewport replay. Strong image overlap
  can correct bounded moving-frame positions. Original images remain authoritative.
  Initial export was manual after Stop (`--session-reference`); Plan028 now queues it automatically after finalization.
  Patch PNGs add storage; no bandwidth-saving claim.

  **Compatible server rollout:** latest API/web **2026-11-06T07-51-52-485Z**,
  scoped backup `/var/backups/softek/page-reference-review-20261106T072257Z`.
  First reader rollout backup `/var/backups/softek/session-reference-20261106T061645Z`
  retains the pre-Plan-027 configuration. SCREENSHOT_RECORDING_ENABLED,
  CHANGE_CAPTURE_ENABLED, WINDOW_CAPTURE_ENABLED, PAGE_CANVAS_ENABLED and
  PHOENIX_TRACING_ENABLED are true; existing evaluation collection profile/settings
  preserved. HTTPS DB health connected; retained 10 recording rows and collection/
  tracing fingerprints unchanged; all 17 Nginx site hashes unchanged. No new port,
  security-group rule, unrelated service or DDL; schema 0014 clean. Strict numeric
  `page-context-v1` and `screenshots-window-canvas-v1` use existing frame JSON/approval
  fields. New gates preserve Stop/read/old clients. Private numeric page previews,
  manifest/range/no-store, quotas and recursive cleanup support retained derivatives.

  **Existing-image result:** recording `c9c0bcfa-6fe9-4ea1-8dba-7476d1581b44`
  regenerated with renderer revision 9, all 42 original hashes unchanged. Selected
  /goals reference spans 708×3168 content, including the later footer; preview adds
  a 110px explanation header. Three independent partial references, 185 patch
  versions, 2,661,278 tile bytes plus 1,165,911 preview bytes; originals total
  2,387,144 bytes. Legacy extent/endpoints remain unknown. Full video 47.750 s
  versus 47.717 s Stop (+33 ms, within one 24 fps frame), 2,819,242 bytes; sample
  15.000 s / 887,063 bytes. All 16 keyboard-masked frames use registered raw donors,
  14 remain partial. Frame 11 combines donor 31 with 62 footer pixels from donor23;
  remaining 26px is explicitly unknown. Final encoded frame at14s visually verifies
  readable tooltip, reconstructed page and footer. New measured-canvas fill is synthetic-test
  verified only: this old recording has no new metadata. Render 42,684 ms; Node
  peak 285,972 KiB, separate sample/full child peaks 180,480/183,000 KiB. Rendering
  stays single-job/reduced priority/two encoder threads with documented caps.

  **Checks actually run:** 43 focused core/API TAP entries, 29 core +20
  rendered/adapter mobile checks, 20 browser cases across Chromium 360/390/1440 and
  WebKit440; typecheck, evaluation build, Expo exports and archive checks pass.
  Generated HTTPS canvas/window/change/periodic smokes passed and deleted only their
  own fixtures. Private real-session HTTPS hashes/range/no-store/anonymous denial
  and mobile/desktop play/seek/preview passed on the final release; temporary admin session removed.
  Production cleanup read-only check as `softek`: all six counters zero. Running
  cleanup as development user initially failed private-store permissions; corrected
  OS identity is documented, permissions unchanged. Evidence: `artifacts/page-context-all-tests.log`,
  `page-context-mobile-tests.log`, `page-context-browser.log`,
  `page-reference-final-verification.json`, `session-reference-public-check.json`,
  `session-reference-rollout-check.json`, `page-context-cleanup-dry-run.log`.

  **Signed preview:** **0.5.0 (15)**, `canvas-preview`, EAS
  **936bdab4-5764-488e-9138-8bb05df9ade0**, FINISHED
  **2026-11-06 06:39:41.069 UTC**. [Install build15](https://expo.dev/accounts/mbcollins2/projects/softek-ios-poc/builds/936bdab4-5764-488e-9138-8bb05df9ade0).
  IPA 8,311,472 bytes, SHA-256
  `251a2bf39e96ba6b2163196f6acc39d0beafcdc106c7cbe799e11ef511cbb0f9`.
  Linux inspection confirms bundle/version/build, linked native/window capability,
  embedded signature, provisioning CMS/team/device set, release mode and unchanged
  permission descriptions; not full Apple codesign verification. At submission all45 archived
  inputs matched; current37 mobile/native inputs still match build15. Plan028
  changes root build dependencies only. Native code remains frozen at build15.
  Native coverage must be explicitly selected to negotiate the metadata contract.
  The owner has now made two actual build15 uploads; detailed evidence follows.
  No mandatory sweep for normal sessions.
  CAN-05/08/09 stay open for remaining partial/mutation and keyboard-motion
  quality, lifecycle and phone-resource observations; initial measured sweeps pass. Prior Plan024–026 follow-ups
  remain. Feature source/tests/docs are uncommitted except earlier migration commit
  51cc902; no commit/push requested. Owner IMG_2008.jpeg/temp remain untouched.

- **Plan027 build15 actual uploads and replay visibility follow-up (2026-11-06 UTC).**
  Owner reported two new tests with Screenshot Review/Interactions but no Animated
  replay experiment. Both uploads were complete; no export had been generated.
  The section is conditional on a generated replay. The server/manual post-Stop
  generation boundary is confirmed; no recording repetition or app update needed.
  Both new sessions now have private sample/full videos and measured references.

  Latest **`25ded174-8f67-45b0-b458-81c46a4d5df6`**, start15:57:54.553Z:
  **19/19** frames, **90** events, no reported loss, Stop18,649ms. Single /goals
  reference reports complete supported coverage **708×3168**, both endpoints,
  100% known pixels, 13 admitted observations. Preview visually verifies readable
  complete cards and footer without repeated headers. Full18.667s (+18ms), sample
  15.000s; 226 patch versions, 3,382,302 patch bytes +622,791 preview bytes.
  Capture p50/p95/max61/64/64ms; render24,366ms, Nodepeak236,200KiB.

  Earlier **`f086bc4a-11b0-4396-93e5-a8a2be4ae23a`**, start15:54:09.170Z:
  **30/30** frames, **152** events, no reported loss, Stop38,101ms. Separate
  Summary/Goals references both complete supported coverage, measured endpoints;
  9/16 admitted observations. Exact native valid706/excluded621px in the one
  masked screenshot; full replay uses one as-of canvas fill, no later pixels.
  Full38.125s (+24ms), 438patch versions, 7,055,632 tile +1,346,189 preview bytes;
  capture p50/p95/max65/71/91ms, render37,368ms, Nodepeak263,688KiB.

  First rendering exposed a registered return just above document origin, which
  threw Invalid canvas rectangle. Fixed the operator builder to leave out-of-domain
  aligned frames viewport-only, preserving source pixels without clamping. Added
  the one-pixel negative return to the existing moving-registration regression;
  all5 focused session-reference/fill tests pass, formatting/diff checks pass.
  Only CLI/test files changed; no server/native deployment was needed. Both
  published exports are renderer9 with the bounded-return fix. Original **49/49**
  hashes verified; both full videos decode, timing within one24fps frame, private
  HTTPS hashes/range/no-store/anonymous denial pass. WebKit440/Chromium1440 verify
  the actual Animated replay heading, play/seek, all numeric previews and no
  overflow/errors/vendor calls. Temporary admin session removed. Evidence:
  `artifacts/page-context-phone-review-check.json`, `page-context-return-scroll-tests.log`,
  `page-context-phone-latest-render.log`, `page-context-phone-first-render.log`.
  **Owner quality result:** latest full replay and complete reference accepted
  (“Visible now; replay and reference look good”). This confirms scrolling, text
  and footer for that sweep; it does not claim partial/mutation/keyboard or lifecycle
  acceptance. The subsequent menu inquiry is resolved: older recording c9c0bcfa,
  original snapshot3 at3.433s and full-video frame4s both visibly show Customer Menu.
  Its short excerpt starts5.931s, after that menu. The two newest recordings have
  no banking-menu screenshot/event interval; their overlays are recording controls.
  Owner independently found the menu in an earlier recording. Menu open state is
  preserved with a timed cut, not a reconstructed horizontal opening animation.
  No source, capture or replay change was needed. Actual menu image/encoded-frame
  inspection is in ignored `artifacts/menu-source.jpg`/`menu-replay-4s.png`.
  No new physical lifecycle/partial/mutation/resource acceptance is inferred.

- **Plan 026 integrated experiment — actual device upload/replay accepted; lifecycle checks pending.**
  Local gate passed with three owner-confirmed actual validation-bubble captures,
  keyboard exclusion, readable alignment/dismissal and build-13 reset/fresh runs.
  OVL-01–04 are verified for that local gate. The API/web now supports explicit
  experimental coverage in capable banking previews, defaulting to page capture;
  native method is fixed per approved session with no silent fallback.
  `screenshots-window-v1`/`changes-v2` binds approval to strict per-frame surface
  provenance in existing metadata; no migration (schema 0014 clean). The separately
  enabled WINDOW_CAPTURE_ENABLED gate preserves baseline clients and allows Stop.
  Error requests settle 350 ms within the loop, preserving >=500 ms spacing and
  discarding stopped/late work. Window web taps request UI snapshots; native-only
  actions without a web signal are not claimed to have complete transition coverage.
  Admin review labels method/popover/mask; replay cuts uncertain native/masked/error
  surfaces and omits page markers there. No new full-page/diff/continuous capture.

  **Deployment:** API/web **2026-11-05T18-09-21-499Z**; project runtime/site/link
  backup **`/var/backups/softek/overlay-window-20261105T180614Z`** preserves prior
  **2026-11-05T09-19-33-557Z** identities. Health/DB connected; cleanup dry-run zero;
  all 17 Nginx site hashes unchanged. All nine retained recording metadata rows and
  Clarity/Phoenix setting revisions unchanged. No new port, security group, service
  or schema change. Gate rollback disables only window capture while keeping Stop,
  compatible readers/cleanup and retained data. Normal preview stays baseline.

  **Checks:** **23 API/replay TAP entries**, **28 core + 20 rendered/adapter mobile
  checks**, **16 browser cases** across Chromium 360/390/1440 and WebKit 440 pass.
  Includes consent/provenance agreement, retry immutability, native method opt-in,
  Stop during settle, native capture spacing, overlay replay cuts/marker omission,
  private readback, selection locking and layout. Root typecheck/evaluation build,
  focused formatting/diff and Expo iOS export **665 modules / 1.7 MB** pass. EAS
  profile archive **44 files**, safe allowlisted inputs. Live **window, changes and
  periodic** generated-fixture HTTPS smokes pass and delete their owned rows/files/
  sessions. Window smoke verifies real scoped ingestion/hash/UTC/private readback of
  generated pixels, not a phone upload. Reports `artifacts/recording-public-window-smoke.json`,
  `artifacts/overlay-window-rollout-check.json`, `artifacts/overlay-window-api-tests.log`,
  `artifacts/overlay-window-mobile-tests.log`, `artifacts/overlay-window-browser-tests.log`.

  **Experimental app:** **0.4.0 (14)**, profile `overlay-preview`, EAS
  **`a952555f-c506-4397-b6a6-6683184eb883`**, **FINISHED** at
  **2026-11-05 18:14:25.817 UTC**. [Install experimental banking](https://expo.dev/accounts/mbcollins2/projects/softek-ios-poc/builds/a952555f-c506-4397-b6a6-6683184eb883).
  IPA **8,308,098 bytes**, SHA-256
  **`e05271e36936a8f1daf7c0e33d0e9664219b6aee7beb6fa8bbb646389391b7d6`**.
  Bundle/version/build, linked native module/window capability, embedded signature,
  profile CMS signature, matching team/device set, release/nondebugging and unchanged
  permission descriptions inspected on Linux, not full Apple codesign validation
  or an on-phone launch. Reports `artifacts/overlay-build-14.json`,
  `artifacts/overlay-ipa-14-check.json`, `artifacts/overlay-window-manifest.json`.
  JS sources match submission. Native implementation is unchanged; its introductory
  comment was clarified after submission, with archived/current source hashes and
  comment-stripped code equality recorded. Public web bundle matches the verified
  build (`artifacts/overlay-window-web-check.json`).
  **First actual window upload (OVL-05):** owner confirms tooltip uploads correctly
  and keyboard excluded. Session **`c9c0bcfa-6fe9-4ea1-8dba-7476d1581b44`**, started
  **2026-11-06 01:24:33.874 UTC**, finalized **Stopped / 47,717 ms**. All **42/42**
  captures and **151/151** reported events received; **38** combined triggers,
  **2,387,144 image bytes**, no reported loss. Every frame has window provenance;
  dimensions **720×1327**. Native popovers in frames **11 (12,703 ms)** and
  **12 (16,441 ms)**; keyboard masked in **16** frames. Actual saved images visually
  confirm the Goal name and target required-field bubbles, blanked keyboard areas,
  and readable content after dismissal. Capture duration **p50 64 / p95 73 / max 74 ms**,
  minimum frame spacing **508 ms**. This meets the capture-duration budget for this
  session; phone CPU/memory and extended-run performance are still unmeasured.

  **Actual window replay:** owner accepted tooltip/keyboard exclusion replay, then
  accepted the OVL-08 labeled keyboard placeholder (“That worked”). OVL-09 now
  provides opt-in page reconstruction beneath the keyboard in renderer revision
  **7** (`--reconstruct-keyboard`). No actual keyboard/full-page capture is added.
  Same recording **`c9c0bcfa-6fe9-4ea1-8dba-7476d1581b44`** regenerated atomically:
  sample **5,931–20,931 ms**, **15.000 s / 874,206 bytes**; full **47.750 s /
  2,791,754 bytes**, **+33 ms** within one 24 fps frame, 720×1436. Initial no-image
  gap **116 ms** and all native holds preserved; 15 ordinary scroll intervals remain.

  **Reconstruction result:** all **16** masked source frames have a registered page
  donor; **2** recover the full excluded area, **14** recover partially and retain
  a smaller placeholder. Sample has **6** partial fills. Donors are snapshots
  **10, 23, 31, 36**, with offsets **−14.0 to +15.3 s**. Each video caption labels
  donor/time and reconstruction; private manifest stores bounds/offset/match audit.
  Website's generic movement note is unchanged; private report explains unknown
  historical hidden state. Only the nearest eligible stable unmasked observation
  on either side within the contiguous route and 30-second window is considered.
  Visible texture/seam agreement gates borrowing. Boundary is inferred from canvas
  pixels plus bounded JPEG-edge tolerance, not exact recorded keyboard bounds.
  Captured pixels above that boundary are unchanged; original **42/42** file hashes
  reverified. Tiny clipping/lighting seams can remain. Hidden changes beyond the
  visible overlap cannot be verified; this is approximate reconstruction, not
  ground truth for covered content. Placeholder-only remains the default and can
  be restored by rerendering without the flag. No native/API/web deployment needed.

  **Checks:** **13 renderer tests** (5 reconstruction + 8 existing replay), script
  typecheck, focused formatting/diff pass. Tests cover donor timing, full/partial
  pixel recovery, observed tooltip preservation, unsafe route/gap/zoom/container/
  unstable/masked/popover/time/viewport rejection, unrelated/blank pixels and actual
  FFmpeg encoded content/timing. Full decode succeeds. Encoded full frames at
  **14 / 18 / 40.5 s** visually show readable tooltip/page/error and recovered
  content with source labeling. Actual private HTTPS sample/full byte hashes,
  range/no-store/anonymous denial pass; WebKit 440 and Chromium 1440 play/seek
  without page/layout errors. Vendor requests blocked; temporary admin session
  removed. Render **36,926 ms**, Node peak **207,952 KiB**, sample/full child peaks
  **183,068 / 185,812 KiB** (separate peaks). Existing nonfatal Fontconfig
  unwritable-cache warnings remain; labels render correctly. Reports
  `artifacts/keyboard-reconstruction-tests.log`,
  `artifacts/keyboard-reconstruction-placement.json`,
  `artifacts/keyboard-reconstruction-report.json`,
  `artifacts/overlay-window-phone-public-check.json`. Temporary image/video copies
  removed. Owner reports reconstruction worked pretty well and identifies the slide 10→11
  jump as keyboard appearance on the phone. Source/plan comparison confirms a
  **205 image-pixel upward translation (~125 CSS px)** and exactly **205 image
  pixels** left unrecovered at the bottom: shifting donor 10 exposes that much
  uncaptured page below its original extent. The full excluded keyboard region
  was **620 image pixels**, of which **415** were reconstructed. The residual
  placeholder is an unavailable-page strip, not a measurement of keyboard height.
  No code/test rerun for this feedback-only analysis. Remaining lifecycle/offline/
  fallback and phone observations stay OVL-06/07.
  No commit/push; schema 0014 is the existing sole local feature commit. Earlier
  source/docs and current work remain uncommitted; owner image/temp untouched.

- **Plan 026 local comparison — prior implementation/evidence.** Added
  `SoftekOverlayCapture` as a local Expo iOS module and a separate `overlay-check`
  entry/fixture. It resolves the referenced view's owning active normal-level window,
  crops directly into a 720 px JPEG and clips known keyboard transition regions
  before rendering. Hosted modals are allowed; unrelated native presentations
  reject unless a popover is anchored within the fixture. Public UIKit APIs only;
  no global window enumeration, ReplayKit or full-screen file. The first candidate bubble capture is owner-confirmed; repeated capture,
  keyboard-visible exclusions and wider geometry/lifecycle tests remain.

  The explicit local check coalesces initial/invalid/UI/content/scroll/viewport
  requests for 350 ms, takes one sequential A/B pair at a time (500 ms between pair
  starts), expires after one minute and retains at most eight samples. Each method
  has capture UTC/elapsed/cost/bytes/dimensions; candidate mask/popover flags and
  fixed diagnostics are shown. Stop/background/eligibility loss discards late files;
  local exit/restart cleanup preserves no Photos copy. The native candidate has
  no receiver wiring, banking login or upload credential. Normal preview continues
  using the unchanged baseline capture adapter. The fictional form uses genuine
  HTML required-field validation; no hosted validation UI was changed.

  **Checks:** **25 core + 18 rendered/adapter mobile tests pass**, including five
  pairing/lifecycle cases, four candidate-file validation/redaction cases and the
  local-only app entry. A new test initially had an incomplete fixture-result merge;
  corrected that harness and reran successfully. Mobile/script typecheck and focused
  formatting/diff checks pass. WebKit/Chromium local fixture validation/inline error,
  fixed-kind events without typed values, no network requests and mobile layout
  pass (`artifacts/overlay-fixture-check.json`). Expo iOS export **665 modules / 1.7 MB**
  passes. Autolinking resolves `SoftekOverlayCaptureModule` and its pod
  (`artifacts/overlay-autolinking.json`). EAS profile archive **44 files**, explicitly
  allowlisted local module, no private/server/Git inputs. Linux has no UIKit compiler;
  native build success and device fidelity are separate from these checks.

  **Build:** **0.3.1 (12)**, EAS **`fdab781e-f9c7-4b71-a789-8cfa1f2bf192`**,
  profile `overlay-check`, **FINISHED** at **2026-11-05 17:23:54.392 UTC**.
  [Install local comparison](https://expo.dev/accounts/mbcollins2/projects/softek-ios-poc/builds/fdab781e-f9c7-4b71-a789-8cfa1f2bf192).
  IPA **8,301,508 bytes**, SHA-256
  **`59bcacadb5fdfe3ccccb6ff48b8d117023c01436fcaf7ae0b09bc5362c6de178`**.
  Native module actually compiled/linked in the release executable; local comparison
  text present in bundle. Bundle/version/build, embedded signature presence, profile
  CMS signature, matching team/device set versus build 11, nondebugging entitlements
  and unchanged permission descriptions checked on Linux. This is not full Apple
  codesign verification or a full device acceptance check. Owner has now confirmed launch and a successful
  candidate bubble capture. Private IPA/report
  `artifacts/overlay-check-0.3.1-12.ipa`, `artifacts/overlay-ipa-12-check.json`; other reports
  `artifacts/overlay-build-12.json`, `artifacts/overlay-experiment-manifest.json`,
  `artifacts/overlay-archive-check.log`, `artifacts/overlay-mobile-tests.log`.
  No production deploy/schema/service/security-group changes. API/web symlinks
  still **2026-11-05T09-19-33-557Z**. Module/package/autolinking/source changes and
  Stage A/B work remain uncommitted except migration 0014; no push. Owner diagnostic
  image/temp untouched.

  **First OVL-04 device result:** owner selected “Candidate captures the bubble
  correctly” for build 12, confirming installed standalone launch and actual
  required-field tooltip pixels in the Window candidate. This is one positive
  trial in the asked readable-page/no-keyboard-pixel check, not proof of general
  overlay coverage or the keyboard-visible case. Two more bubble trials and
  keyboard-visible/dismissal/scroll checks are requested before integration;
  lifecycle/resources remain outstanding. No code/build/deployment changes for this
  feedback; documentation/diff checked, no application tests rerun.

  **Local gate passed:** owner confirms a third actual bubble capture in build 13,
  Test 2 / Pair 2 / Window candidate / invalid, with “Fill out this field,” and
  separately confirms keyboard excluded, content/alignment and dismissal correct.
  OVL-04's local pixel/crop/keyboard gate passes; the plan now explicitly locates
  banking/lifecycle/resource matrix rows in OVL-06/07, since the standalone fixture
  cannot exercise the integrated banking path. No unmeasured performance result or
  general native-overlay coverage is inferred. OVL-05 implementation follows this
  proof; image-diff/full-page capture stays discussion only.

  **Owner-requested reset refinement:** repeated comparisons were confusing because
  pair numbers restart on Start and Review could retain its previous scroll offset.
  Added Clear & reset on the fixture/review screens, explicit test labels and a
  fresh review scroll container. Reset stops and invalidates pending work, disposes
  saved files and reloads an empty fictional page; old load/message events are
  rejected by document epoch, readiness resets and capture stays stopped. UI-only
  change; native candidate/geometry/file adapter and production capture unchanged.
  Mobile **25 core + 19 rendered/adapter** checks pass, including actual reset file
  disposal, stale-document rejection and Test 2 / Pair 1 labeling. Mobile typecheck,
  focused formatting, iOS export (665 modules / 1.7 MB), 44-file profile archive and
  diff check pass. Reports `artifacts/overlay-reset-mobile-tests.log`,
  `artifacts/overlay-reset-rendered-check.log`, `artifacts/overlay-reset-export.log`,
  `artifacts/overlay-reset-archive-check.log`. Version **0.3.2 (13)**, profile
  `overlay-check`, EAS **`9f8d1a60-3a75-4b37-b0bb-cb9362eee03c`**,
  **FINISHED** at **2026-11-05 17:44:22.355 UTC**.
  [Install reset comparison](https://expo.dev/accounts/mbcollins2/projects/softek-ios-poc/builds/9f8d1a60-3a75-4b37-b0bb-cb9362eee03c).
  IPA **8,302,242 bytes**, SHA-256
  **`b6af85592fdcee3d8063e20323076333c2c6adf74bbeed6821424507e037ddfe`**.
  Identity/version/build, profile CMS signature and matching team/device set,
  nondebugging/unchanged permission descriptions, embedded signature presence,
  module linkage and reset text in bundle verified on Linux; not full Apple
  codesign or on-phone reset proof. Reports `artifacts/overlay-build-13.json`,
  `artifacts/overlay-ipa-13-check.json`, `artifacts/overlay-reset-manifest.json`.
  App/candidate source hashes match submission; native module source unchanged
  from the successful build 12. Owner confirms “Reset and fresh tooltip check work,”
  establishing build-13 installation, cleared prior entries/empty form, fresh
  labeling and a second actual bubble capture. The three-trial target still needs
  one explicit repeat; keyboard-visible exclusion/dismissal and other physical
  checks remain. No code or build changes for this result; documentation/diff
  checked, no application tests rerun.
  No server/deployment/schema change, commit or push for this refinement.

- **Plan 025 Stage B — implemented/deployed, device acceptance pending.** Owner explicitly advanced after the fps explanation. Added negotiated `changes-v2` beside legacy `periodic-v1`; initial screenshot plus change requests, no idle capture timer, minimum 500 ms spacing, one capture in flight. Native/web clocks are calibrated; geometry probes bracket captures; passive local UI/scroll/touch observation sends typed metadata without DOM/input/error text. Opaque menu/dialog container IDs prevent incorrect gesture assignment. Native batches/queues/lifecycle and terminal failure behavior are bounded. Sparse admin review holds idle images, exposes capture/event/coalescing counts and nearby events. Replay supports sparse holds, recorded scroll timing and actual tap/swipe glyphs, with geometry/uncertainty fallback and one viewport scale. Exports remain manual CLI actions after finalized uploads.

  **Schema/rollout:** migration **0014**, local commit **`51cc902`**, checksum `e7d5f0d095696382538f04dd5a6359a0e9f2b1d43ba11b416e85a93073c1540b`, applied cleanly to both `demo` and `demo_test` on `127.0.0.1:3306` through `softek_migrator`; runtime remains non-admin. Frame insert shape retains 12 columns. Backup **`/var/backups/softek/change-capture-2026-11-05T08-38-30Z`** contains `demo-before-0014.sql` (1,094,758 bytes), test backup, schema/ledger/config/link identities. Previous API/web **`2026-11-05T07-16-00-994Z`**. Initial Stage B API/web **`2026-11-05T09-19-33-557Z`**, superseded by the Plan 026 release above. Both screenshot gates enabled explicitly, existing Clarity/Phoenix profile and DB revisions preserved. All 17 site hashes unchanged; original six recording metadata rows unchanged. No new port or Nginx limit change. Source/retained replay files remain private.

  **Checks actually passed:** migration upgrade/repeat/retained-data/cascade/partial-DDL probe; **22** sequential receiver/replay TAP entries (15 receiver + 7 replay); **20 core + 13 rendered/adapter** native tests; **12 browser cases** across Chromium 360/390/1440 and WebKit 440, plus targeted WebKit surface recheck. Real FFmpeg fixtures verify event-guided pauses/pans, encoded glyph positions, short viewport scaling and omission on an uncaptured dialog. Typecheck, evaluation build, formatting/diff checks and Expo iOS export (661 modules, 1.7 MB) pass; EAS archive **34 files**, no private inputs. API and browser suites must run separately because their active-session quota is shared. Latest glyph/geometry refinements are fixture-checked; physical fidelity is not inferred.

  **Actual HTTPS checks:** new-policy smoke uploads two same-second images (100/600 ms) plus two events, deduplicates retries, checks private/hash/timestamp/size boundaries; legacy smoke also passes. Both remove their owned fixture/session/files. Reports: `artifacts/recording-public-changes-smoke.json`, `artifacts/recording-public-smoke.json`; readback/settings comparison `artifacts/change-capture-rollout-check.json`. No real new-policy device session was present at that comparison. Website analytics remained blocked in routine browser checks.

  **Signed preview:** **0.3.0 (11)**, EAS **`8fc8bfd9-fbda-4429-8ed5-07d125a10ad2`**, FINISHED. [Install](https://expo.dev/accounts/mbcollins2/projects/softek-ios-poc/builds/8fc8bfd9-fbda-4429-8ed5-07d125a10ad2). IPA **8,286,134 bytes**, SHA-256 **`6f471fab525f7b906677ef6d534a267b6c9709b47631d28cf6876f4294754dd5`**. Bundle/team/profile CMS, embedded signature presence, release/nondebugging and device-set match to accepted build 10 checked on Linux, not full Apple codesign validation. Private artifact/report: `artifacts/change-capture-0.3.0-11.ipa`, `artifacts/change-capture-ipa-11-check.json`, `artifacts/change-capture-build-11.json`. Native sources stayed unchanged after this build's submission; later refinements were web/renderer only.

  **First real build-11 session:** **`af19eb19-a310-4e1c-b81a-a676f73c3898`**, started **2026-11-05 15:52:03.278 UTC**, finalized Stopped at **63,187 ms**. All **38/38** images and **194/194** events received; **36** merged triggers, no reported losses. Events: 152 scroll, 17 swipe, 8 tap, 8 UI, 5 content, 3 route, 1 viewport; no error event in this session. Frame 2 at 1,492 ms is followed by no events until 15,361 ms and no next image until 16,288 ms; frame 37 at 50,380 ms is followed by no events until 61,413 ms and next image at 61,548 ms. These establish idle suppression without asking the owner to repeat it. Capture work 31–49 ms, minimum spacing 505 ms; 18 captures marked unstable during motion. No physical memory profiling inferred.

  **Actual replay / renderer revision 5:** owner reports full replay looks good overall, but 24→25 and 33→34 were choppy and the short excerpt seemed to omit motions. Both pairs had valid content overlap rejected by moving scrollbar pixels at the image edge (prior edge error 26.09/26.67, second match 96.77%). Alignment now excludes only the outer one-sixtieth-width gutter and refines every full-resolution content pixel, retaining the same acceptance thresholds. Accepted offsets **579/462 px**, matches **98.83%/97.69%**, edge error **18.17/21.05**. Four former cuts now animate: **24→25, 28→29, 33→34, 34→35**; all source frame metadata/hashes unchanged. Original full-width pixels remain in composites. The previous idle-onset correction is retained. Regenerated only this session's derivatives atomically; no native rebuild or API/web deployment.

  **Latest output/checks:** short excerpt now **34,000–49,000 ms**, **15.000 s / 951,295 bytes**, selected to include both flagged pairs; it is an excerpt, not the complete recording. Full **63.209 s**, **+22 ms** (within one 24 fps frame), **3,374,014 bytes**, 720×1436. 29 reconstructed intervals, three fully event-guided paths, 12 onset-guided intervals; remaining motion is estimated/cut as labeled. Render **37,712 ms**, Node peak **178,644 KiB**, child peak **188,588 KiB** (separate peaks). Seven replay tests and script typecheck pass, including moving-scrollbar acceptance, changed-page/fixed-header rejection, encoded idle fallback and FFmpeg decode/duration. Intermediate actual transition frames visually inspected. HTTPS anonymous denial, admin range/no-store byte hashes, WebKit 440/Chromium 1440 sample/full playback and seeking to 47.8 s pass; no layout/page errors, external requests blocked, temporary admin session removed. Reports: `artifacts/change-capture-transition-check.json`, `artifacts/change-capture-transition-public-check.json`. Earlier timing/idle evidence remains in `artifacts/change-capture-phone-timing-check.json`; no idle retest needed. Private inspection image/video copies removed after review.

  **Owner acceptance:** both revision-5 transitions confirmed smoother. The short excerpt starts with snapshot 23 because it covers seconds 34–49; full replay starts with snapshot 1. The owner requested where to find a form error; verified source validation at Savings Goals → Create a goal, name `Test`, target `0`, displays the $1–$1,000,000 validation message without creating a goal. Inline error device proof is recorded immediately below.

  **Form-error device evidence:** owner confirms the inline amount error is captured, along with intermediate typed-name states. Read-only server inspection found finalized session **`8e15dc19-b219-44ee-851e-7c5d54a7b783`**, started **2026-11-05 16:28:35.887 UTC**, Stop **30,299 ms**, **30 images / 97 events**, expected events 97, loss 0. Frame **15 at 15,856 ms** visibly includes `Test`, target `0` and the inline amount validation message; matching error events at 15,743 ms. Earlier session **`812454f9-1bee-45e8-85bd-98227835220f`** (16:24:59.419 UTC, 34 images / 78 events, no reported event loss) has error-triggered frames **9 at 16,058 ms** and **15 at 30,559 ms**, about 114/101 ms after error events. Both show a focused empty Goal name but omit the browser's “Fill out this field” bubble, matching the owner's report. Thus detection/capture requests work, while these overlay pixels are absent. Local view-shot captures the referenced view hierarchy; WebKit's iOS validation bubble is a separately presented UIKit popover ([implementation](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/ios/ValidationBubbleIOS.mm)). This supports a capture-boundary explanation, without proving the exact iOS hierarchy/timing on the phone. Native popover coverage is an explicit unresolved limitation; no code, validation UX, native scope or app build changed for this report. Source confirms input observation requests `content` after a 300 ms pause; intermediate text can appear in approved images, while event payloads contain no input values. Private inspection copies removed. No application tests needed for this documentation/read-only check.

  **Pending:** remaining new-mode lifecycle/offline checks, native validation-popover capture follow-up and existing profiling/operational follow-ups. VID-05/06/07 remain open until their full criteria are checked. No current automated failures. Only migration 0014 is committed; other Stage A/B source/tests/docs remain uncommitted; no push. Owner `IMG_2008.jpeg` and `temp/` are untouched.

- **Prior Plan 025 Stage A / B-025 — deployed and accepted for progression.** Added
  `recordings:replay` CLI, deterministic timing/hash/offset manifest, conservative
  vertical image registration/compositing and FFmpeg pan rendering. Uses existing
  approved images only, preserves pauses/initial absence, cuts unsupported changes,
  labels capture UTC and elapsed time separately, and invents no gesture telemetry.
  Private atomic exports, separate render lock, bounded working reservation/derived
  quota accounting, stale-work cleanup and authenticated range/no-store video
  delivery are implemented. Admin review adds inline sample/full/downloads.
  Phone capture and legacy receiver contract remain **1 Hz**, app **0.2.1 (10)**.
  No schema migration, dependency installation, EAS build, new port or public assets.

  **Owner feedback / revision 2:** initial phone playback looks good except a
  larger leap around nine seconds, specifically source **14→15 and 15→16**.
  Original registration searched only half a viewport. Their actual displacements
  are **−994 px** and **−776 px** on 1327px images: both exceed that limit while
  retaining valid overlap. Extended the bound to three-quarters with unchanged
  strict matching (98.87% and 97.25% matched). Full-source comparison adds **only
  these two** animations; the earlier 20 decisions are unchanged. Encoding now
  generates **24 fps** rather than 12 from the same 139 screenshots. No new capture.
  Added explicit `--replace`, staging/validation and Linux atomic directory exchange
  to retain the prior complete export until replacement succeeds. Six replay tests
  pass, including quarter-viewport overlap, exact source crop, failed/successful
  exchange and actual FFmpeg duration/decode. Scripts typecheck/format/diff pass.
  Published **2026-11-05T08:16:58.207Z** without any API/web/service change; latest
  HTTPS playback/seek/hash/range/no-store checks pass in WebKit/Chromium. Owner was
  asked to reload the whole review page and reassess those transitions before Stage B.

  **Produced:** retained recording **`a88bbb7b-f78b-46ee-85cc-a7c4c998fbfb`**,
  139 frames; **15.000 s** sample (0 ms error), **139.250 s** full replay versus
  Stop **139.234 s** (16 ms error). Twenty-two estimated scroll intervals total
  **21,993 ms**; initial 0–1,011 ms explicitly has no image. Outputs **720×1436**
  include a separate label band and padding; source remains 720×1327. Sample
  **1,196,355 bytes**, full **9,148,405 bytes**, render **68,850 ms**. Peak Node RSS
  **180,504 KiB**, largest child **182,224 KiB**, separate peaks, not simultaneous
  combined memory. Files under the recording's private `replay/`, 0750/0640 and
  `softek:softek`. Source retention is **2026-11-12T05:46:56.993Z**; videos expire
  with their parent. Public delivered hashes match private files.

  **Rollout:** API/web **`2026-11-05T07-16-00-994Z`**; scoped configuration/link
  backup **`/var/backups/softek/replay-rollout-2026-11-05T07-14-27Z`**. Previous API/
  web release **`2026-11-05T01-07-31-794Z`**. API/cleanup timer healthy; updated
  worker pinned to new release. Actual cleanup and dry-run show zero stale work,
  missing/orphan/temp files or expired records. All **17** site-available hashes
  unchanged. Original six recording metadata rows and Clarity/Phoenix values and
  revisions verified unchanged. At that Stage A rollout, DB was migration **0013**; Stage B is now **0014**.

  **Verification:** initial 18 focused replay/receiver TAP entries, eight local browser
  cases (Chromium 360/390/1440, WebKit 440), typecheck, evaluation build, formatting
  and Git diff checks pass. HTTPS WebKit 440/Chromium 1440 play and seek the actual
  sample, correct dimensions/duration, no page errors/overflow/vendor requests;
  anonymous access denied, both MP4 hashes/range/no-store checked, temporary admin
  session revoked. Evidence **`artifacts/replay-public-check.json`**; renderer report/
  manifest remain private with the recording. Visual inspection of three extracted
  scrolling positions found readable text and aligned content; six further sampled
  positions confirm reconstructed content through both corrected transitions.
  Phone playback is confirmed and the owner explicitly advanced to Stage B after
  the 24-fps clarification. The retained Stage A review is at
  [the review](https://demo.bawebtech.com/controls/recordings/a88bbb7b-f78b-46ee-85cc-a7c4c998fbfb).
  VID-02/03 are accepted for progression. No current automated failures; fixed
  fragmented test-container seek failure is documented in TESTING. Gesture/scroll
  metadata and early/same-second capture are implemented in Stage B as described above.

  **Uncommitted:** Plan 025/docs, CLI/renderer/private-files helper, receiver/review/
  CSS/package script and focused tests. No commit or push in this session. Owner
  `IMG_2008.jpeg` and `temp/` remain untouched/untracked. Remaining Plan 023/024
  profiling/operational work is unchanged.

- **Git delivery — source pushed and verified:** implementation/tests/runbooks
  committed as **`7f605c9`**, with existing schema commit **`a702319`**, on
  `origin/main`. Verified the remote branch SHA equals the implementation commit
  after push; this final handoff note is recorded in the following docs commit.
  Reviewed 51 candidate paths against private environment values/key/token
  patterns: no credential findings; explicitly staged the 50 changed POC files.
  Owner `IMG_2008.jpeg` and `temp/` remain untracked, with ignored artifacts/
  environment/signing files excluded. Plain HTTPS push lacked a credential
  helper; the existing GitHub CLI login completed the push using a command-scoped
  helper ([runbook](LOCAL_SETUP.md#github-push-authentication)). Shared Git settings
  were not changed. No application tests were rerun for commit-only work; the
  recorded automated checks and physical acceptance below remain the evidence.
  Git diff/staged scope/credential checks passed. No deployment/service/collection
  setting change was performed for this Git task.

- **Plan 024 — deployed functional POC accepted; profiling/operational follow-ups open.**
  **Final build-10 acceptance:** owner confirms offline/reconnect retains login,
  capture stays Stopped until explicitly started, force-close still requires login,
  and a new recording appears in admin review. Independent readback at **06:21 UTC**
  confirms **13/13 frames**, sequences 1–13, state stopped, reason Stopped, duration
  **13,517 ms**, finalized **06:20:50 UTC**. Captures **41–54 ms**, images 720px
  wide, **854,385 stored bytes**. Native SoftekPOC/10 requests are present in the
  access log. This resolves the earlier absence of a new-build upload, rather than
  treating the first generic response as server evidence. Evidence:
  `artifacts/recording-device-build-10-upload.json`. Normal two-minute review and
  all requested background/lock/reload/logout/force-close/offline phone cases pass.
  No more routine device checks are needed for the delivered core POC. API/DB and
  API/cleanup timer were healthy at the preceding read-only check. No new code,
  config, service operation or collection setting change during final acceptance.
  Process-memory profiling, extended slow-network/failure exercises and a live
  rollback drill remain unperformed; REC-01/07/08 are not marked complete for them.

  **Offline follow-up:** owner confirms lock/unlock, native Reload and sign-out/
  sign-in each stop recording until a fresh Record tap. With Wi-Fi disabled,
  however, the **whole native app shows Unable to open the demo / Try again**;
  recovery then requires login. This is the native shell, not merely recording
  creation failure. Build 9's conditional rendering unmounts the WebView on any
  load failure, discarding its temporary cookie store. The exact native error
  event/code was not captured; the unmount/session-loss path is directly present.
  Accepted **0.2.1 (10)**, **980c35af-c9ac-48b7-8a84-2c61f40c4f80**, is
  **FINISHED at 2026-11-05 06:07:16 UTC** through normal `preview`; offline/login
  behavior and the new upload are accepted/verified above.
  [Install offline-recovery build 10](https://expo.dev/accounts/mbcollins2/projects/softek-ios-poc/builds/980c35af-c9ac-48b7-8a84-2c61f40c4f80).
  IPA **8,279,655 bytes**, SHA-256
  `d29969b049dd078454980af706a5f000336b8169f412f7c68e6d432606876813`.
  Inspected bundle/version/build and corrected JS; embedded profile CMS signature,
  expected app/team, release entitlements and registered device set match.
  This Linux artifact/profile inspection does not establish native cookie recovery
  or verify Apple's whole-app code signature. It keeps the WebView mounted
  behind an opaque/input-blocking/accessibility-hidden connection error screen.
  Explicit Retry issues a fresh GET at home with a counter query parameter so
  iOS cannot ignore an identical source URL; it never replays a form submission.
  Capture invalidates on failure and cannot auto-restart on recovery; failed
  loadEnd does not bootstrap a new bridge. Actual content-process termination
  retains replacement-on-retry and can still require login; force-close keeps
  the accepted fresh-session policy. No native dependency or capture-method change.
  Mobile typecheck and **17 core + thirteen adapter/rendered tests pass**; iOS
  export **660 modules / 1.7 MB** and actual **32-file** archive pass. First new
  wrapper assertion selected the stub component rather than its containing View;
  corrected to inspect the actual wrapper, all tests pass. Actual recovery/login
  behavior is now owner-confirmed separately from mocks. Evidence: ignored/private
  `artifacts/recording-offline-recovery-*`. This correction changes native source/
  version/lockfile metadata/tests/docs only; live web/API/schema/Clarity/Phoenix
  remain unchanged. Plan 024's architecture anchor also corrected.
  Targeted formatting, documentation link targets and Git diff checks pass.
  Source changes are now committed/pushed as recorded above. No service operation
  or new server collection during correction acceptance; owner files untouched.

  **Two-minute journey passed:** owner answered affirmatively to the recording/
  scrolling/menu/error-review request, with readable screenshots and no new shots
  after Stop. Actual readback at **2026-11-05 05:51 UTC**: **139/139 frames**, all
  sequences 1–139, elapsed **1,011–139,015 ms**, Stop **139,234 ms**, state stopped.
  Capture-plus-copy **35–64 ms**, mean **45.6 ms**; stored re-encoded images
  **47,117–92,064 bytes**, **9,642,594 bytes total**, all **720×1327**, zero
  clock-uncertainty flags. Readback occurred after finalization with no extra
  acknowledged frames. Prior backgrounding sessions also show stopped/Backgrounded
  in server metadata. Evidence: private/ignored
  `artifacts/recording-device-two-minute-metrics.json`. These measurements do not
  establish native process memory usage; remaining lifecycle cases are below.

  **Latest device/server evidence:** actual phone session received **17 screenshots
  / 17 scheduled slots**, state **stopped**, reason **Stopped**, finalized
  **2026-11-05 01:17:59 UTC**. **Owner confirms they can step through the server
  screenshots and they are readable/consistent with the app.** Core capture →
  upload → private review works on the signed phone build. At **01:29 UTC** the
  session still has 17 frames, sequences 1–17, elapsed **1,011–17,012 ms**, Stop
  **17,650 ms**, capture-plus-copy **35–50 ms (mean 42.1 ms)**. Stored re-encoded
  frames are **49,524–91,859 bytes**, total **1,211,799 bytes**, all **720×1327**,
  with zero clock-uncertainty flags. These are server/readback and client-reported
  measurements; they do not measure native process memory or prove other lifecycle
  cases. Evidence: `artifacts/recording-device-first-session-metrics.json`.
  The longer journey is now accepted above; remaining lifecycle acceptance stays open.
  **Owner now confirms backgrounding during recording stops it and returning
  leaves it Stopped until a new explicit Record tap.** This completes that physical
  lifecycle case. **Owner also confirms force-close/reopen/sign-in leaves
  recording Stopped until a fresh Record tap.** Lock, Reload and sign-out now
  also pass; offline recovery follow-up is above.
  Owner initially could not sign into admin. Recent browser requests returned **401 password
  mismatch**, not 429/network failures. Verified the actual public sign-in form
  with the private configured password: **200**, Recordings rendered, own admin
  session logged out. **Owner now confirms admin sign-in worked.** Password is unchanged from the deployment backup/workspace.
  Resolved by directing owner to private `.env` → `DEMO_ADMIN_SECRET`, value only, and
  `/controls/recordings`; do not print/reset the secret. No application/config/
  service/password change for this investigation. Earlier browser check used an
  incorrect button label; corrected form check passes. Owner image review passed.

  Owner confirmed signed local **0.2.0 (8)** captures screenshots and supports
  scrolling through local review, then explicitly authorized deployment and an
  integrated transmitting app. The photographed size-check failure was an
  unawaited asynchronous Expo FileSystem `copy()`; the adapter now waits before
  metadata/source release, uses `info()` and reports distinct size failures.
  A deferred-copy regression reproduces the old race and passes after correction.
  Remaining detailed fidelity/cadence/memory and lifecycle evidence stays open.

  **Live web/API release: `2026-11-05T01-07-31-794Z`**, both current links updated.
  Production **demo** migrated **12 → 13** through committed **0013 / a702319**;
  **demo_test** is also at 13. No pending migrations/drift. Exact production
  target/account established first: `127.0.0.1:3306`, `demo`,
  `softek_migrator@127.0.0.1`; runtime `softek@127.0.0.1` remains CRUD-only.
  Root-only retained schema/data/ledger and configuration/runtime/node backup:
  **`/var/backups/softek/recording-rollout-2026-11-05T01-06-35Z/state.json`**
  (database dump **782,213 bytes**). Previous targets for compatible rollback:
  web `2026-11-04T19-17-29Z-input-zoom`, API `2026-10-14T22-49-13-460Z`.
  LOCAL_SETUP owns rollback; retain tables/images and the pinned cleanup release.

  Receiver is enabled through existing HTTPS 443/API loopback 3100; no new port
  or security-group change. Private `/var/lib/softek/recordings` is **0750**,
  images **0640**, owned by `softek:softek`. Only the recording frame upload
  route gains the 2 MiB Nginx exception. API images retain a 1 MiB cap.
  `softek-recording-cleanup.timer` is active; its successful worker is pinned to
  this exact API release. Runtime-user production dry-run: zero expired, orphan,
  temporary or missing files. An initial direct CLI invocation omitted runtime
  environment loading; reran with the actual private runtime environment as
  `softek`, successfully. This was an invocation issue, not a receiver defect.

  Live Clarity evaluation profile and Phoenix runtime gate preserved; existing
  MariaDB collection/tracing values **and revisions/hashes are unchanged**.
  All private runtime values match the backup except the three intended keys:
  `RECORDING_DIR`, `SCREENSHOT_RECORDING_ENABLED`, `SOFTEK_RELEASE`.
  **27 unrelated Nginx configuration fingerprints unchanged**. Nginx syntax,
  API/DB health and Softek API/Phoenix/Nginx/MariaDB are healthy/active.
  Routine workspace defaults remain collection-off; deployment used explicit
  preserved profile/gates. No Microsoft/vendor traffic was used for checks.

  **Actual public HTTPS receiver smoke passed**: generated **418,796-byte** JPEG,
  upload 201; stored re-encoded **502,207-byte 720×1100** image matched its DB hash;
  distinct capture/receipt UTC read back; anonymous read **401** and authenticated
  image `no-store`; expected ordinary/API-image/proxy limits all **413**.
  Actual runtime file/directory modes verified. Owned recording/customer/admin
  session removed; database and private path cleanup checked. This was generated
  fixture data, not a native screenshot. Evidence: private/ignored
  `artifacts/recording-public-smoke.json`, `recording-rollout-*`.
  Public **WebKit 440px / Chromium 1440px** admin-list checks passed enabled
  receiver, page bounds and retained 16px login controls; zero page errors/vendor
  requests. Receiver/migration **14 focused tests pass**, including simulated
  low-free-space/shared-quota refusal before publication; root typecheck and
  evaluation build passed. Prior full API suite 135, eight local recording UI
  and ten layout cases remain previous-session evidence, not rerun claims.

  **Integrated signed 0.2.0 (9)**, build
  **`ba7c5bcf-787c-40f8-a2ae-beeee0b64fdf`**, **FINISHED**
  **2026-11-05 01:11:41 UTC**.
  [Install Softek POC build 9](https://expo.dev/accounts/mbcollins2/projects/softek-ios-poc/builds/ba7c5bcf-787c-40f8-a2ae-beeee0b64fdf).
  IPA **8,279,144 bytes**, SHA-256
  `799c44a602392963b8f3d35336e4edcb4a88d788fcaba2ecdc3167e4089db1eb`.
  Bundle/version/build/JS and embedded profile CMS/app/team/release entitlements/
  registered device set inspected. Linux artifact/profile inspection does not
  verify whole-app Apple signing or actual native network behavior. Normal
  `preview` explicitly sets `EXPO_PUBLIC_CAPTURE_CHECK=0`; it opens banking and
  supports explicit Record/Stop uploads. `capture-check=1` retains local diagnosis.
  iOS export **660 modules / 1.7 MB**, actual **32-file** EAS archive passed.
  Build 8 was local-only; earlier builds 3/7 failed and 4/5/6 were superseded.
  Do not distribute build 6. Native 17 core + eleven adapter/rendered checks
  passed before the build-9 metadata/profile selection; runtime capture code is
  unchanged from the phone-proven copy fix. No dev server/Metro is required.
  Final root typecheck, targeted formatting/Git diff and **117 local documentation
  link targets** pass. Public health and API/cleanup timer remain active. The
  generated fixture's private directory is confirmed removed.

  **Remaining follow-ups:** native memory and extended slow-network/failure
  profiling, operational rollback validation, and Plan 023's separate remaining
  assertions. The requested functional/native lifecycle checks are accepted.
  Keep future routine checks collection-off; no additional scope is implied.
  Do not infer those checks from generated HTTPS uploads or mocked native tests.
  Git delivery is recorded above. Owner `temp/` and `IMG_2008.jpeg` remain
  untouched/untracked; the image is excluded from EAS uploads.

- **B-027 / IOS-09–10:** owner authorized changing the previously accepted login
  persistence policy. `apps/mobile/App.tsx` now sets `incognito` and
  `sharedCookiesEnabled={false}`. Installed WebView source maps this on iOS to
  `WKWebsiteDataStore.nonPersistentDataStore`, without importing shared native
  cookies. New version **0.1.1 (2)** keeps the same Softek bundle/EAS identity.
  Cookie/browser-storage lifetime is this WebView instance: ordinary Reload and
  backgrounding preserve it while the view/process survives; force-close/new
  process or error recovery that recreates the view requires sign-in again.
  No kill callback, global cookie clearing, backend logout-on-kill or new SDK.
  Bank data and normal server session expiry remain authoritative in MariaDB;
  Safari and hosted website login policy are unchanged. Browser-only consent/
  preferences also start fresh when the temporary store is recreated.
  Mobile typecheck, seven policy/state and four rendered-handler checks pass,
  including ephemeral/no-shared-cookie wiring. Expo Doctor **20/20**, iOS export
  (634 modules, 1.6 MB), format and 24-file EAS upload inspection passed; only
  mobile version metadata changed in the lockfile, no existing dependency version.
  EAS preview **a67d553b-02fd-4e28-ba45-9159d8a4ba11**, **0.1.1 (2)**,
  **FINISHED at 19:59:13 UTC / 11:59 PST**.
  [Install the updated app](https://expo.dev/accounts/mbcollins2/projects/softek-ios-poc/builds/a67d553b-02fd-4e28-ba45-9159d8a4ba11).
  Downloaded IPA **8,227,620 bytes**, SHA-256
  `80f3c641b9ade409f87c61196315e0aa7efea97e939bf690d213ccadc749fd66`.
  Checked name/bundle/version/build, included JavaScript (differs from build 1),
  and CMS-verified embedded profile for the expected app/team/registered iPhone
  with no debug entitlement. This inspects artifact identity/profile, not native
  cookie lifetime or Apple application code signing on this Linux host.
  Evidence is ignored/private `artifacts/fresh-login-*` files. IOS-09 is complete.
  **Owner installed build 2 and confirmed Reload/app switching retain login,
  while force-close/reopen requires sign-in.** The requested session-policy
  behavior has passed on the iPhone, completing B-027's requested change.
  IOS-10 remains open for explicit saved-data return after re-login, sign-out,
  retained zoom/layout and Safari-isolation checks; these were not individually
  confirmed by the selected response. IOS-05/06 broader acceptance remains open.
  Hosted frontend remains
  `2026-11-04T19-17-29Z-input-zoom`; no web/backend deployment, service operation,
  database/collection change or dependency upgrade was performed for B-027.
  Initial build 1 results below are historical, not acceptance of the new policy.

- **B-026 / IOS-07–08:** the owner authorized the focused Plan 023 amendment.
  **Owner confirms Account Summary and an account detail page fit after fresh
  sign-in without pinching, following the 16px form-text release. B-026 and
  IOS-07/08 are complete.** The outline-only release had not resolved sideways
  movement; pinching out made the signed-in page fit and removed the symptom. This
  establishes a zoomed visual viewport, not a demonstrated over-wide card layout.
  Shared `input, select` text was 15px, a candidate trigger for iPhone focus zoom.
  Controls now use 16px while preserving user pinch zoom and existing card sizing.
  **CSS-only frontend `2026-11-04T19-17-29Z-input-zoom` is live**, with
  `/assets/index-DblOOSg2.css` (SHA-256
  `0c45e8b541dc873ae88c1257101bfab8b8b42f5d1be3a1445995a6fec7610c15`).
  Compiled CSS differs from the prior release only by shared input/select font
  size 15px → 16px. Two pre-change WebKit cases failed on 15px; all **10 focused
  cases** now pass readable controls, retained user zoom, page/focus bounds,
  keyboard menu, vertical and contained table scrolling. Root typecheck/build/
  format passed. Public WebKit confirms both login inputs are 16px, viewport
  metadata permits zoom, normal-scale widths are 440px, zero external requests
  and API/DB health OK. Exact active JavaScript and collection marker, API
  release/process and all 33 configuration hashes/links remain unchanged.
  No native build or backend operation. Backup/rollback manifest:
  `/var/backups/softek/input-zoom-2026-11-04T19-17-29Z/state.json`.
  Evidence: `artifacts/input-zoom-before.log`, `input-zoom-after.log`,
  `input-css-release.json`, `input-css-public-check.json`.
  The owner was asked to Reload, reset existing zoom once, then sign out/in
  without pinching afterward. The owner answered that both pages fit after
  signing in, confirming the correction on the installed iPhone app.
  Reproduced the rust line as main's 3px focus outline with a 4px outward offset,
  painting **7px outside each screen edge**. Two pre-fix WebKit checks failed on
  these bounds. Desktop WebKit/Chromium reported root width 440 and scrollX 0,
  so actual iPhone sideways scrolling was not reproduced locally; the outline
  is a confirmed paint issue, but the owner check ruled it out as the sufficient
  correction for sideways movement.
  Only `#main:focus-visible` now has inset offset -7px. Route/skip-link focus,
  interactive focus rings, vertical scroll and contained report scroll remain.
  **10 focused cases passed** (WebKit 360/440/1440; Chromium 440/1440), covering
  login, six signed-in routes, keyboard menu, skip link and real report tables.
  Root typecheck, collection-off build, format and Git whitespace passed; the
  initial NodeNext config import was corrected. No local check remains failing.
  First CSS-only frontend `2026-11-04T18-56-14Z-focus-outline` was deployed;
  it is retained and superseded by the input-zoom release above.
  Verified the compiled CSS differs from the previous asset by exactly the one
  inset rule. The new HTML references `/assets/index-C0yCtRro.css`; actual served
  CSS SHA-256 matches the release. Active `/assets/index-A56xcmfI.js` bytes,
  collection-mode marker, API release/process, runtime/unit and **33 configuration
  file hashes/links** are unchanged. No backend restart, Nginx reload/config edit,
  database/collection mutation or native rebuild. Prior frontend is retained;
  rollback is in LOCAL_SETUP. Root-only release manifest:
  `/var/backups/softek/focus-outline-2026-11-04T18-56-14Z/state.json`.
  Public HTTPS health confirms DB connected; WebKit 440px login/keyboard-focus
  bounds and zero horizontal scroll passed with **zero external requests**.
  Private/local evidence: `artifacts/layout-before.log`, `layout-after.log`,
  `focus-css-release.json`, `focus-css-public-check.json` and layout screenshots.
  IOS-08's CSS release checks and IOS-07's fresh-login phone confirmation are
  complete. The input-font release resolved B-026; the outline release alone did not.

- Plan 023 implementation is authorized. `apps/mobile` now contains the Expo
  WebView shell, native icon/splash, safe areas, loading, manual error/timeout/
  process recovery, Back/Reload and exact-origin navigation policy. It loads the
  live website with normal WebView cookies, without a new API/auth mechanism,
  recording SDK, native message bridge or collection-setting change.
  SDK **58.0.23**, React **19.3.0**, React Native **0.88.1**, WebView **14.0.1**.
  SDK 58 matches the existing web React; no preexisting package version changed.
  The website build names only web/API workspaces; normal build never invokes EAS.
  EAS owner **mbcollins2**, project **softek-ios-poc**, project ID
  `e9e5458a-8ba3-4c49-82d4-26408cb29fb7`, bundle `com.bawebtech.softek.poc`.
  Apple team is configured in app.json; EAS found one registered iPhone.
  The owner completed Apple sign-in and configured an active, Softek-specific
  ad hoc profile, reusing the existing team distribution certificate and including
  their iPhone. Ctrl+C exited the credentials menu after settings were saved;
  its exit 130 is expected, not a signing failure. The prior expired-session
  blocker is resolved. The upload archive was rechecked (24 allowed files), then
  EAS internal iOS preview **0.1.0 (1)**, build
  **bc1cb6da-ce54-4e4f-b198-970bd3eebdcf**, **FINISHED** at
  **18:31:25 UTC / 10:31 PST**. [Install/build page](https://expo.dev/accounts/mbcollins2/projects/softek-ios-poc/builds/bc1cb6da-ce54-4e4f-b198-970bd3eebdcf).
  Downloaded IPA **8,227,623 bytes**, SHA-256
  `cf68893975e8cc2e7a15034e9b8a06034c76c01d9701088e0ac956db314b19c6`.
  Inspected Info.plist for Softek name/bundle/version, bundled JavaScript, and
  CMS-verified embedded profile for the correct app/team, included registered
  phone and disabled debug entitlement. This is artifact inspection, not a local
  Apple code-signature or actual-device runtime test. Private evidence:
  `artifacts/softek-ios-build-status.json`, `artifacts/softek-ios-ipa-check.json`,
  and `artifacts/softek-ios-preview-0.1.0-1.ipa` (0600).
  **Owner confirmed installation, login and navigation work on their iPhone**
  in response to the signed-app check, with Metro stopped. IOS-04 is complete.
  This confirms the basic standalone flow, not every device-matrix case.
  On initial build 1, owner confirmed login persists after fully swiping the app off-screen
  and reopening it. This verifies valid-session persistence on the phone; it
  does not establish expired-session handling. Owner subsequently confirmed
  that signing out, force-closing and reopening keeps the app signed out at the
  login screen. These were the build-1 persistence results; B-027 intentionally
  supersedes cold-launch login persistence in the update.
  Owner also confirmed Airplane Mode/Reload shows the error state and restoring
  connectivity/Try again recovers the demo. Offline recovery has passed.
  Owner reported whole-page sideways movement on signed-in pages, with login
  unaffected, and identified the over-wide rust line below titles. The initially
  discussion-only observation became the authorized B-026 correction above.
  Mobile layout acceptance and IOS-05/06 remain open. Invalid-login messaging, detailed
  keyboard/layout, full route coverage, external navigation, consent/network
  evidence and Safari coexistence are not yet explicitly confirmed on the phone.
  No other issue reported. EAS reports pay-as-you-go usage on the existing account.
  **Verified:** seven policy/state tests and four rendered-handler tests;
  **20/20 Expo Doctor checks**; SDK dependency check; root typecheck/format;
  iOS export (634 modules, 1.6 MB Hermes bundle); collection-off web/API build;
  real EAS archive check (**24 files**, no private/server sources/Git history)
  and archive npm-install dry run. Public API health reports DB connected.
  SDK-57 duplicate React/obsolete splash configuration and a test-renderer React
  resolution issue were fixed; no local implementation check remains failing.
  Basic iPhone installation/login/navigation are owner-verified; remaining device
  checks are listed above. Existing web chunk-size advisory
  and test-renderer/Node timer notices are unchanged non-failing advisories.
  Optional Expo Go preview was checked on dedicated Metro **8083**, including
  HTTPS tunnel launch page, status and iOS manifest. It has now been stopped
  deliberately for standalone acceptance: verified project process group 7662
  was terminated, the PID file removed, and port 8083 confirmed closed. Its old
  ephemeral URL is no longer an installation link. Only this project's preview
  was stopped; the banking website and AWS processes were not changed.
  LOCAL_SETUP/TESTING own executable commands and native acceptance limits.
  Owner-authorized Git handoff includes mobile sources/assets, root package/
  lockfile, Git/EAS ignore rules, scoped build integration, Plan 023 and maintained
  root documents, shared CSS fixes and focused layout spec/config/type coverage.
  Root typecheck, all 11 mobile tests, root/mobile-helper formatting and diff
  checks passed again before committing. Earlier acceptance evidence above is
  retained; broader phone acceptance remains open as listed. Owner `temp/` is
  excluded; generated artifacts and signing credentials remain ignored. AWS
  files/processes remain untouched. The CSS-only frontend releases above are the
  only web release change; no backend deployment, migration or data reset.
  Inspect Git history and the remote ref for the resulting commit/push identity.

- **Owner-requested resumption on 2026-11-02 at 12:31 PST / 20:31 UTC.**
  Restored the retained release **2026-10-14T22-49-13-460Z** using LOCAL_SETUP's
  restore steps. The API and private Phoenix units were enabled and started;
  the exact prior live Nginx site was restored from the root-only shutdown backup
  `/var/backups/softek/shutdown-20261017T160358Z/`. The maintenance site is retained
  at `/var/backups/softek/resume-20261102T203120Z/maintenance-nginx.conf`.
  Nginx syntax passed. Public HTTPS root, `/controls`, built JS/CSS and API health
  returned 200; health confirms MariaDB connected. HTTP redirects to HTTPS (301),
  `.env` is blocked (403), and unknown API/assets/ACME probes return 404.
  Both dedicated units are active/enabled; API 3100 and Phoenix 6006 listen only
  on loopback. Phoenix returned HTTP 200 after its initial startup delay.
  All 29 unrelated Nginx configuration hashes and symlink targets matched.
  No rebuild, deployment, migration, data reset or collection/tracing-setting
  change was performed. Verification used read-only HTTP requests without customer
  login or Clarity traffic; the full fixture-creating public smoke was not run.
  Git whitespace and changed-document links passed; no failing check remains.
  The October 17 shutdown is superseded by this explicit resumption request.
  PROJECT_STATE and LOCAL_SETUP operational notes were left uncommitted at
  resumption; no push. These checks describe November 2, not a new November 4
  service/public check.

- Plan 022 adds cta-clicked only after an acknowledged CTA from an owned readable
  Summary banner entry, alongside the existing generic event. Strict trace values
  exclude absence, arbitrary identifiers and inactive account spaces. Direct/menu/
  discovery entries do not inherit earlier banner values. No schema change.
  **13 focused TAP entries** and **12 browser cases at 360/390/1440px** passed,
  including lost-response retry, no pre-acknowledgement tag, real audit acceptance,
  unrelated menu CTA exclusion, consent/admin/impersonation and audit-failure checks.
  Typecheck, format, evaluation build, Git whitespace and documentation links passed.
  Build retains the existing >500 kB chunk advisory (659 kB / 187 kB gzip).
  Release **2026-10-14T22-49-13-460Z** deployed; API/Phoenix active and public health
  reports DB connected. No migration; schema remains 12. Owner collection/tracing
  switches and revisions matched before/after deployment and acceptance.
  Live SDK-stub check at **22:50:07 UTC** verified 13 initial calls, then 20 total
  through banner/feature/CTA, including exactly one
  `clarity("set", "cta-clicked", "summary-business-invoice");` with matching
  route/banner context in actual Phoenix REST readback. CTA trace:
  `86a3adc6f35d530268cf2f41e7d5d8ec`; private 0600 evidence:
  `artifacts/banner-cta-live.json`. Its owned Automation fixture was deleted;
  existing customers/configuration were untouched, and Microsoft uploads were zero.
  First live CTA readback raced asynchronous Phoenix visibility; adding the same
  bounded polling already used for initial spans resolved the harness check.
  No application fix or additional deployment was needed. No failing check remains.
  Implementation committed locally as **0a4b247**; final handoff notes committed
  separately, no push. Only owner `temp/` remains untracked and untouched.

- On **2026-10-14 at 21:04 UTC**, the owner-supplied private `CLARITY_API_TOKEN`
  successfully authenticated one read-only Data Export request (HTTP 200), for
  the last 24 hours grouped by URL. Traffic rows include Summary (8 sessions) and
  `/features/business-invoice` (2 sessions); grouped counts are not additive and
  do not establish receipt of a specific tag/click. The supported export covers
  processed dashboard metrics, not raw calls, custom-tag lookup or recording data.
  LOCAL_SETUP owns API limits and token handling. Private response evidence is in
  ignored, 0600 `artifacts/clarity-export-token-check.json`.
  A read-only runtime-account audit query found the retained Human customer's
  `set banner summary-business-invoice` invocation at **20:43:52.616 UTC**, and
  `banner_clicked` at **20:52:43.044 UTC**, mirrored to Phoenix. The tag initially
  entered the SDK queue; the same document subsequently had a loaded callable.
  Neither establishes Microsoft receipt. At the check, only about 21 minutes had
  elapsed since the tag call; Microsoft documents 30 minutes to two hours for
  new custom tags. The owner still reports the filter value missing. No collection
  pilot, application change, deployment, migration, service restart or setting
  change was performed. No application tests were needed for this read-only check;
  documentation links/whitespace were checked. Tracked changes are these diagnostic
  notes and the setup runbook; owner `temp/` remains untracked and untouched.

- Plan 021 changes the Feature Explorer Clarity banner tag to a derived readable
  space-feature alias. Current Summary values: summary-identity-protect,
  summary-business-invoice and summary-youth-banking. Admin widget configuration
  shows the exact value; new banner-linked landing entries carry it. UUIDs remain
  in ownership, selections and local reports; existing remote values are retained.
  No additional SDK call or activation of another space.

- Plan 020 defers Summary feature/service/campaign/banner tags and audit metadata
  while selection/artwork is pending. Resolved artwork supplies actual tags once;
  empty/failed slots supply appropriate absence values. Successful reloads send
  nine tags once, without transient feature/banner none or service banking.
  Identity, stable page context, consent and real event timing remain intact.

- Plan 019 sends identity and tags once initially, then only changed values.
  Stable Summary tags no longer repeat through initialization/event callbacks.
  Reload/customer/run/visit/collection restarts begin fresh; ordinary SDK queue
  drain preserves context. Events, consent and audit metadata remain intact.

- Plan 018 populates newly exported Phoenix spans with the readable call in Input
  and `clarity.call`, local outcome in Output, OK/ERROR status and bounded Error
  messages. Raw arguments remain intact and Kind stays unknown. Historical
  acknowledged spans are not rewritten. No schema or collection policy change.


- Plan 017 was deployed Off; the owner has now enabled tracing **On**, independently
  of existing Clarity collection **On**. All supported application calls use `Demo()`; consented safe
  snapshots are accepted under owned server contexts, stored in MariaDB and exported
  as custom protobuf OTLP spans. Admin Clarity Settings has the independent control,
  status/loss counters and filtered JSON download. Phoenix 20.21.3/Python 3.12.12
  runs privately as `softek-phoenix` on loopback 6006, with seven-day retention,
  isolated SQLite and HTTP-only launcher (no new gRPC listener). LOCAL_SETUP owns
  tunnel/inspection commands. Raw SDK uploads are B-018, not implemented.
  Owner walkthrough recheck: 339 accepted calls were collector-acknowledged, with
  no export errors; live REST readback confirmed a persisted span and the real
  Phoenix UI lists softek-clarity-api. The default project remains empty. API and
  Phoenix services are active; no restart, setting change or capture pilot was needed.

- Deployment URL: **https://demo.bawebtech.com**, currently stopped as recorded above.
  Retained application has branded username/password login; no signup.
  Admin signs in independently at `/controls` using the private `DEMO_ADMIN_SECRET`.
  Email-style usernames within the 3–40-character limit are supported.
- Manage Customers → **Generate customers** creates 1–200 fictional users with
  unique usernames/display names and sampled checking/savings cent amounts. Owner
  chooses count, prefix, shared password, ranges and existing assignment choices.
  Human is the default; no login/visit/analytics opt-in occurs during generation.
  Password-free CSV supports later automation. Saved starting amounts survive
  reset; current amounts persist across logins. Starting-account template selectors
  are removed from manual creation, generation and reset; Savings Goals eligibility
  is independent. Internal legacy fixtures remain for history/API compatibility.
- Device and Browser selectors are available in customer creation, generation and
  details, with an independent Save action. Existing customers default to Desktop/Chrome.
  Seven compatible pairs are enforced. Saving preserves banking/sessions/consent;
  manual visits keep their actual browser. The explicit pilot can use saved profiles,
  with matching engines; broader scheduling and dashboard classification stay deferred.
- The owner-requested cleanup left one preserved customer; the owner has since
  created another batch (batch 21). The current customer count is not rechecked.
  The authorized cleanup deleted 37 other customers through the protected API.
  Preserved identity/credentials, runs, accounts, goals and configuration matched
  their pre-cleanup snapshot; banners, assets, collection settings and anonymous
  runs were unchanged. Batch retry metadata remains.
- Every Manage Customers card has a separate details link and **Delete** button.
  Confirmation permanently removes the selected login, all owned active/retired
  runs and local report history; other customers and shared banners remain intact.
  Deletion revokes sessions. Batch retries return surviving customers, including
  an empty batch, without recreating deleted identities. Existing Clarity recordings
  are outside the local deletion operation.
- Customer details now offer **Impersonate customer** for enabled Human/Automation
  users. Account Summary and customer actions use their saved state, with a
  **Viewing as** indicator and conditional **Exit to Admin** above Sign out. Admin
  sessions bound to impersonation are checked on every customer request; expiry,
  logout, password replacement, disable and deletion revoke access. Clarity is
  always excluded, local visits retain provenance, and default reports exclude
  impersonated activity/admin-only cohorts. Other tabs return to Admin on entry.
- Customer sessions last 24 hours. Sign-out/expiry preserve banking state; password
  replacement/disable revoke that user's sessions. Reset retires the run and retains
  history, stable user UUID and rotation cursor. Admin and customer sign-outs are
  independent. New users use the common starting accounts; omitted-profile resets
  preserve existing internal assignments and restore saved starting amounts.
- Account Summary starts with the three account widgets, then a compact 105px
  full-width feature banner before Recent Activity. Enabled uploaded Summary
  widgets cycle by saved order/ID on login/full refresh; menu returns preserve
  the tab's exact selection. Proportional centered artwork links to its catalog
  page, with qualified visibility/click and feature/CTA attribution. Empty/error
  states show the placeholder. Other account details retain inactive strips.
  Summary Clarity tags use loaded artwork and clear on route/customer changes;
  these feature invitations do not feed the Savings Goals campaign.
  The View savings options link is removed; complete checking/savings/credit widgets
  link to `/accounts/checking`, `/accounts/savings`, `/accounts/credit-card`. Pages
  use owned balances and account-ID-associated recent activity, with stable labeled
  statement examples and fictional terms. Viewing writes no ledger data; details
  are masked and routes have ordinary banking page tags. Explore placements await
  the owner discussion.
  Retained selections still advance once on login/full Summary refresh; menu returns/
  data reads/feature CTAs do not. Independent tabs retain their exact selection. Savings Goals enrollment,
  goals and contributions remain functional; other banking sections use demo actions.
- Customer Menu → **Explore more ways to bank** opens authenticated `/explore`,
  a searchable catalog with five expanded-by-default groups and all twelve
  campaigns. Full product names link to the existing `/features/:featureId` routes. One shared Harbor landing component
  starts each card with a larger green uppercase headline, without the repeated
  Explore line or decorative star, then renders copy, benefits, disclosures and
  one primary CTA. CTA acknowledgement
  shows an inline demo confirmation, without changing banking/enrollment. No banners
  or financial input forms appear on feature pages. All customers may explore them.
- Customer Menu now includes **Savings & Investing** and **Loans**. Explicit
  investing exploration can show EasyCoin; the eligible fictional auto-loan payment
  screen can show Skip A Pay. The ineligible personal-loan example has no invitation.
  Learn more/Dismiss uses the existing feature pages. Payment form, review and
  confirmation are simulations without financial writes. Discovery preferences
  persist across logins/reset: one reservation per visit, 14-day seen cooldown,
  90-day dismissal and seven-day fewer-suggestion interval. These settings cover
  the new invitations; Summary banners/Goals remain separate. Contextual Discovery
  in Adoption Report has owned immutable attribution and existing actor/variant/
  time filters; impersonation is excluded.
- All twelve internal destinations are selectable in Manage Banners. No new artwork
  or enabled promotional set was created. Uploaded JPEG/PNG/WebP is re-encoded to
  immutable WebP; production assets remain outside releases in
  `/var/lib/softek/banner-assets`. Replacements retain prior URLs/history.
- Feature observations are `feature_viewed` / `feature_cta_clicked`, separate from
  Savings Goals adoption. The API validates owned run/visit, feature/action/time,
  CSRF and optional immutable banner entry; retries deduplicate per page/feature.
  Banner history state belongs to the exact landing entry; menu/direct entries do
  not inherit another tab's or the user's last banner attribution.
- Admin Menu contains Manage Customers, Manage Banners, Feature Explorer, Adoption Report and Clarity Settings at
  `/controls/*`. Feature Activity within the report shows raw views/clicks, distinct
  customers/runs and banner-attributed counts under actor/variant/UTC filters.
  Savings Goals funnel queries/denominators are unchanged. Selected-customer activity
  names feature observations. Admin descendants remain masked and analytics-excluded.
- Feature Explorer (`/controls/feature-explorer`) has four banner space headers:
  Account Summary, Everyday Checking, Harbor Savings and Harbor Credit Card. Add a
  catalog feature, open its title, upload/replace mobile artwork, view/copy its
  automatically derived URL and save accessible text/order/future inclusion.
  Recommend 960×315 for the compact mobile slot. One widget per feature per space;
  repeat features across spaces are allowed. Image-less inclusion is rejected.
  Widget rows/configuration also have confirmed Delete; only the chosen placement
  and settings are removed. Its feature is available again; other spaces/catalog
  and immutable artwork remain. Summary activation is delivered in Plan 016;
  checking/savings/credit spaces remain configuration-only.
- MariaDB is authoritative. Business writes use user/run locks and READ COMMITTED;
  savings reports use consistent snapshots; feature aggregates use one SQL statement.
  Runtime has scoped CRUD; migrator has scoped DDL. Private `.env` remains ignored
  and 0600. Runtime environment is an allowlist, root:softek 0640, with no DB admin,
  migration or test credentials.
- Migrations **0001–0012** applied to **demo and demo_test**, version 12 with no
  pending/checksum drift; repeat application is a no-op. 0007 adds device/browser
  preferences; committed **7eb7290** before application. Batch/balance tables and
  the collection switch/epoch remain intact. Next migration is **0013**. 0012 adds diagnostic configuration/contexts/calls, committed **9a167b6** before application. 0011 adds only the Summary cursor, committed **0cbb1cb** before application. 0010 adds only unseeded admin widget configuration, committed **c8f4204** before application. 0008 adds session/visit-context tables without changing existing table layouts; committed **c758cc4** before application. 0009 adds discovery preferences/presentations/attribution; committed **b3305a6** before application.
- Root-only 0600 pre-0011 schema/data/ledger backup:
  `/var/backups/softek/demo-before-0011-20261014T000207Z.sql`.
  Additive cursor and existing immutable snapshots may remain on code rollback.
- Root-only 0600 pre-0010 schema/data/ledger backup:
  `/var/backups/softek/demo-before-0010-20261013T205047Z.sql`.
  Prior code can ignore the additive table on code rollback; no rollback performed.
- Root-only 0600 pre-0008 schema/data/ledger backup:
  `/var/backups/softek/demo-before-0008-20261012T061846Z.sql`; tested schema-8
  API/web recovery build `/var/backups/softek/schema8-tested-build-20261012-final.tar.gz`.
  Earlier code ignores provenance and is unsuitable for report rollback after
  impersonation activity. No rollback performed.
- Root-only 0600 pre-0007 schema/data/ledger backup:
  `/var/backups/softek/demo-before-0007-20261012T004021Z.sql`.
  Earlier pre-0002/pre-0004/pre-0005/pre-0006 backups remain. All ten original runs and retained
  counts survived; anonymous ownership remains NULL; upload public hash unchanged.
- Retained release: **2026-10-14T22-49-13-460Z**. Previous authenticated release:
  **2026-10-14T20-37-46-275Z**. Both current links point to the new release.
  API now stopped/disabled; its configured identity is nonlogin `softek`, loopback
  **3100**. Health/DB connectivity was verified before shutdown, not while stopped.
  Retained evaluation flags On, project `yvs5hp3ivb`, database switch **On**.
  Matching build/deploy profiles and site-specific Clarity CSP are installed.
  Private development flags remain off. No development/test listeners remain.
- Earlier authenticated API **2026-10-11T19-49-23-608Z** was explicitly tested
  against schema 4 containing both
  feature ENUM values: owned state, original interactions, report, users and retained
  activity work. That rollback loses feature routes/reporting but preserves schema
  and history; never downgrade the ENUM. Actual rollback was not performed.
  This was prior schema-4 evidence, not a schema-5 rollback check. Before rolling
  back to pre-switch code, restore collection-off runtime flags/CSP; older code
  cannot honor the new switch. Prefer a current-code default-off deployment.
  Pre-auth anonymous releases remain incompatible public rollback targets.
  Pre-generation code does not restore individual saved starting balances on
  reset; use code supporting schema 6 when generated customers exist. No rollback
  or old-code schema-6 compatibility check was performed this phase.
- Dedicated Nginx/HTTPS/upload configuration and persistent assets are intact.
  All unrelated Nginx configuration hashes and enabled symlink targets match the
  original manifest. The service cannot edit code; only banner storage is writable.

## Plan 005 initial result and verification

All FEAT-01–09 are complete. The untouched original report remains untracked in
`temp/`; its identical durable reference is in `plans/references/`. This is supplied
fictional/demo marketing copy, not independent Access Digital product verification.
Architecture, product, setup, testing and roadmap reflect the implemented phase.

| Check actually run | Result |
| --- | --- |
| `npm test` | **40 TAP entries passed**: 34 nested scenarios, four parents, two standalone migration/context checks |
| Browser suite | **39 Chromium journeys covered** at 360/390/1440px: 36 passed initially; three banner journeys passed on focused rerun after correcting a destination-picker test selector |
| Feature browser evidence | All twelve pages/CTAs; lost-response retry and rapid activation; banking/adoption unchanged; banner/direct/menu/tab/reload attribution; auth/unknown routes; short viewport/keyboard; separate reporting |
| Typecheck/build/format | Passed; frontend ~578 kB / 170 kB gzip size advisory remains B-011 |
| Migration status/repeat | Both ledgers version 4, no pending/drift, repeated migration no-op; old ENUM rows/ordinals verified on owned probe |
| Prior API compatibility | Previous authenticated release works on dedicated schema 4 with stored feature values; owned fixtures cleaned |
| `npm run deploy` | Release **2026-10-11T21-30-01-050Z** deployed successfully |
| `npm run smoke:public` | HTTPS 360/1440px banking/login/rotation, feature submenu/CTA/child reload, exactly two owned feature views/one CTA, saved accounts/goals/run, separate report, independent sign-out and reset; no browser errors/Clarity requests |
| Retained production data/assets | All ten original runs retained, original table counts not reduced; earlier uploaded image has identical public hash |
| Host/privacy | Nginx syntax passed, service active/loopback, health 200, runtime allowlist/permissions and three collection flags off; unrelated site hashes/links unchanged |
| Visual review | Representative mobile/desktop submenu, landing/confirmation and report reviewed; source and live screenshots in ignored artifacts |
| Credentials | Secret scan passed across 84 candidate source/document/build files |

No unresolved application failure remains. The browser selector correction changed
only the test; visual review separated the banner count notes from report totals.
Real devices and real Clarity playback are not established by these checks.
Public smoke's owned automation users/history are intentionally retained.

## FEAT-09 compact headline follow-up

User-requested shared presentation refinement: remove the star and Explore line;
move the semantic headline to the top of each card with green uppercase eyebrow
styling at 20–26px. Supplied wording, page title, CTA and tracking are retained.
No API/schema change or migration was required.

Focused existing all-twelve-feature journey passed at 360/390/1440px (three tests),
including CTA retry/deduplication, unchanged banking state and no overflow/Clarity.
Typecheck, production build and format passed; bundle ~577 kB / 170 kB gzip.
Representative mobile/desktop screenshots were visually reviewed. Release
**2026-10-11T21-46-00-510Z** deployed, and public HTTPS smoke passed at 360/1440px.
Service/DB health, original data, immutable upload and unrelated Nginx hashes/links
remain verified; credential scan passed. The earlier full API/browser baseline
above was not rerun for this presentation-only change. No failing check remains.

## Clarity control, transport and remaining acceptance

Owner has now reported seeing mouse-behavior playback in Clarity. This confirms
owner-observed capture/playback, not reviewed masks, attribution or heatmaps. The
owner emphasized the demo is still far from ready for Chris.

Project **`yvs5hp3ivb`** and settings are owner-confirmed: **Balanced masking,
cookies On, bot detection Off, consent Required**. The owner reported switching
Bot Detection Off on 2026-10-12 UTC (initially On). These are reported settings,
not dashboard inspection. The owner authorized enabling collection and the admin
control. **Chris is deferred until the owner says the demo is ready.**

Admin Menu → **Clarity Settings** (`/controls/clarity`) persists site-wide on/off
with protected, conflict/retry-safe writes. Customer opt-in is required; advertising
storage is denied. Consent belongs to user UUID/revision in the tab. Off/on, logout,
shared-browser switching and captured admin entry require a fresh opt-in/document.
Foreground pages poll every five seconds/on focus without visits or banner changes;
background timers can be throttled. Policy failure closes collection. Withdrawal
stops SDK, clears first-party Clarity cookies, and reloads.

| Check actually run this phase | Result |
| --- | --- |
| `npm test` | **45 TAP entries passed** including four new collection/control scenarios |
| `npm run test:clarity` | **6/6** SDK-stub journeys at 360/390/1440px; all external traffic intercepted; no real collection |
| Banking browser suite | **39 journeys covered**: 38 passed initially; all three affected admin-create journeys passed after scoping a selector that collided with a loading status |
| Typecheck, both build profiles, format | Passed; default-off and explicit evaluation builds verified; existing ~583 kB bundle advisory remains B-011 |
| Profile mismatch refusal | Default deploy rejects an evaluation build before host mutation, as intended |
| Migration/repeat | Both ledgers version 5, no pending/drift; repeat no-op; retained data/assets verified |
| Evaluation deploy | Release **2026-10-11T22-24-55-744Z**; admin switch enabled through protected API |
| Real SDK pilot | Two labeled mobile click/skip journeys; **10 acknowledged `/collect` uploads**, real cookie creation/withdrawal, no requests after withdrawal or on admin pages, no browser/CSP errors |
| Public HTTPS smoke | 360/1440px passes with automated users still excluded and no Clarity requests; route-transition wait added after an initial goal-form timing failure |
| Host/privacy | Nginx syntax, service/DB health, root:softek runtime permissions/allowlist, evaluation gates, unrelated site hashes/links verified |

Real pilot observed `www.clarity.ms`, `scripts.clarity.ms`, `c.clarity.ms`,
`u.clarity.ms`, `z.clarity.ms` and `c.bing.com`, within the dedicated CSP allowlist.
Lookup evidence with UUID/run/visit/scenario/time is ignored, 0600
`artifacts/clarity-pilot.json`; pilot timestamps **22:25:50–22:25:58 UTC**.
Owned automation users/history remain. Bot detection was not changed and may filter
these recordings. **Network success does not establish dashboard recordings,
heatmaps, or masking playback.** Public smoke/test timing fixes changed harnesses
only; no unresolved application check failure remains.

Clarity session tags accumulate values; sending `none` on navigation describes
current context but does not erase earlier session tags. Compare the event timeline
and database attribution for exact entries. Events before opt-in are not backfilled.
The optional public `?banner=` heatmap parameter remains deferred.

## October 12 authorized Playwright capture pilot

Owner requested testing whether Playwright activity appears in Clarity before
building the broader suite. The existing CLI now sets `pilot_run` and
`pilot_scenario` tags, names new users Clarity Pilot Click/Skip, includes scrolling
and about 55 seconds of reading pauses per journey, and correctly labels Bot
Detection as owner-reported Off. No app deployment, migration, collection-setting
change, existing-customer reset or broader runner was required.

`npm run clarity:pilot -- --collect --device=desktop --browser=chrome` passed two
actual Chromium journeys on public HTTPS on **2026-10-12 14:30:12–14:32:09 UTC**.
Clarity acknowledged **19 `/collect` uploads** (click 10, skip 9). Decline made no
vendor requests; withdrawal cleared cookies/stopped traffic; admin made no vendor
requests; no browser/CSP errors occurred. Independent protected-API history reads
confirmed one EasyCoin feature view each, with CTA counts **click 1 / skip 0**.
Typecheck, focused Prettier and Git whitespace checks passed; live health is
200/DB connected. Routine test suites were not rerun for this isolated pilot change.

- Project: `yvs5hp3ivb`; lookup tag `pilot_run`:
  `pilot-0ac80155-b681-45cf-bc70-5818483b4bdf`.
- Clarity Pilot Click user UUID: `1755bd32-8bab-482f-bba2-82668baf7015`.
- Clarity Pilot Skip user UUID: `55fdff84-4f23-4c24-a155-df4454ede3d0`.
- Two new Automation users/history are retained for dashboard lookup. Generated
  random passwords were not logged/saved. Existing users were not used or reset.
- Ignored 0600 evidence: `artifacts/clarity-pilot.json`, plus archived
  `artifacts/clarity-pilot-20261012T143012Z.json`. These contain no credentials or
  collection payloads; the latest manifest replaces the prior pilot's lookup file.

The agent browser opened the project recordings URL but displayed an expired
Microsoft sign-in session. **Actual recording inclusion, device/browser
classification, playback fidelity, masking and heatmaps remain unverified.** The
owner has been asked to find both recordings by UUID/time or the new custom tag
(filter values may take time to appear). Wait for this evidence before expanding
traffic. Plan 003 and Chris access remain deferred. No push performed.

At approximately **14:39 UTC**, the owner reported neither recording visible and
no `pilot_run` custom-tag filter. This is about seven minutes after the last
journey; inclusion remains unconfirmed. Microsoft documents **30 minutes to two
hours** for new custom tags to appear in project filters:
[custom tags](https://learn.microsoft.com/en-us/clarity/filters/custom-tags).
Recheck today's recordings without restrictive filters after processing; do not
treat the missing early filter as proof of either capture failure or success.

The owner then confirmed each Custom User ID was searched separately and Today's
unfiltered recordings were empty. One additional new **Clarity Pilot Diagnostic**
Automation customer was created (none of the owner's ten generated customers or
personal account was used/reset). The ignored host-local helper
`artifacts/diagnose-clarity-capture.ts` ran an approximately 80-second actual
Chromium journey starting **14:46:45 UTC**, with Summary scrolling, Explore
Features → EasyCoin, CTA confirmation and ordinary logout. It inspects collection
payloads only in memory and saves boolean/count metadata, never raw bodies.

- Diagnostic customer UUID: `6494fb69-1b44-4efd-beda-90a038877848`.
- SDK `0.8.72` reports project `yvs5hp3ivb`, native Clarity user ID `owexj9`,
  session ID `114qxaa`, playback enabled and analytics consent granted.
- **Six HTTP 204 uploads** matched the project; four included playback events,
  all six included the customer's SHA-256 custom identity, and the diagnostic
  `pilot_run` tag was present. No END command, browser/analyzer error or private
  automation/capture header sent to Microsoft was observed.
- The owner confirmed **“I can see the live session”** when checking Clarity's
  live-users panel using the native ID. This establishes owner-observed synthetic
  live-session visibility, not completed recording availability or replay quality.
- Evidence: ignored 0600 `artifacts/clarity-capture-diagnostic.json`; owner live
  confirmation is recorded separately from the still-false playback acceptance.
- Owner replay inspection is requested. The two original recordings/tag filter
  have not yet been confirmed; do not attribute their absence definitively to
  processing delay. Keep traffic small until replay is reviewed.

Owner playback feedback: the diagnostic shows screen changes, clicks and the
EasyCoin CTA confirmation; scrolling was not observed. This confirms those live
replay elements only. A collection-free geometry check used admin impersonation
of the owned diagnostic customer (no banking changes) and found both pages can
scroll at 1280×720. It recorded physical movements and made **zero vendor
requests**; ignored evidence is `artifacts/pilot-scroll-geometry.json`. The
original capture did not measure scroll offsets, so the cause of its unseen
scrolling is not established; joining live after an earlier scroll is a possibility.

One focused follow-up, **Clarity Pilot Scroll**, ran **07:56:48–07:58:12 PDT**
(14:56:48–14:58:12 UTC) in Chromium at 1280×600. It verifies physical document
offsets after each wheel input and pauses eight seconds between movements:
Summary **4→504→4→404→4 px**; EasyCoin **0→300→0 px**, followed by the CTA
confirmation. All six movement assertions passed. **Eleven HTTP 204 uploads**
matched the project and included **eight Scroll events** plus playback data,
custom identity and the diagnostic tag. No browser/analyzer error or private
headers on collection uploads occurred. Raw payloads were inspected only in
memory and not saved.

- Scroll customer UUID: `0497d1dc-dfd4-4401-b661-873a70cac906`; native Clarity user
  ID **`91iamz`**, session `1oi305m`.
- Ignored host-local helper: `artifacts/diagnose-clarity-scroll.ts`; 0600 evidence:
  `artifacts/clarity-scroll-diagnostic.json`.
- There are now **four newly created pilot customers** retained for lookup. The
  owner's account and ten generated customers were not used/reset. Impersonation
  geometry visits on the diagnostic are labeled/excluded from normal reports.
- The owner initially saw no scrolling in the focused full recording from the
  beginning, then reported **“in mobile view I'm seeing scrolling.”** This adds
  owner-observed visible scrolling to the confirmed page/click/CTA replay. The
  earlier desktop display discrepancy remains unexplained; speed/Skip inactivity
  settings, the precise mobile-view control and recording identity for that
  observation were not independently verified. All four captures used Desktop
  Chrome; this observation does **not** establish a new mobile-profile capture or
  Clarity's native mobile classification. No further capture is needed merely to
  repeat the already verified physical scroll movements.
  Completed recording availability and the original two recordings remain
  unconfirmed. Live visibility is not full presentation readiness. No broader traffic run,
  deployment, application-code change or migration was required for diagnostics.

The owner noted Live entries disappear when the customer stops. Microsoft
documents inactive watched entries in that list for five minutes and a distinct
processed-recording retention period (normally 30 days). Live has fewer supported
filters; do not use missing live custom-tag filters as proof of upload failure.
References: [Live recordings](https://learn.microsoft.com/en-us/clarity/session-recordings/clarity-real-time),
[recording retention](https://learn.microsoft.com/en-us/clarity/faq#how-long-are-my-recordings-retained).
Microsoft's [inline player guide](https://learn.microsoft.com/en-us/clarity/session-recordings/inline-player)
documents Highlights, full playback, speed/Skip inactivity controls and Scroll
events under More details. Raw payload bodies were discarded, so prior decoded
scroll coordinates cannot be recovered from the count-only manifests. Owner
mobile-view scrolling is now confirmed; completed-recording lookup, desktop
display, masking and heatmaps remain separate acceptance checks.

Earlier owner dashboard observation: **Today shows one unique user**, native
Clarity user ID **`1fwxlgf`**. This is a user-count observation, not yet a matched
pilot/completed recording. It differs from known diagnostic IDs `owexj9` and
`91iamz`; native IDs were not retained for the original click/skip users. Owner
replied that **“Those recordings are no longer found”** when asked to open a
recording and check its start time and `actor` tag. No recording start time or
tag was obtained; this native user remains unmatched. Earlier observed live
playback remains valid evidence, but post-session searchable recording availability
is still unverified. The cause of the unavailable recordings is unknown; do not
infer deletion, bot filtering, or completed processing from this observation.

Latest owner observation: **two sessions labeled Headless Chrome appear in the
Dashboard, not in Recordings**. This confirms owner-observed dashboard session
counts for that browser label, not saved-recording availability or a match to
specific pilot customers. Live replay was observed earlier; post-session recording
availability remains unresolved. No additional capture was run for this update.

## October 12 evening — authorized feature-menu capture

The owner requested one run using **Explore Features** to visit each feature once.
The ignored host-local helper `artifacts/run-feature-menu-pilot.ts --collect` ran
at **18:04:50–18:07:45 PDT on October 12** (October 13 01:04:50–01:07:45 UTC).
It created one new Automation customer, **Clarity Feature Menu Pilot**, used a
fresh Desktop/Chrome context and actual customer login, clicked **Allow analytics**,
then opened every feature via the menu in catalogue order. Each page had a
12-second reading pause; no banner or feature CTA was clicked. It signed out
normally and closed the browser/admin session. No existing customer was used/reset.

- Customer UUID: `dfa52b47-f007-41fe-9f94-0e5de360461f`; native Clarity user ID
  **`1sblz1g`**, session **`1q6lmba`**.
- Custom `pilot_run`: `feature-menu-e54d91f4-d953-44f7-9b12-efb66e4b4f43`;
  `pilot_scenario`: `all-features-menu-views-only`.
- SDK 0.8.72 reported playback enabled, analytics storage granted, advertising
  storage denied, and 13 pages (Summary plus the 12 features) in this session.
- **26 HTTP 204 uploads** matched project `yvs5hp3ivb`; 25 included playback data.
  Custom identity and lookup tag were observed in memory. No END command, browser
  page/CSP error or private header sent to Microsoft was observed.
- Protected local interaction history independently confirms **exactly one view
  of each of the 12 features and zero feature CTA clicks** in the owned run.
- Owner confirmed live visibility and described all 12 feature pages in order,
  ending with Business Invoicing. The earlier “Waiting for additional activity”
  overlay did not prevent subsequent page playback. Completed-recording lookup,
  classification, masking and heatmaps remain unverified.
- Ignored 0600 evidence: `artifacts/clarity-feature-menu-2026-10-13T01-04-50-178Z.json`.
  Raw capture payloads and the generated password were not retained. The new
  customer/history remain available for dashboard lookup. No application code,
  deployment, schema, collection setting or unrelated service changed.

### Feature-menu post-session follow-up

Owner now reports **all feature pages appear in Dashboard, but the test is absent
from All Recordings**. With filters/saved segments cleared and **Last 7 days**
selected, **manual recordings appear; the test remains missing**. This narrows the
observed discrepancy to the automated session rather than an entirely empty
recording list. It does not establish that headless mode or bot filtering caused it.

Read-only review reconfirmed all 26 uploads succeeded and 25 contained playback
data, with no captured errors/END command. Microsoft's
[Dashboard troubleshooting](https://learn.microsoft.com/en-us/clarity/insights/troubleshooting-dashboard)
documents Dashboard activity without playable recordings when received replay
data is insufficient, and suggests broadening filters; that is a possible
explanation, not a diagnosis. Our agent browser still shows expired Microsoft
sign-in, so dashboard evidence remains owner-observed. No account/service setting
was changed and no new real capture was made.

The proposed controlled comparison was to repeat the same menu-only journey with
headed Chromium, keeping consent, capture gates and synthetic labeling intact.
Playwright uses a separate headless shell by default versus regular Chromium for
headed operation ([browser documentation](https://playwright.dev/docs/browsers#chromium)).
Host `Xvfb`/`xvfb-run` is available; Google Chrome is not on PATH. A result would
test browser-mode behavior, not prove a Microsoft filtering policy. If still
missing, the existing project/user/session/time evidence supports a Microsoft
support case; no message to Microsoft has been authorized or sent.

## October 12 night — authorized headed feature-menu comparison

Owner explicitly authorized the same all-feature test in headed mode. The
headed Chromium preflight on `about:blank` passed without website/vendor traffic.
The host-local comparison then ran:

```bash
xvfb-run -a npx tsx artifacts/run-feature-menu-headed.ts --collect
```

Capture timestamps: **21:11:38–21:14:35 PDT on October 12** (October 13
04:11:38–04:14:35 UTC). One new **Clarity Headed Feature Menu Pilot** Automation
customer used actual customer login and clicked Allow analytics. The twelve
Explore Features links, catalogue order, 12-second pauses, no banner/CTA clicks,
final pause and ordinary sign-out matched the earlier headless journey. Browser
and admin session closed. Other customers were not used/reset.

- Customer UUID: `86284506-770b-4f7d-89cb-82a29da67830`.
- Native Clarity user **`1mwvoop`**, session **`qlil7v`**. Owner opened the session
  details and reports browser label **Chrome**; owner subsequently reports the
  saved recording is **still not visible**.
- `pilot_run`: `feature-menu-headed-97a261e8-7a18-4485-874f-500bf484e261`;
  scenario remains `all-features-menu-views-only`; extra `pilot_browser_mode` tag is `headed`.
- Actual launch uses `headless: false` with a temporary Xvfb display and full
  Chromium 156.0.8078.4, Desktop/Chrome preset, viewport 1280×720. Native
  `navigator.webdriver` remains true. No automation-detection override was used.
- SDK 0.8.72 reports playback enabled, analytics storage granted, advertising
  storage denied and 13 pages under the same native session.
- **26 HTTP 204 uploads**, all project-matched, 25 with playback events; identity
  and pilot tag verified in memory. No browser/CSP/analyzer errors, END command,
  or private automation/capture headers sent to Microsoft were observed.
- Local protected interaction history confirms **exactly one view per feature
  (12 total), zero feature CTA clicks**. The live API health check passed.
- Ignored 0600 evidence:
  `artifacts/clarity-feature-menu-headed-2026-10-13T04-11-38-660Z.json`.
  Helper is also ignored/0600; it is a host-local diagnostic, not a new package
  command or general automation suite. Original headless helper/evidence retained.
  Generated password/raw payloads were not saved; customer/history retained for lookup.

No application code, deployment, schema, collection setting or unrelated service
changed. Runtime journey/assertions and evidence review passed; broad app suites
were not repeated for the host-local browser-mode comparison. The Chrome label
does not establish saved-recording acceptance or explain the earlier missing run.

October 13 PDT follow-up: owner reports headed recording still missing and
suggests `clarity('set', 'test_run', 'automated-suite')`. Both menu runs already
use `set` for unique `pilot_run` and shared `pilot_scenario`; headed also sends
`pilot_browser_mode`. Reinspection confirms one acknowledged payload per run
contains the exact pilot tag and all 26 contain custom identity. Tags are sent
after consent/SDK readiness. Microsoft's [custom-tag guidance](https://learn.microsoft.com/en-us/clarity/filters/custom-tags)
documents segmentation; no bot exemption is documented for `set`. The
[cited SEJ article](https://www.searchenginejournal.com/microsoft-clarity-ab-test/486432/)
discusses A/B labels, not the quoted bot-filtering advice. Adding a `test_run`
alias is not an established fix. Headless mode alone cannot explain both missing
runs. Next review consent/session shutdown and assemble support evidence; no
new capture, setting change or support contact was made. Microsoft sign-in is
still required in the agent browser. Do not contact others without authorization.

Human-like-action advice follow-up: the two menu runs already pause 12 seconds
per feature; earlier capture also verified mouse/scroll input and uploaded Scroll
events. Login typing occurs before collection/consent, so slower login typing
would not supply recorded behavioral input. The linked
[Microsoft issue 520](https://github.com/microsoft/clarity/issues/520) reports live
replay missing from saved sessions. Microsoft support comments describe missing
data/low-confidence replay; a later user reports a consent-integration cause in
their own setup. This is not evidence of a mandatory human-like action sequence.
The referenced YouTube page was throttled; its content was not verified.
Read-only local audit confirms customer sign-out calls `beginCustomerTransition`
and `finishCustomerTransition`, both reaching `stopCollection`, which sends
ConsentV2 analytics denied before SDK stop and cookie removal. Whether that
shutdown affects saved replay is unproven. Next proposed controlled capture:
keep the same consent/actions/pauses but close the browser without application
sign-out, isolating this path. Do not weaken real decline/withdrawal handling or
claim a fix until saved-recording behavior is observed. No capture/code change
was performed for this advice review.

## October 13 — owner accepts the automated recording limitation

Owner accepts the demonstrated outcome for the current demo: automated Playwright
activity appears in Dashboard, while saved human recordings are available.
Automated saved recordings remain missing; cause is unknown and no fix is claimed.
This is an accepted limitation and no longer a blocker. Stop this investigation;
the proposed no-sign-out capture and Microsoft support case are not to proceed
unless the owner explicitly reopens it. Retain existing evidence and labeled
test customers; no cleanup, capture, application/consent change or support contact
was requested. Product acceptance and M2-05 now reflect this owner decision.
This does not complete remaining human masking/heatmap review, authorize the
broader suite, or authorize Chris's access/presentation.

## M2-C06 consent modal follow-up

The initial unanswered customer consent now uses a centered native modal over a
dimmed account page. Shared Harbor tokens, two full-width choices, a scrollable
card for short viewports, background inertness and page-scroll locking apply.
Keep analytics off receives initial focus; Escape declines. A saved choice dismisses
the modal and survives navigation/reload; page-bottom controls still allow changing
it. Existing user/revision gates and withdrawal behavior remain unchanged.

Relevant verification: all nine privacy journeys covered at 360/390/1440px
(eight initially passed; all three global-off cases passed after the harness fix),
including six modal/short-viewport journeys. An initial harness timeout was fixed
by choosing consent before trying to use the now-inert menu; the global-off harness
was adjusted to await the expected reload rather than evaluate during navigation.
Typecheck/evaluation build/format passed; source and live mobile/desktop visuals
reviewed. Release **2026-10-11T22-42-00-516Z** deployed. Focused HTTPS checks verify
modal/focus/decline/navigation/saved choice without vendor traffic at 360/1440px.
Service/DB health and credential scan (94 files) passed. No unresolved check
failure remains. No migration/API changes. The previous API/banking baseline and real SDK transport
pilot above were not rerun for this UI change. Dashboard acceptance is still pending.

## Plan 006 result and verification

All GEN-01–05 complete. Protected bulk creation is atomic and retry-safe. Unique
batch/position markers distinguish generated identities across batches. Checking
and savings use sampled integer cents, saved by user UUID for first login and
both reset paths. Passwords are independently salted; the local CSV omits them.
Credit accounts and recent activity remain fictional template samples.

| Check actually run | Result |
| --- | --- |
| `npm test` | **51/51 TAP entries passed**, including five generation scenarios and existing banking/features/collection/migration coverage |
| 200-user batch | **~14 seconds**, all distinct identities/hashes, varied bounded amounts, no premature runs; concurrent retries return the same batch |
| Integrity | Changed-payload conflict, late collision rolling back earlier inserts, real Human login, contribution/relogin persistence, customer/admin reset restore saved amounts |
| `npm run test:e2e` | **42/42** banking journeys at 360/390/1440px; three focused generation journeys also passed after using the shared checkbox style |
| Typecheck/build/format | Passed; Clarity evaluation build ~594 kB / 173 kB gzip; B-011 size advisory remains |
| Migration/repeat | 0006 committed before test/production application; scoped pre-0006 backup; both ledgers version 6, no pending/drift; repeated application no-op |
| `npm run deploy -- --clarity` | Release **2026-10-11T23-07-29-587Z**, evaluation profile and existing database switch On preserved |
| Live generation | HTTPS 360/1440px: three users each, default Human choice, chosen Automation test activity, ranges, same-request retry, password-free CSV, customer details, login/relogin/reset and no Clarity traffic |
| Public banking smoke | HTTPS 360/1440px passed enrollment/goals/contribution, rotation, relogin, feature CTA/report, independent admin sign-out and reset |
| Retained host/data | Original ten runs/counts/upload hash intact; service/DB health, loopback binding, Nginx syntax, unrelated site hashes/links and private runtime allowlist/permissions verified |
| Visual/credentials | Mobile/desktop form and results reviewed; secret scan passed across 99 source/document/build files |

An initial concurrent retry exposed a MariaDB lock-upgrade deadlock; the exclusive
upsert lock fixed it and the complete API suite passed. The first public banking
smoke filled a temporary enrollment form before the final Goals route remounted
it; the harness now waits for the destination acknowledgement, and both widths
passed. That correction changes the harness only. No unresolved check failure
remains. Six labeled `test.live-bulk.*` Automation users and public smoke history
are intentionally retained; no full 100–200 production cohort was generated.
Ignored, 0600 `artifacts/live-generation-check.json` records only identities,
starting amounts and checked run IDs, without passwords.

## Plan 007 result and verification

DEV-01–05 complete: saved Device/Browser choices in create/bulk/details, independent
protected save, compatible pairs and CSV columns; matching Playwright resolver and
saved-customer option for the explicit pilot. Preferences preserve banking runs,
balances, sessions and consent. Private pilot headers are scoped to our origin.

| Check actually run | Result |
| --- | --- |
| `npm test` | **64/64 TAP entries passed**; protected updates, legacy defaults, SQL/API pair validation, manual/bulk persistence, retry/conflict, banking/session/consent preservation and both resets |
| Browser suite | **45 journeys covered** at 360/390/1440px: 39 initial passes; all six affected bulk/profile tests passed on focused rerun after switching test locators to accessible combobox names |
| Native profile checks | All seven pairs launch matching Chromium/Firefox/WebKit and prove UA, screen/viewport, density and actual tap/click delivery; vendor traffic intercepted |
| Header isolation | Intercepted browser verifies private automation/capture headers on own origin and absent on vendor requests |
| Typecheck/build/format | Passed; evaluation build ~597 kB / 174 kB gzip; existing B-011 advisory remains |
| Migration/repeat | 0007 committed **7eb7290** before test/production application; scoped 0600 pre-0007 backup; both ledgers version 7, no drift/pending; repeats no-op |
| Deploy | **2026-10-12T00-46-07-747Z**, matched evaluation profile; existing database collection switch On preserved |
| Live profile checks | All seven saved pairs on public HTTPS: login, same owned banking run, mouse/tap menu and feature CTA; no vendor requests. One owned Automation check user retained |
| Live admin/bulk checks | 360/1440px: profile selectors/save/reload, batch pairs, retry, CSV, login/relogin/reset; six owned generated check customers retained |
| Public smoke | Both 360/1440px existing banking/enrollment/goals/contribution, rotation, feature/report, independent sign-outs and reset passed without Clarity |
| Host/data/credentials | Health/DB connected, loopback service, Nginx syntax and unrelated hashes/links, permissions/allowlist/gates, original ten runs/counts/upload hash intact; secret scan passed across 108 source/document/build files |

Initial UI failures were test label selectors, corrected to accessible combobox
roles. WebKit reports no Android-style maxTouchPoints; tests now prove real
`touchstart` delivery. No unresolved application failure remains. No real SDK
collection was run this phase. The modified pilot's actual upload/withdrawal and
Clarity's browser/device classification still require a deliberate later recording
check; no classification guarantee or bot-filter evasion is claimed. Ignored 0600
`artifacts/live-browser-profiles.json` and `artifacts/live-generation-check.json`
record only test identities/profiles/run evidence, without passwords.

## Plan 008 — shared starting-account controls

Removed redundant Alex/Jamie and Eligible/Standard selectors from manual creation,
bulk generation and banking reset. Fixtures share identical accounts/activity.
New requests default to the internal Alex fixture; resets preserve the locked
user's internal profile when omitted. Eligibility is independent, including an
ineligible Alex customer and an eligible legacy Jamie customer. Generated amounts,
user identity and archived history remain intact. No migration was required.

| Check actually run | Result |
| --- | --- |
| API/native suite | 64 entries covered: 54 outside the revision suite passed initially; after fixing a comparison of regenerated account IDs, all 10 revision entries passed on focused rerun |
| Focused browser suite | 9/9 at 360/390/1440px: manual creation, omitted-profile reset/eligibility, bulk retry/CSV and individual amounts; no template selectors or Clarity requests |
| Typecheck/build/format | Passed; matched evaluation build 595.53 kB / 173.57 kB gzip, existing B-011 advisory |
| Migration status | Both schemas version 7, no pending/checksum drift; no SQL applied |
| Deploy | Release **2026-10-12T01-14-03-090Z**, existing evaluation flags/switch preserved |
| Live focused check | 360/1440px: bulk retry/CSV, ineligible default profile, login/relogin, customer reset and admin reset to eligible; saved starting amounts preserved, no Clarity traffic |
| Public HTTPS smoke | 360/1440px banking, features/report, independent sessions and reset passed |
| Host/data | Active service, DB health, loopback 3100, matching release links, Nginx syntax/unrelated hashes/links, runtime permissions/allowlist/gates; ten original runs/counts and immutable image hash intact |
| Credentials/docs | Secret scan passed; changed-document local links and Git whitespace checks passed |

The failed reset assertion was a test-only issue: fresh account IDs are expected
on a new run; financial fields are compared independently. No unresolved failure
remains. Six owned generation-check users and public-smoke fixtures are retained
with password-free evidence in ignored `artifacts/plan008-live-generation-check.json`
(0600). Real SDK collection and dashboard classification were not run this phase.

## Plan 009 — permanent customer deletion

Owner requested plain Delete on each `/controls/customers` card. DEL-01–04 are
complete: protected strict endpoint, user-locked transaction and FK-ordered removal
of all local user/run data, safe repeated deletion, independent link/button,
identified confirmation, cancel/error/pending behavior and filtered-list refresh.
MariaDB's no-op batch upsert is distinguished from first insert, so replay cannot
recreate deleted customers even when the whole batch is gone. No migration needed.

| Check actually run | Result |
| --- | --- |
| `npm test` | **66/66 TAP entries passed**, including deletion auth/CSRF/origin/body/UUID, linked tables, retired/active runs, sessions/login, concurrent repeats/isolation and partial/empty generation retry |
| Focused browser checks | **12/12** at 360/390/1440px: deletion/cancel/error/keyboard, original creation/navigation/reset/independent sessions; deletion rerun **3/3** after adding pending-button assertions |
| Typecheck/build/format | Passed; matched evaluation build 596.13 kB / 173.73 kB gzip; B-011 advisory remains |
| Migration status | Both schemas version 7 without pending changes or drift; no SQL applied |
| Deploy | **2026-10-12T04-47-42-220Z**; matching links, existing evaluation flags and database switch On preserved |
| Public deletion check | 360/1440px cancel/confirm, active/retired run removal, revoked session, surviving customer navigation and partial/empty batch retry; only newly owned fixtures deleted, no Clarity requests |
| Public smoke | Both 360/1440px complete existing banking/features/report/session/reset journeys passed |
| Host/data | Service active/DB healthy/loopback 3100; Nginx syntax and unrelated files/links intact; private runtime permissions/allowlist; original ten runs/counts and uploaded asset hash retained |
| Credentials/docs | Secret scan passed across 110 source/document/build files; changed local links and Git whitespace verified |

An initial live harness reset omitted X-Browser-Session and was rejected with 400.
Corrected the harness and reran successfully; four identified failed-setup fixtures
were removed through the protected endpoint. Successful deletion fixtures are also
removed; retry-protection batch metadata remains. Password-free evidence is ignored
0600 `artifacts/live-delete-check.json`. Public smoke history is intentionally
retained. No unresolved check failure or new real SDK collection remains.

## Owner-requested customer cleanup — Plan 009 follow-up

Deleted **37 of 38 production customers** through the existing protected delete
endpoint, preserving the exact owner-designated username and its stable UUID.
Checked the live admin list against the DB before mutation and verified exactly
one customer remained afterward. Before/after snapshots confirmed the preserved
identity/credentials, all runs, accounts, transactions, enrollments, goals, receipts,
current mapping, saved amounts and preferences were unchanged. Shared banners/
assets, collection settings and anonymous historical runs were also unchanged.
Deleted user ownership/session/preference rows are absent. The temporary admin
session was signed out. No migration, deployment, customer login or analytics
collection was performed. Private password-free evidence: ignored 0600
`artifacts/customer-cleanup.json`; no snapshot contents or credentials were saved.

Earlier owned production smoke/pilot histories for deleted customers have now
been removed by this explicit owner cleanup. Clarity's prior recordings remain
external to the local operation. Public smoke creates customers; it was not run
for this cleanup. The owner has since generated batch 21; inspect the current
cohort rather than relying on earlier test-cohort manifests.

## Plan 010 — admin customer impersonation

Owner approved implementation after reviewing the plan. IMP-01–06 are complete.
Customer details have password-free admin entry; the shared customer shell shows
Viewing as and Exit to Admin immediately above Sign out. Entry ends this browser's
previous customer session; other browsers remain independent. Refresh preserves
mode. Exit returns to the selected admin details, or list for a deleted target;
customer Sign out opens login, preserving admin access. Cross-tab transitions
stop prior collection, clear stale state and direct other customer tabs to Admin.
A context ID plus separate cookie/CSRF prevents stale pages acting on another user.

Hashed sessions bind to initiating admin/target/expiry, with user → admin → session
locks and per-request checks. Customer disable/password/deletion and admin expiry/
logout revoke access. Retry uses an HMAC-derived token to reissue the same cookie,
run and banner after a lost response; ended requests cannot resurrect a session.
Actual banking changes persist. Actor/profile preferences remain unchanged.

Migration 0008 adds two tables, preserving original layouts/data and historical
source interpretation. New visit provenance survives session termination. Default
Adoption/Feature Activity counts exclude impersonation; admin-only runs enter
cohorts after a customer visit using original run-start dates. Source-aware event
keys/first-use checks and context-bound receipts separate real observations.
Customer history labels Admin impersonation. Clarity is server/client excluded,
even with prior consent/capture headers; no analytics prompt appears in this mode.

| Check actually run | Result |
| --- | --- |
| API/native/migration suite | **76/76 TAP entries passed**, including eight impersonation cases and exact committed migration probes; retained visits/layout and repeat/FK checks |
| Banking browser suite | **48/48** at 360/390/1440px; existing state/features/reports/admin/delete/generation behavior |
| Clarity-stub privacy suite | **18/18** at the same widths; nine new impersonation checks, prior-consent cross-tab stop, error/retry and expiry recovery; no real SDK |
| Typecheck/build/format | Passed; matched evaluation bundle 599.45 kB / 174.57 kB gzip; existing B-011 advisory |
| Migration/deploy | 0008 committed **c758cc4**, scoped root-only backup, both ledgers version 8 with no pending/drift, repeats no-op; final release **2026-10-12T06-30-44-829Z** |
| Public HTTPS | 360/1440px entry, CTA/menu/refresh, actual enrollment/goal, correct exit, ordinary login preserving goal and independent sign-outs; two owned fixtures deleted afterward |
| Preservation | Original customer/banking/history/session/settings fingerprints unchanged; shared assets and unrelated Nginx hashes/links intact; active loopback 3100, HTTPS/DB health and release links matched |
| Collection | Zero vendor requests/page errors in live checks; current evaluation flags and global toggle On preserved; no new actual Clarity recording |
| Credentials/docs | Secret scan and local links/Git whitespace checked; runtime allowlist/permissions and root-only recovery files verified |

Initial new tests used an incorrect feature ID/CTA selector and a Human fixture
under the automation-only harness header; corrected. One run was disrupted by an
API hot reload during edits; final complete suites passed. A final exit-error fix
prevents other tabs remaining paused after a failed request; three focused
mobile/desktop recovery checks passed, followed by a rebuilt deployment and
repeated public verification. The live harness first
needed BigInt-safe snapshot serialization and a readiness wait after API restart;
no customer fixture existed in those failed setup attempts. Successful public
fixtures were removed; ignored 0600 `artifacts/plan010-live.json` contains only
password-free results. No unresolved failure, public rollback or real SDK capture
remains. The owner declined an independent OS selector; existing presets remain.

## Plan 011 — verified contextual discovery result

DISC-01–06 complete. The selected EasyCoin and Skip A Pay journeys, saved
preferences, visibility/cooldown/cap rules and independent reporting are deployed.
Broader two-FI/experiment scope remains B-014/B-007; no activation,
money movement or loan servicing is implied by these educational confirmations.

| Check actually run | Result |
| --- | --- |
| API/rules/migrations | **83/83 TAP entries**; new owned-context/strict input/CSRF, concurrent cap, cooldown boundaries, retry attribution, relogin/reset preferences, actor/impersonation separation and exact committed 0009 clean/repeat probes |
| Banking/discovery browsers | **48 existing checks passed** at 360/390/1440px; after the preference loading fix **9/9 new discovery checks passed** on focused rerun |
| Privacy SDK stub | **18 checks covered/passed**: mobile six passed before external SIGTERM; wide/mobile + desktop twelve passed on scoped rerun; no real vendor collection |
| Typecheck/build/format | Passed; matched evaluation profile, main bundle ~622 kB / 179 kB gzip, existing B-011 advisory |
| Migration/deploy | 0009 committed **b3305a6** before test/production apply; both schemas version 9, no drift/pending; repeats no-op; release **2026-10-13T16-23-08-166Z** |
| Live HTTPS | **360/1440px** both invitations, linked feature views/CTAs, ineligible loan suppression, masked payment review/confirmation, preserved accounts and opt-out relogin; report matched one visible/view/CTA per feature for each scoped check |
| Hosting/collection | Service/DB healthy, matched release links, Nginx syntax valid; collection settings unchanged, external requests/page errors zero in public checks; test listeners stopped |
| Credentials/docs | Credential scan passed across **130 source/document/build files**; maintained local links, section structure and Git whitespace checks passed |

Root-only 0600 pre-0009 backup:
`/var/backups/softek/demo-before-0009-20261013T161812Z.sql`. 0009 only creates
tables; do not downgrade/drop them for code recovery. Previous Plan 010 release
retains existing layouts, but does not provide the discovery UI/report. Prefer
forward recovery and consult LOCAL_SETUP before a deliberate rollback.

The public helper created two owned Automation customers and deleted both through
protected Delete after checks; no owner customer was used/reset. Ignored 0600
`artifacts/plan011-live.json` contains password-free evidence. Public screenshots
and the ignored helper are under `artifacts/`; no raw capture data was retained.
Initial test setup mistakenly passed an extra login field/reset request ID; strict
validation rejected them and the harness was corrected. The preference browser
failure exposed controls showing a default choice before the saved setting loaded;
controls are now hidden until loaded. One privacy runner was externally interrupted;
only verified owned test process groups were stopped before the remaining checks.
No unresolved application/check failure remains. Automated recording investigation
and further actual capture remain stopped by owner decision.


## Plan 012 verification — 2026-10-13 UTC

Source commit **99abd9d**. Release **2026-10-13T17-01-20-049Z**, matched API/web
links. Customer Menu opens `/explore`, with the five screenshot groups, full product
names/counts, independently collapsible sections and search. Existing feature
landings/CTAs retain their routes and reporting; catalog entries return to the catalog
without banner/contextual attribution. Admin Menu and collection configuration remain.
No migration: production and test schemas stay at version 9, without pending/drift.

| Check actually run | Result |
| --- | --- |
| Routine browsers | **63/63** at 360/390/1440px; includes six new catalog checks plus existing feature/banner/discovery/controls journeys |
| Privacy SDK stub | **18/18**, vendor requests intercepted; consent, withdrawal, switch and impersonation boundaries preserved |
| API regression | Full run **81/83 passing entries**; the impersonation exclusion assertion assumed zero retained feature activity. Changed it to compare pre-entry counts; focused rerun **9/9** passes, resolving the failed subtest and parent. Other API/migration entries passed unchanged |
| Static/build | Typecheck, format, Git whitespace passed; matched Clarity evaluation build, ~626.75 kB main JS / 180.11 kB gzip (existing B-011 advisory) |
| Responsive review | Catalog screenshots inspected at 360/390/1440px; all rows readable, no horizontal overflow |
| Live HTTPS | At **360/1440px**, deep-link login, search, all twelve feature links/returns, Skip A Pay confirmation and unchanged accounts; each scoped customer had twelve views/one CTA with no banner attribution |
| Hosting/collection | API/DB healthy, Nginx syntax valid, matching release links, no dev/test listeners. Live checks had zero external requests/browser errors and verified collection settings unchanged |
| Documentation/credentials | 86 local link targets and Git whitespace passed; credential scan passed across 121 source/plan/build files plus 10 root documents |

Live helper created two owned Automation customers and deleted both through the
protected Delete endpoint, without using/resetting owner accounts. Password-free
0600 evidence: ignored `artifacts/plan012-live.json`; helper/screenshots/logs also
remain ignored. Missing automated recordings remain an accepted limitation;
no actual Clarity capture or investigation was performed for this release.

### CAT-05 title follow-up — 2026-10-13 UTC

Source **9235495**, release **2026-10-13T17-23-41-174Z**. Page/browser titles now
use EasyVest Automated Investing, EasyVest Self-Directed Investing, EasyCoin
Cryptocurrency and Small Business Invoicing. Shared banner/report labels follow
these names; IDs, paths, headlines and CTA behavior remain unchanged.
Typecheck, format, evaluation build and **9/9 focused browser checks** passed at
360/390/1440px (all-twelve feature journey plus EasyCoin discovery/opt-out).
Live HTTPS verified all twelve headings/links at 360/1440px, with screenshots of
the four updated titles; API/DB health and release links matched. The two owned
Automation fixtures were deleted; zero external requests/page errors, accounts
and collection settings unchanged. Evidence: ignored 0600
`artifacts/feature-titles-live.json`. No migration or actual vendor capture.

## Plan 013 verification — 2026-10-13 UTC

Source **bdd15e1**, release **2026-10-13T17-57-03-153Z**. Three read-only account
pages use saved balances/identity, existing owned activity and deterministic labeled
statement examples. `/api/state` adds `accountId` to transactions for association;
no migration or retained-data seed/update. Checking, savings and credit information
are masked, with bounded banking page-view tags; no feature/adoption event on view.

| Check actually run | Result |
| --- | --- |
| API/rules/migration regression | **83/83 TAP entries**, including existing funding, ownership, persistence, feature separation and bounded account route context |
| Routine browsers | **69/69** at 360/390/1440px, including six new account journeys; saved balance/activity updates after real demo goal funding, relogin/customer isolation, sample refresh stability, banner preservation and no ledger changes on view |
| Focused privacy SDK stub | **3/3** consent/masks/withdrawal/admin/shared-browser journeys; each visits all three accounts to verify mask containers and banking-only tags; no actual vendor loaded |
| Static/build | Typecheck, format, Git whitespace and matched evaluation build passed; main JS 638.24 kB / 182.28 kB gzip (existing B-011 advisory) |
| Schema/hosting | Production/test schema 9, no pending/drift; matched API/web release links, active service, DB/public HTTPS health and Nginx syntax passed; no test/dev listeners remain |
| Live HTTPS | **360/1440px**: direct-login path, all three widget/detail links, exact balances and saved activity, stable sample rows on refresh, masked information, Summary return/banner retention; no financial writes or feature observations |
| Documentation/credentials | 88 local link targets and credential scan across 136 source/document/build files passed before deployment; final handoff links/whitespace checked |

Two owned live Automation users were created/deleted through protected controls;
owner accounts and global collection settings were untouched. External requests and
browser errors were zero. Password-free 0600 evidence is ignored
`artifacts/plan013-live.json`; the helper and screenshots/logs remain ignored.
Mobile and desktop screenshots were inspected. Initial new-test navigation raced
the logout document transition; waiting for the sign-in form resolved the harness
failure, with six focused and all 69 routine checks passing afterward. No unresolved
application/check failure remains. Explore links are B-015 discussion scope only.

### DETAIL-05 savings layout follow-up — 2026-10-13 UTC

Source **74ddd64**, release **2026-10-13T18-19-30-775Z**. Savings balance card
removes the generic heading/subtitle/icon, positions the separately masked last-four
number upper-right and places the balance/available-balance label lower-left.
Typecheck, format, evaluation build and **6/6 focused account browser checks** passed
at 360/390/1440px. Mobile/desktop savings screenshots inspected; live HTTPS at
360/1440px verified balances/history, sample refresh, route/return/banner behavior,
number masking and zero vendor requests/errors. Both owned fixtures deleted and
collection settings unchanged. Ignored 0600 `artifacts/savings-layout-live.json`
holds password-free evidence. API/DB health and matching release links verified.
Focused SDK-stub assertions reported **3/3**; the initial npm parent exited 143
with no test failure or remaining listeners. Direct CLI confirmation passed **3/3**
with exit 0; no unresolved check failure remains.

### DETAIL-06 savings card consolidation — 2026-10-13 UTC

Source **42eef8f**, release **2026-10-13T18-35-10-471Z**. Personal Savings is
upper-left, masked last-four upper-right, Interest 1.25% / Compounded Monthly
middle-left, balance/label lower-left. Savings Account Information is removed;
Recent Activity uses the full width. Terms remain fictional display examples.
Typecheck, format and evaluation build passed; **6/6 focused account journeys**
at 360/390/1440px, then **2/2 visual reruns** after tightening rate-line spacing,
and **3/3 consent/masking SDK-stub journeys** passed with exit 0. Screenshots
inspected. Live HTTPS 360/1440px confirmed the new labels, absent information
widget, masking, unchanged owned balances/history, stable samples and return/banner
behavior. Zero external requests/errors, collection settings unchanged, both owned
fixtures deleted. API/DB health and release links matched; no test listeners.
Evidence: ignored 0600 `artifacts/savings-content-live.json`. No migration/capture.

### DETAIL-07 credit card consolidation — 2026-10-13 UTC

Source **49a2acf**, release **2026-10-13T18-58-19-642Z**. Savings/credit share
compact-card styling. Credit Card is upper-left, masked number upper-right;
Available Credit/Credit Limit are middle, current amount owed lower-left. Credit's
Account Information panel is removed and Recent Activity uses the full width.
The fictional credit limit and available-credit calculation are preserved.
Typecheck, format, evaluation build, **6/6 account browser checks** at 360/390/1440px
and **3/3 consent/masking SDK-stub checks** passed, all with exit 0. Screenshots
inspected. Live HTTPS 360/1440px verified labels, removed panel, masked number/
credit figures, exact owned balances/history, stable samples and return/banner
behavior. Zero external requests/errors, collection settings unchanged and both
owned fixtures deleted. API/DB health and matched release links verified; no test
listeners remain. Evidence: ignored 0600 `artifacts/credit-layout-live.json`.
No migration or real vendor capture; Explore placements still await discussion.

### DETAIL-08 checking card consolidation — 2026-10-13 UTC

Source **850839f**, release **2026-10-13T19-57-01-817Z**. All three account pages
now share compact-card styling. Personal Checking is upper-left, masked number
upper-right and available balance/label lower-left. Its separate Account Information
panel is removed, with full-width Recent Activity immediately below.
Typecheck, format, evaluation build, **6/6 account browser checks** at 360/390/1440px
and **3/3 consent/masking SDK-stub checks** passed with exit 0. Screenshots inspected.
The initial account run caught an accidentally broadened test assertion; its original
checking exception was restored before the successful full focused rerun.
Live HTTPS 360/1440px verified labels, removed panel, masks, exact owned balances/
history, stable samples and return/banner behavior. Zero external requests/errors,
collection settings unchanged and both owned fixtures deleted. API/DB health and
matched release links verified; no test listeners remain. Evidence: ignored 0600
`artifacts/checking-layout-live.json`. No migration or real vendor capture;
Explore placements still await discussion.

## Plan 014 verification — 2026-10-13 UTC

Source **815cbe3**, release **2026-10-13T20-28-58-806Z**. Removed the large Summary
linked image; account widgets now start beneath its header. Shared inactive More
ways to bank strips follow Summary accounts and each detail balance card, above
Recent Activity. Shared height token: balance cards minimum 210px, strips 105px;
full padded content width, mobile and desktop. No link/image/exposure/click; Summary
Clarity tags carry no invisible banner/feature/campaign context. Admin creatives,
selection persistence and historical attribution remain; future rotation is B-016.
The public smoke was adapted to retained selections and the active Goals sidebar.

Typecheck, format, evaluation build and documentation links/diff checks passed.
**54 distinct account/banking browser cases** at 360/390/1440px passed across
batches/reruns, plus **eight SDK-stub privacy checks** (all six mobile scenarios
and consent/masking on wide-mobile/desktop). Screenshots inspected. An obsolete
login helper initially matched two elements after both pages gained strips; fixed.
An interrupted browser parent left test-only fixtures and duplicate upload labels;
removed 12 owned test users/three uploads from `demo_test`, completed remaining
cases and reran failed checks successfully. No unresolved check failure or test
listener remains. Broad 83 API/69 browser results above are earlier Plan 013 evidence,
not a claim of rerunning those whole suites for this change.

Live HTTPS 360/1440px verified all four placements, full width/half-height, absence
of old linked artwork/actionable content, masked owned balances/activity, stable
samples, reload/return and retained selection behavior. Banking/global collection
settings unchanged; no banner visibility/click/feature observations, external
requests or browser errors. Both owned Automation fixtures deleted. API/DB health,
active service and matched API/web release links verified. No migration or real
vendor capture. Evidence: ignored 0600 `artifacts/strip-layout-live.json` and
`artifacts/strip-*.log`; logs/helpers/screenshots remain uncommitted.

## Plan 015 verification — 2026-10-13 UTC

Owner chose **admin controls only** and clarified that each page name is a banner
space header. Source/migration **c8f4204**, verified UI/test follow-up **b52045c**;
release **2026-10-13T20-55-23-121Z**. Feature Explorer is the fifth Admin Menu/Home
entry, with four space sections, twelve catalog choices, widget-title configuration,
read-only/copyable automatic URL, mobile upload/preview/replacement, accessible
text/order and inclusion in future rotation. Image-less inclusion is rejected.
No customer reader, artwork activation, rotation, impressions or CTA attribution
was introduced. Plan 014 customer placeholders remain inactive.

| Check actually run | Result |
| --- | --- |
| API/migration suite | `npm test`: **88 TAP entries passed**, including five new Feature Explorer entries; no failure/skip |
| Browser | **9/9**: new admin configuration and both account journeys at 360/390/1440px; persisted artwork/settings/URLs, four spaces, menu/Home, no overflow/errors; screenshots reviewed |
| Privacy | **3/3** consent/masking SDK-stub journeys crossing into `/controls/feature-explorer`; admin excluded and masked, no real Microsoft capture |
| Build/quality | Typecheck, format, evaluation build and documentation link/diff checks passed; existing bundle advisory remains B-011 |
| Migration | 0010 committed before application, tested on `demo_test`, then applied to retained `demo`; both ledgers version **10**, no pending/drift, repeats no-op; one additive unseeded table |
| Backup | Root-only 0600 `/var/backups/softek/demo-before-0010-20261013T205047Z.sql`, including schema/data/ledger |
| Live HTTPS | Admin spaces/configuration at 360/1440px; a valid >32 KiB PNG crossed the new scoped Nginx upload allowance; actual WebP preview, saved settings and derived URLs verified |
| Customer boundary | Own customers on Summary and three account details retain non-actionable placeholders, unchanged owned balances/history/goals, no new banner/feature observations; global collection settings unchanged |

Initial browser test assumed an Admin Home menu item that does not exist; corrected
the test to close the menu and open the Home route, then all nine checks passed.
No unresolved failure or dev/test listener remains. Live checks removed only their
own eight widgets, two assets and two Automation customers; no configuration was
seeded for retained customers. Production widget table is empty after cleanup.
No external requests/browser errors; matched release links, active service and API/
DB health verified. Evidence: ignored 0600 `artifacts/explorer-live.json`; helpers,
logs/screenshots remain ignored. New runtime-table data remains independent of
legacy banner history and account state. Customer rotation is still explicitly
owner-deferred (B-016), with further contextual placements separate (B-015).

### EXP-06 widget deletion — 2026-10-13 UTC

Source **01f082a**, release **2026-10-13T21-16-17-030Z**. Confirmed Delete appears
on each feature widget row and its configuration page. The private admin endpoint
locks and permanently deletes only the selected row/settings; repeated deletion
succeeds. Shared catalog pages, other spaces and immutable artwork remain; the
feature may be re-added with fresh settings. Configuration deletion returns to
Feature Explorer; errors preserve the current UI for retry.

Focused API **6/6 TAP entries** and browser **6/6 journeys** at 360/390/1440px
passed: access/CSRF, scoped deletion, immutable images, repeat requests, cancellation,
failure/retry, persistence and re-adding. Initial API assertion expected 401 for an
unauthenticated POST; existing CSRF middleware correctly returns 403, so the test
was corrected and passed. Typecheck, format and evaluation build passed; screenshots
reviewed. No full API or privacy-suite rerun was needed for this admin-only follow-up.
Live HTTPS 360/1440px verified row/configuration cancellation/deletion, correct
return, unaffected other space, restored catalog choice and idempotent retry.
Only four newly created fixtures were deleted; original configuration/global Clarity
settings matched before/after. No external requests/errors or test listeners; API/DB
health, active service and matched release links verified. Schema stays **10**;
no migration/customer activation. Ignored 0600 evidence:
`artifacts/explorer-delete-live.json`; checks/logs/screenshots remain ignored.

## Plan 016 verification — 2026-10-14 UTC

Source/migration **0cbb1cb**, acceptance tests **fe66eea**, public smoke adaptation
**e204138**, admin-preview cursor preservation **ba786dd**. Current release
**2026-10-14T00-11-24-262Z**. Owner's three enabled Summary widgets (Identity
Protection, Small Business Invoicing, Youth Banking) now appear one at a time in
saved order, with login/refresh rotation and exact menu/tab selection restoration.
Actual uploaded artwork stays proportional in the compact strip. Customer account
pages retain placeholders. Reporting reuses owned immutable snapshots/feature
observations without Savings Goals campaign attribution; Clarity context uses loaded
artwork, clears on exit, and respects existing consent/collection gates.

| Check actually run | Result |
| --- | --- |
| API/migration suite | **94 TAP entries passed**, no failures/skips; ordering/concurrent retry, ownership/tabs, legacy separation, deleted/disabled/empty recovery, immutable CTA attribution and unchanged banking |
| Browser | **18/18** at 360/390/1440px: Summary rotation/link/visibility/CTA/fallback, existing account journeys and Feature Explorer creation/deletion; screenshots inspected |
| Privacy | **6/6** SDK-stub checks at all three widths: existing consent/masks/admin/shared identity plus loaded Summary tags/events and account-route clearing; no real Microsoft requests |
| Build/quality | Typecheck, formatting and evaluation build passed; existing bundle advisory remains B-011; documentation links/diff checked |
| Schema | 0011 committed before applying to test/demo; both version **11**, no pending/drift, repeat production application no-op; root-only 0600 backup `demo-before-0011-20261014T000207Z.sql` includes schema/data/ledger |
| Live HTTPS | 360/1440px: all three owner images loaded, exact order/wraparound, correct feature links/CTA attribution, qualified visibility, stable returns, inactive account slots and unchanged banking |
| Admin preview | Live impersonation of own fixtures retained the current banner/cursor and returned correctly to Admin; capture excluded |

No owner widget/settings/image was changed; before/after configuration/global Clarity
settings and all three artwork SHA-256 values matched. Only two new Automation
customers were used and deleted, with their banking/events/presentations/cursors.
Zero external requests/browser errors in live checks; matched release links, active
service and API/DB health verified; no test listeners remain. Ignored 0600 evidence:
`artifacts/summary-banners-live.json`; logs/helpers/screenshots remain ignored.
Public smoke accepts the active compact banner or empty placeholder. The generic
banner-click pilot can find the slot again, but was not run or sent to Microsoft.
Broader banking/privacy-suite counts above are historical evidence, not additional
reruns for this phase. Other banner spaces and the recording inquiry stay deferred.

## Plan 017 verification — 2026-10-14 UTC

Migration **9a167b6**; implementation **f00c785**; final acceptance **6fa782e**.
Release **2026-10-14T15-32-53-693Z**. PHX-01–07 complete; source and runtime preserve
Clarity calls/consent while tracing is Off. No Microsoft pilot or owner recording
investigation was run. Earlier checks above remain historical evidence.

| Check actually run | Result |
| --- | --- |
| API/migration | **110 TAP entries passed**, no failures/skips; adapter fidelity, strict context/ownership, consent/actor/impersonation, retries/conflicts, terminal close, reset/deletion and additive/repeat schema |
| Browser/privacy | **12/12**, 360/390/1440px: new mirror/audit-failure journey, existing consent/masking/shared identity, impersonation stopping, Summary tags/events; hosted SDK stubbed and no real Microsoft traffic |
| Real Phoenix | **13/13** focused checks with isolated port-6008 instance; accepted MariaDB arguments/event ID matched REST readback and generic span Attributes in real UI; HTTP failure, partial rejection, timeout and expired lease covered |
| Capacity | 200 synthetic identities × 100 calls acknowledged/persisted in isolated SQLite; initial 20-second REST readback was incomplete while insertion drained, later read-only counts confirmed 20,000; collector-only evidence, not a full banking cohort/production throughput claim |
| Quality | Typecheck, format check, evaluation build and diff/link checks passed; existing bundle advisory remains B-011 |
| Schema | test/demo version **12**, no pending/drift; repeat production application no-op; private 0600 schema/data/ledger backup `demo-before-0012-20261014T153200Z.sql` |
| Live HTTPS | 360/1440px admin control ready/Off, no overflow, customer Summary banner and feature CTA work; zero diagnostic/vendor calls/browser errors; original user/widget/collection/tracing fingerprints unchanged; two owned Automation fixtures created/deleted |
| Host | matched API/web release links, API/DB health, active scoped API/Phoenix services, loopback-only Phoenix HTTP and no new gRPC/public ingress; isolated test collector stopped |

Evidence is ignored: `artifacts/phoenix-live.json`, `phoenix-real-span.png`,
`phoenix-volume.json` and `plan017-*.log`. Invocation/queued/collector acknowledgment
are explicitly distinct from Microsoft receipt/processing. Browser delivery is
best effort with bounded losses; remote Phoenix copies can outlive local deletion
or an in-flight request and expire independently. No push or rollback performed.

## Plan 018 verification and release

- Implementation commit **cedf9bf**; release **2026-10-14T16-24-31-198Z** deployed
  to matching API/web current links. Schema 12 remains unchanged, no pending/drift.
- **16 focused TAP entries passed**, including durable intake/export regression,
  escaped/object/multiple/zero arguments and every invocation outcome. Isolated
  Phoenix on 6008 persisted Input/Output/status/message/unknown kind; real table
  and Attributes checks passed. The first run needed a selector update because
  Phoenix now opens the populated Info panel; rerun passed with no failures.
- Typecheck, formatting, evaluation build and Git diff checks passed. Build retains
  its existing large-bundle warning. Screenshots/logs under ignored artifacts.
- Live HTTPS health reports connected DB; API/Phoenix services active. Authenticated
  tracing status is configured/enabled. Both owner-enabled switches and their
  revisions matched before/after; deployed exporter fields checked without emitting
  a production test trace. No real Microsoft pilot or historical re-export.
- Isolated collector stopped; test-owned DB fixtures cleaned by the tests. No known
  implementation failure. No push; owner temp files untouched.

## Plan 019 verification and release

- Implementation **7f1f9ba**; release **2026-10-14T18-52-04-855Z** deployed to
  matching API/web links. Schema 12 unchanged; deployment migration check passed.
- **14 TAP entries passed** for context, adapter and feature/report regression.
  **12 selected browser cases passed** across 360/390/1440px, counting the corrected
  Summary reload case rerun at all three widths. First mobile reload checks needed
  to scroll the banner into view before asserting visibility; no application fix
  was needed for that test-step failure. Consent, impersonation, SDK/audit fidelity,
  banner/feature/CTA/navigation and context clearing passed.
- Typecheck, formatting, evaluation build and diff checks passed; existing bundle
  size warning remains. All routine vendor requests stubbed/blocked.
- Live owned Automation fixture + SDK stub: a full Summary reload produced **16
  calls: one consent, one identify, twelve sets (nine initial + three loaded-artwork
  changes), page_view and banner_visible**. Each stable tag occurred once. Exact
  SDK/audit arrays matched; all sixteen spans were persisted in real Phoenix and
  filtered in its actual UI. No real Microsoft uploads. Screenshot/evidence:
  ignored `artifacts/clarity-context-phoenix.png`, `clarity-context-live.json`.
- Owner's real Summary reload at 18:58:21 UTC also persisted **16 calls**, including
  twelve sets and one identity, under document `13e6cb4a-870d-41a5-8e56-f20b4a1ea70d`.
  Its feature changes from none to business-invoice. Identity-protect spans two
  seconds earlier belong to the preceding document, initialized at 18:41 before
  deployment; clearing Phoenix does not stop open-page emissions. These are human
  owner spans, separate from the controlled Automation fixture. No cross-document
  feature leakage was observed; filter by document to isolate a reload.
- Checked document UUID **3cb93b79-353e-406d-9f20-ccf0351dbbad**. Its test customer
  and linked local history were permanently cleaned up; Phoenix copies remain
  until the existing retention policy or owner cleanup. No owner history cleared.
  Live switches and revisions preserved; HTTPS DB health and services active.
- Phoenix Spans filtering uses nested attribute access for dotted attributes:
  `attributes["softek"]["document_id"] == "UUID"`. Flat REST attribute keys do
  not imply the same bracket syntax in this version's Spans filter.
- No known unresolved implementation failure; no push. Owner `temp/` untouched.

## Plan 020 verification and release

- Implementation **e0a642f**; release **2026-10-14T19-23-25-623Z** deployed to
  matching API/web links. Schema 12 unchanged; deployment migration check passed.
- **16 focused TAP entries and 12 browser cases passed**. Tests cover a held image
  across reload (no deferred set calls/audit metadata until image release), actual
  values exactly once, failed image and confirmed empty selection, account context
  clearing, events, consent, impersonation and SDK/audit fidelity at 360/390/1440px.
  Initial browser acceptance exposed a missing resolved-empty path; the selection
  component now mounts shared readiness handling for empty results and all cases
  passed on rerun. No known unresolved implementation failure.
- Typecheck, formatting, evaluation build and diff checks passed; existing large
  bundle warning remains. All routine Microsoft traffic blocked/stubbed.
- Live owned Automation fixture + SDK stub: a Summary reload produced **13 calls**:
  one consent, one identity, nine sets, page_view and banner_visible. No temporary
  feature/banner none or service banking calls. Exact SDK/audit arrays matched;
  all thirteen spans persisted and were inspected in real Phoenix's filtered UI.
  This replaces Plan 019's 16-call reload pattern; historical records stay intact.
- Evidence: ignored `artifacts/summary-ready-live.json`, `summary-ready-unit.log`,
  `summary-ready-browser.log`, `summary-ready-phoenix.png`. Checked document UUID
  **b1ab04e8-8301-4c42-b3c9-f692c9936d2c**. The owned fixture and linked local records
  were deleted after acceptance; Phoenix copies remain subject to retention/owner
  cleanup. No real Microsoft uploads, owner data cleanup or collection pilot.
- Owner-enabled live switches/revisions preserved; HTTPS DB health and both
  services active. No push; owner `temp/` untouched.

## Plan 021 verification and release

- Implementation **d0b7794**; release **2026-10-14T20-37-46-275Z** deployed to matching
  API/web links. Schema 12 unchanged; deployment migration check passed.
- **23 focused TAP entries and 12 SDK-stub browser cases passed**. Checks cover known
  aliases/unknown rejection, legacy compatibility, owned feature entry and UUID
  snapshot preservation, Summary rotation/readiness/nine set calls, banner/CTA
  attribution, consent and impersonation across 360/390/1440px. Typecheck, formatting,
  evaluation build and diff checks passed; existing bundle warning remains.
- Live owned Automation fixture + SDK stub: 13-call Summary reload (one consent,
  identity, nine tags and two events). SDK/audit arrays matched; real Phoenix REST
  and UI show `clarity("set", "banner", "summary-business-invoice");`. Its internal
  banner ID remains `b6184060-7f86-40c3-bc23-4026f0f3a37b`; admin API exposes both.
  No real Microsoft uploads, history clearing or owner setting changes.
- Checked document **9173fb07-9e3c-483c-827b-3bc276dc5c19**; ignored evidence:
  `artifacts/readable-banner-live.json`, `readable-banner-phoenix.png`,
  `readable-banner-tests.log`, `readable-banner-browser.log`. Owned customer and linked
  local records removed; Phoenix copies retain their ordinary expiration/owner cleanup.
- Live switches/revisions preserved; public health reports connected DB; API/Phoenix
  services active. No unresolved failure, no push; owner `temp/` untouched.

## Exact resume point

Current work resumes from the **Next task** at the top: automatic replay is
delivered; remaining Plan027 physical acceptance is separate. The older delivered-feature
context below does not replace that task or authorize new analytics experiments.

1. Read AGENTS/START_HERE, state and PRODUCT; inspect actual Git and live release.
   Plans 017/018/019/020/021 are delivered; the owner has collection and tracing enabled.
   Use private port-6006 forwarding and select softek-clarity-api. Refresh the
   customer page and inspect new spans for readable Input/Output/status/error and
   resolved context (one identity, nine tags sent once, readable banner alias);
   historical spans retain their old fields. Customers still need analytics consent. Do not infer
   raw SDK upload observation or resumed recording investigation from this delivery.
2. Plans 013/014/015/016 are complete and deployed; verify live release/schema/Git
   before new work. Walk through Summary's three ordered feature banners and their
   links/report attribution. Account detail banner slots remain inactive; discuss
   their activation and wider Explore placements (B-016/B-015) before implementing.
   Existing `/savings` education and `/loans` journeys retain their one-per-visit
   invitation cap, independent of Summary banners. Wider institution configuration
   remains deferred; do not infer authorization from the broader supplied brief.
3. Both feature-menu captures are complete. Owner accepts automated Dashboard
   activity plus human saved recordings and ended the missing-recording inquiry.
   Await the next priority; do not resume consent/shutdown experiments or support
   escalation unless explicitly reopened. Plan 003 and broader profile validation
   remain deferred. Keep existing presets; no OS selector is requested.
4. Plan 016 restores the linked Summary slot; the generic banner-click pilot can
   find it again. If owner explicitly requests recording evaluation, use
   `clarity:pilot -- --collect` with
   explicit pair flags or `--customer=UUID` and private PILOT_CUSTOMER_PASSWORD.
   Verify actual dashboard classification/recordings/masks/heatmaps, not just
   uploads. Bot Detection is owner-reported Off as of 2026-10-12 UTC; the pilot's
   evidence label already reflects that owner-reported setting.
   OS identities are preset-derived; no independent OS selector is implemented.
   Verify user agent/platform consistency and actual Clarity classification before
   claiming OS emulation acceptance. Owner has reported mouse playback; Chris
   remains deferred until the owner says the demo is ready.

## Git and operational handoff

Current Git delivery supersedes the then-current uncommitted/ahead statements in
older dated verification sections above.

- **b13de94** commits the outstanding Plan025–028 implementation, native local
  module/probes, change-triggered capture, page references/diffs, automatic30fps
  replay, keyboard-tail correction, tests and primary documentation (71 files).
- Migrations0014/0015 were already committed as **51cc902/e2b5c8a** before schema
  application. Applied SQL/checksums are unchanged. This delivery-notes commit adds
  the current state and verification record; inspect `git log -1` for its identity.
- Commit verification actually run: **52 focused core/API/migration/image/FFmpeg/
  queue TAP entries**, **29 mobile core +20 rendered/adapter entries**, workspace/
  script typecheck, full TypeScript/CSS formatting and mobile CJS formatting pass.
  Known private environment values were checked against72 project candidates:
  no matches or unexpected credential/generated files. Diff/relative links pass.
  Reports are ignored `artifacts/commit-capture-*.log`. Prior browser/live/device
  evidence remains above; no extra deployment or collection experiment was run.
- All project work is committed locally. Owner `IMG_2008.jpeg` and `temp/` are
  excluded and untouched; private configuration, builds, recordings and evidence
  remain ignored. **No push** performed. Remote remains
  `https://github.com/cnm4us/softek.git`; the four local commits since origin include
  both migrations, implementation and these delivery notes.
- Live release remains **2026-11-06T16-58-10-085Z**, schema15, signed mobile
  **0.5.0 (15)**. Services/settings were not changed by committing. LOCAL_SETUP
  owns operations/rollback; TESTING owns commands; individual plans retain open
  physical/lifecycle/resource checks. SDK packaging/tenant targeting remains future
  scoped work; the banking demo stays the reference application.
