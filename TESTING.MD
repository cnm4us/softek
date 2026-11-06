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

Sixteen banking journeys run at **360×800, 390×844, and 1440×900**: **48 Chromium checks**.
With three discovery, two catalog and two account-detail journeys at each size,
the full routine browser suite now has **69 checks**.

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
state across relogin, preserves retained banner selections across Summary reload/menu return,
uses the active sidebar Savings Goals link with the inactive strip in place,
uses a placeholder action, visits a feature through Explore more ways to bank, confirms its
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

## Contextual discovery checks — Plan 011

Migration 0009 must be applied to `demo_test` before these checks:

```bash
npx tsx --test --test-concurrency=1 tests/discovery.test.ts tests/discovery-migration.test.ts
npx playwright test tests/e2e/discovery.spec.ts
```

Seven API/rules/migration TAP entries cover exact cooldown boundaries, eligibility,
concurrent one-per-visit reservations, strict input/CSRF/ownership, retry-safe
visibility and immutable feature attribution, preferences/history across relogin
and reset, separate actors, impersonation exclusion and additive SQL/repeat no-op.
Nine browser journeys across 360/390/1440px cover both contexts, actual visibility,
feature CTA linking, payment review/confirmation without banking changes, opt-out,
re-enable, dismissal persistence and permanent Explore. External traffic is blocked.
The full commands now include **83 TAP entries** and **57 banking/discovery browser
checks**. Existing SDK-stub privacy coverage remains 18 checks.

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

## Plan 012 catalog acceptance

`tests/e2e/catalog.spec.ts` adds two journeys at 360/390/1440px: catalog deep-link
login, exact group/product order and counts, keyboard collapse/expand, search with
no results/clear, no overflow and no premature feature events; then menu current
state, un-attributed Skip A Pay confirmation, refresh/return and preserved balances.
The existing all-twelve, banner attribution, discovery opt-out and SDK-stub tests
now navigate through the catalog. `clarity:pilot` and `smoke:public` use the same
new menu path. These navigation changes do not authorize actual capture runs.

## Plan 013 account details

`tests/e2e/accounts.spec.ts` adds two journeys at 360/390/1440px: keyboard widget
entry, exact owned balances/history, masking, stable sample rows, no ledger changes
or promotional feature observations, return/banner preservation; then direct-login
routes, real demo goal funding reflected in checking/savings, relogin/customer
isolation and unknown-account handling. The existing Clarity consent SDK-stub case
now visits all three details to check mask containers and bounded banking tags
without loading a real vendor. Account information and fixture terms remain
read-only; full history/search and Explore placements are separate future work.

## Compact placeholder checks — Plan 014

`tests/e2e/accounts.spec.ts` verifies strip order, full content width, approximately
half-card height, no actionable content or linked image, no overflow and unchanged
owned banking/history. `banking.spec.ts` retains session-selection tests and uses
the active Savings Goals sidebar for enrollment. Its reserved banner-attribution
case supplies an owned Router entry directly: it validates the retained contract,
not a click on the inactive placeholder. API banner/admin tests remain valid.
The existing `clarity:pilot` banner-click pair assumes a rendered image and needs
adaptation before reuse; future rotating strips are separate owner-selected work.

## Feature Explorer checks — Plan 015

`tests/feature-explorer.test.ts` covers private admin/CSRF access, all four spaces,
catalog-owned URLs, duplicates, settings, image-less activation refusal, valid/
invalid/oversize uploads, immutable replacements and missing-widget cleanup.
`tests/e2e/feature-explorer.spec.ts` covers mobile/desktop creation, title navigation,
URL display, upload/preview/replacement, persisted settings, independent spaces,
menu and Admin Home links, overflow and errors. Collection is disabled and external
requests are blocked. Existing account checks prove customer placeholders remain;
the consent/masking SDK-stub journey crosses into the new admin route.

EXP-06 extends the Feature Explorer API/browser checks with protected and
idempotent deletion, cancelled confirmation, failure/retry, independent spaces,
configuration return navigation and fresh re-adds. Existing image references
remain readable; routine checks use only owned `demo_test` fixtures.

## Summary feature banners — Plan 016

`tests/summary-banners.test.ts` covers ordered/idempotent selection, independent
user/tab ownership, legacy separation, immutable feature/CTA attribution, deleted/
disabled widget recovery, empty lists and unchanged banking. `summary-banners.spec.ts`
checks actual compact geometry, proportions, links, qualified impressions/CTA
association, refresh wraparound, stable menu returns, inactive account-detail slots
and image-error placeholders at 360/390/1440px. The SDK-stub test Summary artwork
checks granted-consent tags/events and clears context on account navigation.
Routine tests use `demo_test`; live checks use only owned capture-disabled users,
retain all owner configuration/artwork and delete their fixtures afterward.

