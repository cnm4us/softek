# 025 — Change-triggered screenshots and animated video replay

Lifecycle and evidence: [PROJECT_STATE](../PROJECT_STATE.md#plan-status-registry).
Requirements: [PRODUCT](../PRODUCT.md#animated-recording-replay--plan-025).
Design: [ARCHITECTURE](../ARCHITECTURE.md#animated-replay--plan-025).
Depends on the accepted functional [Plan 024 POC](024-ios-screenshot-recording-poc.md).

The owner requested this plan after discussing sparse screenshots, timestamps,
FFmpeg-generated scrolling and gesture markers. The owner subsequently authorized
implementation. Stage A's renderer/private review is implemented; installed-phone
visual review precedes Stage B. Plan 024's remaining profiling/operational tasks stay
open, and acceptance is not inferred from a successful render or cloud build.

## Outcome and delivery order

Create a private video that approximates the interaction while retaining its real
duration, pauses, readable screens and visible timing. Take screenshots on meaningful
changes; generate intervening animation on EC2. Do not introduce continuous video
capture or a periodic screenshot fallback. Video encoding frames are generated
afterward and do not determine how often the phone captures an image.

1. **Stage A: prove the visual result using existing images.** Render a short
   scrolling example, then a full duration-preserving replay. No app rebuild,
   capture collection or database migration is needed for this experiment.
2. **Review the result.** Confirm that text, alignment and reconstructed movement
   are useful. If existing images do not overlap sufficiently, report that result;
   use a labeled synthetic fixture to test the renderer, without presenting it as
   the owner's session. Scope a small instrumented recording if evidence is still
   needed, rather than treating an unsuitable source as proof of impossibility.
3. **Stage B: capture changes and lightweight motion events.** Version the protocol,
   receiver and viewer; update the app, then validate a newly approved iPhone
   recording and its reconstructed video. Retain compatibility with old recordings
   and installed build 10 throughout rollout.

Stage A is the first authorized implementation milestone. Review of its output
precedes Stage B; implementation authorization does not substitute for that evidence.

## Existing implementation and implications

- `apps/mobile/src/capture-loop.ts` schedules 1 Hz captures and derives sequence
  from elapsed seconds. `recording-controller.ts` handles eligibility/lifecycle,
  the typed bridge and bounded uploads; `capture-file.ts` produces native JPEGs.
- `apps/api/src/recordings.ts` requires `floor(elapsedMs / 1000) === sequence`.
  Migration 0013 also requires frame elapsed time to be at least 900 ms. These
  rules cannot accept an initial near-zero frame or multiple changes in one second.
- `apps/web/src/recordings.tsx` displays each legacy frame for one second and treats
  missing slots as gaps. Sparse replay needs a separate interpretation of holds,
  missing observations and delivery failures, rather than relabeling every idle
  second as a missing screenshot.
- Existing rows contain capture UTC, monotonic elapsed time, capture duration,
  receipt UTC and Stop elapsed time. They contain no scroll positions or gesture
  coordinates. Existing scroll animation must be identified as estimated, and
  real gesture markers cannot be recovered from these images alone.
- FFmpeg/ffprobe 4.4.2 and native pan/crop/text capabilities were checked locally.
  Recheck capabilities, source retention and capacity before actual rendering;
  installed tools do not establish render quality or resource consumption.

## Stage A — private video experiment

### Source and timeline

Use a finalized, retained fictional-data recording with overlapping scroll views.
The earlier inspected long recording had 139 images and Stop elapsed 139,234 ms;
revalidate actual availability because seven-day retention still applies. Read its
metadata/files through a scoped project tool/runtime identity, without printing
credentials or modifying the source. Do not copy screenshots into public assets.

Build a deterministic timeline manifest containing source sequence/hash, capture
UTC/elapsed time, output interval, transition type, alignment/offset and confidence.
Keep manual annotations and estimated scroll start/end times in this manifest so
the experiment can be reproduced. Manual selection/alignment of a small example
is acceptable; a general image-registration service is not required.

- Order by monotonic elapsed time, never upload/receipt time or client UTC alone.
- Preserve elapsed time from session start through Stop. Show an explicit initial
  no-image interval rather than backdating the first capture to time zero.
- Hold stable screens for their original duration. Do not compress idle time or
  lengthen the session to accommodate transitions. Preserve explicit missing-file/
  interrupted-upload gaps; a long legacy missing-slot interval is not known idle.
- Show elapsed playback time and the actual source snapshot capture time, labeled
  separately. During reconstructed movement retain source capture labels; do not
  label a synthetic intermediate frame as a newly captured screenshot. Display
  UTC explicitly or a named timezone; keep receipt times in review metadata.
- Finalized sessions have a measured Stop boundary. An interrupted session with no
  reliable end must be labeled incomplete, with the chosen export cutoff recorded.

### Movement and encoding

First select a roughly 10–20 second source interval with a pause and a scroll.
Align overlapping content, make a bounded composite, then animate a crop across
that composite using FFmpeg. Separate stationary overlays/fixed regions only when
they actually remain fixed; the normal page header must not be assumed stationary.
Use measured scroll events in Stage B; Stage A uses documented estimates.

Reject unreliable alignment across page changes, menu/error appearance, dynamic
layout changes or non-overlapping views. Use a timed cut or clearly identified
transition, preserving the same interval. Do not stretch text, invent missing
content, smear text with optical-flow interpolation, or pan an entire screenshot
when part of it should remain stationary. Reverse scrolling must also work.

Deliver H.264 MP4 without audio, preserve image aspect ratio and readable text,
pad odd dimensions for compatible encoding (the inspected images were 720×1327),
and place timing labels in a separate band so they do not obscure app content.
Choose and record an output cadence suitable for the animation; it is independent
of capture triggers. Confirm playback on the iPhone and a desktop browser.

After the short example passes review, apply the same timeline to a complete
session, using cuts where reconstruction is unsupported. Report duration error,
animated intervals, fallback/gap intervals, render time, peak memory and file size.

### Server preflight, storage and review

Recheck FFmpeg/ffprobe/filter/encoder availability, disk space/inodes, memory,
current competing processes, source permissions, retention and Softek API health.
No package upgrade, new port, security-group change or global service change is
expected. Use the existing private recording directory and approved project identity.

Start with one manually invoked project-scoped render at a time, at reduced CPU
priority and at most two encoding threads. Proposed initial limits to benchmark:
15-minute source, 15-minute render timeout, 1 GiB working files and 128 MiB output;
retain the receiver's 5 GiB free-space floor and 5 GiB recording budget, counting
derived files. Bound composite dimensions and decoded memory instead of building
an unbounded full-session canvas. Tune limits only from measured evidence.

Use a private staging workspace and atomically publish successful output under a
reserved per-recording replay subdirectory (0750 directories, 0640 files). Confirm
the existing cleanup worker's behavior before adding subdirectories. Coordinate
deletion/retention with short source-copy/publish locks; do not hold the shared
recording lock throughout encoding and block uploads. Recheck source existence
and retention before publishing; deletion must not resurrect an export. Remove
failed/stale work and include derived files in quota/reconciliation accounting.

Stage A produces a private MP4, manifest and short verification report. Deliver
through an authenticated artifact mechanism; if that is unavailable, add only the
minimal authenticated admin delivery needed for review. Do not publish a static
URL, use public banner storage, or build a render-job dashboard for this experiment.

## Stage B — change-triggered capture and event-guided replay

### Capture triggers and bounds

Capture an initial eligible frame after explicit Record approval; thereafter request
native screenshots for committed route changes, meaningful menu/dialog/form/error
state changes, image/content readiness and scroll position changes. Instrument
known React state changes first. Do not upload DOM trees, form values, arbitrary
error text, network bodies or a blanket mutation stream.

Use passive scroll/touch observations without preventing default scrolling. Proposed
working defaults, to tune on the phone:

| Input | Capture policy |
| --- | --- |
| Route/UI/error/content-ready | Capture the committed visible state; coalesce repeated triggers over about 100 ms, prioritize short-lived errors |
| Scroll | Reuse the before frame; capture after roughly half a viewport of new content, on direction reversal when needed, and at scroll end; use a debounced fallback where `scrollend` is unavailable |
| Tap without a visible change | Store gesture metadata; no screenshot needed solely for the tap |
| Idle | Hold the previous observation; no scheduled screenshots; heartbeats remain metadata-only |
| Viewport/zoom/orientation | Capture the changed layout, record new geometry and start a new alignment segment |

Keep one capture in flight; coalesce pending work and use a minimum 500 ms capture
spacing as an initial maximum rate, not a periodic timer. Fast movement may outrun
overlap: mark it and use a transition rather than catching up in a burst. Preserve
the existing 1 MiB image, 10-frame/10 MiB queue, 900-frame, 15-minute and 256 MiB
session limits initially. Reaching a cap stops with a clear reason; it is not a
claim that every fast interaction or brief error will be captured.

### Events, geometry and clocks

Record allowlisted tap, touch/swipe summary, scroll offset, route/UI-state and
viewport events only during an approved eligible recording. Include document and
session generation, event sequence, elapsed time, scroll-container ID, viewport
dimensions/scale and normalized touch coordinates relative to the captured WebView.
Use route identifiers without query values and error-state codes without entered
text. Distinguish a finger swipe from content/inertial scrolling; cancelled pointer
streams must not generate a false tap or invented touch path.

WebKit and native JavaScript clocks have different origins. Calibrate a shared
session timeline with a native/web handshake, bracket clock exchange to estimate
uncertainty, and re-establish it for each document. Native capture timing remains
authoritative for images. Associate a screenshot with geometry sampled near capture;
if scroll/layout changed during capture, flag uncertainty and avoid false alignment.
Record page/viewport coordinates before scaling to the 720px image, including zoom
and nested-scroll transforms; never assume CSS pixels equal image pixels.

Coalesce motion metadata to at most ten samples/second per active scroll stream.
Proposed bounds: 12,000 events/session, 500 queued events/256 KiB, batches at most
100 events and 24 KiB JSON, bounded retry/flush with the existing Stop drain window.
Define aggregate limits across streams so nested scrolls cannot bypass the caps.
Expose event loss/truncation; neither event upload nor retries may starve images.
No gesture or event collection before Record or after Stop/ineligibility.

### Versioned receiver and persistence

Add a negotiated change-triggered policy and capability version; the existing
1 Hz build keeps its current contract. Use independent increasing image sequences
and elapsed time for the new policy, including elapsed zero, with request IDs for
idempotent event batches. Store capture reasons, viewport/scroll references and
event/capture timing uncertainty. Distinguish attempted, coalesced, uploaded and
lost observations from legacy scheduled-slot counters.

Use new numbered MariaDB migrations (0014 if still next when implemented). Never
edit applied 0013. Add policy/version fields and structured event storage with
ownership/cascade indexes, and safely broaden only the constraints needed for
early frames. Preserve legacy rows and validation by policy; old API inserts must
remain compatible with defaults/additive columns. Inspect positional INSERTs and
convert affected writes to explicit column lists before schema changes. Follow the
[migration contract](../db/migrations/README.md), inspect exact dedicated targets,
commit migrations before application, back up retained data and document partial-DDL
recovery. No migration is needed for Stage A.

Reuse the short-lived scoped upload credential, exact-origin/document/generation
checks, customer ownership, quotas, expiry, no-store admin reads and retention.
Validate event batches before persistence, rate-limit payloads and reject forged,
stale, conflicting, after-Stop and wrong-owner messages. Keep events in MariaDB;
keep images/derived MP4 outside it. No new public ingestion service or EC2 port.

### Replay and rollout

Extend the timeline manifest to use observed scroll offsets/times for crop motion
and recorded tap/swipe metadata for brief circles/arrows. Visually distinguish
finger gestures from inertial movement; do not draw a stationary finger throughout
inertial scroll. Preserve labels for reconstructed movement and unknown intervals.
Update admin still-image playback to hold sparse states and show actual loss,
while retaining legacy 1 Hz gap interpretation. Add authenticated video playback/
download for an already rendered export, including seeking/range behavior and
immediate denial after deletion/expiry. Rendering remains a bounded CLI action;
automatic jobs, export queues and job-management UI are deferred.

Deploy backward-compatible receiver/review first, then web instrumentation gated
by negotiated native capability, then a signed EAS preview. Verify old build 10
continues to capture/review. New build must preserve login, reconnect, native
snapshot fidelity, Record/Stop/X, exclusions and all lifecycle stops. Preserve live
Clarity/Phoenix settings; routine tests keep vendor collection disabled.

Rollback disables the new policy/capability and cancels active new-policy sessions,
then restores compatible app/web/API behavior while retaining image/event rows.
Keep schema forward-compatible; do not drop new data to roll back. Document which
previous releases can read both policies, and retain private export deletion and
cleanup even if capture is rolled back.

## Tasks and acceptance

- [x] **VID-01 — Preflight and deterministic timeline.** Revalidate tools, capacity,
  source retention/files/hashes and timing. Build a private manifest and fixture
  cases for initial delay, pause, missing image, out-of-order arrival and Stop.
  **Pass:** timing uses capture elapsed, unknown intervals are explicit, source
  untouched, output duration target is reproducible, resource limits recorded.
- [x] **VID-02 — Short animated scrolling example.** Implement bounded alignment/
  compositing and FFmpeg crop animation, capture/elapsed labels and cut fallback.
  **Pass:** upward/downward motion, pauses and applicable stationary regions look
  correct; text stays readable; uncertain/unseen pixels are not invented; private
  MP4 plays on iPhone/desktop. Save the manifest and owner visual review result.
- [x] **VID-03 — Full replay and Stage A review.** Render a complete retained
  recording, preserving its measured duration within one encoded output frame.
  **Pass:** ffprobe/decode checks, correct start/end/pauses/gaps, readable transitions,
  clean text, no fabricated gestures, measured resources/bytes and scoped cleanup;
  owner confirms whether the approximation is useful before Stage B proceeds.
- [x] **VID-04 — Versioned contracts and migrations.** Add new policy negotiation,
  timing/event schemas, bounded ingest and compatibility with legacy rows/builds.
  **Pass:** dedicated MariaDB clean/upgrade/repeat/partial-failure checks; early and
  same-second frames accepted only for the new policy; ownership/idempotency/
  ordering/caps/lifecycle rejection checked; legacy 1 Hz receiver tests still pass.
- [ ] **VID-05 — Triggered capture and motion events.** Implement explicit UI hooks,
  scroll checkpoints/settle detection, calibrated timing, geometry and bounded
  queues. **Pass:** idle fixture produces no extra images; page/menu/error/scroll
  changes produce explainable captures; no overlap/burst; stale events and late
  capture results discarded; no input values; touch behavior unchanged. Fake clocks
  test timing/coalescing, while signed-device checks establish actual pixel fidelity.
- [ ] **VID-06 — Event-guided replay and private review.** Extend rendering/viewer
  for sparse holds, measured scrolls, tap/swipe marks and authenticated MP4 delivery.
  **Pass:** coordinate/timing fixtures, zoom/nested-scroll uncertainty fallback,
  iPhone/desktop seeking, denied anonymous/customer reads, deletion/expiry revocation,
  quota accounting and cleanup races; old recordings still display correct gaps.
- [ ] **VID-07 — Signed end-to-end acceptance and handoff.** Deploy compatibly and
  install EAS preview. Owner records a fictional two-minute script: idle pause,
  tap/menu, navigation, slow/fast/reverse scroll and form error. **Pass:** substantially
  fewer idle screenshots than 1 Hz, readable state changes, correctly timed gesture
  marks/movement, video duration within one output frame of Stop, visible loss where
  applicable; reconnect/login and background/lock/Reload/logout/force-close still
  stop without auto-restart. Measure capture timing, counts, bytes, memory and render
  cost; check API/web regressions and preserve collection settings. Update setup,
  testing, exact release/build evidence, rollback and next task honestly.

Order: VID-01 → VID-02 → VID-03/review → VID-04 → VID-05/06 → VID-07.
Stage A does not wait on unrelated Plan 023/024 acceptance. Reuse their outstanding
performance evidence where relevant without marking unperformed profiling complete.

VID-02/03 implementation now produces a private 15-second example and complete
full-session replay from the retained 139-frame recording. The owner found cuts
between source 14→15 and 15→16: their valid overlap fell beyond the original
half-viewport search. The revision admits up to three-quarters displacement with
strict matching, animates those two pairs, and generates smoother 24 fps output
without increasing capture. Timing/decode, source preservation, resource measurement and local
browser checks pass. After the fps explanation, the owner explicitly requested
continuing to change-triggered capture; Stage A is accepted for progression.
VID-04 is verified; VID-05/06 are implemented/deployed with fixture evidence,
while remaining physical acceptance and VID-07 stay open. The owner uploaded a
finalized build-11 session: receiver timing confirms long idle holds, change
captures and complete image/event receipt. Its first replay exposed interpolation
across idle time with an unstable endpoint; revision 4 preserves the preceding
pause using the compatible scroll-event onset bound. The owner found the full
replay good overall but reported choppy 24→25 and 33→34 transitions, and missing
motion in the short excerpt. Revision 5 excludes scrollbar gutters from alignment
while retaining content thresholds; both flagged pairs now qualify for animation.
The regenerated short excerpt covers those pairs; the owner confirmed both
transitions look smoother. The excerpt begins with snapshot 23, while the full
recording begins with snapshot 1.
The owner confirms inline amount-error capture and intermediate typed-name
images. Browser-required-field error events trigger snapshots, but the iOS
validation popover pixels are absent; retain this capture-boundary limitation
separately from successful inline validation capture. The focused follow-up is
[Plan 026](026-ios-native-overlay-capture-experiment.md), currently planning only.
New-mode lifecycle checks
and existing profiling remain outstanding.
PROJECT_STATE owns exact release/schema/build evidence.

## Verification and documentation boundaries

Stage A checks timeline arithmetic, fixture registration/crop outcomes, actual
FFmpeg decoding/duration, visual quality and private resource handling. Stage B
adds migration/API, fake-clock/native bridge, browser layout/privacy and signed
iPhone acceptance. Mocks cannot prove real touch/snapshot behavior. Do not broaden
to the full app suite for prose-only planning changes.

Add runnable commands to [LOCAL_SETUP](../LOCAL_SETUP.md) and coverage/evidence to
[TESTING](../TESTING.MD) when their implementation exists. Stage A's executable CLI
and focused checks are now documented there. Keep detailed task checks here and
lifecycle/evidence in PROJECT_STATE.

Out of scope: continuous/native video, off-screen DOM recording, real-bank masking,
other-app/system/keyboard capture, microphone, public sharing/live support, automated
render-job infrastructure and automatic collection without explicit approval.

## Primary references

- [FFmpeg filters: crop, zoompan, overlay and drawtext](https://ffmpeg.org/ffmpeg-filters.html).
  Check installed 4.4.2 help rather than assuming every current-doc option exists.
- [FFmpeg concat timing](https://ffmpeg.org/ffmpeg-formats.html#concat).
- [Scroll completion](https://developer.mozilla.org/en-US/docs/Web/API/Document/scrollend_event)
  and [pointer cancellation during native panning](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event).
- [Existing capture implementation and references](024-ios-screenshot-recording-poc.md#primary-technical-references).
