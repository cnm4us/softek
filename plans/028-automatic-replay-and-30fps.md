# 028 — Automatic replay generation and 30 fps output

Lifecycle/evidence: [PROJECT_STATE](../PROJECT_STATE.md#plan-status-registry).
The owner authorized automatic video generation after recording ends and changing
generated video from 24 to 30 fps. Capture remains change-triggered; no native
app update or increase in screenshot cadence is required.

- [x] **AUTO-01 — Durable completion queue.** Add an additive MariaDB migration
  for one job per recording with bounded attempts/status. Enqueue atomically on
  final Stop after upload drain, never on drain alone or for empty/no-duration
  recordings. Repeated finish must not duplicate/reset jobs. Cascade deletion.
- [x] **AUTO-02 — Isolated automatic worker.** Deploy the renderer with the API
  release and run one reduced-priority Softek worker, independently of HTTP.
  Recover interrupted attempts, bound retries/time/resources, preserve existing
  source-deletion/publication locks and retain manual operator access. Enable only
  new completed recordings; do not backfill or replace existing accepted videos.
- [x] **AUTO-03 — Visible status and retry.** Admin review shows queued/rendering/
  failed status and updates automatically to the generated replay. Failed jobs
  have an authenticated, CSRF-protected retry. Preserve screenshot access throughout.
- [x] **AUTO-04 — 30 fps and focused verification.** Encode all new/rebuilt output
  at 30 fps, measured duration within one frame. Test finalization/idempotence,
  serialization/recovery/retry/deletion, actual FFmpeg output, UI polling and
  private HTTP playback; keep vendor collection blocked in checks.
- [x] **AUTO-05 — Rollout and handoff.** Record schema/backup/release, deploy and
  verify a generated fixture automatically passes Stop → queued → ready with no
  operator render call. Delete only owned fixtures, preserve existing recordings,
  independent collection/tracing gates and shared-host configuration. Update
  operational docs, state and backlog. No commit/push of unrelated feature work.

Migration recovery: 0015 is one additive CREATE TABLE; earlier releases ignore it.
If DDL/ledger application is interrupted, use the migration-contract scoped backup
recovery, never change the SQL/checksum after application or force the ledger.
Rollback stops/disables the replay worker and automatic enqueueing; keep compatible
readers/cleanup for retained source/derivatives. Plan027's remaining physical
partial/mutation/keyboard/lifecycle/resource checks remain separate.
