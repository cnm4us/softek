# Architecture

Status: M0 scaffold/theme/migration tooling implemented; banking data model and
behavior remain a working design. The decision record distinguishes user
requirements from agent-selected implementation choices.

## System shape

Use a small TypeScript application with a React frontend, an Express API, and the
existing MariaDB server. The browser uses the API for all persistent mutations.
The public placeholder uses a dedicated Nginx site at `demo.bawebtech.com`; the
eventual frontend/API will use the same origin. Development listeners should
bind to loopback unless external preview access is deliberately configured.

Working stack:

- Frontend: React, TypeScript, Vite, React Router, Tailwind CSS, Lucide icons.
  Shared theme/card/link primitives exist; shadcn/ui form primitives remain a
  candidate for the enrollment screens.
- Backend: Node.js, TypeScript, Express, input validation, MariaDB connector.
- Database: MariaDB-native schema and queries, versioned SQL migrations.
- Verification: focused unit/API checks and Playwright browser journeys.
- Analytics: structured MariaDB events plus an optional Clarity browser adapter.

Installed dependency versions are recorded in `package-lock.json`; runtime is
Node 22.21.1. Verify relevant current official APIs before adding new dependencies.

Current structure, with seeds/shared contracts still to add when needed:

```text
apps/
  web/                 # React frontend and shared theme/components
  api/                 # Express routes, services, repositories, analytics
packages/
  contracts/           # Shared request/event types if actually useful
db/
  migrations/          # Ordered SQL schema migrations
  seeds/               # Deterministic fictional fixture definitions
scripts/               # Migration/seed tooling and focused operational helpers
tests/
  migrations.test.ts   # MariaDB migration contract checks
  e2e/                 # Browser journeys
deploy/                # Nginx configurations and public placeholder source
agents/
  plans/initial_handoff.md
```

Use npm workspaces and one committed lockfile. Avoid extra infrastructure or a
generic framework for a single demo. Add shared packages only for real reuse.

## Frontend boundaries

Centralize theme tokens and reusable components before implementing full screens.
Brand configuration supplies institution names, approved colors, terminology,
and promotional copy. Campaign configuration supplies service, creative,
placement, and variant. Neither needs a separate frontend application.

Routes cover demo entry, accounts, service details, enrollment, service use, and
controls/reporting. Confirmed state comes from the API; local form state stays in
the browser. Do not treat local storage as the banking database.

Keep promotion visibility observation and the Clarity adapter separate from UI
components. Track logical placement separately from presentation placement so a
sidebar campaign adapted inline on mobile remains analyzable.

## API and persistence boundaries

- Validate requests and use parameterized SQL. Enforce participant and institution
  boundaries on every read and write, not just in frontend navigation.
- A secure cookie identifies the participant run. Profiles are reusable templates;
  entering the demo creates independently mutable participant data.
- Runtime access uses a dedicated application account. Migrations use a separate
  account with schema-management privileges on dedicated Softek schemas only.
- Use integer minor units for simulated monetary values and explicit currency.
  Validate integer range at API and database boundaries; avoid floating-point money.
- Use UTC timestamps for stored events. Display/report timezone must be explicit.
- Apply transactional mutations for related banking state and confirmed events.
  Enrollment and first use are idempotent; retrying requests must not double-apply.
- Protect administrative configuration/reset controls separately from customer
  demo access. Restrict resets to the intended run or identified test environment.
- Handle errors without leaking connection details or secrets.

Planned entities, to refine before the first migration:

| Entity group | Responsibility |
| --- | --- |
| Institutions, services, institution services | Branding, catalogue, institution purchase |
| Customer profiles and fixture templates | Fictional starting data and eligibility |
| Participant runs and visits | Independent mutable state and journey identity |
| Accounts and transactions | Persistent simulated banking data |
| Campaigns and assignments | Eligibility snapshot and stable experiment allocation |
| Enrollments and savings goals | Confirmed enrollment and qualifying service use |
| Adoption events | Structured milestones and reporting dimensions |
| Migration ledger | Applied versions/checksums and failure status |

Every mutable customer record belongs to a participant run. Institution IDs alone
are insufficient for participant isolation. Server-side query scoping is mandatory.

Reset retires the active run and creates a new seeded run. Retain prior run/event
history for analysis with explicit status and filters; old records must not appear
as the participant's current banking state. A later cleanup/retention policy may
remove archived demo runs; reset itself is not a schema operation.

## Analytics boundaries

The event envelope includes event ID, event name, server receipt time, relevant
client observation time, institution/service/campaign, assignment/variant,
participant run, visit, customer-profile identifier, placement, actor type, and
source (`client_observed` or `server_confirmed`). Use an allowlist of event names
and safe metadata; never store arbitrary browser payloads as trusted dimensions.

The server derives ownership, eligibility, assignments, and actor type from trusted
session/configuration context. Automated journeys are designated by the test/demo
harness. Public requests must not be able to relabel themselves as human or admin.
Client-observed milestones are behavioral observations, not proof of enrollment.

Use unique event IDs for delivery retries and distinct participant runs for
funnel counts. Server-generated enrollment and use events are committed with the
business action. Clarity may miss events or filter automated sessions; it does not
determine business success or replace the database report.

Use a browser event allowlist matching named adoption milestones. Backend success
responses can trigger corresponding Clarity events only after the action commits;
the database remains authoritative if the browser closes before emission.

## Schema migration design

The contract is in [db/migrations/README.md](db/migrations/README.md). Use ordered
SQL files and a runner providing status, locking, checksums, and explicit target
validation. Separate schema, fixture seed, and run-reset commands. Do not use ORM
schema push or application startup to mutate the schema.

MariaDB DDL can cause implicit commits, so a failed schema migration can require
explicit inspection and recovery rather than transaction rollback. This behavior
is documented by [MariaDB](https://mariadb.com/docs/server/reference/sql-statements/transactions/sql-statements-that-cause-an-implicit-commit).

## Decision record

| ID | Decision | Basis / status |
| --- | --- | --- |
| D-001 | Develop on the existing EC2 host; MariaDB only | User-confirmed, 2026-10-10; supersedes original Windows/MySQL assumptions |
| D-002 | Mobile-first shared theme with desktop adaptation | User-confirmed, 2026-10-10 |
| D-003 | Use committed, versioned migrations for schema changes | User-confirmed, 2026-10-10 |
| D-004 | React/TypeScript frontend and Express API | Working choice from the handoff; no scaffold yet |
| D-005 | MariaDB connector and SQL migrations rather than the handoff's tentative Prisma baseline | Working choice: direct MariaDB schema control and visible migration SQL; no ORM requirement exists |
| D-006 | Savings goals as the first promoted service | Working choice: simple enrollment and concrete first use |
| D-007 | One npm workspace repository and same-origin deployment | Working choice: proportionate tooling and simple session handling |
| D-008 | Isolated participant runs; reset starts a new run | Working choice: independent demos and preserved analytical history |
| D-009 | Use the user's configured `demo` schema and local TCP runtime account | User-selected `.env` target; provisioned and login verified, 2026-10-10 |
| D-010 | `demo_test`, `softek_test_app`, and `softek_migrator` for isolated testing/schema changes | Implemented; generated secrets in ignored `.env`; no global or grant privileges |
| D-011 | Dedicated Nginx site with Certbot webroot certificate | User-authorized public hostname; implemented without changing existing site files |

Changes to working choices do not need a separate approval ceremony. Record the
reason and update affected plan/setup files. Revisit user-confirmed constraints
with the user when a proposed change conflicts with them.
