# Testing

M1, the login/banner revision, and Plans 004/005/006 menus/features/customer generation and Plans 008/009/010 starting-account/deletion/impersonation controls are covered by MariaDB/API integration and Chromium journeys. Routine
tests use `demo_test`, trusted automated actor labels, and disabled Clarity.
Human Clarity evaluation remains M2 work.

## Commands and prerequisites

With `npm ci`, private `.env`, and scoped test accounts:

```bash
npm run db:migrate -- --test
npm run db:seed -- --test
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run format:check
```

Fresh browser install: `npx playwright install chromium`. The current host already
has Chromium and its required libraries. Production may keep running while tests
use API port 3101 and Vite 5173. Playwright refuses to reuse an unknown listener
and stops its temporary servers after verification.

## Database and API checks

`tests/migrations.test.ts` runs eight migration-contract scenarios on its own
`_contract_migrations` ledger and three probe tables in `demo_test`. It refuses
existing contract fixtures, removes only those fixtures afterward, and leaves the
real `_schema_migrations` / application tables intact. The runner permits this
alternate ledger only with the explicit test target. Both runners still share
the schema advisory lock.

Coverage: empty no-op without ledger creation, clean/repeated application,
checksum changes, missing/duplicate files, concurrent runner, upgrade,
historical insertion, partial DDL failure and blocked retry. Production migration
status and repeated application separately verify the real ledger.

`tests/application.test.ts` runs twelve API scenarios against a real ephemeral
loopback server and MariaDB. It checks:

- Origin, CSRF, anonymous access, and strict request validation.
- Server eligibility, ownership, and rejection of forged success events.
- Deduplicated visibility placements and journey observations.
- Concurrent idempotent enrollment, replay, and changed-payload rejection.
- Persistent goal creation, one first-use marker, and unchanged initial savings.
- Funding limits, integer amounts, and participant isolation.
- Atomic checking/savings/history/goal updates with safe replay.
- New browser-session / 30-minute inactivity visits and one repeat-use milestone.
- Repeat seeds preserving participant state.
- Protected reports: exact cohorts, ordered prerequisites, denominators, actor
  labels, placements, and observation cutoff.
- Reset preserving authentication while retiring the old banking run and retaining history.
- Selected-user variant/eligibility reset and admin logout revocation.

`tests/revision.test.ts` adds nine authenticated-user/banner scenarios: admin
creation and salted hashes, email username normalization/login and field-specific
validation errors, concurrent first login producing one run, expiry and
relogin preserving state, serialized retry-safe rotation, observation ownership,
actual raster decoding/limits/internal destinations/immutable replacement URLs,
zero/one-enabled fallback, and reset/password/disable behavior. Plan 008 adapts
creation to omit the profile and verifies an ineligible customer uses the shared
fixture but cannot enroll. A legacy Jamie reset omits the profile, preserves the
internal assignment/history and permits enrollment when eligibility is enabled.

`tests/features.test.ts` adds five API scenarios for all twelve feature IDs,
strict auth/action/time/ownership, concurrent/retried observations, exact immutable
banner attribution, separate human/automation report counts/cutoffs and retained
reset history. It verifies unchanged banking/enrollment and Savings Goals events.
A local Clarity stub checks bounded current-context calls without loading the SDK.
Real Clarity session tag values accumulate; these tests do not prove historical
session tags are erased. `tests/feature-migration.test.ts` applies the exact committed ENUM SQL to
an owned probe, checking old rows/ordinals, new values and repeat no-op.

`tests/clarity.test.ts` adds four admin/collection scenarios: authorization,
origin/CSRF and strict settings; explicit profile/runtime readiness; revision
conflicts and retry-safe persistence; human consent availability versus ordinary
and specifically authorized automation. The Node runner reports **76 passing
entries** including parent tests and three standalone checks. Test files run serially. Cleanup deletes only fixture-owned users/runs
and uploads, removing their interaction/presentation references before run
cleanup and restoring temporarily changed banner settings. Admin-session tokens
are also removed; browser cleanup removes only its own hashed admin cookie token. It never drops a schema.
Do not run the API suite and browser suite concurrently: their report assertions
expect their own isolated execution window.

