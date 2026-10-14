# 018 — Phoenix span presentation

Lifecycle and evidence: [PROJECT_STATE](../PROJECT_STATE.md#plan-status-registry).
Depends on [Plan 017](017-clarity-api-phoenix-tracing.md). The owner authorized
implementation of readable calls and populated Phoenix span columns.

## Scope

Derive presentation fields from existing accepted call arguments, SDK state and
local outcome during export. Input and `clarity.call` show the complete JSON-escaped
call, for example `clarity("event", "banner_clicked");`. Retain the exact argument
array in `clarity.arguments_json`. Output distinguishes Queued for SDK, SDK
invocation returned, Invocation threw and callable unavailable. Returned calls
have OK status; thrown or absent calls have ERROR with a bounded status message.
Kind remains unknown: these are ordinary application calls, without AI semantics.

No migration, new payload capture, SDK behavior change, switch change or historical
re-export. Fields apply to spans exported by the updated release. Local OK status
and Phoenix acknowledgment never establish Microsoft receipt or recording storage.

## Tasks and acceptance

- [x] VIEW-01 — Derive readable call, text Input/Output, local status and bounded
  error message without changing raw arguments, stable IDs or generic span kind.
- [x] VIEW-02 — Verify escaped/multiargument/object/zeroargument calls and every
  outcome; inspect real isolated Phoenix REST/UI columns with no Microsoft traffic.
- [ ] VIEW-03 — Deploy, preserve owner-enabled collection/tracing, verify health,
  and update inspection instructions and durable handoff with actual evidence.

Recovery: restore the preceding application release using LOCAL_SETUP's existing
rollback runbook. Database and Phoenix storage stay intact; prior spans retain
prior presentation and are not rewritten.
