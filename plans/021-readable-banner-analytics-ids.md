# 021 — Readable banner analytics IDs

Lifecycle/evidence: [PROJECT_STATE](../PROJECT_STATE.md#plan-status-registry).
Depends on Plans 015/016/017/020. Owner wants usable banner values in Clarity
filters; use the previously discussed space-and-feature names.

## Scope and choices

Feature Explorer widgets expose a derived analytics ID, e.g.
`summary-business-invoice`. Send it as the existing banner tag for resolved Summary
artwork and preserve it on the linked feature entry. Retain UUIDs in selections,
requests, ownership checks and first-party reporting. Accept only catalog-derived
aliases in tracing; retain legacy values for older clients/history. No extra SDK tag.

Aliases identify space + feature, so title/image changes and deletion/recreation
of the same space/feature retain that readable name. Existing first-party UUID and
asset snapshots distinguish historical creatives; existing Clarity/Phoenix records
are not rewritten. No schema change or activation of other banner spaces.

## Tasks and acceptance

- [x] LABEL-01 — Add shared derived IDs, propagate through Summary and owned feature
  entries, update strict trace validation; preserve UUID reporting and readiness.
- [x] LABEL-02 — Verify known/invalid aliases, legacy compatibility, internal UUID
  attribution, reload and banner/feature/CTA/navigation behavior with SDK stub.
- [ ] LABEL-03 — Deploy preserving live settings, verify readable calls in Phoenix
  with an owned SDK-stub fixture and record evidence/runbook/handoff.

Recovery: restore the preceding application release using LOCAL_SETUP. No data
migration or history deletion; new/legacy tag values remain in their existing stores.