`tests/customer-generation.test.ts` adds five scenarios: admin/origin/CSRF and
count/amount bounds; simultaneous 200-user creation with distinct identities,
varied cent amounts, unique salted password hashes and no premature runs;
concurrent replay/configuration conflicts and cross-batch uniqueness;
contribution/relogin/customer-reset/admin-reset persistence with the admin reset
omitting the template; and late collision
rolling back earlier inserted users. Cleanup removes only owned `test.*` users
and their batches after cascading opening rows. A full 200-user run takes ~14s.

## Browser acceptance

Plan 007 adds `tests/customer-browser-profiles.test.ts`: protected updates,
legacy defaults, incompatible-pair rejection including MariaDB CHECK, atomic
manual/bulk persistence, retry/conflict and unchanged banking/session/consent on
save. `tests/browser-profiles.test.ts` launches all seven supported combinations
with matching Chromium/Firefox/WebKit, asserting UA, viewport, screen, density
and actual tap/click delivery. All URLs are fulfilled locally or blocked. WebKit
does not report Android-style `maxTouchPoints`; touch is proved by delivered
`touchstart` events rather than that browser-dependent property.
An additional intercepted-browser check proves private automation/capture headers
are sent only to the application origin, with neither header on vendor requests.

Sixteen journeys run at **360×800, 390×844, and 1440×900**: **48 Chromium checks**.

| Journey | Evidence |
| --- | --- |
| Login, ordered rotation and menu | Keyboard Escape/focus, placeholder action, logout/relogin, same run retained |
| Two tabs | Independent retained selection while sharing the user sequence |
| Admin customers and banners | Email login creation/search/details, selected password/access changes, empty activity, image upload/settings/replacement with retained old URL |
| Complete promotion → enrollment → goal → contribution | State/balances persist through refresh; secure backend milestones |
| Later browser session | Same run/assignment, different server-owned visit, one repeat-use event |
| Reset | Clean new run; historical first use remains queryable |
| Independent profiles / unavailable service | Distinct run IDs, eligibility enforced and clear unavailable UI |
| Visibility | Below-fold inline promotion absent until viewed; brief visibility insufficient; sustained visibility and deduplication |
| Protected report / configuration | Direct admin entry, explicit denominators, retained actor filter, selected new variant run, logout |
| Admin-only routes/menu | Child-route sign-in/reload, filter persistence, keyboard containment/Escape/focus, active links, back/forward, missing pages/customer, expired access clearing private data; no customer bootstrap/events/Clarity |
| Independent sessions | Customer-only admin denial, both sessions, admin logout preserves customer, customer logout preserves admin, admin navigation leaves banking run/presentations unchanged |
| Abandonment | Enrollment start without invented completion or first use |
| Direct service entry | First use without a promotion click |
| Form failures / keyboard | Error keeps entered text/amount; keyboard link, checkbox, and submission actions |
| Twelve feature pages | Source copy, one CTA, confirmation, no forms/banner/overflow, rapid clicks and lost-response retry with identical request UUID; banking/adoption unchanged |
| Feature banner and reporting | Owned uploaded feature banner, exact landing attribution across independent tabs/reload/menu, separate raw/distinct activity totals and admin destination options |
| Feature routes and submenu | Authenticated direct entry, unavailable Savings Goals profile, unknown ID/back/forward, active child, short viewport, Enter/Space/Tab/Escape |
| Bulk customer generation | Protected direct child route, form/count/ranges, lost-response retry with the same request UUID, three-row CSV without passwords, customer links, per-customer login amounts and no overflow/browser errors |
| Device/browser preferences | Compatible options and automatic browser adjustment, saved choices across reload, independent update preserving run/accounts/goals; bulk CSV persists both IDs |
| Shared starting accounts | No template selectors on manual/bulk/reset forms; independent eligibility works; default-profile creation and omitted-profile resets preserve saved amounts/history |
| Responsive / privacy | No page overflow; no Clarity requests during complete journey; explicit masking attributes |

Screenshots are written to ignored `artifacts/`; mobile/desktop dashboards and
report and admin customer/home/menu surfaces were visually inspected. The report's wide table scrolls inside its card.
The shared hamburger menu works on mobile and desktop without page overflow.

The browser observation is best-effort evidence of behavior, never proof of
business success. First/repeat use and enrollment are committed transactionally
with actions. Trusted harness labeling separates controlled automation from
ordinary public traffic; it is not a general bot detector.

