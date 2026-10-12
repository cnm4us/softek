# Plan 007 — Customer device and browser profiles

Lifecycle: [PROJECT_STATE.md](../PROJECT_STATE.md#plan-status-registry).
User authorized Device and Browser selectors on customer profiles for later
Clarity automation. This prepares emulation and the existing explicit pilot;
it does not activate Plan 003's scheduler or generate recordings automatically.

- [x] DEV-01: commit/apply additive migration 0007 for saved per-user choices;
  scoped production backup; existing users default to Desktop/Chrome.
- [x] DEV-02: shared device/browser compatibility catalog; protected create,
  bulk-create, list and update APIs; preserve banking state, sessions and consent.
- [x] DEV-03: separate selectors on creation/bulk/details, compatible options,
  independent save without banking reset, persisted choices and CSV columns.
- [x] DEV-04: Playwright resolver uses matching Chromium/Firefox/WebKit engines
  and built-in device presets. Existing pilot can load a saved customer profile
  with a private password; no automatic collection, bot evasion or fake SDK data.
- [x] DEV-05: real DB/API tests and mobile/desktop UI checks, all seven browser/
  device combinations exercised with vendor traffic blocked; deploy and small
  owned live checks; docs/state updated. Dashboard classification remains pending.

Working choices: Desktop (Chrome/Edge/Firefox/Safari), Android phone (Chrome),
iPhone and iPad (Safari). Saved preferences apply to automation, including Human
customers' future assignments; manual browser visits are not altered. Edge uses
Chromium with the built-in Edge identity; Safari uses WebKit emulation. These
are test profiles, not exact physical-device fidelity or guaranteed bot inclusion.

Acceptance: owner creates or updates saved choices without resetting banking;
bulk customers/export retain choices; incompatible pairs are rejected by the API;
the pilot reads the selected customer's saved pair and creates a matching browser
context. Consent, trusted automation and collection-off routine tests remain intact.

Verified/deployed: 64 passing TAP entries; protected API/integrity tests; all 45 banking journeys covered
(39 initial passes, six corrected-selector checks passed on focused rerun);
all seven native profiles exercised locally and on public HTTPS without collection;
mobile/desktop bulk CSV and profile save/reload; retained data/assets and host
checks intact. Real Clarity classification and the modified explicit pilot's
vendor upload/withdrawal behavior remain pending; no new real recording was run.
Exact release, migration backup and check evidence are in PROJECT_STATE.
