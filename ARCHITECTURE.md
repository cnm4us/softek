# Architecture

Status: M1 implemented and deployed. MariaDB remains authoritative for banking
state and adoption reporting; live Clarity evaluation is pending in M2.

## System shape

Use a small TypeScript application with a React frontend, an Express API, and the
existing MariaDB server. The browser uses the API for all persistent mutations.
The dedicated Nginx site at `demo.bawebtech.com` serves built assets and proxies
the API on the same HTTPS origin. Development listeners should
bind to loopback unless external preview access is deliberately configured.

Working stack:

- Frontend: React, TypeScript, Vite, React Router, Tailwind CSS, Lucide icons.
  Shared cards, actions, fields, alerts, focus, and tokens cover all routes.
  Native labeled controls keep this small demo consistent and accessible.
- Backend: Node.js, TypeScript, Express, input validation, MariaDB connector.
- Database: MariaDB-native schema and queries, versioned SQL migrations.
- Verification: focused unit/API checks and Playwright browser journeys.
- Analytics: structured MariaDB events plus an optional Clarity browser adapter.

Installed dependency versions are recorded in `package-lock.json`; runtime is
Node 22.21.1. Verify relevant current official APIs before adding new dependencies.

Current structure:

```text
apps/
  web/                 # React frontend and shared theme/components
  api/                 # Express routes, services, repositories, analytics
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

Entities in `0001_demo_foundation.sql`:

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
| D-004 | React/TypeScript frontend and Express API | Implemented working choice from the handoff |
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

## Implemented run and transaction design

Two reusable fictional templates (Alex eligible, Jamie ineligible) are seeded
separately from schema. The institution purchase flag, profile eligibility, run
eligibility snapshot, service enrollment, and goal use remain distinct records.
The campaign and baseline/value assignment are fixed on the run. Admin changes
create a new run; ordinary reset preserves the current profile/eligibility/variant.

The browser receives an opaque 256-bit token in an HttpOnly cookie. MariaDB stores
only its SHA-256 hash and a 30-day expiry. Every current-state operation locks and
checks the active run. Mutations require JSON, exact origin, and an HMAC CSRF token
bound to that cookie. Reset retires the run, invalidating its cookie for current
state but preserving owned records/events. A separate hashed admin cookie expires
in one hour and protects report/configuration routes. Login and entry are limited.

The browser supplies a session-scoped UUID; the server creates visits scoped to
its authenticated run, renewing after 30 minutes of inactivity. Assignments persist
across visits. Actor designation comes from the server checking a private harness
header at entry, then stays immutable. Public ordinary traffic is labeled human;
this separates controlled automation, not every possible bot.

Business actions serialize on the run row. A unique run/request UUID receipt
stores an operation and normalized payload hash. Retries return the committed
result without repeating funds or milestones; changed payloads receive 409.
Enrollment, goals, contributions, histories, receipts, and confirmed events share
transactions. A contribution debits checking, credits savings, and increments goal
progress. Existing savings is not automatically allocated to new goals. First use
is goal creation; later goal creation/contribution qualifies for repeat only in a
visit different from the first-use visit.

Client observations use fixed event/placement/presentation allowlists and bounded
observation times. The server derives run/campaign/actor/eligibility; it rejects
client-created success milestones. Exposure deduplicates by run and logical
placement (desktop sidebar versus mobile inline is also recorded). Reports take a
consistent transaction snapshot, select run-start UTC cohorts and an observation
cutoff, count distinct eligible runs, and separately show ordered receipt-time
stages, total eligible reach, direct entry, and service use. Retired runs remain in
their original cohorts. This is one campaign, not a general analytics platform.

## Clarity and deployment boundaries

The adapter allows only named events and fixed institution/service/campaign/
variant/actor tags, using pseudonymous run/visit identifiers. Banking text, goal
forms/progress, and all controls/reporting have explicit DOM masking attributes.
The loader requires verified backend configuration, a matching frontend flag,
and explicit visitor opt-in. It queues ConsentV2 with analytics storage granted
and advertising storage denied before loading. Live behavior and masking still
need M2 verification against the intended project.

Both production collection flags remain false. Nginx's current CSP also restricts
scripts and connections to the same origin. M2 must verify the project and adjust
the CSP allowlist before enabling collection. Routine browser tests make no
Clarity requests. Reference: [ConsentV2](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2)
and [masking/client API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-api).

Production runs as the dedicated nonlogin `softek` system user, using root-owned
release files outside Ubuntu's home. Its runtime environment contains only scoped
application DB credentials and application secrets. It cannot access the source
home or modify code/system files. Development/test API uses 3101; production uses
3100. Static files alone are public. The exact paths, installation, and rollback
are maintained in [LOCAL_SETUP.md](LOCAL_SETUP.md).