## Clarity API-call tracing — Plan 017

With migration 0012 applied to `demo_test`:

```bash
npx tsx --test --test-concurrency=1 tests/clarity-call.test.ts tests/clarity-tracing.test.ts tests/clarity-tracing-migration.test.ts
npm run test:clarity -- --grep 'Phoenix API-call audit|consent, masks|Summary artwork|impersonation stops'
```

The adapter checks preserve argument object identity at the SDK boundary, immutable
snapshots, order/return/receiver, SDK queue replacement and original exceptions
under serializer/recorder failure. API checks cover private controls, explicit
consent context, owned existing visits, CSRF/origin, strict shapes/limits, conflicting
retries, Automation capture gates, impersonation rejection, terminal revocation,
tracing Off without changing Clarity, export filtering and deletion cascades.
Migration probes apply the committed SQL to new owned test tables, verify initial
Off/repeated no-op and leave existing event layout unchanged.

Worker checks use an isolated fake collector to exercise HTTP failure, protobuf
partial rejection, timeout, expired-lease recovery and stable trace IDs. The new
browser journey compares accepted arrays to the SDK stub, checks initial queued
ConsentV2, feature CTA calls, audit 503 recovery without disrupting banking,
withdrawal/stop, and responsive admin controls. All Microsoft requests are
intercepted or blocked. Normal browser checks send neither real Clarity traffic
nor production Phoenix traces; the stub configuration's collector port 6009 is
intentionally unused. Each test restores the test collection/tracing switches and
removes only its owned users/records.

For a real collector round trip, first start a separate Phoenix instance on
loopback port **6008** with its own ignored storage, using the installed runtime:

```bash
PHOENIX_HOST=127.0.0.1 PHOENIX_PORT=6008 PHOENIX_WORKING_DIR=/home/ubuntu/softek/artifacts/test-phoenix PHOENIX_DEFAULT_RETENTION_POLICY_DAYS=7 PHOENIX_ALLOW_EXTERNAL_RESOURCES=false PHOENIX_TELEMETRY_ENABLED=false PHOENIX_ENABLE_MCP_SERVER=false PHOENIX_ALLOWED_PROVIDERS=NONE PHOENIX_ALLOWED_SANDBOX_PROVIDERS=NONE PHOENIX_DISABLE_AGENT_ASSISTANT=true /opt/softek-phoenix/venv/bin/python deploy/phoenix-http.py serve
```

In a second terminal, from the repository root:

```bash
SOFTEK_TEST_PHOENIX=true npx tsx --test --test-concurrency=1 tests/clarity-tracing.test.ts
```

The optional test explicitly targets only port 6008, sends an accepted test-schema
record through the durable exporter, verifies the exact arguments/event ID through
Phoenix's REST readback, and opens a generic span's Attributes in its real UI.
It saves `artifacts/phoenix-real-span.png`. Stop the isolated instance afterward;
never point this test at the live port 6006 or erase a production Phoenix project.
It sends no Microsoft requests. Phoenix copies outlive local fixture deletion
until isolated storage is removed or retention expires.

Observed collector-only capacity evidence is ignored
`artifacts/phoenix-volume.json`: 200 synthetic identities × 100 calls were
acknowledged and persisted in the isolated SQLite instance. An initial 20-second
REST readback window was insufficient while insertion drained; later read-only
SQLite counts confirmed persistence. This is not an end-to-end automated banking
cohort, a production throughput guarantee, or proof of Microsoft processing.
Actual checks/release results are recorded in PROJECT_STATE.

## Phoenix span presentation — Plan 018

Exporter formatting/outcome checks run with the normal test suite or alone:

```bash
npx tsx --test tests/phoenix-export.test.ts
```

They cover parsed/string JSON, quoted/newline/backslash values, object arguments,
multiple/zero arguments, generic kind, stable IDs and queued/returned/thrown/absent
outcomes. No collector or Microsoft network traffic is needed for these checks.
With the isolated port-6008 instance described above running, verify actual REST
and UI presentation:

```bash
SOFTEK_TEST_PHOENIX=true npx tsx --test --test-concurrency=1 tests/clarity-tracing.test.ts tests/phoenix-export.test.ts
```

The optional presentation test sends four fictional collector-only spans to 6008,
checks persisted Input/Output/status/message/unknown kind, then checks the real
Phoenix table and call attribute. Screenshots are ignored
`artifacts/phoenix-presentation-columns.png` and
`artifacts/phoenix-presentation-detail.png`. Production port 6006 and Microsoft
are never targeted. Stop only the isolated test process afterward.

