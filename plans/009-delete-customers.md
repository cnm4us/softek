# Plan 009 — Permanent customer deletion

Lifecycle: [PROJECT_STATE.md](../PROJECT_STATE.md#plan-status-registry).
Owner explicitly requested a Delete button on every `/controls/customers` card,
with permanent removal. Depends on Plans 006–008.

- [x] DEL-01: protected, strict, transactional endpoint; lock the selected user,
  remove all owned active/retired runs and local activity, then delete the user
  and cascading sessions/preferences/opening balances. Repeated deletion is safe.
- [x] DEL-02: each card contains a separate details link and Delete button;
  identify the customer in confirmation, explain permanent history removal,
  handle cancellation/errors/pending state and refresh the filtered list on success.
- [x] DEL-03: prevent generation-request replay from recreating deleted users,
  including when no customers remain in the batch. Preserve the request ledger.
- [x] DEL-04: verify authorization/CSRF/origin, complete linked-data removal,
  invalidated login, concurrent/repeated requests, isolation, partial/all batch
  deletion and responsive/keyboard UI; deploy and verify only owned live fixtures.

No schema migration is required. Shared templates, banners/assets and other
customers remain intact. Deleted local history disappears from adoption/feature
reports. Batch request metadata remains for retry protection; already collected
Microsoft Clarity recordings are outside this application's deletion operation.

Acceptance: each card has a visible Delete action; cancel retains the customer;
confirm permanently removes their local identity/state/history with no orphaned
references or recreation by a batch retry. Admin access remains independent.

Verified: 66 passing TAP entries; twelve focused browser checks across
360/390/1440px, plus three deletion reruns covering pending state. Matched
evaluation deployment passed live mobile/desktop cancellation/deletion and
partial/empty retry checks using owned fixtures only. Existing public banking
smoke, retained original data/assets and host checks passed. No migration or
real Clarity collection was performed. Exact release/evidence is in PROJECT_STATE.

- [x] DEL-05: subsequent explicit owner cleanup deleted all 37 other production
  customers while preserving the exact designated account. Live API/DB lists
  agree that one remains; preserved banking/identity and shared resources matched
  in-memory snapshots. No schema/application change or new collection occurred.
  See PROJECT_STATE for the current cohort and private evidence location.
