# 026 — iOS native overlay capture experiment

Lifecycle/evidence: [PROJECT_STATE](../PROJECT_STATE.md#plan-status-registry).
Requirements: [PRODUCT](../PRODUCT.md#native-overlay-capture-experiment--plan-026).
Design: [ARCHITECTURE](../ARCHITECTURE.md#native-overlay-capture-experiment--plan-026).
Depends on the working [Plan 025](025-change-triggered-video-replay.md) capture,
upload and replay implementation. Its remaining lifecycle/profiling work stays open.

The owner subsequently authorized implementation of this experiment. Begin with
the local comparison build; integrated broader uploads still depend on the signed
device pixel/exclusion proof below. This authorization does not extend to the
separately discussed image-diff/full-page experiment.

## Goal and evidence

Determine whether an approved screenshot can include the actual iOS/WebKit
“Fill out this field” validation bubble while retaining readable banking content,
change-triggered capture and the existing recording boundaries.

The owner confirmed inline amount-error capture and intermediate typed-name images.
Empty-field validation also emitted error events and triggered snapshots, but its
native bubble was absent. Exact recording/frame evidence is in PROJECT_STATE.
WebKit's implementation presents this bubble using a UIKit popover; the current
`capture-file.ts` snapshots the referenced content view. A wider app hierarchy may
include it. This is a hypothesis to test, not a guarantee about this phone's view
hierarchy or about all native overlays.

## Proposed approach

1. Keep the current referenced-view method as the baseline and fallback.
2. Try rendering the **foreground window owning that same capture view**, then
   crop directly to the view's banking-content rectangle. Render only that region
   into a bounded image rather than retaining a full-device screenshot.
3. Resolve the window from the actual view/scene relationship. The installed
   view-shot screen option uses a global key-window lookup; do not assume it selects
   the correct window or silently enumerate all application/system windows.
4. Prefer existing public APIs if they provide the required targeting. If needed,
   add a small local iOS Expo module with public UIKit drawing/coordinate APIs.
   Keep it packaged reproducibly for EAS; no hand-edited generated Xcode project,
   private WebKit APIs, SDK upgrade or broad native recording SDK is planned.

The local implementation uses a small scene-associated Expo module; keyboard
notifications define a conservative pre-render clip above the keyboard, and
unrecognized presented controllers reject candidate capture. The fixed 720 px
canvas remains unchanged; blanked areas are identified in local review. Sequential
A/B pairs have at least 500 ms between pair starts, a 350 ms settle delay, one pair
in flight and a one-minute cutoff; these local two-image comparisons do not change
production capture spacing. Physical clipping/popover fidelity remains unproven.

If the bubble lives outside that window, document the finding. A second app-owned
surface may be considered only with explicit ownership, geometry and exclusion
checks. An undifferentiated whole-display/all-window capture is outside this plan.
If public APIs cannot meet the boundary, retain the baseline and report the limit.

### Capture contract and boundaries

- Capture only after the user's explicit tap, with visible Recording/Stopped
  status. Before integrated use, approval text must accurately include app-owned
  validation overlays within the banking area; version capability/approval if
  needed. Old app builds retain their current method and approval contract.
- Continue to exclude login, admin, impersonation, another app, notifications,
  system permission sheets, status bar and native navigation toolbar. No ReplayKit,
  microphone, Photos writes, screen broadcast or continuous video.
- Keyboard appearance/disappearance is a test condition, not a request to collect
  keyboard pixels, suggestions or autofill/credential UI. Establish exclusions
  before uploading candidate images. If a safe region cannot be established,
  discard the candidate and report that reason; never expand the crop to succeed.
- Keep a stable banking-area canvas and one CSS-to-image scale. Convert window,
  safe-area and WebView coordinates explicitly, including visual-viewport offsets
  when the keyboard is visible. Document any blanked/unsupported region. Do not
  resize text or shift gesture markers to hide a geometry mismatch.
- Retain initial-plus-change scheduling, minimum 500 ms spacing, one capture in
  flight, Stop cancellation and bounded queues. Native bubble presentation can
  finish after the DOM `invalid` event: evaluate one bounded delayed settled-image
  request per invalid action, coalesced with pending work. No recurring polling or
  idle screenshot timer. Capture dismissal through a verified interaction/native
  signal; identify unsupported transitions rather than inventing evidence.
- Preserve capture UTC, monotonic elapsed time, receipt UTC, attempts/loss counts,
  JPEG/file validation and existing byte/dimension/session limits. Timing starts
  when pixels are actually requested, not when validation was first detected.
- Typed text may appear in approved images. Do not add input values, validation
  strings, screenshots or native hierarchy dumps to interaction metadata/logs.
  The existing 300 ms input debounce is unchanged by this experiment.

## Delivery stages and tasks

- [x] **OVL-01 — Inspect and define the candidate.** Recheck installed SDK/native
  sources, view/window ownership, archive rules and current capture/lifecycle
  guards. Specify the smallest public-API implementation, coordinate transforms,
  unsupported-surface handling and temporary-file cleanup. Confirm whether a local
  module is required. **Pass:** reproducible design and bounded crop/exclusions,
  with uncertainties listed; no assumption that build success proves pixel support.
- [x] **OVL-02 — Implement a local-only comparison.** Extend the fictional local
  capture fixture with an ordinary HTML required field and an inline error. Keep
  native constraint validation intact. Offer baseline/candidate comparison with
  method, capture time, dimensions, bytes and duration. Arm the check explicitly;
  submit an empty field and capture automatically after validation so tapping a
  separate capture button does not dismiss the bubble. Record sequential A/B
  timestamps; do not claim simultaneous samples. Keep at most eight local images
  with cleanup on exit/restart; no uploads. Owner-requested Clear & reset also
  stops/deletes samples and reloads an empty fixture; distinct test labels and
  review scroll reset make repeated runs clear. **Pass:** bounded capture, truthful
  failures and synthetic data only; no changes to the hosted banking form.
- [x] **OVL-03 — Produce and verify a signed comparison build.** Use the existing
  Softek EAS project, bundle identifier, provisioning and cloud macOS pipeline from
  Ubuntu. Choose the next available version/build at implementation time. Check
  native module autolinking, release build, archive allowlist, absence of secrets,
  IPA identity/profile and standalone launch. A custom module requires a compiled
  app; Expo Go cannot validate it. **Pass:** installable internal build with local
  checks and baseline fallback. Linux inspection is not full Apple codesign or
  iPhone visual verification. More than one cloud build may be needed.
- [x] **OVL-04 — Establish physical pixel and boundary proof.** Run the local
  pixel/crop/keyboard portions of the device matrix below. Compare actual bubble
  presence, readable text, cropping and dismissal. Carry integrated banking,
  lifecycle and resource measurements into OVL-06/07, where that path is available. **Pass:** the actual
  required-field bubble appears in three repeated trials and no excluded pixels
  appear. A deterministic app-owned native popover may help diagnose failures,
  but cannot substitute for the WebKit bubble. If the candidate fails, retain the
  baseline and record a negative result before considering a broader approach.
- [x] **OVL-05 — Integrate the proven candidate with private recording.** Only
  after local pixel/exclusion proof, connect it to the existing controller and
  negotiated experiment capability, scoped approval, before/after eligibility and
  lifecycle checks. Fix candidate selection for the session; report capture
  failures instead of silently switching methods mid-session. Default remains
  baseline until explicitly selected in the experimental preview. Deploy any
  compatible receiver/web change before issuing the integrated signed preview.
  **Pass:** readable approved overlays upload, method/provenance is inspectable,
  old builds remain compatible and fallback is available for a new session.
- [ ] **OVL-06 — Verify receiver, replay and lifecycle regressions.** Follow one
  short fictional recording end to end, then the interruption matrix. Check stills
  before judging the generated replay; native overlay appearance/dismissal must
  hold/cut rather than be swept through a reconstructed page scroll. Omit gesture
  marks where native overlay geometry cannot be established. **Pass:** correct
  timestamps/crop/markers, no extra idle captures, bounded uploads, explicit loss,
  duration within one generated frame, and all stops prevent late image upload or
  automatic restart. Reuse verified Plan 025 checks without claiming they prove
  new native behavior.
- [ ] **OVL-07 — Record the outcome and fallback.** Document supported/unsupported
  surfaces, device/iOS/build, selected method, resource measurements, known timing
  limits, release/rollback identities and owner pixel review. Add runnable commands
  to setup/testing only when implemented. **Pass:** verified positive or negative
  feasibility conclusion; label a negative result as an unsuccessful candidate,
  not delivery of native-popover support. Keep broader performance/operational
  follow-ups open if unmeasured.

- [x] **OVL-08 — Explain excluded keyboard space in replay.** Owner authorized a
  labeled placeholder after accepting tooltip upload/replay. Add “Keyboard area /
  Not captured” within safely identified blank pixels of confirmed masked frames;
  retain a header explanation when placement is unsafe. Preserve originals and
  native keyboard exclusion; do not synthesize keys or hidden page content.
  **Pass:** fixture checks protect page pixels/unmasked frames, encoded labels are
  readable, and the existing recording is regenerated with unchanged duration and
  source hashes. No native build or capture-scope change is required.

- [x] **OVL-09 — Reconstruct the page beneath the keyboard.** After accepting
  OVL-08, the owner authorized this next experiment. Add an opt-in replay renderer
  mode borrowing only registered pixels from nearby unmasked screenshots in the
  same contiguous document route. Preserve the observed upper page/actual tooltip,
  label donor snapshot/time offset, and retain placeholders for unavailable pixels.
  Exact masked bounds and hidden state are not recorded; do not claim current-time
  ground truth. **Pass:** reject unsuitable routes/layouts/geometry/blank matches,
  preserve source hashes and measured duration, encode readable recovered content,
  regenerate the accepted recording and verify private playback. No actual keyboard
  capture, native build, schema change or full-page capture is part of this task.

OVL-03 has a finished signed build, Linux identity/profile checks and owner-confirmed
standalone launch. The owner confirms actual validation-bubble capture in builds
12 and 13, with unchanged native capture source, and confirms build-13 reset/fresh
run behavior. A final build-13 trial (Test 2 / Pair 2 / Window candidate / invalid)
shows the actual “Fill out this field” bubble; keyboard exclusion, alignment and
dismissal/scrolling are also owner-confirmed. The local pixel/exclusion gate
passes. OVL-05 is verified by the actual build-14 window session: all reported
images/events received, real tooltip/keyboard exclusion visually confirmed and
per-frame method flags inspectable. Its first replay preserves duration and holds
native/masked layers; private playback passes, and the owner confirms the replay
shows the tooltip and keyboard exclusion correctly. Remaining banking/lifecycle/
resource acceptance stays open in OVL-06/07. OVL-08 adds the owner-selected
explanatory label to derived replay, accepted by the owner. OVL-09 adds opt-in
reconstruction from registered nearby page captures, with donor/time labeling and
partial-region fallback. Implemented keyboard exclusion is unchanged.
Exact build/report identities and the next device check are in PROJECT_STATE.

Order: OVL-01 → OVL-02/03 → OVL-04 → OVL-05 → OVL-06/07.
Phone feedback is required to establish OVL-04; a simulator/mock cannot replace it.

## Device acceptance matrix

| Check | Expected evidence |
| --- | --- |
| Empty required Goal name, with keyboard hidden and visible where reproducible | Actual bubble readable in candidate; timing and baseline comparison saved; repeat three times |
| Fill field/dismiss bubble, then scroll | Current state captured; no stale bubble, duplicate UI or capture controls in the image |
| Inline amount error and normal typed text | Existing errors remain readable; input-trigger policy unchanged |
| Slow/fast/reverse scroll, menu, banking navigation | Text/crop stable, gesture positions correct, smoothness comparable to baseline |
| Keyboard opening/closing and viewport shifts | No keyboard/suggestion pixels; correct banking coordinates or explicit unsupported result |
| Ten seconds idle after settling | No extra screenshots; metadata heartbeat may continue |
| Stop during pending/drawing/upload work | Late result discarded; no candidate upload after cancellation |
| App switch, lock, native Reload, logout, force-close/reopen | Stopped until explicit Record; force-close still requires login |
| Offline/reconnect, external link and admin/login navigation | Capture stops; no excluded page/surface; existing reconnect/login behavior preserved |
| Repeated one-minute baseline/candidate runs | Counts, p50/p95/max capture time, image bytes, responsiveness and obtainable memory/CPU observations compared; declare unmeasured metrics |

Target capture p95 below the 500 ms spacing budget, zero overlapping captures and
no visible scrolling regression. If not met, report the regression and retain the
baseline rather than raise capture frequency, size limits or queues implicitly.

## EC2, data and rollback

Reuse the current authenticated HTTPS receiver, MariaDB metadata, private image
storage, retention/deletion and manual FFmpeg renderer. No new EC2 port, security
group rule, storage service or database migration is expected for local proof.
Before integrated upload, verify actual API health, gates, free space, cleanup,
JPEG limits and old/new compatibility. Preserve live Clarity/Phoenix settings;
routine tests block vendor collection.

Do not pass unrecognized method fields into today's strict API schema. Prefer
additive bounded provenance using a negotiated contract if persistence is needed.
If a schema change is necessary, recheck the next number (0015 is currently next),
follow the migration contract with committed SQL/backups/recovery, and keep applied
migrations immutable. A renderer must not assume all candidate image motion is
whole-page scrolling simply because image sizes agree.

Keep build 11 and its installer identity as the known baseline, plus the candidate
build/profile and any release identities. To revert, stop the experiment and
start a newly approved baseline session or install a signed fallback build.
Switching methods never starts recording automatically. Roll back any experiment
capability in a backward-compatible way; retain metadata/images and cleanup rather
than dropping data or reverting applied schema. A failed native build leaves the
existing installed app and production receiver unchanged.

## References and limits

- [WebKit iOS validation bubble implementation](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/ios/ValidationBubbleIOS.mm): native popover presentation supports the hypothesis, not a guarantee of capture visibility.
- [Apple view-hierarchy drawing](https://developer.apple.com/documentation/uikit/uiview/drawhierarchy(in:afterscreenupdates:)) and [window scenes](https://developer.apple.com/documentation/uikit/uiwindowscene): use public view/scene geometry and verify on-device results.
- [Local Expo modules](https://docs.expo.dev/modules/get-started/) and [cloud builds](https://docs.expo.dev/build/introduction/): native code can be packaged in the existing cloud build workflow; new native code needs a compiled preview.

Out of scope: Android, other applications/system UI, keyboard capture, real-bank
masking, audio/video recording, website validation redesign, changing typing policy,
automatic replay jobs, new support-sharing features or general overlay coverage.