## Clarity context deduplication — Plan 019

```bash
npx tsx --test --test-concurrency=1 tests/clarity-context.test.ts tests/clarity-call.test.ts tests/features.test.ts
npm run test:clarity -- --grep 'Phoenix API-call audit|consent, masks|Summary artwork|impersonation stops'
```

Context checks cover unchanged repeats, startup callable replacement, changed
banner tags, account navigation/clearing and return, customer/run/visit changes,
explicit reset and exception retries. Summary artwork browser coverage asserts
one identity and one copy of each stable tag both initially and after reload,
at most twelve set calls including legitimate loaded-artwork changes, and intact
page/banner/feature/CTA observations. SDK/audit, consent and impersonation coverage
remains active at 360/390/1440px. Microsoft endpoints are stubbed/blocked; routine
checks keep production Phoenix untouched. Live acceptance, if performed, uses
only an owned Automation fixture with the SDK stub and documented trace IDs.

## Summary banner analytics readiness — Plan 020

```bash
npx tsx --test --test-concurrency=1 tests/clarity-context.test.ts tests/clarity-call.test.ts tests/features.test.ts
npm run test:clarity -- --grep 'Phoenix API-call audit|consent, masks|Summary artwork|impersonation stops'
```

Context unit checks additionally distinguish pending/ready/empty/failed artwork,
owner boundaries and omitted fields followed by changed-only resolved values.
Summary artwork browser checks hold the image response across a full reload:
identity/page context and page_view proceed, dependent set calls and audit metadata
are absent until release, then every tag appears exactly once (nine set calls).
Aborted artwork and a confirmed empty configuration resolve to absence values
without a banner-visible event. Existing click/CTA/navigation/consent/mirror checks
remain active across 360/390/1440px; Microsoft is stubbed/blocked. Live acceptance
uses only an owned Automation fixture with SDK stub and records its actual evidence.

## Readable banner analytics IDs — Plan 021

```bash
npx tsx --test --test-concurrency=1 tests/clarity-context.test.ts tests/clarity-call.test.ts tests/features.test.ts tests/summary-banners.test.ts
npm run test:clarity -- --grep 'Phoenix API-call audit|consent, masks|Summary artwork|impersonation stops'
```

Alias checks cover unique known space/catalog combinations, unknown/credential
rejection, legacy UUID compatibility, owned landing-entry validation and retained
internal selection/banner UUIDs. Summary API checks verify the readable alias while
its database snapshot keeps the UUID. Browser checks expect summary-identity-protect
on the rendered banner and linked feature page, then correct absence on ordinary
banking navigation. Reload readiness, nine tag calls, consent, qualified events,
CTA/report attribution and SDK/audit fidelity stay covered at all three widths.
Routine Microsoft traffic is blocked/stubbed; live checks use only owned Automation
fixtures with SDK stub, keeping owner switches and existing history intact.

## Banner CTA custom tag — Plan 022

```bash
npx tsx --test --test-concurrency=1 tests/clarity-context.test.ts tests/clarity-call.test.ts
npm run test:clarity -- --grep 'Phoenix API-call audit|consent, masks|Summary artwork|impersonation stops'
```

Focused unit checks verify customer/run/route/alias ownership and restrict the
new cta-clicked tag to known Summary aliases. The existing Summary artwork journey
asserts no tag on display/view/banner click, records a CTA but loses its response,
asserts no tag until retry acknowledgement, then expects one exact tag immediately
before the generic CTA event and checks real MariaDB audit acceptance. A different
feature's subsequent menu CTA must not inherit the banner origin. Existing
consent/admin/impersonation and SDK/audit-failure coverage remains at 360/390/1440px.
Microsoft stays stubbed/blocked; production Phoenix is excluded from routine tests.
An owned live SDK-stub acceptance may verify actual deployed call/export readback;
that does not validate Microsoft ingestion or new-tag indexing.

## Expo iOS shell — Plan 023

Use the root `npm ci` and then run:

```bash
cd /home/ubuntu/softek/apps/mobile
npm run typecheck
npm test
EXPO_NO_DOTENV=1 npm run doctor
EXPO_NO_DOTENV=1 npm run export:ios
npm run archive:check
```

The seven policy/state tests cover exact-origin matching, external click versus
redirect behavior, malformed/scheme/credentialed URLs, subframe handling,
main-document versus API errors, and failure preservation after loadEnd.
Four rendered-component tests exercise the actual App handlers with controlled
native boundaries: Back/Reload, main-document HTTP failure and fresh-home Retry,
load timeout/process termination without auto-reload, and external/popup handling.
They run without a WebView/network, customer credentials, database writes or
Clarity requests. Their mocked native ports are not iOS behavior/layout evidence.
The renderer emits its upstream deprecation notice and Node's mocked timers
emit an experimental notice; neither is a failed test.

