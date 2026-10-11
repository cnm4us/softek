# Testing

Status: migration-contract and mobile/desktop foundation checks are implemented.
Adoption/banking behavior checks below remain planned until M1 implementation.
Prose-only changes need link/consistency/diff checks, not app tests.

## Principles

Verify behavior and failure modes that matter to this demo. Prioritize persistent
state, participant isolation, confirmed adoption, migration reliability, and
mobile usability. Do not add tests that merely mirror trivial implementation.

Ordinary tests run with Clarity disabled and use a dedicated test schema and
automated actor designation. Never infer that browser automation is captured by
Clarity; verify that separately in labeled evaluation runs.

## Coverage

| Layer | Meaningful checks |
| --- | --- |
| Migration integration | Clean schema, no-op repeat, upgrade, checksum mismatch, concurrent application, partial failure |
| Database/API integration | Persisted enrollment/use, transactions, duplicate submission, invalid eligibility, participant scoping |
| Unit checks where useful | Exposure timing, funnel cohort/count logic, variant assignment, money validation |
| Playwright | Full adoption, abandonment, no-promotion journey, later use, reset, persistence, responsive layouts |
| Human evaluation | Clarity recordings/heatmaps, masking, navigation fidelity, actual service discovery |

## Browser acceptance matrix

Use representative narrow mobile, wider mobile, and desktop viewports. Initial
targets: 360×800, 390×844, and 1440×900 CSS pixels. Add real-device review before
presentation when available. Include keyboard navigation and form-error behavior.

| Journey | Required assertion |
| --- | --- |
| Balance check only | Dashboard loads; no enrollment/use success is invented |
| Promotion below fold | No exposure event before the documented threshold is met |
| Promotion click then abandonment | Start is recorded; completion/use are absent |
| Complete enrollment and first use | Backend state and events persist; report reconciles |
| Later visit and repeat use | Same run/assignment; qualified repeat-use event |
| Refresh and navigate away/back | Confirmed state remains visible |
| Two browser contexts | Independent mutable participant data and scoped APIs |
| Participant reset | Clean new run; historical run does not become current state |
| Request/event retry | Business mutation occurs once; report count is not inflated |
| Ineligible customer | Enrollment rejected server-side with useful UI feedback |
| Mobile/desktop | Consistent components; no horizontal page overflow; usable forms |
| Routine automated run | No Clarity script or collection requests |

Once transfers and bill pay exist, add transactional balances/history and
persistent scheduled-payment checks. Do not build those tests before the features.

## Database verification

Tests connect only to an explicitly identified Softek test schema. Refuse broad
reset/cleanup commands or targets outside the expected schema allowlist. Do not
discover a random host database and use it as test storage.

Verify migrations against the installed MariaDB server. Keep fixture seeds
deterministic and separate from schema application. Include a fresh database path
and, once migrations evolve, an upgrade from the previously applied schema.

## Executable commands

```bash
npm run typecheck
npm run build
npm test
npm run test:e2e
```

Prerequisites: `npm ci`, working private `.env`, and the provisioned `demo_test`
schema/accounts. Install the browser on a fresh development machine with
`npx playwright install chromium`. Browser/system-library availability was
verified on this instance; no system package changes were needed.

`npm test` runs eight scenarios against MariaDB: empty migration no-op, clean
application/repeat, checksum changes, missing/duplicate files, concurrent runner,
upgrade, historical insertion, and partial DDL failure/retry rejection. The Node
report counts these eight subtests plus their parent. It requires `demo_test` to
be empty before starting, and removes only its own fixtures/ledger afterward.

`npm run test:e2e` starts its own loopback API/frontend servers, runs one foundation
journey at 360×800 and 1440×900, and stops them afterward. It verifies route
navigation/refresh, page width, API database health, browser errors, and absent
Clarity requests. API test startup uses `softek_test_app` on `demo_test`.
Screenshots are written to ignored `artifacts/` and were visually inspected.

The 390×844 viewport, detailed keyboard/form accessibility, banking persistence,
enrollment, and report acceptance remain M1 checks, not completed coverage.

Hosting checks are recorded in [LOCAL_SETUP.md](LOCAL_SETUP.md): Nginx syntax,
HTTP→HTTPS redirect, valid certificate, ACME path, renewal dry run, and unchanged
preexisting site files/links. `/healthz` is a Nginx marker; `/api/health` is local
API/database health and is not proxied publicly yet.

## Reporting results

Record commands actually run, results, and any material unverified behavior in
`PROJECT_STATE.md`. Do not call a skipped/unavailable check passed. Run relevant
checks once after a change; expand or repeat only when new changes, failures, or
unresolved concerns justify it.

Synthetic success proves instrumentation and software behavior. Human walkthroughs
support behavioral interpretation; neither alone proves conversion improvement.
