# Plan 006 — Bulk demo customer generation

Lifecycle: [PROJECT_STATE.md](../PROJECT_STATE.md#plan-status-registry).
Depends on Plans 001/004. User authorized this implementation: create customers
automatically with unique usernames/display names and varied checking/savings.
The eventual population is 100–200; this phase provides the tool, not a full
production cohort or automated browsing. Chris remains out of scope.

- [x] GEN-01: additive migration 0006 for retry-safe generation batches and
  per-customer starting balances; commit before applying; scoped production backup.
- [x] GEN-02: admin-only bulk API, 1–200 customers, chosen username prefix/shared
  demo password, validated cent ranges and existing profile/eligibility/variant/
  actor choices. Atomic all-or-nothing creation; repeat request returns the same
  batch and changed payload conflicts. Passwords individually salted, never exported.
- [x] GEN-03: generated names include the globally allocated batch/position marker
  for uniqueness across repeated batches. Persist sampled cent amounts; first login
  and explicit reset restore those amounts without changing other users/templates.
- [x] GEN-04: Generate Customers under Manage Customers, shared mobile-first form,
  result list and password-free downloadable CSV. Preserve inputs/request identity
  on uncertain failure, prevent double submission, explain that generation is not
  automatic login/consent and Human versus Automation controls later activity.
- [x] GEN-05: prove a 200-customer batch, bounds/uniqueness, authentication, replay/
  conflict, rollback on collision, login/reset/relogin persistence and salted hashes;
  browser creation/export/navigation at mobile/desktop widths. Deploy and verify
  a small owned production check only; update durable docs and state.

Default working choices: count 10; prefix `demo`; Human activity; eligible Alex
template/value variant; checking $100–$10,000 and savings $0–$50,000. Admin can
change ranges and all configuration before creating a batch. Credit/history keep
their fictional template values. No real personal data, emailed credentials,
customer signup, service activation or scheduler is introduced.

Acceptance: the owner can create a chosen batch, download its customer identities
and initial amounts, and log in with the chosen password. Names are distinct across
batches and current balances survive later logins. Reset restores each customer's
saved initial amounts. Existing banking/adoption/Clarity behavior is preserved.

Verified: 51 TAP entries, all 42 banking browser checks plus three focused bulk
checks after the checkbox style refinement; 200-user integration batch ~14s;
public HTTPS generation/export/retry/login/relogin/reset at 360/1440px. Migration
and deployment evidence are in PROJECT_STATE. Six labeled automation customers
were retained for the live generation checks; no full production cohort was made.
