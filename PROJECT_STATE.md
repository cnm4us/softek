# Project state

Last updated: 2026-10-10, America/Los_Angeles.
Active milestone: **M1 — one complete adoption experiment**.
Latest completed work: **M0 foundation and public Nginx/HTTPS placeholder**.
Next task: **M1-01 — finalize the minimal model and add the first real migration**.

## Current reality

- npm workspaces, TypeScript React/Vite frontend, Express API, shared mobile-first
  theme, root lockfile, migration tooling, and foundation tests exist.
- Banking tables, seeds, customer sessions, enrollment/use, and adoption reports
  are not implemented. No application SQL migrations exist or have been applied.
- Work takes place on the existing Ubuntu EC2 instance at `/home/ubuntu/softek`.
- MariaDB 10.6.22 is running. MariaDB is the only database target.
- Node 22.21.1, npm 10.9.4, Git 2.34.1, and MariaDB CLI are available.
- Public URL: `https://demo.bawebtech.com`, serving the static test page through
  `/etc/nginx/sites-available/012_demo.bawebtech.com` and its enabled symlink.
- HTTP redirects to HTTPS. Certbot webroot issuance and renewal dry run passed;
  the existing renewal timer is active with a per-certificate Nginx reload hook.
- Public assets are in `/var/www/softek/public`; ACME webroot is
  `/var/www/softek/letsencrypt`. The project directory/credentials are not served.
- Git was initialized on `main`, with origin
  `https://github.com/cnm4us/softek.git`. No commit or push was made in this session.
- Clarity has not been configured or enabled. `yvs5hp3ivb` is a candidate project.
- The user-configured `demo` database and local TCP runtime account are created.
  Runtime grants are CRUD on `demo.*` only; the supplied application login works.
  The schema uses `utf8mb4` / `utf8mb4_unicode_ci` and has zero tables.
- `demo_test` and `softek_test_app` are provisioned; the test runtime has CRUD only
  on that schema. Test fixtures were removed, leaving it empty.
- `softek_migrator` has CRUD plus CREATE/ALTER/DROP/INDEX/REFERENCES on `demo` and
  `demo_test` only, no global privileges or grant option. Both schema logins work.
- Supplied admin credentials now authenticate over TCP and the local socket after
  the user corrected `.env`. Initial provisioning used `sudo -n mariadb`
  administration; no admin account/password changes were made by the agent.
- `.env` uses separate `ADMIN_DB_*`, runtime `DB_*`, migration, and test settings.
  Generated secrets stay there, owned by `ubuntu`, mode `0600`, ignored by Git.
- API/frontend development listeners use loopback ports 3100/5173. They are
  stopped after checks; no persistent API service or public `/api` proxy exists.
- Existing Nginx site files/links were unchanged. Only the dedicated demo site was
  added. The banking frontend is not deployed; the public page is a placeholder.

## User direction to preserve

The original handoff's Windows/local-MySQL assumptions are superseded. The user
wants MariaDB-only implementation, migrations, a mobile-first uniform theme, good
desktop layouts, and robust documentation for fresh-agent transitions.

The working architecture retains the proposed React/TypeScript + Express stack,
uses MariaDB connector with versioned SQL rather than the tentative Prisma
recommendation, and starts with savings goals. These are documented working
choices, not user-mandated library/service selections.

## Completed work

All M0 tasks are checked in `IMPLEMENTATION_PLAN.md`, including the user-requested
hosting bootstrap. M2's host inspection is complete; M2 application-service
deployment remains partial. Durable docs reflect the installed scaffold and exact
commands. The original handoff is preserved unchanged as historical background.

## Verification evidence

| Check | Result |
| --- | --- |
| `node --version`, `npm --version`, `git --version` | 22.21.1 / 10.9.4 / 2.34.1 |
| Nginx/MariaDB/Certbot timer | Active |
| Public DNS | A record matches instance public IP; no AAAA record |
| HTTP / HTTPS | Initial HTTP 200; final HTTP 301 to HTTPS; HTTPS 200 with certificate validation |
| Nginx test / ACME path | Passed; challenge probe publicly served |
| Certbot renewal dry run | Successful for `demo.bawebtech.com` |
| Existing Nginx configurations | Prior file hashes/enabled-link targets unchanged |
| `npm run typecheck` | Passed for frontend/API/scripts/tests |
| `npm run build` | Frontend and API passed |
| `npm test` | Eight migration scenarios passed (nine TAP entries including parent) |
| `npm run test:e2e` | Mobile/desktop passed; route/refresh/width/API/no-Clarity checks |
| Public Chromium walkthrough | Mobile/desktop HTTPS placeholder passed; no overflow |
| Compiled API smoke | `/api/health` reports database connected; process stopped afterward |
| `npm run db:provision` repeat | Existing scoped accounts authenticate; no changes |
| `npm run db:status`, `... -- --test` | Both schemas reachable; no ledger/applied/pending migrations |
| `npm run db:migrate` | No-op with no production SQL; no ledger created |
| Grant inspection | Runtime CRUD only; migrator DDL only on explicit schemas; no grant options |
| Visual inspection | Mobile/desktop foundation screenshots inspected; artifacts ignored |
| Final documentation/environment checks | 33 local links; formatting/ignore rules/private permissions passed; no duplicate environment keys |
| Final process cleanup | No listeners on temporary application ports 3100/3101/5173/4173 |

## Outstanding dependencies

- Clarity project/settings, masking, and collection requirements remain unverified.
- Banking-model/session/reset/event semantics require M1 implementation.
- Persistent API service and frontend/API public deployment remain M2 work.

No current blocker prevents M1. Collection remains disabled; a tested scaffold
does not establish working banking behavior or live Clarity evaluation.

## Exact resume point

1. Read `AGENTS.md`, `PRODUCT.md`, and M1 in `IMPLEMENTATION_PLAN.md`.
2. Check Git status and whether the user has changed the working choices.
3. Finalize the minimal M1 entity model and add `0001_demo_foundation.sql`.
4. Verify it with `db:migrate -- --test`, then apply to `demo` after reviewing the
   exact status/target. Add deterministic fixture seeds separately.
5. Build independent participant sessions, the complete enrollment/first-use flow,
   structured events, and reporting. Keep Clarity off until settings are verified.
6. Update this state, setup/testing commands, and plan status with actual evidence.

## Working tree and handoff

All created files are uncommitted; no Git commit/push occurred. The Nginx placeholder
is public. There is no background application process or pending SQL migration.
Inspect Git status for later user/agent changes rather than assuming this stays true.

Check commands/prerequisites in `LOCAL_SETUP.md` and `TESTING.MD`. Screenshots and
the prechange Nginx hash manifest are in ignored `artifacts/`.