## Deployed smoke checks

```bash
curl --fail https://demo.bawebtech.com/api/health
npm run smoke:public
```

The public smoke uses HTTPS at 360/1440px, checks Secure/HttpOnly/SameSite cookies,
creates users, signs in, completes enrollment/goal/contribution, proves saved
state across relogin, cycles banners on Summary reload, preserves menu return,
uses a placeholder action, visits a feature through Explore Features, confirms its
CTA, reloads the child route, returns to Summary without advancing the banner,
checks unchanged accounts/goals/run and separate Feature Activity, then opens the
separate admin customer/banner pages,
checks admin sign-out/reload while preserving the customer login, and resets. It asserts no browser errors or Clarity
requests. Its labeled automated history is intentionally retained in `demo`.
After enrollment it waits for the final Goals-route acknowledgement before
filling the form, since the enrollment route briefly renders a temporary form.

Plan 006's owned live check (`artifacts/check-live-generation.ts`, ignored) verified
the protected generation UI, same-request retry, CSV omission of passwords,
balance bounds, customer details and login/relogin/reset at 360/1440px. It uses
only the private automation label, without the collection override, and asserts
no Clarity traffic. Its six test customers and password-free 0600 evidence manifest
are retained; test-schema fixtures are cleaned by the committed suites.
The updated check also verifies Device/Browser on bulk creation, CSV and details
save/reload. `artifacts/check-live-browser-profiles.ts` exercises one owned
Automation user across all seven saved pairs: actual matching engines, login,
mouse/tap menu and feature CTA, same banking run and no vendor traffic. Its
password-free lookup evidence is `artifacts/live-browser-profiles.json` (0600).

A production multipart upload was decoded/published by the hardened service,
disabled as a retained check fixture, and its immutable image hash verified after
service restart and repeat deployment. This exercises the actual writable asset
path and Nginx upload limit. Local API tests also verify old URLs after replacement.

Host verification includes Nginx syntax, HTTP redirect, API 200, blocked `.env`,
unknown API 404, loopback-only API, dedicated service identity/protections, private
runtime environment permissions, and unchanged preexisting site hashes/links.
Certbot renewal was verified during initial HTTPS setup; application deployment
preserves the challenge route and certificate configuration.

## Consent and Clarity control checks

```bash
npm run test:clarity
```

Run serially with the API/banking suites. Three privacy journeys at 360/390/1440px
(nine checks) use evaluation gates against `demo_test` and intercept **all external
requests**, returning an SDK stub. They verify decline/no load, opt-in/ConsentV2,
pseudonymous identification, feature CTA events, explicit DOM masks, withdrawal
and cookie clearing, admin document separation, fresh consent for another user,
persisted admin off/on, stopped open pages and fresh consent after re-enable.
Modal coverage includes focus, keyboard navigation, explicit decline, Escape,
short-viewport fit, scroll unlocking and no repeat prompt after a saved decline.
They restore the exact original singleton settings and remove owned fixtures.
These checks do not send data to Microsoft or establish real masking playback.

## Authorized real SDK pilot

```bash
npm run clarity:pilot -- --collect --device=iphone --browser=safari
npm run clarity:pilot -- --collect --customer=YOUR_CUSTOMER_UUID
```

Requires the already-authorized evaluation deployment and admin collection On.
This command intentionally contacts the real project. It creates two labeled
automation customers on `demo`, uses the requested device/browser profile, declines then opts in,
executes banner/feature-CTA click and skip cases, returns through the menu, checks
acknowledged `/collect` responses, first-party cookies, withdrawal, shared-browser
logout/login and no admin collection/CSP errors. Private capture headers are read
from `.env`. Owned pilot users/history remain for lookup. Only UUIDs, timestamps,
scenario names and transport counts are saved in ignored 0600
`artifacts/clarity-pilot.json`; credentials and collection payloads are not saved.
Each execution sets `pilot_run` and `pilot_scenario` Clarity custom tags and saves
the same values in that manifest. Journeys include about 55 seconds of reading
pauses plus scrolling, banner/CTA choices and menu navigation. Newly created users
are named Clarity Pilot Click and Clarity Pilot Skip. Filter the project by the
manifest's `pilot_run` value or by each user's copied Clarity lookup UUID; new
custom-tag filter values may take time to appear.
Bot detection was On during the original pilot; the owner reported switching it
Off on 2026-10-12 UTC. New evidence records the owner-reported Off setting;
verify dashboard inclusion/classification separately.
The second command instead uses an enabled saved Automation customer, with its
password in private `PILOT_CUSTOMER_PASSWORD`. It reads saved preferences, creates
the corresponding engine/context, and preserves banking state. Neither command
is part of the routine test suite. Profile/engine/preset/viewport/screen are added
to the ignored evidence; no new real SDK recording is implied by preference tests.

