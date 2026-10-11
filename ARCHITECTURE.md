# Architecture

Status: M1 and Plans 001/004/005 implemented. MariaDB remains authoritative for banking
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
plans/                 # Numbered implementation plans; root roadmap links them
agents/
  plans/initial_handoff.md
```

Use npm workspaces and one committed lockfile. Avoid extra infrastructure or a
generic framework for a single demo. Add shared packages only for real reuse.

Documentation boundaries: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) is the
roadmap, individual `plans/` files own detailed tasks and acceptance, and
[PROJECT_STATE.md](PROJECT_STATE.md#plan-status-registry) owns lifecycle statuses,
verification evidence, and the current resume point. The original handoff remains
historical background at its existing path.

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
- A secure cookie identifies an expiring user session. The server resolves that
  user's owned current run. Profiles are reusable templates; first login initializes
  independent banking state, and explicit reset retires it.
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

The browser receives an opaque 256-bit token in the HttpOnly `softek_user` cookie.
MariaDB stores its SHA-256 hash with a 24-hour expiry. The API locks the enabled
user, rechecks the session, and resolves its owned current run. Legacy run-token
expiry does not expire banking data. Logout revokes only authentication; reset
changes the user's current run while retaining authentication and historical rows.
Password replacement and disable revoke all that user's sessions. A separate
hashed admin cookie expires in one hour. Username/password login is rate limited;
legacy `/api/entry` is retired (410). JSON and upload mutations require exact origin
and an HMAC CSRF token bound to the applicable cookie.

The browser supplies a session-scoped UUID; the server creates visits scoped to
its authenticated run, renewing on explicit login or after 30 minutes of inactivity. Assignments persist
across visits. Admin configures dedicated human/automation users; authentication
checks the private harness header against the configured actor, which stays
immutable on a run. Public ordinary traffic is labeled human;
this separates controlled automation, not every possible bot.

Business actions serialize on the user and run rows using READ COMMITTED. This
lets a request that waited for the user lock see the preceding committed run,
receipt, and banner selection. Reports explicitly use REPEATABLE READ for a
consistent snapshot. A unique run/request UUID receipt
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
variant/actor/route/banner tags. Identify uses the stable opaque user UUID, with
visit/session and allowlisted route/page context; run ID is a separate tag. Banking text, goal
forms/progress, and all controls/reporting have explicit DOM masking attributes.
The loader requires verified backend configuration, a matching frontend flag,
and explicit visitor opt-in. It queues ConsentV2 with analytics storage granted
and advertising storage denied before loading. Live behavior and masking still
need M2 verification against the intended project.

Collection is authorized for the owner-only evaluation. Admin Menu → Clarity
Settings updates the singleton `clarity_collection` table through an admin-only,
CSRF/origin-protected API. Migration 0005 creates it initially off. Each actual
change creates a revision UUID; stale conflicting updates return 409 and a retry
of the already-applied value preserves its revision. Readiness gates still require
verified project settings, a valid project ID and matching frontend/runtime flags.

Consent in sessionStorage is bound to user UUID and revision. Global off/on, logout
and shared-browser user switching require fresh opt-in. `/api/analytics` polls every
five seconds and on focus/visibility without creating visits or rotating banners.
An unavailable policy fails closed. Open SDK documents stop/reload before private
admin content renders, on consent withdrawal, and on observed disabling or expiry.
Background timers may be throttled until the tab resumes. ConsentV2 denial alone
allows cookieless tracking: the app additionally calls SDK `stop`, removes local
Clarity cookies, and replaces the document. Advertising storage remains denied.

Build/deploy default off and support deliberate matching `--clarity` profiles.
The evaluation CSP allows `*.clarity.ms` scripts/connections/images plus
`c.bing.com` connections/images; default sources stay same-origin. Automated users
cannot collect unless a bounded authorized pilot also supplies private
`X-Demo-Capture`; routine smoke supplies only the automation authentication header.
The dedicated privacy browser suite intercepts every external request and uses an
SDK stub. Real network uploads prove transport, not dashboard recordings or masks.

References: [ConsentV2](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2),
[SDK stop implementation](https://github.com/microsoft/clarity/blob/master/packages/clarity-js/src/clarity.ts),
[CSP](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-csp),
and [masking/client API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-api).

Production runs as the dedicated nonlogin `softek` system user, using root-owned
release files outside Ubuntu's home. Its runtime environment contains only scoped
application DB credentials and application secrets. It cannot access the source
home or modify code/system files. Development/test API uses 3101; production uses
3100. Static files alone are public. The exact paths, installation, and rollback
are maintained in [LOCAL_SETUP.md](LOCAL_SETUP.md).

## Implemented login and banner revision

Migrations 0002/0003 add users, hashed sessions, nullable historical run ownership,
a unique user/current-run mapping, immutable assets/presentations, per-user
rotation, and allowlisted interaction observations. Root planning/status files
retain the implementation task IDs and deployment evidence.

Passwords use asynchronous Node scrypt (N=32768, r=8, p=1, 64 MiB limit), random
16-byte salt and a versioned 32-byte hash. Usernames normalize to lower-case ASCII
3–40 characters (letters, digits, dots, underscores, hyphens, @ and +);
email addresses within that limit work as usernames. Passwords allow 8–128
characters. Plaintext is never stored.
Protected user creation returns static field-specific validation errors without
echoing submitted values. Its browser pattern escapes the literal hyphen for
modern HTML validation; see [MDN pattern](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/pattern).
These are proportionate demo choices, with no signup or self-service recovery.
Reference: [Node scrypt](https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback).

The branded login and shared section-title shell use the same theme tokens.
Account Summary places the padded linked image above checking/savings/credit,
activity and goals. The upper-right modal menu contains keyboard focus, closes
on Escape/outside activation/selection, and returns focus. Banking placeholders
have explicit simulated actions; existing savings remains functional.

Banner destinations are server-owned keys, never arbitrary URLs. Admin uploads
JPEG/PNG/WebP up to 5 MiB and 4096 pixels per side. Sharp decodes bounded pixels,
rotates orientation, scales to at most 1600 pixels wide, and re-encodes WebP without
metadata. Multer parses only the protected upload route. Files publish atomically
under generated UUID keys; failed DB publication removes its newly created file.
Replacements disable the prior creative and use a new immutable URL; old assets
and selection snapshots remain readable. Production assets are stored outside
releases in `/var/lib/softek/banner-assets`, the service's only persistent writable
path. Nginx permits 6 MiB only on the exact upload endpoint; other limits remain
small. Public media requires a published DB asset and a validated generated key.
References: [Sharp](https://sharp.pixelplumbing.com/api-constructor/),
[Multer](https://expressjs.com/en/resources/middleware/multer/).

Enabled creatives sort by explicit order then stable ID. Selection and cursor
updates share a locked-user transaction. Login and Account Summary document
refresh each advance once; unique request keys make concurrent retries return
the same presentation. SPA returns/data refetches preserve selection. Tabs share
the sequence but retain their own immutable selection in session storage.
Disabled/replaced selections fall back once. Reset keeps the user cursor and
selects from the retained cursor for the new run without advancing. Three
fictional starter images are seeded only when absent, preserving admin edits
and immutable URLs. No-enabled and image-error states leave accounts usable.

Interactions retain page/presentation evidence separately from distinct-run
adoption. Only explicitly savings-associated banners feed the savings funnel.
The backend still owns enrollment and first/repeat-use success. Login/admin/banking
private text is masked; navigation and artwork remain visible. Logout clears
user/banner/consent state and starts a new document; controls suppress capture.
Actual SDK account separation/masking still needs Plan 002 playback verification.
The optional `?banner=` heatmap parameter is deferred pending that validation.

`scripts/lib/journey-scenarios.ts` defines a validated credential-free scenario
contract (assigned alias, viewport, waits, click/skip, menu routes); it is not a
runner or scheduler. Routine authenticated Playwright/public smoke journeys remain
collection-off. The small Clarity capture pilot belongs to Plan 002.

## Admin and Customer route boundaries — Plan 004

The shared `AppShell` supplies Harbor section titles, theme, a focus-contained
upper-right menu, route focus, and static document titles. Its route/action
registry and visible dialog label identify **Admin Menu** or **Customer Menu**.
Selected customer names and usernames never enter document titles.

`routes.ts` defines the `/controls` and all `/controls/*` admin boundary.
`Application` mounts `AdminApp` or `CustomerApp` independently: admin pages check
only the admin session and load their own protected data. They never bootstrap
banking state or depend on customer refresh. Admin and customer cookies, CSRF,
and sign-out remain independent, even when both sessions exist. Protected server
APIs remain the authorization authority; expired admin requests unmount private
tool state and show sign-in at the requested destination.

`/controls` remains the entry/home; `/controls/customers` is a searchable compact
list, `/controls/customers/new` creates a login, and `/controls/customers/:userId`
shows one selected customer's actions. Existing protected list data resolves the
selected UUID; activity loads on demand. Forms are keyed by customer ID so switching
customers clears inputs. `/controls/banners` and `/controls/report` load separately.
Report filters live in bounded admin session UI state across menu navigation and
reset on document reload/sign-out. Only the latest filter response can replace
report data. No schema or API contract change was needed.

The Customer Menu retains banking routes plus secondary About/reset utilities.
Admin entry is on the customer login footer; direct `/controls` works without
banking authentication. Customer bootstrap is retained only for its component
lifetime, with a document-level guard preventing duplicate Summary refreshes or
advancement on SPA menu returns. Data reads/admin navigation do not advance banners.

The admin subtree is wholly masked, with no customer consent UI, page/menu events,
or Clarity initialization. Analytics helpers also reject every admin descendant.
Crossing into admin from an already captured SPA document denies consent and opens
a new document before rendering private tools. These boundaries are verified with
collection off; actual SDK playback/masking remains Plan 002 acceptance.


## Feature campaign design — Plan 005

The pure public catalog in `apps/api/src/features.ts` is shared by web, API,
and the typed automation contract. It owns twelve stable IDs, routes, menu labels,
source copy and CTAs. Keeping it inside the API source tree preserves the existing
API build/release boundary without another package. `feature-page.tsx` renders
one shared Harbor landing component at `/features/:featureId`. Its first card
content is a semantic h2 using green uppercase eyebrow typography at 20–26px;
the user requested removal of the preceding star and repeated Explore line.
Unknown IDs show
a return link and emit no invented feature observations. Login preserves requested
feature destinations. Customer Menu's Explore Features disclosure reuses the
existing dialog focus containment, scrolling and active-link behavior.

Landing CTAs only record engagement and show an accessible local confirmation.
They collect no inputs and change no accounts, applications or enrollment.
Confirmation resets on a new page entry/reload; banners remain on Account Summary.
The admin destination allowlist includes all twelve pages. Uploaded artwork and
its enable/order configuration remain under existing admin controls.

Migration `0004_feature_interactions.sql` appends `feature_viewed` and
`feature_cta_clicked` to the interaction ENUM, preserving existing ordinals.
The protected API derives user/run/visit/actor and validates the feature route,
CSRF, time and optional presentation. Events deduplicate by run/name/page/feature;
retries receive acknowledgement even when already committed. Changing a retry's
banner attribution is rejected. CTA pending/error/retry uses one request UUID and
an in-flight guard; confirmation follows API acknowledgement.

A banner link carries bounded entry context in React Router history state,
including owned user/run/feature and exact immutable selection. Reload/back retains
that entry; menu/direct entries do not inherit it. Client and server validate it
against the current run and original destination. Neither another tab's selection
nor a mutable current banner determines attribution. No private IDs enter URLs.

`/api/admin/feature-activity` aggregates feature observations in one SQL statement,
using the report's actor/variant/run-start UTC cohort and observation cutoff.
It returns raw views/clicks, distinct users/runs, and optional banner-attributed
counts for all twelve features, including zero rows. Feature Activity appears
within Adoption Report; Savings Goals queries and milestones are unchanged.
Generic page views are not added to feature view totals. Reset retains historical
observations while discarding prior-run entry context. Selected-customer activity
names these engagement observations separately.

The gated Clarity adapter derives bounded route/feature/service/campaign/banner
context via `feature-context.ts`, sending current values (or `none`) on navigation.
Clarity custom tags accumulate values across a session: sending `none` does not
erase earlier feature/banner tags. Session filters mean the value occurred during
the session; use route, event timeline and database attribution for exact entries. Feature
SDK events follow API acknowledgement; late acknowledgements from an unmounted
page do not emit events under another page's context. The Savings Goals adapter
continues to use its own confirmed-business-event path. Local stub tests verify
current-context calls with collection off. Real SDK playback remains Plan 002 work.

The scenario contract accepts a stable feature ID plus existing action click/skip;
no runner or scheduler is added. The frozen user-provided report is linked from
Plan 005; it remains demo marketing copy, not independently verified product data.
