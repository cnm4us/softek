# 019 — Clarity context deduplication

Lifecycle/evidence: [PROJECT_STATE](../PROJECT_STATE.md#plan-status-registry).
Depends on Plans 017/018. Owner authorized reducing redundant context calls and
examining Phoenix afterward.

## Scope and choices

Keep document-local applied identity/tag state. Send identity when customer,
visit or route changes; send each tag only when its value changes. Customer/run/
visit changes and collection restart reset the context. A full reload naturally
starts fresh. Successful startup-queue calls count as applied; normal hosted SDK
queue drain/replacement does not require resending. Failed invocations remain
retryable. Update audit metadata on every initialization independently of whether
Clarity context changed. Preserve all actual event calls and consent/policy gates.

No schema/queue/filter change, history deletion, re-export or owner-switch change.
Routine tests use a Clarity stub and owned fixtures. Examine real Phoenix after deployment with an owned Automation fixture and SDK
stub, plus read-only owner activity when available; no Microsoft recording pilot.

## Tasks and acceptance

- [x] CTX-01 — Implement changed-only context and restart/ownership handling;
  test repeat, banner/navigation clearing, session/reset and exception behavior.
- [x] CTX-02 — Verify one identity/stable-tag group per Summary reload while
  page/banner/feature/CTA events and SDK/audit fidelity remain intact in browser.
- [x] CTX-03 — Deploy preserving live settings, inspect Phoenix for new owner
  activity when available, and record release/checks and exact comparison steps.

Recovery uses the normal application-release rollback in LOCAL_SETUP; retained
banking/audit/Phoenix data and switch settings remain intact.
