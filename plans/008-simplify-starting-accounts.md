# Plan 008 — Simplify starting accounts

Lifecycle: [PROJECT_STATE.md](../PROJECT_STATE.md#plan-status-registry).
The owner requested removing Alex/Jamie starting-account template choices because
both provide identical accounts and activity. Savings Goals eligibility remains
an independent checkbox. Depends on Plans 006/007.

- [x] ACCT-01: remove template selectors from manual creation, bulk generation
  and customer banking resets; keep eligibility and generated balance controls.
- [x] ACCT-02: new users default to the shared internal Alex fixture; resets that
  omit a profile preserve the existing internal profile under the user lock.
  Retain legacy API profile fields, saved balances, identity and reporting history.
- [x] ACCT-03: verify manual/bulk creation and eligibility without template inputs,
  legacy Jamie reset preservation, mobile/desktop forms and saved balances.
- [x] ACCT-04: deploy with the existing Clarity evaluation profile, verify public
  behavior and retained data, and update documentation/state.

No schema change or migration is needed. Existing templates and their foreign
keys remain as implementation fixtures; no customer or run is rewritten.
Explicit legacy API profile overrides remain supported for compatibility.

Acceptance: no Alex/Jamie or Eligible/Standard template dropdown remains in admin
forms; eligibility alone controls Savings Goals access; checking/savings generation
and both resets retain their existing behavior. No Clarity collection is performed
by the verification journeys.

Verified: default-profile manual creation and ineligible enrollment denial;
omitted-profile legacy Jamie reset with preserved internal assignment/history and
eligible enrollment; generated amounts survive both resets. All nine focused
Chromium checks passed at 360/390/1440px. Typecheck, evaluation build and format
passed. Public HTTPS focused generation/reset and banking smoke passed at
360/1440px without Clarity requests. Both ledgers remain at version 7; retained
data/assets and host checks passed. See PROJECT_STATE for release and test evidence.