## Remaining evaluation

The owner must inspect actual Clarity recordings/heatmaps, private-content masks,
rendered artwork/CSS and user/route/event context before presentation. Network
uploads demonstrate SDK transport, not dashboard processing, bot inclusion or
recording fidelity. No Microsoft password is needed. Chris is invited later when
the owner says the demo is ready. Human walkthrough instructions are in Plan 002.
Automated success does not establish customer adoption improvement.

Historical user-creation fix: all 32 API/migration entries passed; the admin
creation/upload/login browser journey was rerun at 360/390/1440px to verify email
usernames and native rejection of spaces. Plan 004 subsequently passed the final full 30-journey suite, including these
email validation regressions, history navigation, and banner replacement.

## Customer deletion checks — Plan 009

The revision suite covers admin authentication, strict UUID/body, CSRF/origin,
concurrent/repeated deletion, all active/retired owned runs and dependent tables,
revoked session/login, and another customer's unchanged runs/accounts. The
generation suite verifies partial and fully deleted batches return their survivors
on replay without recreating identities or opening rows, with conflict detection
retained. All deletion fixtures belong to demo_test and are cleaned.

The responsive card journey checks a distinct details link, keyboard activation,
confirmation cancellation, rejected-request feedback/retry, pending disabled
state, successful filtered-list refresh, invalidated customer session and missing
details. Existing card navigation journeys use the dedicated link. Public checks
delete only newly created owned test customers with vendor collection excluded.

## Plan 010 — admin customer impersonation

`tests/impersonation.test.ts` covers protected entry/CSRF/origin/strict inputs,
retry cookie reissue and one run/banner, Human/Automation access, preserved
banking, context mismatch, Clarity exclusion even with capture headers, labeled
history, default report exclusion and customer milestones after admin first use.
It checks repeated exit, session replacement, customer sign-out, reset, revocation
by password/disable/expiry/logout/deletion and concurrent entry. Fixture users,
admin sessions and collection settings are cleaned/restored afterward.

`tests/impersonation-migration.test.ts` applies the exact committed 0008 SQL to
owned probe tables through the test contract runner, verifies creation, repeat
no-op, FK rejection and unchanged retained visits/table layout, then removes only
its probes/contract ledger. Historical missing visit context means customer.

Three new Clarity-stub browser journeys cover entry/rotation/CTA/history/exit,
prior opted-in activity stopping across tabs, independent sign-out, pending/error
recovery and admin expiry. Combined privacy coverage is **18 checks** across
360/390/1440px; all vendor URLs are fulfilled locally or blocked. Existing banking
coverage remains **48 checks**. API/native/migration coverage is **76 TAP entries**.

Public checks at 360/1440px created two owned Automation customers, used actual
impersonation, feature/menu navigation, enrollment/goal writes, ordinary login and
independent sign-outs, and removed the fixtures through protected Delete. Original
customer/state fingerprints, collection settings and shared assets/host configs
were unchanged; zero vendor requests and page errors. Password-free evidence is
ignored 0600 `artifacts/plan010-live.json`. Initial live harness issues were BigInt
snapshot serialization and checking health before API readiness; corrected and
rerun successfully without failed customer fixtures. No real recording or rollback
was performed. Tests run sequentially; no Clarity pilot is a routine acceptance step.

A final failed-exit recovery fix was checked with three focused browser reruns:
another authenticated customer tab returns to Admin instead of remaining paused
when Exit receives an error; the initiating page shows the error and stays usable.
Typecheck/format/evaluation build and public smoke were repeated for the final
release. Broader suites were not repeated after this isolated error-path change.
