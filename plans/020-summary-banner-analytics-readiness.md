# 020 — Summary banner analytics readiness

Lifecycle/evidence: [PROJECT_STATE](../PROJECT_STATE.md#plan-status-registry).
Depends on Plans 016/019. Owner authorized removing loading placeholders while
keeping changed-only individual Clarity tags (the API has no multi-key set).

## Scope

Distinguish pending Summary artwork from genuinely empty/failed artwork. Send
identity and stable page context immediately; defer banner-dependent feature,
service, campaign and banner tags until artwork resolves. Loaded artwork supplies
actual tags once; confirmed empty/failed state supplies the existing absence values.
Omit unresolved banner fields from Phoenix audit metadata as well. Event timing,
visibility qualification, consent, ownership, SDK forwarding and rotation stay intact.
Navigation to pages without banners still sets appropriate absence context.

No schema change, multi-set API, history deletion, switch change or real Microsoft
pilot. Tests use an SDK stub, including delayed/failed images. Live acceptance may
use an owned Automation fixture and SDK stub with real Phoenix export.

## Tasks and acceptance

- [x] READY-01 — Track owner-bound pending/resolved artwork; emit only known
  context and preserve correct empty/failure/navigation behavior and deduplication.
- [x] READY-02 — Verify delayed image emits no temporary absence tags or audit
  metadata; success emits actual tags once, failure/empty resolve, and events,
  consent, SDK/audit fidelity and mobile/desktop flows remain intact.
- [x] READY-03 — Deploy with live settings preserved, examine a fresh reload in
  Phoenix and update operational instructions/state with actual evidence.

Recovery: restore the prior application release using LOCAL_SETUP; all retained
banking, audit and Phoenix history stays intact.