The archive check validates the real EAS upload contents. A dry-run npm install
was also checked against an inspected archive, establishing that the retained
workspace manifests/lockfile resolve without shipping server sources. The iOS
export validates Metro/Hermes bundling, not Apple compilation, signing or phone
installation. Expo Doctor must pass configuration, SDK and native dependency
checks; the implementation uses SDK 58 to match the website's existing React.

For changes to this shell or build integration also run the existing root
`npm run typecheck`, `npm run build`, and `npm run format:check`; include
`npx prettier --check 'apps/mobile/scripts/*.cjs' 'apps/mobile/tests/rendered/*.cjs'`
for the mobile helper/test files. No API/database suite is needed solely for
shell changes. If a backend or hosted-page change becomes necessary, run that
area's existing meaningful regression checks before deploying it.

The signed-preview matrix in [Plan 023](plans/023-expo-ios-webview-poc.md) remains
required on the owner's iPhone 17 Pro Max: cold launch without Metro/Expo Go,
login validation, navigation, keyboard/safe areas, lifecycle/session/sign-out,
Airplane Mode recovery, external destinations and Safari coexistence. Keep raw
phone/build evidence private and record exact results in PROJECT_STATE. Use
fictional fixture accounts and decline web analytics consent during routine
checks; do not enable native capture or change collection switches. At this
handoff, consult PROJECT_STATE for current cloud-build/artifact evidence and
remaining actual-device acceptance.

## Shared layout focus bounds — Plan 023 / B-026

```bash
npx playwright test -c playwright.layout.config.ts
```

This dedicated suite starts the normal isolated test API/frontend, blocks all
external requests and uses/removes only its own `demo_test` fixtures and admin
sessions. Two cases run in five projects: WebKit at 360/440/1440px and Chromium
at 440/1440px. They cover login and six signed-in routes, keyboard skip-link
focus, menu open/Escape restoration, vertical scrolling and real contained
Adoption Report table scrolling. Root `scrollWidth` and attempted `scrollX` are
checked alongside the focused main's painted outline bounds; root width alone
misses an outward outline. The normal interactive-control focus indicator must
remain visible, and document-wide overflow clipping is not used.

The pre-fix WebKit 440px cases failed on the focus outline extending 7px beyond
each screen edge. Both desktop browser engines still reported scrollX 0 before
the correction, so these checks establish focus-paint containment, not an
independent reproduction of iPhone WebView sideways movement. The installed
phone must be checked after Reload. PROJECT_STATE owns that result and the
public HTTPS stylesheet/hash verification. No Clarity collection pilot or
fixture-creating production smoke is needed for this CSS-only correction.

After the owner confirmed pinching out resolves the apparent width problem,
the same suite was extended to require at least 16px computed text in login and
report controls and to reject viewport settings that disable user zoom. Two
pre-change WebKit cases failed on 15px controls; all ten cases pass at 16px.
This verifies the input-zoom prevention precondition and retained layout, not
the iPhone's software-keyboard zoom behavior. Phone acceptance must reset any
existing zoom once, then repeat sign-out/sign-in without pinching afterward.
Card widths/margins remain unchanged. PROJECT_STATE owns the actual phone result.

## Temporary iOS sessions — Plan 023 / B-027

Use the mobile typecheck, `npm test`, Expo Doctor, iOS export and `archive:check`
commands above. The rendered shell check asserts that the actual WebView receives
`incognito: true` and `sharedCookiesEnabled: false`, along with existing normal
navigation/Reload handling. These checks verify wiring; they do not emulate a
native persistent/temporary cookie store or prove OS process lifetime behavior.
The installed WebView iOS implementation was inspected to confirm it selects
`WKWebsiteDataStore.nonPersistentDataStore` for this prop.

IOS-10 requires the actual signed **0.1.1 (2)** update over the old app: fresh
launch requires login, normal Reload and a brief app switch retain it, and full
force-close/reopen returns to login. Re-login must restore the same saved banking
state, and explicit sign-out must remain effective. Existing view-remount recovery
also starts a new session. Safari's independent website session must remain
untouched. The previously passed force-close login persistence on build 1 is
historical and intentionally superseded by this owner-requested policy.

## Screenshot recording verification — Plan 024

