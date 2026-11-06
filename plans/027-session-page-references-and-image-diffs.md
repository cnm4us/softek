# 027 — Session page references and image diffs

Lifecycle/evidence: [PROJECT_STATE](../PROJECT_STATE.md#plan-status-registry).
Requirements: [PRODUCT](../PRODUCT.md#session-page-references-and-image-diffs--plan-027).
Design: [ARCHITECTURE](../ARCHITECTURE.md#session-page-references-and-image-diffs--plan-027).
Depends on the capture/timestamp/replay path in [Plan 025](025-change-triggered-video-replay.md)
and the native-layer boundaries and reconstruction findings in
[Plan 026](026-ios-native-overlay-capture-experiment.md). Their remaining lifecycle,
profiling and operational tasks stay open.

**The owner reviewed the plan and authorized implementation (“Great. Please
proceed.”).** Implement the existing-image experiment first, then compatible
server/native changes and device checks. Existing Plan 024–026 follow-ups remain.

## Goal

Build a page image progressively from the portions viewed during an approved user
recording. Preserve timestamped changes as image patches and use the resulting
page versions to reconstruct viewport movement and fill supported gaps in replay.

A reference belongs to one recording and compatible page/layout segment. It may
start anywhere, remain partial, contain gaps, or eventually cover the whole page.
Neither starting at the top nor reaching the bottom is required. The owner's
latest clarification supersedes a mandatory admin sweep/full-page starting image.
A deliberate top-to-bottom sweep remains a useful test case, not a prerequisite
or a separate admin collection feature.

## First delivery and boundaries

- Use the existing explicitly approved, change-triggered screenshot/event stream.
  Start with server-side assembly and diffing; retain immutable original JPEGs.
- Build references from the same user's same recording. Do not reuse another
  session's balances, form values or text/layout settings as page pixels.
- Support the main vertically scrolling banking document first. Nested scrollers,
  menus and uncertain/fixed layers retain observed viewport replay until their
  geometry is proven; they cannot establish main-document coverage.
- Preserve native tooltip capture, keyboard exclusion, Record/Stop, interruption
  behavior, receipt/capture timestamps, gesture provenance and independent web use.
- Produce private reference previews, a coverage/provenance view and short/full
  reconstructed videos. A page-length preview is optional when small enough;
  sparse tiles are the source representation, so a very tall page need not become
  a single enormous decoded bitmap.
- No hidden auto-scroll, unseen/off-screen capture, DOM/HTML replay, actual keyboard
  capture, continuous video, admin-wide reference library or generative image fill.
- On-device image diffing, patch-only uploads and removing original screenshots
  are deferred. First measure correctness, patch volume and server cost.

## Proposed data flow

1. The app captures a changed viewport through its selected, approved method.
   Associated metadata identifies the page visit/layout, scroll container, document
   extent, viewport and valid image content region at capture time.
2. The server maps usable document pixels into that recording's sparse page canvas.
   Pixel overlap verifies the metadata mapping; unreliable observations remain
   viewport-only. Capture order follows monotonic elapsed time, not receipt time.
3. Newly observed regions extend spatial coverage. Compare overlapping observed
   regions with the latest applicable page state and store changed tiles/rectangles,
   including pixels that erase previous text or error messages.
4. Append a timestamped immutable patch revision. A later source never overwrites
   the historical version used for an earlier point in playback. Optional compact
   checkpoints bound replay work; all derivatives remain rebuildable from originals.
5. FFmpeg renders the appropriate viewport through these versions. Preserve observed
   pixels at screenshot times; interpolate supported movement between them. Render
   uncertain transitions with timed holds/cuts, retaining the actual duration.

### Coverage, time and validity

Maintain these as separate facts:

| Fact | Meaning |
| --- | --- |
| Spatial coverage | Which document regions have real source pixels in this compatible segment |
| Source provenance | Source snapshot/hash, capture elapsed/UTC time, mapped rectangle and alignment evidence |
| Page revision | Which observed patches apply at a particular replay time |
| Freshness/validity | Last observation and known invalidations; off-screen pixels may have changed |
| Boundary observations | Top/bottom seen for a measured page extent, independent of coverage completeness |

A final mosaic can combine observations made at different times; label it as such.
A faithful replay uses observations available at its replay time. Retrospective
fill from a later screenshot is an explicit reconstruction option with source time
shown; it cannot silently become historical fact or bring later input/error pixels
into an earlier observed viewport. Keep unavailable regions visible as unavailable.
The absence of a screenshot or a diff never proves off-screen content stayed fixed.

Track top/bottom against the actual main scroll container with a small rounding
and bounce tolerance. A short page can be at both boundaries. A session starting
mid-page can validly have neither. If page height changes, reevaluate boundary
observations for the new layout. Claim complete spatial coverage only when all
regions within the measured extent are covered in one compatible layout, with
confirmed endpoints and no holes; visiting both endpoints alone is insufficient.

### Geometry, layout and surfaces

Propose a strictly versioned optional page-context extension, negotiated for capable
clients while retaining legacy `periodic-v1`/`changes-v2` readers and scheduling.
Freeze exact names/limits in CAN-03 before editing code. Collect only bounded,
whitelisted numeric/identity metadata, including:

- Document/page-visit identity and layout revision; route without query strings.
- Actual scroller position, scrollable width/height and client width/height.
- Visual viewport size, offsets and scale, separately from document scroll origin.
- Image dimensions and validated CSS-to-image mapping, valid content rectangle,
  excluded keyboard rectangle(s) and surface/capture-method provenance.
- Render/layout signature sufficient to reject incompatible width, orientation,
  zoom or changed text rendering; do not require reading OS text preferences.

Existing `scrollY` includes a visual-viewport offset while `containerY` is tracked
separately. Establish the image's actual document origin with device measurements;
adding offsets again would misplace keyboard-era pixels. New native metadata must
report the same clip it actually used to render, including keyboard transitions.

Begin a new reference segment on route/document changes, incompatible width/scale/
text layout, or unexplained reflow. A mutation/height change that may move unseen
content must invalidate the affected cached area or start a new layout revision;
seed that revision from currently observed pixels rather than transplanting stale
content below the change. Retain old revisions for historical replay. A return to
the same URL does not establish unchanged page state. Keyboard viewport motion is
handled separately from document reflow when mapping is proven, otherwise fall back.

Treat popovers, dialogs, fixed/sticky UI and capture controls separately from page
pixels. Do not bake a validation bubble into the permanent canvas. In the first
version, reject whole popover/menu frames as base donors unless a clean page region
can be identified reliably. Preserve the original viewport image for their actual
appearance/dismissal; add page fill only outside valid observed pixels. Masked
keyboard pixels never establish coverage. Unsupported native geometry remains
explicitly unsupported; this plan does not require solving every overlay.

## Tasks

- [x] **CAN-01 — Establish the source baseline and offline experiment.** Inspect
  current source contracts, Git status and retained sources. Use the existing
  Savings Goals recording `c9c0bcfa-6fe9-4ea1-8dba-7476d1581b44` to test multiple
  registered donors, including its later footer, rather than the current nearest
  single donor. Work in a bounded private derivative workspace; preserve the
  accepted export until a candidate validates. **Pass:** preview a partial page
  mosaic and a short reconstructed comparison with source-time labels, unchanged
  originals and explicit unknown regions. Legacy extent/boundary status remains
  unknown where it was not recorded. No app rebuild is needed for this experiment.

- [x] **CAN-02 — Implement the sparse canvas and versioned diff engine.** Define
  document coordinates, compatible segments, source rectangles and per-region
  provenance. Use bounded tiles (initial working choice: 256×256 image pixels),
  detect new/changed/cleared regions with JPEG-aware comparison, and append immutable
  revisions. Diff against the latest applicable state, not always the original
  reference; refresh checkpoints as needed. **Pass:** unchanged recaptures avoid
  duplicate patches without suppressing real small text changes; a scroll adds
  newly seen pixels without treating translation
  as a page mutation; text/error removal clears old pixels; arbitrary historical
  revisions reconstruct deterministically. Blank/unobserved pixels are distinct.

- [x] **CAN-03 — Define and implement capture metadata.** Inspect the observer,
  bridge, native adapter, receiver and strict schemas together. Version/validate
  the page context, extent, identities, mapping and mask rectangles. Negotiate the
  extension, preserve old clients and reject incompatible retry metadata. Keep
  metadata attached to the actual capture attempt; recheck mapping after capture
  and flag moving/changed layouts. Existing JSON frame context is the proposed
  persistence path; inspect whether session negotiation needs schema additions.
  **Pass:** top/bottom and geometry cases work in fixtures; no node text/input
  values cross the event bridge; legacy clients/recordings still work. A new signed
  EAS preview is expected for native bounds/capability changes, after server support.

- [x] **CAN-04 — Integrate private persistence and compatibility.** Store structured
  source metadata in MariaDB, originals/patch bytes privately, and a rebuildable
  canvas manifest with format version, source hashes, regions, revisions, confidence
  and unavailable reasons. Reuse existing JSON metadata where sufficient. If schema
  changes are necessary, inspect status and use the next numbered committed SQL
  migration with test-schema upgrade and partial-DDL recovery; never modify 0014.
  Extend scoped ingestion/negotiation before enabling the client extension.
  **Pass:** idempotent retries, strict version/dimension/path bounds, private admin
  readback, old-client compatibility and immutable source metadata are verified.

- [ ] **CAN-05 — Integrate viewport replay and coverage review.** Use the canvas
  to reconstruct supported forward/reverse scroll and keyboard-induced viewport
  movement, with real timing and source provenance. Keep actual tooltip/menu/error
  observations authoritative. Add a compact per-page coverage preview showing
  known/unknown regions, observed extent, boundary status and capture times; make
  partial coverage a normal result. Support legacy fallback and explicit labels
  for borrowed/stale/later-time regions. **Pass:** readable short/full replay,
  original screenshot times/appearance preserved, no repeated fixed headers or
  stale bubbles, and duration within one 24 fps output frame of measured Stop.

- [x] **CAN-06 — Bound storage, render work and cleanup.** Recheck FFmpeg, free
  disk/inodes, memory, competing Softek jobs, service health and private permissions.
  Start with one reduced-priority render, two encoding threads, the existing 15-minute
  timeout/1 GiB work reservation and 128 MiB MP4-per-file bound. Proposed additional
  limits: 128 MiB canvas derivatives and 4,096 stored patch tiles per recording;
  tune from measured evidence before rollout. Keep decoded image limits and sparse
  tiling so distant coordinates cannot allocate a huge canvas. Count tiles,
  manifests/checkpoints, exports and work against capacity; current usage counts
  only named replay files and must be extended. **Pass:** bounded fallback to raw
  viewport replay on canvas limits; existing 5 GiB budget/free-space floor retained;
  deletion/retention, crash/orphan cleanup, stale work and atomic publication tested.
  Source deletion during rendering prevents republishing derived data.

- [x] **CAN-07 — Run focused automated and server checks.** Exercise the matrix
  below with synthetic images, existing sources, real FFmpeg decode and private
  HTTPS browser playback. Add meaningful mobile/receiver/browser tests for changed
  paths, not blanket duplicates. Use dedicated test schemas and generated fixtures
  with cleanup; block vendor requests and preserve production Clarity/Phoenix
  settings. **Pass:** source hashes unchanged, pixel/coverage/version assertions,
  timestamp ordering, encoding duration, auth/range/no-store, quota/deletion and
  compatibility checks pass. Record patch bytes/count, comparison/render time and
  peak memory; do not claim savings unless measured against retained full frames.

- [ ] **CAN-08 — Deploy compatible server support and verify on iPhone.** After
  implementation authorization and automated checks, record current release/gates,
  retain a scoped rollback, deploy compatible receiver/review/cleanup first, then
  build/inspect the signed Expo preview with the existing project identity. Preserve
  explicit capture approval, 500 ms minimum spacing, coalescing, source limits and
  lifecycle stops; idle capture remains off. **Pass:** perform the short partial,
  complete sweep, mutation and keyboard cases below; readable coverage/replay,
  measured bounds and safe lifecycle behavior confirmed. No new EC2 port/security
  group or unrelated service change is expected. No shared/admin reference feature.

- [ ] **CAN-09 — Record outcomes and hand off.** Update the registry, requirements,
  design, setup/testing commands and backlog in their primary documents. Record
  preview/release IDs, schema decisions, verification evidence, unsupported surfaces,
  resource results and exact resume point. Rollback disables new canvas assembly/
  metadata negotiation and restores compatible raw replay; keep readers, sources
  and deletion/retention until derivatives expire. **Pass:** partial sessions accepted
  as valid, useful replay demonstrated, known limits explicit, no claim of unseen
  content or older Plan 024–026 lifecycle/profiling work being completed by this plan.

- [x] **CAN-10 — Recover verified keyboard-transition tails.** Owner reported a
  checkerboard at snapshots27→28 in automatic recording a34bc9c6. Preserve the
  original tooltip/viewport and unknown-region semantics. A later clean screenshot
  can extend only the previously unseen lower tail after a recent keyboard event
  if stable geometry and two separated textured bands verify its placement.
  Keep historical as-of coverage unchanged and label later-time fill. Check
  negative mapping/layer/time/motion cases, real encoded pixels/timing and private
  playback, then deploy the worker renderer and regenerate only the affected
  recording. No native build or capture-frequency change. Owner confirms the
  corrected footer and tooltip look correct; detailed evidence is in the registry.

CAN-05 is implemented for preview selection, historical patches, source-preserving
canvas fill and existing timed scroll replay. Owner accepted build15 complete-sweep
scrolling/text/footer and the complete reference. Partial/mutation/keyboard-motion
acceptance is still required. Native/uncertain viewport transitions retain timed cuts until
supported movement is established. CAN-08 has compatible server rollout and signed
0.5.0 (15) actual uploads now verify measured complete sweeps and one exact-bound
keyboard fill; owner accepted the complete-sweep replay/reference. Its remaining
iPhone matrix is not complete. CAN-09 remains open for the outstanding physical
outcomes and operational observations; see the state registry.

Order: CAN-01 → CAN-02/03 → CAN-04 → CAN-05/06 → CAN-07 → CAN-08 → CAN-09.
The existing-image experiment precedes any native build. An unsuccessful mapping or
layer experiment retains observed viewport replay and documents the limitation.

## Acceptance matrix

| Scenario | Required result |
| --- | --- |
| Start at top, scroll partway, Stop | Valid partial reference/replay; bottom unknown/unreached; no compulsory sweep |
| Start mid-page or never scroll | Valid known viewport region; unobserved top/bottom remain unknown; no idle images |
| Top-to-bottom sweep | Footer included, verified overlap and stable measured extent; complete only without holes |
| Fast scroll skipping a region, then reach bottom | Partial coverage with a gap despite both boundary observations; bounded captures preserved |
| Reverse scroll / revisit unchanged region | Correct crop movement; no duplicate patch for codec noise; last observed provenance retained |
| Type, show error, clear field/error | Correct successive pixel states; removals erase previous content; earlier replay remains unchanged |
| Error insertion, expanding section, lazy-loaded content | Reflow/extent revision invalidates unsafe cached areas; no old footer/body spliced at wrong coordinates |
| Keyboard appears, shifts page, tooltip appears/dismisses | Readable real bubble and observed pixels; valid mask excluded; supported movement reconstructed or timed cut; no stale bubble/keys |
| Footer first appears later | Available in final mosaic; earlier use labeled retrospective reconstruction, not backdated observation |
| Menu, fixed/sticky header, nested scroller | Viewport layer/fallback; no duplicated headers or false main-page coverage |
| Same URL after navigation, text-size change, rotate or zoom | Separate/invalidate incompatible segment; no assumed cross-layout reuse or text stretching |
| Background/lock, Reload, logout, force-close, offline/reconnect | Existing stop/no-auto-restart semantics and bounded retry/loss remain; login/reconnect behavior retained |
| Legacy app/source or incomplete metadata | Existing capture/replay works; inferred/unknown coverage labeled; no fabricated extent/endpoints |
| Size limits, failed render, deletion/expiry | Explicit canvas fallback; previous valid output or unavailable state; private data cleaned and capacity counted |

## Execution and deferred work

Implementation is authorized. PROJECT_STATE owns actual source/release/build
status and evidence; setup/testing own executable commands once implemented.
Unchecked tasks remain required, and signed-device checks cannot be replaced by
synthetic fixtures.

Deferred: a reusable admin reference library, one-shot below-the-fold capture,
patch-only device uploads, cross-session reference reuse, full horizontal/nested
canvas support, real-bank masking/sharing, and actual keyboard imagery. Revisit
only with a concrete need and separate scope; none is required for partial session
references to work.
