# 022 — Banner CTA custom tag

Lifecycle/evidence: [PROJECT_STATE](../PROJECT_STATE.md#plan-status-registry).
Depends on Plans 005/016/017/021. Owner requested
`clarity("set", "cta-clicked", "summary-business-invoice")` to directly filter
sessions whose confirmed feature CTA came through a particular Summary banner.

## Scope and choices

Add the `cta-clicked` tag alongside the existing `feature_cta_clicked` event only
after the feature interaction API acknowledges the CTA. Use the landing page's
validated customer/run/feature entry and readable Summary banner alias. Displaying
or clicking artwork, viewing a landing page, failed/unacknowledged CTA requests,
and direct/menu/discovery entries do not emit this tag. Legacy entries lacking
the readable alias retain their existing generic event behavior.

Keep consent/admin/impersonation exclusions, CTA idempotency and first-party
reporting intact. Extend the safe trace contract so the actual call is mirrored
to Phoenix. No schema change, settings change, Microsoft capture pilot or API
importer. Tags accumulate within a Clarity session: this tag answers which banner
entries led to confirmed CTAs, not exact click totals or ordered event pairings.

## Tasks and acceptance

- [x] CTA-01 — Emit the owned readable tag only for acknowledged banner-entry CTAs;
  preserve the generic event and safe tracing.
- [x] CTA-02 — Verify ownership/route/value restrictions, no tag before acknowledgement,
  response-loss retry, actual audit acceptance, and unrelated menu CTA exclusion.
- [x] CTA-03 — Deploy preserving owner switches; verify public release/health and
  SDK-stub call + real Phoenix readback without Microsoft test traffic. Update
  product/filter/testing guidance and handoff with actual evidence.
