# Plan 015 — Feature Explorer controls and section invitations

Plan ID: **015**. Lifecycle: [PROJECT_STATE.md](../PROJECT_STATE.md#plan-status-registry).

## Requested scope

Add Feature Explorer to the Admin Menu. Four sections: Account Summary, Everyday
Checking, Harbor Savings, Harbor Credit Card. Each allows adding a widget from
all twelve existing Explore more ways to bank titles. Selecting a saved title
opens configuration with mobile-banner upload and its automatically derived,
read-only feature URL. A feature may be used in multiple sections; one widget
per feature per section initially. Blank widgets remain inactive until artwork
is uploaded. Reuse secure image decoding/publication and private admin sessions.

Owner selected **admin controls only for now**. Customer placeholders remain
inactive; rotation and attribution activation are later scope. Each page name is a **banner space header**, with its widgets underneath;
Spacer was corrected by the owner to space, not blank layout spacing.
The intended rotation recommendation is independent ordered selection per section,
advancing on refresh and preserving selection on menu returns. No automatic
contextual eligibility targeting, timing/scheduling or new landing pages.

## Working design

Admin `/controls/feature-explorer` lists sections and Add feature forms; individual
widget configuration lives at `/controls/feature-explorer/:widgetId`. Catalog
provides titles/URLs; arbitrary destinations are rejected. Artwork is immutable
WebP in existing persistent banner storage. Replacement preserves historical assets.
Use an additive MariaDB migration for widgets; commit SQL before applying it,
validate `demo_test` first and back up retained `demo` with the ledger.

Mobile images fit the existing 105px strip; recommend 960×315 (3× a 320×105
mobile slot). Keep artwork readable without stretching; desktop behavior will be
reviewed at the same compact height. Admin and impersonation collection gates
remain; any activated customer invitations require owned immutable attribution,
separate feature/CTA observations and accurate section/banner Clarity tags.

## Tasks and acceptance

- [x] EXP-01: confirmed admin-only scope and space headers, shared section identities,
  committed additive migration and private admin APIs for widgets/settings/upload.
- [x] EXP-02: Admin Menu/list/configuration routes, catalog title selector, auto URL,
  upload/replacement and accurate mobile preview, responsive errors and save feedback.
- [x] EXP-03: preserve inactive customer placeholders; saved configuration and
  future-rotation inclusion flags do not activate them. Rotation/attribution remains B-016.
- [x] EXP-04: API/database and responsive browser checks for access, invalid uploads,
  duplicate widgets, configuration persistence, replacement and selected rotation scope;
  verify existing data/reporting/privacy boundaries.
- [x] EXP-05: scoped backup/migration/status checks, evaluation build/deploy, live
  HTTPS checks without vendor capture, remove only owned fixtures and update handoff.

## Boundaries

Retain existing Manage Banners/assets/history and customer banking state. No demo
artwork is uploaded/enabled for retained customers merely to test the new controls.
Do not restart the stopped automated-recording investigation or widen discovery.
