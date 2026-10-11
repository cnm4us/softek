# Project state

Last updated: **2026-10-11 UTC**.
Active milestone: **M2 — Clarity evaluation and presentation readiness**.
Latest completed work: **M1 banking/adoption flow and persistent HTTPS deployment**.
Next task: **M2-01 — verify the intended Clarity project and collection settings**.

## Current reality

- Live banking app: **https://demo.bawebtech.com**. The placeholder is preserved
  for rollback. React/Vite frontend and Express API share the HTTPS origin.
- Harbor Community Bank has two fictional templates: Alex Morgan (eligible) and
  Jamie Chen (standard). Entry creates independent accounts and history for each
  participant run; no real accounts or money are connected.
- Dashboard balances/activity, banner and sidebar/mobile-inline promotions,
  details, two-step enrollment, goal creation, and contributions are implemented.
- Enrollment, balances, goal progress, receipts, and confirmed adoption events
  persist in MariaDB. Requests are idempotent and contributions transactional.
- Reset retires the run, invalidates its current cookie, and creates fresh state
  while retaining the old report history. Assignments remain stable until reset;
  ordinary reset preserves the chosen variant/eligibility.
- `/controls` requires `DEMO_ADMIN_SECRET` from the private `.env`. It configures
  a fresh run and reports UTC cohorts, eligible denominators, ordered funnel,
  total reach, direct service entry, and separate human/automation activity.
- Structured browser observations deduplicate exposures and distinguish logical
  sidebar from inline presentation. Enrollment and first/repeat use come from
  successful server transactions. Repeat use needs a later server-owned visit.
- `0001_demo_foundation.sql` was committed before application and is applied to
  **demo and demo_test**. Both ledgers report version 1, no pending work or drift.
  Initial empty production backup: `/var/backups/softek/before-0001-demo.sql`.
- Deterministic seeds update only templates. Repeated seeding preserves runs.
- Runtime DB account has CRUD on `demo`; test runtime CRUD on `demo_test`;
  migrator has schema-scoped DDL. Admin/test/migration credentials are excluded
  from the deployed runtime environment.
- Production `softek-api` is enabled/active, runs as dedicated nonlogin `softek`,
  and listens on **127.0.0.1:3100**. Code is root-owned and service protections
  include `ProtectSystem=strict`, `ProtectHome`, and `NoNewPrivileges`.
- Latest deployed release: **2026-10-11T06-07-44-353Z**, reached through
  `/opt/softek/current` and `/var/www/softek/current`. Prior banking release:
  `2026-10-11T06-00-00-243Z`. Paths/runbook are in `LOCAL_SETUP.md`.
- Development/test API now uses **3101**, Vite **5173**. Temporary servers stopped;
  production remains running. Tests can run alongside the public service.
- Existing Nginx site files/links remain unchanged. Only the dedicated
  `/etc/nginx/sites-available/012_demo.bawebtech.com` changed for API/SPA routing.
  Certbot certificate/challenge/renewal hook remain in place.
- `.env` is ignored, `ubuntu:ubuntu`, 0600. Deployed runtime allowlist is
  `/etc/softek/runtime.env`, `root:softek`, 0640, inside a 0750 directory. Secrets
  are never printed or committed. The supplied corrected admin DB login works.
- Clarity adapter, fixed tags/events, explicit DOM masking, and gated opt-in
  loader exist. **Collection remains disabled and unverified**. The current CSP
  permits only same-origin scripts/connections. Candidate project: `yvs5hp3ivb`.
- Controlled public smoke runs are labeled automation and intentionally retain
  archived history. Ordinary test fixtures were removed from `demo_test`.

## Verification evidence

| Check actually run | Result |
| --- | --- |
| `npm run typecheck` | Frontend/API/scripts/tests passed |
| `npm run build` | Frontend/API production build passed |
| `npm test` | 22 TAP entries passed: 8 migration + 12 API scenarios and 2 parents |
| `npm run test:e2e` | 15 journeys passed at 360, 390, 1440px; repeated with production running on its separate port |
| `npm run format:check` | Passed |
| Migration status / repeated migrate | Both schema ledgers at version 1, no pending/drift; production repeat no-op |
| Repeated seed | No duplicate templates or participant overwrite |
| `npm run deploy` | Initial install and repeated deployment passed |
| `npm run smoke:public` | Actual HTTPS journeys at 360/1440px: persistent goal, contribution, report, logout, reset, no browser/Clarity errors |
| Public security/routing | API health 200 + DB connected; HTTP 301; `.env` 403; unknown API 404; Secure/HttpOnly/Lax cookies |
| Service identity / environment | Dedicated softek user, protections active, enabled on boot, private runtime file |
| Nginx syntax / preexisting sites | Passed; prior config hashes and symlink targets unchanged |
| Certbot renewal | Passed during initial HTTPS setup; configuration preserved |
| Visual inspection | Mobile/desktop dashboard and desktop report inspected; screenshots ignored |

Initial browser controls checks failed because a test required an exact wrapped
select-label match. The locator was corrected and all final journeys pass.
Vite emits a bundle-size advisory (~523 kB minified / 156 kB gzip); tracked as
B-011. No known failing application check remains. Live Clarity/real-device
behavior is not established by these tests.

## User direction to preserve

Develop on the existing EC2 instance, target MariaDB only, use committed migrations,
and keep a uniform mobile-first theme with good desktop layouts. The original
Windows/MySQL handoff is historical. Preserve unrelated host resources. Do not
expand banking scope before the Clarity evaluation without new prioritization.

## Exact resume point

1. Read `AGENTS.md`, `PRODUCT.md`, and M2 in `IMPLEMENTATION_PLAN.md`.
2. Inspect Git, migration status, public health, and user changes before editing.
3. Establish whether candidate Clarity project `yvs5hp3ivb` belongs to this demo,
   verify hostname/project settings, consent mode, and masking. Official APIs were
   consulted; the actual project configuration and recordings were not accessed.
4. Verify the opt-in adapter and pseudonymous event/visit context against the
   intended project. Review all masked DOM, including controls and goal content.
5. Deliberately configure the required CSP domains and collection gates only
   after verification within the authorized evaluation scope. Routine tests stay
   off. Deployment currently forces collection off; M2 must review that behavior.
6. Run labeled human and synthetic walkthroughs, inspect actual recordings and
   heatmaps, and document observed limitations without conversion claims.

## Git and operational handoff

Foundation/schema commit: `1f759d9`. The M1 implementation and current docs are
committed locally on `main`; inspect `git log` for the current hash. No push was
made. The working tree is clean at handoff. Origin remains the user's supplied
`https://github.com/cnm4us/softek.git`.

No pending migration, background build, or development listener remains. The
production API is intentionally running. Use `LOCAL_SETUP.md` for startup,
protected control access, deployment, rollback, and certificate renewal;
`TESTING.MD` owns coverage and safe cleanup boundaries.
