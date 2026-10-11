# Testing

M1, the login/banner revision, and Plan 004 menus are covered by MariaDB/API integration and Chromium journeys. Routine
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
zero/one-enabled fallback, and reset/password/disable behavior.

The Node runner reports **32 passing entries**: 29 nested scenarios plus three
parents. Test files run serially. Cleanup deletes only fixture-owned users/runs
and uploads, removing their interaction/presentation references before run
cleanup and restoring temporarily changed banner settings. Admin-session tokens
are also removed; browser cleanup removes only its own hashed admin cookie token. It never drops a schema.
Do not run the API suite and browser suite concurrently: their report assertions
expect their own isolated execution window.

## Browser acceptance

Ten journeys run at **360×800, 390×844, and 1440×900**: **30 Chromium checks**.

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
uses a placeholder action, opens the separate admin report/customer/banner pages,
checks admin sign-out/reload while preserving the customer login, and resets. It asserts no browser errors or Clarity
requests. Its labeled automated history is intentionally retained in `demo`.

A production multipart upload was decoded/published by the hardened service,
disabled as a retained check fixture, and its immutable image hash verified after
service restart and repeat deployment. This exercises the actual writable asset
path and Nginx upload limit. Local API tests also verify old URLs after replacement.

Host verification includes Nginx syntax, HTTP redirect, API 200, blocked `.env`,
unknown API 404, loopback-only API, dedicated service identity/protections, private
runtime environment permissions, and unchanged preexisting site hashes/links.
Certbot renewal was verified during initial HTTPS setup; application deployment
preserves the challenge route and certificate configuration.

## Remaining evaluation

Real devices, actual Clarity recordings/heatmaps, opt-in behavior against the
verified project, and masking fidelity need human evaluation before presentation.
The current production CSP blocks third-party collection; M2 must deliberately
update its allowlist after verification. Automated success proves software and
instrumentation behavior, not customer adoption improvement.

Historical user-creation fix: all 32 API/migration entries passed; the admin
creation/upload/login browser journey was rerun at 360/390/1440px to verify email
usernames and native rejection of spaces. Plan 004 subsequently passed the final full 30-journey suite, including these
email validation regressions, history navigation, and banner replacement.
