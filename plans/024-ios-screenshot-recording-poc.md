# 024 — iOS screenshot recording POC

Lifecycle and evidence: [PROJECT_STATE](../PROJECT_STATE.md#plan-status-registry).
Product scope: [PRODUCT](../PRODUCT.md#screenshot-recording-poc--plan-024).
Design: [ARCHITECTURE](../ARCHITECTURE.md#screenshot-recording--plan-024).
Server operations: [LOCAL_SETUP](../LOCAL_SETUP.md#screenshot-receiver-preflight--plan-024).

The owner requested this implementation plan, changing the proposed rate from
four screenshots per second to **one screenshot every second**. The owner then
authorized implementation. Unchecked tasks remain incomplete until their actual
acceptance evidence exists; native capture feasibility requires the signed phone
check before receiver rollout.

## Outcome and scope

On the installed Softek iOS app, a button immediately left of the customer menu
opens a recording overlay. Record starts an explicitly approved screenshot
session; Stop ends capture. Captured images and timestamps reach this project's
server and can be reviewed by an authenticated administrator.

Use the existing Expo app, HTTPS origin, Express API and MariaDB. No new public
port, external storage subscription or separate streaming service is needed for
this small POC. Browser banking continues working. The recording control appears
only after a supported native-app capability handshake on signed-in customer
pages; ordinary browsers and old app builds have no unusable recording button.
The Admin Menu gains review access in both browsers and the app.

This tests visible app-content snapshots. It does not capture other apps, the
iOS status bar/keyboard/system dialogs, microphone, camera or off-screen page
content. It does not yet provide tap markers, gesture paths, semantic error
events, MP4 video, live support, sharing links or production banking masking.
Existing Clarity controls and collection remain independent and unchanged.

## UI and session behavior

- Reuse the customer menu button's dimensions, shape, focus and touch target.
  Show a recording dot while active and a stopped symbol otherwise, with an
  accessible label and visible textual status in the overlay; do not rely on
  color alone. Verify the two buttons fit narrow headers without title overflow.
- Overlay: Record, Stop and an X at the upper right. Explain before Record that
  visible fictional banking screens are uploaded to the demo administrator.
  This tap is session-specific approval, separate from optional web analytics.
- Closing the overlay does not stop recording. Record is disabled while active;
  Stop is disabled while stopped. Starting/uploading/error states must be clear.
  Capture can include the website's recording overlay and customer menus.
- Start only after an authenticated receiver session is established and native
  capture is ready. Show Recording only after the native acknowledgement.
- Stop immediately prevents new captures, discards any in-progress result that
  completes after the stop boundary, and drains already-queued frames for at most
  30 seconds. Show upload progress separately from Recording, then finalize with
  uploaded/missing counts. Stop/finalize are safe to retry.
- Backgrounding, locking, opening an external browser, logout, authentication
  loss, entering admin/impersonation, WebView reload/remount/process loss, or a
  capture/queue failure stops capture. Returning never silently restarts it;
  Record creates a new session. Do not depend on uploads or a termination callback
  running after iOS suspends/kills the process. An inactivity timeout closes
  interrupted sessions on the server and preserves acknowledged frames.
- Keep the current force-close-login policy. Exclude login, admin and impersonated
  screens. Gate capture with native lifecycle/navigation state plus fresh,
  validated website eligibility; clear eligibility before route/auth transitions.
  If a reliable gate cannot be demonstrated, block capture rather than risk a
  login/credential frame. Test transition races, not only stable routes.

## Capture, timing and upload design

Start by measuring `react-native-view-shot` on the actual SDK-58/iPhone build.
Expo documents native view capture and the library lists iOS WebView support;
neither establishes performance or pixel fidelity on our installed app. Capture
the visible WebView container rather than a DOM reconstruction or full page.
Preserve native snapshotting as the experiment's subject.

Working defaults to validate during implementation:

| Setting | Proposed value / behavior |
| --- | --- |
| Cadence | 1,000 ms; first scheduled frame one second after start |
| Scheduler | Monotonic deadlines, one capture at a time; skip overdue slots, never burst to catch up |
| Image | JPEG, approximately 720 physical pixels wide, aspect ratio preserved, quality initially 0.7; tune for readable text |
| Frame limit | 1 MiB encoded image; reject rather than silently truncate |
| Local queue | At most 10 frames and 10 MiB, one upload in flight; no base64 image traffic through the web/native bridge |
| Retry | Bounded retry with backoff for network/429/5xx; no retry loop for invalid/auth-rejected frames |
| Queue failure | Stop capture with an explanation when the queue fills or retries are exhausted; disclose missing frames |
| Session limits | 15 minutes, at most 900 scheduled frames and 256 MiB stored per session |
| Receiver capacity | Initially two active sessions, 5 GiB recording budget, refuse new data below 5 GiB filesystem free space |
| New approval | One active recording/customer; an explicit new session replaces an unclosed prior one, allowing restart after force-close |
| Route rate limits | Ten new sessions/customer/minute; 180 frame requests/recording/minute including retries, within the shared API limit |
| Retention | Seven days, plus explicit admin deletion; cleanup affects recording data only |

Use temporary files, deleting each after acknowledgement or terminal discard.
Do not save to Photos or persist an upload credential/queue across app launches.
Clear only this feature's stale temporary files at startup. A force-close may lose queued
frames; acknowledged frames remain reviewable and the session is interrupted.

Each frame includes recording ID, unique scheduled sequence, client UTC capture
time, monotonic elapsed milliseconds from session start, and capture duration.
Record actual capture time, not the scheduled tick or upload time. The server
adds UTC receipt time, validated dimensions, bytes and content hash. Store UTC
with millisecond-or-better precision, preserving client and server values
separately; device clock skew is flagged rather than treated as upload latency.
Sequence and elapsed time order playback; server arrival order does not.
Track attempted/skipped/uploaded/failed slots and stop reason so gaps are visible.
An image frame cannot prove that every brief message or gesture was observed.

## Receiver, authentication and storage

Proposed API contract (paths may be refined consistently during implementation):

| Route | Access and purpose |
| --- | --- |
| `POST /api/recordings` | Existing customer cookie + exact Origin + CSRF; create an approved session, derive owner/run from the server, return a short-lived session-scoped upload credential |
| `POST /api/recordings/:id/frames` | Native multipart image + bounded timing metadata; scoped bearer credential, session/owner validation, idempotent sequence |
| `POST /api/recordings/:id/heartbeat` | Same scoped credential; maintain active-session liveness without using frame arrivals as capture status |
| `POST /api/recordings/:id/stop` | Scoped credential; bounded queue-drain finalization, idempotent counts/reason |
| `GET /api/admin/recordings` and `/:id` | Existing admin authentication; paginated session list and frame manifest |
| `GET /api/admin/recordings/:id/frames/:sequence` | Admin-only image delivery, no public static URL, `Cache-Control: no-store` |
| `POST /api/admin/recordings/:id/delete` | Admin cookie, Origin and CSRF; existing project convention for confirmed deletion; revoke upload access and remove recording metadata/files |

Creation/control runs through the website's existing authenticated API boundary.
Pass only typed recording messages/results through a narrowly scoped WebView
bridge. Do not extract HttpOnly cookies or embed an admin key in the app. Native
HTTPS uploads use a session-specific, hashed-at-rest credential restricted to
this recording's upload/heartbeat/stop endpoints. It grants no banking or review
access. Validate originating customer session validity, revocation, expiration,
ownership, state, duration and quota on each request. Credential expiry must
cover the 15-minute session plus the bounded drain window, not permit renewal
without a new approved session. Never put credentials in URLs or logs.
Native bearer routes have their own authentication boundary; do not weaken the
existing website's global Origin/CSRF rules to accommodate native uploads.

The native bridge validates exact top-level origin, current document/handshake
identity, message schema, allowed actions and current eligibility. Ignore stale,
subframe, malformed and out-of-order messages. Restrict all capture/upload targets
to configured Softek endpoints; messages cannot name arbitrary URLs or files.
A browser capability flag is presentation, not server authorization.

Add numbered MariaDB migration **0013**, if still next at implementation time,
for sessions and frame metadata: server-derived customer/run/session references,
approval version/time, lifecycle/expiry, timestamp fields, counters, hashes and
unique `(recording_id, sequence)`. Keep adoption events and Clarity diagnostics
separate. Store image bytes outside MariaDB under proposed private
`/var/lib/softek/recordings`, directories 0750/files 0640 owned by `softek:softek`.
Use server-generated paths, not supplied filenames; reject invalid/oversized/
animated images and excessive decoded pixel counts using the existing image
tooling where suitable. Strip incidental metadata. Never log image bodies.

Duplicate frame retries with identical content/metadata return the original
acknowledgement; changed payload at the same sequence returns conflict. Stage,
validate and atomically publish files with explicit DB/file failure recovery.
Acknowledge only after durable file and metadata success. Document crash-point
reconciliation, stale temporary/orphan cleanup and quota accounting under
concurrent uploads/deletion. Deleted/expired sessions cannot be resurrected.
Customer deletion must remove its recordings without altering other customers;
banking reset does not create a new recording or silently change ownership.

## Server readiness and setup

Read-only checks performed **2026-11-04, approximately 20:29 UTC**:

| Check | Observed result / implementation consequence |
| --- | --- |
| HTTPS API health | `status: ok`, database connected |
| Services | Softek API/Phoenix, Nginx and MariaDB active; no services changed |
| Capacity | Root filesystem 97 GiB, 64 GiB available; inode use 6%; about 4.8 GiB memory available, no swap; a snapshot, not a load-test result |
| Clock | `NTPSynchronized=yes`; use UTC for server timestamps |
| Database | `demo` and `demo_test` on 127.0.0.1 at migration 12; no pending files or problems; next numbered migration is 0013 |
| Nginx | Live configuration passes `nginx -t`; ordinary body limit 32 KB; existing 6 MB exceptions apply only to banner uploads |
| Runtime writes | User/group `softek`; `ProtectSystem=strict`, `ProtectHome=yes`, `PrivateTmp=yes`; writable allowlist is only `/var/lib/softek/banner-assets` |
| Storage | Banner directory exists with 0750; recording directory is not provisioned |
| Releases | Frontend `2026-11-04T19-17-29Z-input-zoom`; API `2026-10-14T22-49-13-460Z`; source main `005967a`, matching origin |

Before receiving real frames, recheck this snapshot and complete these scoped
setup steps under implementation authorization:

1. Reconfirm dedicated DB host/schema/migration account and runtime CRUD grants;
   inspect migration status. Recheck disk/inodes/time, API health and competing
   resource use. Do not provision a second database server or open a new port.
2. Test/commit the additive migration, back up retained `demo` schema/data/ledger,
   then apply through the migration runner. Document partial-DDL recovery and
   previous-application compatibility. Correct the stale migration README header
   to link to canonical current evidence rather than repeating old version 11.
3. Provision the private recording directory and add only that path to the API's
   systemd write allowlist. Preserve other sandbox settings. Add the proposed
   recording directory/limits to the deployment environment allowlist and service
   setup; deploy must preserve files across releases. Test as the runtime user.
4. Add a narrowly anchored Nginx frame-upload exception with a 2 MiB request
   limit, matching the API's 1 MiB image + small metadata allowance. Preserve
   normal 32 KB limits, HTTPS/CSP and other sites. Authenticate before expensive
   processing; cap upload concurrency and use bounded multipart memory/temporary
   files. Define route/session rate limits compatible with 60 frames/minute plus
   retries/heartbeats and the existing shared 1,200 requests/minute/IP limit.
5. Implement authenticated streaming/image reads, private temp storage and clear
   401/403/409/413/429/503 responses. Verify proxy timeout/body limits using actual
   multipart uploads through public HTTPS, not only loopback API tests.
6. Add a project-only retention/reconciliation job with dry-run output, scoped
   paths, locking and deletion-race tests. Heartbeat about every 10 seconds;
   mark sessions interrupted after 90 seconds without liveness, without depending
   on a stopped iOS process. No global cleanup or deletion of owner data.
7. Add bounded health/status reporting for bytes, active sessions, last upload,
   failures, cleanup outcome and filesystem capacity. Backups/recovery must state
   whether image bytes are included; MariaDB backup alone cannot restore images.
8. Preserve and verify existing collection/tracing settings and build profile.
   Routine tests block vendor traffic. Back up this site's config/unit before
   changes; validate Nginx before reload, restart only Softek's API as needed, and
   verify unrelated-site/config fingerprints remain unchanged.

## Review experience

Admin Menu → Recordings lists date/time, customer identifier, duration, state,
received/missing frame counts and storage size. Open a session for Play/Pause,
timeline scrubbing and previous/next-frame stepping. Display capture UTC and
server receipt UTC separately; use actual elapsed time and visible gap markers,
not a misleading uninterrupted video. Indicate incomplete uploads/interruption.
Fetch paginated manifests and a small image window rather than every full-size
image at once. Include confirmed deletion; no public links or new reviewer role.

## Implementation tasks and acceptance

REC-01 first delivers a signed local-only embedded WebView capture fixture,
without depending on receiver deployment. It proves the native pixel path and
perceived scrolling on the phone. Live-website authentication/transition/lifecycle
proof is completed with REC-04/05/07; it is not inferred from the local fixture.
PROJECT_STATE owns the exact builds, measured results and pending owner checks.
The first installed local check failed with zero frames. The async-copy correction
now produces screenshots and working local review on the owner's phone. REC-01
remains open for the remaining fidelity/performance/eligibility evidence in its
acceptance; keep actual phone results distinct from cloud builds and mocked tests.
The functional POC and all requested normal/offline/lifecycle phone checks are
now accepted, including a new upload from build 10. Remaining unchecked items
retain their profiling/extended-failure/rollback acceptance; do not treat missing
process-memory measurements or an unperformed rollback drill as completed work.

- [ ] **REC-01 — Prove native capture and settle parameters.** Add only compatible
  Expo dependencies after checking current SDK guidance. On a signed iPhone
  build capture a short local-only fixture at 1 Hz. Check scrolling, menus,
  overlay, error text, readability and frame timing; measure capture duration,
  image size and memory. Prove eligibility transitions exclude login/admin.
  **Pass:** readable images, no blank WebViews or overlapping capture, observed
  cadence reported truthfully, acceptable navigation/scrolling. Resolve failures
  before receiver rollout; any capture-method change gets documented.
- [x] **REC-02 — Define contracts and persist metadata.** Implement session/frame
  schemas, timing validation, state transitions, quotas, migration 0013 and
  DB/file recovery. **Pass:** isolated MariaDB clean/upgrade/repeat/partial-failure
  checks; owner-derived references, ordering/idempotency/concurrency and rejected
  conflicting duplicates; no banking/adoption data change.
- [x] **REC-03 — Provision and verify receiver.** Complete the server setup above,
  add authenticated endpoints and cleanup. **Pass:** authorized multipart upload
  crosses HTTPS, file/hash/timestamps match DB readback; private reads denied to
  customers/anonymous callers; wrong owner/token/revoked/expired sessions, malformed
  images, limits, disk pressure, interrupted writes and retry races are covered.
- [x] **REC-04 — Add recording control and native bridge.** Shared-theme button,
  accessible overlay, explicit approval and typed eligibility/control/status
  protocol. **Pass:** X continues active capture, Stop prevents it, focus trapping/
  restoration and narrow-header layout work; browsers/old apps remain usable;
  stale/forged/subframe messages fail closed; login/admin/impersonation are excluded.
- [x] **REC-05 — Connect timed capture, queue and lifecycle.** Implement the bounded
  scheduler, native uploads, timestamps, retries, stop/drain and cleanup.
  **Pass:** fake-clock tests prove 1,000 ms deadlines, no overlap/catch-up bursts,
  late-result discard, byte/frame bounds and monotonic ordering. Device checks
  prove background/lock/logout/reload/force-close stop and never auto-restart;
  queued-frame loss is visible, with no retained token after relaunch.
  **Offline follow-up:** the phone's Wi-Fi-off check exposed connection recovery
  unmounting the temporary WebView and losing login. Preserve that view for
  connection/HTTP/timeout recovery, use an explicit fresh GET without replaying a
  submission, keep capture stopped, and verify recovery on the signed update.
  Actual content-process loss can still require a fresh view/sign-in.
- [x] **REC-06 — Build admin review and deletion.** Implement authenticated list,
  timeline/player, frame stepping and bounded loading. **Pass:** timestamp order,
  gaps, incomplete sessions and deletion display accurately on mobile/desktop;
  customer deletion/retention remove owned files and metadata; another customer's
  recordings/banking data survive; image reads cannot bypass admin authentication.
- [ ] **REC-07 — Validate end to end and deliver.** Run relevant API/migration,
  native scheduling/rendered tests, web accessibility/layout/privacy checks,
  typecheck/build/format, Expo diagnostics/export and EAS archive inspection.
  Build/install a new signed preview; no automated real screenshot collection.
  **Pass:** owner explicitly starts a two-minute fictional-data session, navigates/
  scrolls and triggers an error, then stops; roughly 120 scheduled slots have
  explainable frames/gaps and matching server metadata. No frames after Stop;
  replay and independent UTC receipt/capture times are visible. Exercise offline/
  reconnect, slow uploads, lock/background, force-close and capture/storage failure;
  record size/latency/memory and safe cap behavior. Regression-check login policy,
  zoom/layout, website banking and unchanged Clarity/Phoenix settings.
- [ ] **REC-08 — Operational handoff and rollback.** Update setup/testing/state,
  exact limits, evidence, deployment/IPA identity and remaining issues. Validate
  cleanup dry-run and scoped deletion using owned fixtures. **Pass:** rollback
  first disables new sessions and stops old native clients via receiver rejection,
  then restores compatible API/web/site/unit backups without dropping retained
  tables or deleting screenshots; review/data recovery limits are documented.

Order: REC-01 first; then REC-02/03, REC-04/05, REC-06 and REC-07/08. Backend
deployment must accept old app builds before distributing the new preview.
Plan 023's remaining phone checks stay open rather than being silently completed.

## Primary technical references

- [Expo native view capture](https://docs.expo.dev/versions/latest/sdk/captureRef/).
- [Expo SDK 58 FileSystem](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/)
  and [asynchronous copy/move change](https://github.com/expo/expo/pull/44359).
- [View-shot compatibility and performance](https://github.com/gre/react-native-view-shot).
- [WebView messaging](https://github.com/react-native-webview/react-native-webview/blob/master/docs/Guide.md#communicating-between-js-and-native).
- [MariaDB migration contract](../db/migrations/README.md).

At 1 Hz there are 60 frames/minute. An illustrative 100 KB average frame is
about 6 MB/minute or 90 MB/15 minutes; this is budgeting arithmetic, not measured
image size or a host-capacity guarantee. Measure before changing the POC caps.
