# Plan 014 — Compact banner placeholders

Plan ID: **014**. Lifecycle: [PROJECT_STATE.md](../PROJECT_STATE.md#plan-status-registry).

## Scope and decisions

Remove the large linked image immediately below Account Summary. Place the three
account widgets first, followed by a full-width placeholder strip before Recent
Activity. Use the same strip on checking, savings and credit-card detail pages,
below the balance widget and above Recent Activity (owner-confirmed placement).
The duplicate savings URL in the request refers to `/accounts/credit-card`.

One shared component and height token keep the placeholder at half the 210px
balance-card height (105px), within the padded content width. Use understated
Harbor styling and neutral More ways to bank copy, with no image, link, click
handler or exposure tracking; Summary analytics carries no hidden banner context. This is a visual placeholder; future rotating
content and account-page Explore recommendations are separate work.
Existing banner assets, admin management, selection persistence and historical
attribution remain intact, but linked Summary image rendering is suspended.
The existing banner-driven pilot requires a future adaptation before use.
No migration, financial write, collection change or new artwork is needed.

## Tasks and acceptance

- [x] STRIP-01: shared placeholder; Summary accounts first and strip before activity;
  all three detail pages balance first, strip then activity; responsive full width
  and half-height sizing, no new interaction/exposure events.
- [x] STRIP-02: adapt existing browser checks for the placeholder and preserved
  selection contract; verify layout, owned data, navigation and privacy.
- [ ] STRIP-03: evaluation build/deploy; live HTTPS mobile/desktop checks using
  owned collection-disabled fixtures, delete fixtures, update docs and state.

## Validation boundaries

Routine tests use `demo_test`, with Clarity disabled or intercepted. Live checks
create and remove only their own Automation customers, block vendor requests and
preserve global collection settings, retained customers, banners and balances.