[Plan 024](plans/024-ios-screenshot-recording-poc.md#implementation-tasks-and-acceptance)
owns REC-01–08 and installed-device acceptance. Implemented commands:

```bash
node --import tsx --test tests/recording-migration.test.ts tests/recordings.test.ts
npm test -w @softek/mobile
npx playwright test -c playwright.recording.config.ts
npm run recordings:cleanup -- --test
npm run typecheck
npm run build
npm run format:check
```

Migration 0013 must be applied to `demo_test` before receiver tests, through the
normal committed-migration workflow. The migration probe uses owned replacement
tables/contract ledger, checks clean/repeated application, and injects failure
between the two CREATE statements to verify visible partial DDL and blocked retry.
Receiver integration uses the real test MariaDB/filesystem/API: creation approval,
server ownership, idempotent replacement/retry, concurrent case-normalized frame
retries, private delivery/integrity/modes, out-of-order UTC metadata, size/timing
limits, customer isolation/deletion, file publication failure/recovery, stop/drain,
orphan/temp/missing reconciliation, retention and session/heartbeat revocation.
Expected negative cases can log a bounded filesystem error code.

Mobile tests cover monotonic cadence, no overlap/catch-up burst, disposal after
Stop, authentication/document/lifecycle invalidation, bounded queues and terminal
upload errors. Six rendered checks wire the actual App handlers against mocked
native storage/network/view ports. Browser checks cover capability gating in
ordinary browsers versus a fake native adapter, matching header buttons, modal
focus/X/Stop/logout, private generated-image review, distinct timestamps, timeline
gaps/playback and deletion at Chromium 360/390/1440px and WebKit 440px. These
eight browser cases are not actual iOS snapshots. Save only fictional-fixture
screenshots under artifacts. The existing ten-case layout configuration also
checks WebKit/Chromium bounds, focus, readable controls and preserved zoom.

After the first installed capture check failed with zero frames, added tests
execute the actual capture-file adapter against mocked iOS bare-path results and
Expo's strict file-URI boundary: encoded paths, preserved native release input,
720 physical pixels at 1x/2x/3x, file-size limits, safe failure stages, and cleanup
errors that preserve the original failure. The `capture-check` rendered profile
test verifies the local-only HTML source, absent banking navigation/upload, and
visible failure details. There are now **17 core + eleven adapter/rendered** mobile
checks. The owner's diagnostic image identified the size guard; the new test
models SDK 58's asynchronous copy with a deferred Promise and zero size until
completion. It fails on the unawaited implementation and passes after awaiting
copy, proving metadata/source release wait and asynchronous errors stay caught.
Metadata checks separately cover missing, invalid, empty and oversized files.
These checks cannot establish the exact failing native operation on build 3 or
prove the corrected snapshot works on an iPhone. Use the LOCAL_SETUP diagnostic
profile commands. The owner now confirms capture and local review; integrated
upload/Record/Stop/lifecycle acceptance remains separate.

The build-9 offline device check exposed a separate native recovery issue:
rendering the error screen unmounted the temporary WebView and lost login.
Build-10 rendered regressions count actual component mounts/unmounts across
repeated connection failures/retries, check a fresh same-origin GET (no submitted
body), blocked/hidden error content, no failed-load bridge bootstrap and no
automatic recording restart. A genuine content-process termination still
replaces the view on explicit retry. There are **17 core + thirteen adapter/
rendered checks** after this correction. These prove React wiring, not native
cookie persistence. Separately, the owner has now accepted signed iPhone
retry/reconnect/login behavior and the new build's upload is server-confirmed;
PROJECT_STATE owns the exact evidence and remaining profiling limitations.

The live receiver smoke has passed with generated pixels: public multipart upload,
private image/hash/timestamp readback, runtime permissions, size rejection and
owned fixture removal. Public WebKit 440px/Chromium 1440px checks also cover the
enabled admin list, bounded layout and retained 16px login controls, with zero
vendor requests. Exact evidence is in PROJECT_STATE. Focused receiver coverage now
includes simulated low free space/shared storage exhaustion before publication;
it does not fill the host's disk. These checks remain separate from actual phone
uploads and readable screenshot playback.

`npm run recordings:smoke` is a separate explicit real-HTTPS receiver check on this
EC2 host after the gate/setup in LOCAL_SETUP. It sends generated fixture pixels,
validates actual proxy/body limits/runtime storage/private readback and removes
only its owned fixture. Read the private result/cleanup flags; it is not a phone
capture test or a command to enable the receiver. Keep its `.env`/sudo requirements
and collection-profile boundary intact.

The checks span three boundaries: actual native 1 Hz capture and lifecycle
on the signed iPhone build; authenticated receiver/metadata/filesystem behavior
through MariaDB and real HTTPS; and admin review of timing, gaps and deletion.
Mocked native tests cannot establish WebView image fidelity. Loopback API tests
cannot establish Nginx multipart/body limits or systemd write permissions. Inspect
the actual uploaded image/hash and independent capture/receipt timestamps.

## Animated replay verification — Plan 025

Implemented focused checks:

```bash
node --import tsx --test tests/recording-replay.test.ts tests/recordings.test.ts
npx playwright test -c playwright.recording.config.ts
npm run typecheck
npm run build
npm run format:check
```

The replay tests check initial absence, elapsed ordering, missing legacy slots and
Stop, known forward/reverse pixel alignment (including just one-quarter viewport
overlap), exact preservation of the source crop,
rejection of changed pages/fixed-layer mismatch, and actual FFmpeg encode/ffprobe/
decode of whole and clipped timelines within one output frame. Generated imagery
uses fictional fixture shapes/text. Replacement tests exercise a real Linux atomic
directory exchange and prove missing/invalid staging does not remove the prior
export. Six replay cases pass after the source 14→15/15→16 jump correction;
encoding now generates 24 frames/second from the same screenshots.
Quota tests count derived files and work
reservations without filling the disk. Receiver integration adds admin-only replay
reads, range responses, no-store, expiry rejection and abandoned-work cleanup.

The eight existing recording browser cases now also use a generated normal H.264
MP4, metadata loading, seeking, responsive video layout and denial after deletion,
on Chromium 360/390/1440px and WebKit 440px. The initial fragmented fixture could
not seek in WebKit; replacing it with the same normal faststart container used by
the renderer resolves that check. This is separate from installed-iPhone acceptance.

Production verification uses authenticated read-only review of an existing approved
recording, comparing delivered MP4 hashes to private files and checking HTTPS range/
no-store behavior. Browser requests remain on the Softek origin; no customer flow
or vendor SDK collection is started. Temporary administrator sessions are revoked.
Compare Clarity/Phoenix settings and original recording metadata before/after rollout.
PROJECT_STATE records measured exports, actual check results and pending owner review.

Stage A reconstructs only conservative whole-viewport vertical motion. It has no
real tap/swipe telemetry; page/menu changes and unsupported overlap use cuts. The
owner's short-example/full-session visual review is the next acceptance boundary
before Stage B instrumentation. Rendered output cadence does not increase capture
cadence. Existing Plan 023/024 profiling and operational follow-ups remain open.

Use isolated `demo_test` fixtures/private test image directories for automated
coverage, and only explicit owner-approved fictional sessions for installed-app
acceptance. Keep Clarity/vendor traffic blocked in routine checks. Include
unauthorized image reads, credential/owner/session revocation, duplicate/conflicting
frames, queue/storage limits, timing drift, clock skew, transition races,
interruption/cleanup and customer-deletion scope. Preserve Plan 023's remaining
acceptance and force-close-login regression checks.


### Change-triggered capture coverage — Plan 025 Stage B

Migration 0014 probe coverage checks retained legacy data/defaults, unchanged
12-column frame inserts, early elapsed values, sidecar/event cascades, repeated
application and a partial-DDL failure that blocks blind retry. Both dedicated
schemas are upgraded via the committed runner; backups/evidence are in state.

```bash
node --import tsx --test tests/change-capture-migration.test.ts
node --import tsx --test --test-concurrency=1 tests/recordings.test.ts tests/recording-replay.test.ts
npm test -w @softek/mobile
npx playwright test -c playwright.recording.config.ts
```

Run API and browser suites separately: owned fixtures still share the schema's
two-active-recording limit. Concurrent suites caused a creation-limit failure;
sequential execution passes. The checks now include new-policy early/same-second
frames, strict geometry/event payloads, idempotent/conflicting batches, after-Stop
rejection, event-loss counters, private reads and cascade deletion. Legacy receiver
coverage remains intact. There are 20 mobile core and 13 adapter/rendered checks,
including idle capture, coalescing/spacing/error priority, separate clock origins,
late-result disposal, next-session recovery and gesture batch drain at Stop.

Twelve browser cases cover both policy controls and observation/privacy/Stop at
360/390/1440px Chromium and 440px WebKit; dialog/menu surface geometry is included.
Generated replay fixtures verify sparse idle holds, recorded scroll timing, encoded
tap/swipe glyphs, a short visual viewport, and omission of a tap belonging to an
uncaptured dialog. Routes/uncertain geometry retain safe motion fallback. These
checks establish code/fixture behavior, not native touch/screenshot fidelity.

The explicit production generated-fixture check is
`npm run recordings:smoke -- --changes`; it must pass separately from the legacy
smoke and clean up only its owned rows/files/session. Preserve live settings and
keep vendor requests blocked. EAS archive/export/profile checks and actual iPhone
idle/changes/error/Stop/lifecycle acceptance are separate VID-07 evidence. New
session MP4 rendering remains a manual CLI action after a finalized phone upload.
The replay suite also decodes an unstable-endpoint fallback at two pre-scroll
times and checks that content remains still; lost events disable the onset bound.
Alignment fixtures include independently moving scrollbar gutters while retaining
rejection of a changed page and unsupported fixed header.

## Native tooltip local comparison — Plan 026

`npm test -w @softek/mobile` now includes five local comparison timing/lifecycle
cases and four candidate-file adapter cases, plus a rendered overlay-check entry
case. They cover coalesced invalid events, no idle captures, sequential pairing,
Stop/eligibility loss, late files across restart, visible candidate failure,
owned-file/size/dimension validation, and redaction of native path diagnostics.
The shell checks verify that the local entry uses the fictional fixture, blocks
external navigation and leaves upload requests inactive. The reset regression
check verifies file disposal, a newly mounted empty fixture, stale-document event
rejection, readiness gating, no automatic restart, Test 2 / Pair 1 labeling and
remounting Review at the beginning. Existing banking tests
still exercise the unchanged production capture path.

A local WebKit/Chromium fixture check additionally verified ordinary required-field
validation, visible inline errors, fixed-kind messages without typed values, no
network requests and mobile layout fit; report `artifacts/overlay-fixture-check.json`.
Mocks and desktop WebKit cannot prove UIKit popover drawing or keyboard exclusion.
Cloud Swift compilation, signed IPA inspection and physical iPhone acceptance are
separate evidence. Run the OVL-04 matrix in Plan 026 before integrating candidate
uploads. Setup owns executable commands and the operator/device procedure.


### Experimental window recording integration

Receiver checks now include matching window approval/provenance, rejection of
unapproved/missing/unknown surface fields, idempotent start approval immutability,
private method readback and deletion. Native checks verify opt-in capability,
fixed per-session selection, late/Stop behavior, 350 ms error settling and minimum
500 ms capture spacing afterward. A rendered normal banking entry advertises the
experimental capability only for the enabled profile. Replay fixtures ensure
reported native popovers/masked keyboard/error surfaces cut and suppress page
markers. Four browser profiles verify the coverage selector defaults to Page,
explicit approval copy, locked selection while recording and website layout.

Focused API/replay, mobile, browser and typecheck commands above remain valid.
The generated live check `npm run recordings:smoke -- --window` writes
`artifacts/recording-public-window-smoke.json` and must remove its owned fixtures.
Actual integrated tooltip upload/replay, lifecycle/offline behavior and resource
profiling remain separate signed-device evidence in PROJECT_STATE; successful
local fixture trials and generated receiver pixels do not replace those checks.


### Keyboard replay placeholder — OVL-08

`node --import tsx --test tests/recording-replay.test.ts` covers confirmed masked
blank-region placement, unchanged page pixels, unchanged unmasked/legacy frames,
unsafe-region rejection and label visibility after actual FFmpeg encoding. Script
typechecking uses `npx tsc -p tsconfig.scripts.json`. Inspect the regenerated real
masked frame alongside the native tooltip, confirm unchanged source hashes and
Stop duration within one frame, then verify authenticated HTTPS range/no-store
playback in mobile WebKit and desktop Chromium. This verifies video decoration,
not capture of keyboard keys or exact historical keyboard bounds. No new native
build or repeated device capture is needed for this change.


### Page reconstruction beneath the keyboard — OVL-09

Run the two focused renderer suites:

```bash
node --import tsx --test tests/keyboard-replay.test.ts tests/recording-replay.test.ts
npx tsc -p tsconfig.scripts.json
```

New tests verify exact preservation above the inferred mask boundary, exact aligned
donor pixels below it, future/past source timing, partial recovery and remaining
placeholder, route departures/returns, sequence gaps, zoom/container changes,
unstable/masked/popover donors, time bounds, viewport changes, unrelated and blank
image rejection. An actual FFmpeg encode checks both observed tooltip and borrowed
page content against references within codec rounding, preserving measured timing.
For the real retained recording inspect filled tooltip/error/footer frames, compare
all source hashes, decode both generated videos and check private HTTPS hashes,
range/no-store/anonymous denial and WebKit/Chromium playback. Visual usefulness of
borrowed hidden content is separate owner feedback, not evidence of its past state.


## Progressive session references — Plan 027

Focused core/receiver tests (43 TAP entries in the recorded run):

```bash
node --import tsx --test --test-concurrency=1 tests/page-canvas.test.ts tests/session-reference.test.ts tests/reference-fill.test.ts tests/keyboard-replay.test.ts tests/recording-replay.test.ts tests/page-context.test.ts tests/recordings.test.ts
npm test -w @softek/mobile
npm run typecheck
npx playwright test -c playwright.recording.config.ts
```

The mobile command passed 29 core and 20 rendered/adapter checks; the recording
browser suite passed 20 cases in Chromium 360/390/1440 and WebKit 440. Routine
vendor requests remain blocked/stubbed. The core suite exercises sparse unknown
pixels, erasures/JPEG tolerance, immutable as-of revisions, source hashes,
partial/complete extent and boundary semantics, layouts/font changes, independent
references, validated moving-image placement and a registered one-pixel negative
return near the page origin, strict API/mobile geometry parity,
clip/provenance agreement, past-first reconstruction and labeled later fill,
encoded visible-pixel preservation, quotas and private read/delete compatibility.

Use the [operator procedure](LOCAL_SETUP.md#session-page-reference-operations--plan-027)
to render a retained session. Compare source hashes, patch bytes/count and source
image bytes; decode/inspect output and verify duration within one 24 fps frame.
Generated video fps does not change screenshot cadence. Inspect the latest mosaic
and as-of states separately: observed spatial coverage cannot prove off-screen
content remained unchanged. Different layouts/visits must remain separate.

The generated production `--canvas` smoke checks transport/validation only and
removes its owned customer, session and files. Private HTTPS preview/video checks
must reject anonymous requests, preserve no-store/range behavior, play/seek at
mobile/desktop sizes and leave no temporary admin session. Production cleanup
inspection requires the `softek` OS identity as documented in LOCAL_SETUP;
development-user permission denial is expected and does not justify opening storage.

Signed-device acceptance is still required: short partial visit, slow top-to-bottom
sweep, return scroll, visible mutation/erasure and keyboard opening/closing. Inspect
actual uploaded page visits/layouts, measured document extent, exact valid/excluded
image bounds, top/bottom flags, covered islands and remaining unknown regions.
Then render that session and compare motion/keyboard shifts and retained tooltip
pixels to the real interaction. Check Stop/background/lock/reload/sign-out/offline
behavior for the new capability, along with phone resource observations. Passing
synthetic geometry/FFmpeg checks does not complete those physical checks. Exact
results, signed build and remaining gates are recorded in PROJECT_STATE and Plan027.


## Automatic replay and 30 fps — Plan 028

```bash
node --import tsx --test --test-concurrency=1 tests/replay-jobs.test.ts tests/recordings.test.ts tests/recording-replay.test.ts tests/reference-fill.test.ts
npx playwright test -c playwright.recording.config.ts
npm run typecheck
npm run build -- --clarity
```

The focused run passed 35 TAP entries. It verifies drain vs final Stop, idempotent
jobs, private status/admin CSRF retry, bounded backoff/terminal failure, independent
worker connection serialization, interrupted-attempt recovery, expiration and
cascade deletion. Actual FFmpeg encoding/ffprobe assert 30/1 output and timing within
one 30 fps frame; existing tooltip/source-pixel checks remain. Browser coverage is 20
cases across Chromium360/390/1440 and WebKit440, including failed→retry→queued→
rendering→ready polling without a page reload, private playback and all previews.
Vendor requests remain blocked. No native source changed, so native export/build
or repeated native unit tests are not required for this server/web change.

Use the two production [automatic smokes](LOCAL_SETUP.md#automatic-replay-operations--plan-028)
to verify real final Stop→worker→private encoded output, including the page-context
path and abandoned-work recovery, without invoking an operator render. Inspect
report cleanup flags and the dedicated worker's role/resource limits. Verify
retained recording/settings fingerprints, Nginx site hashes and API/DB health
before/after deployment. Existing video fps stays historical; new/rebuilt video
uses 30 fps. Plan 027's remaining phone acceptance stays in that plan.


### Keyboard-transition missing tail — CAN-10

`node --import tsx --test tests/reference-fill.test.ts tests/session-reference.test.ts`
covers focus-style differences with a later verified tail, crop-only admission,
unchanged captured tooltip pixels, past-first/later-time provenance and historical
unknown coverage. Negative cases retain rejection without a recent keyboard,
while moving, with incorrect geometry, after 10 seconds, under a different layout, or
with unrelated/blank pixels. Run the existing PageCanvas/keyboard/replay suites
when changing the registration path, then inspect the actual affected encoded
snapshot 28 alongside its raw pixels and later donor 30. Original hashes, full
30fps decode/Stop duration, private HTTP hashes/range/no-store and real browser
play/seek remain the acceptance checks. No new phone recording is needed to
verify a server-side correction to retained source images.
