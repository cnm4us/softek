# Architecture

## Admin impersonation — Plan 010

Owner authorized implementation after reviewing Plan 010. Dedicated hashed
impersonation sessions bind a customer to an initiating admin session; every
customer request validates both under user → admin → impersonation locks.
An independent HttpOnly cookie and nonsecret browser context ID prevent stale
pages from acting under a switched identity. Entry ends only this browser's
ordinary customer session; admin access and other browsers remain independent.
Exit/sign-out/revocation never restore a prior customer login.

Migration 0008 adds session and visit-context tables without altering existing
table layouts. Missing historical visit context means customer activity. New
visits carry server-derived provenance, which survives session termination.
Impersonated actions persist in the customer's actual banking run but are
excluded from Clarity and customer report counts/cohorts. Run actor remains the
customer's Human/Automation assignment. Source-aware keys isolate milestones;
request receipts bind impersonation context. New ordinary visits seed eligibility
when a run was first created by an admin. No customer enrollment is inferred from
an admin enrollment. Admin-only runs enter cohort counts only after a customer
visit, retaining their original run-start dates.

Retry entry tokens are derived with the session-secret HMAC from admin identity,
target and request UUID, allowing the same cookie to be reissued after a lost
response without storing raw tokens. Ended/expired requests cannot be resumed;
a new entry requires a new request ID. Recordings of impersonation are out of
scope. The owner declined additional OS selectors.

Status: M1 and Plans 001/004/005 implemented. MariaDB remains authoritative for banking
state and adoption reporting; live Clarity evaluation is pending in M2.

## Contextual discovery — Plan 011

The first phase reuses the existing twelve educational pages with two contextual
entry points: explicit investing exploration → EasyCoin, and the eligible
fictional auto-loan payment screen → Skip A Pay. Savings displays the owned saved
account; loans use shared labeled fictional fixtures. Loan payment review and
confirmation are UI simulations with no balance or servicing writes. Broader
tenancy, experiment assignments, activation and catalogue redesign are deferred.

MariaDB migration 0009 adds preferences, immutable presentations and a join from
existing feature observations to their discovery origin. Existing table layouts
and ENUMs stay intact. Customer/run locks serialize reservation of one suggestion
per visit. Selection is a reservation, not an impression: the foreground browser
must observe >=50% visibility for one continuous second before the API records
an impression. Fourteen-day seen and ninety-day dismissal cooldowns use customer
history across retained runs; fewer suggestions adds a seven-day global interval.
These preferences cover the new contextual invitations; existing Summary banners
and Savings Goals campaigns keep their separate behavior. Permanent Explore stays
available. Confirmation-only feature CTAs are not interpreted as activation.

Observations are bounded presentation IDs/actions; no banking amounts, raw inputs,
account IDs or names enter discovery payloads. Optional feature attribution is
validated against the owned clicked presentation and cannot change on retry.
Impersonation has separate visit reservations/history and is excluded from the
protected discovery report. Existing actor/variant/run-start/cutoff filters apply.
No Clarity command, consent rule or third-party SDK is added; current gated replay
can observe the rendered pages. Financial displays and payment forms are masked.

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

Implemented API-call diagnostics: [Plan 017](plans/017-clarity-api-phoenix-tracing.md).
The owner selected Arize Phoenix and authorized implementation. `Demo()` resolves
the current hosted Clarity callable, preserves original arguments/receiver/order/
return/exception and independently queues safe immutable snapshots. It neither
replaces the SDK global/initial `.q` nor observes automatic uploads. Authenticated
bounded intake requires an owned existing visit, server-issued grant context and
matching collection/tracing revisions. Admin/impersonation and ordinary automation
are excluded. Only a narrow denial/stop terminal batch can close a context after
collection changes; it cannot admit subsequent activity.

Migration 0012 creates initially disabled tracing configuration, owned contexts
and audit/export rows in MariaDB. Duplicate deliveries deduplicate by event UUID
and document sequence; conflicting content is rejected. Calls remain client
observations, separate from adoption. Explicit custom OTLP protobuf spans preserve
safe argument JSON and opaque user/visit/document identity. A single bounded
worker leases up to 25 rows, checks owner/context existence, times out after five
seconds and retries at most ten times with backoff. Only collector acknowledgment
marks an export acknowledged, including partial-rejection handling. Stable trace/
span IDs survive retries, but ambiguous acknowledgments are not an exactly-once
guarantee. A deletion race can finish a request already in flight; previously
exported Phoenix copies expire independently of local customer deletion.

[Plan 018](plans/018-phoenix-span-presentation.md) adds exporter-derived presentation:
`input.value` and `clarity.call` contain the complete JSON-escaped application
call; `output.value` describes queued, returned, thrown or unavailable local
invocation. Text MIME types populate Phoenix's ordinary Input/Output columns.
Returned calls have OK status; unavailable/throwing calls have ERROR and a bounded
status message, without exception details. Kind remains unknown. These owner-requested
fields describe local invocation, never Microsoft delivery. Existing arguments and
IDs are preserved, with no migration or historical re-export.

[Plan 019](plans/019-clarity-context-deduplication.md) reduces redundant calls at
the application source. A document-local context updater remembers successfully
invoked identity and tag values. Identity changes follow customer/visit/route;
only changed tags are sent. Customer/run/visit changes, a collection stop or a new
SDK bootstrap clear the cache. Normal startup-queue drain into the hosted SDK
preserves it. Throwing calls remain retryable, and audit metadata is refreshed on
every initialization even when no context call is needed. All event invocations,
consent controls and mirror/export fidelity remain independent of this cache.
This is an owner-authorized call reduction, not Phoenix-side suppression.

[Plan 020](plans/020-summary-banner-analytics-readiness.md) distinguishes pending
Summary artwork from a resolved empty/failed slot. Owner-bound readiness gates
feature/service/campaign/banner tags and audit metadata, while identity, run and
stable page tags and real events proceed normally. Only loaded artwork supplies
banner context; a resolved empty or failed image uses existing absence values.
Image readiness is keyed to its URL to avoid treating a replacement as loaded.
Partial context updates reuse the existing changed-only tracker. Each supported
key still uses its ordinary individual Clarity call; no multi-set API is invented.

[Plan 021](plans/021-readable-banner-analytics-ids.md) uses derived space-feature
aliases for the existing Clarity banner tag, such as summary-business-invoice.
API widget/selection responses supply the alias; new banner-linked feature entries
carry it alongside the original UUID. The strict trace contract accepts only known
catalog/space aliases and retains legacy banner values for compatibility. Internal
selection, ownership, event and report IDs remain UUIDs. Admin widget configuration
shows the exact Clarity filter value. No new SDK call or database column is added.
Aliases group a space/feature across artwork/title changes and widget recreation;
UUID/asset snapshots remain the authority for distinguishing historical creatives.
Existing remote history keeps the values originally emitted.

Phoenix 20.21.3 uses a dedicated Python 3.12.12 environment and its own SQLite
store, with HTTP UI/collector only on loopback 6006 and SSH/VS Code port forwarding.
A pinned launcher disables its otherwise wildcard-bound gRPC listener, preserving
existing host telemetry services. The service has scoped storage/network/resource
limits; no browser keys, public collector, global auto-instrumentation or additional
application database engine is introduced. Both stores retain diagnostics seven
days. Browser queues/delivery are bounded and best effort; status/export reports
known omissions without implying complete capture or Microsoft processing.
Tracing is deployed Off independently of the unchanged Clarity collection switch.

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
| D-012 | Separate Expo iOS WebView shell around the hosted website, built with EAS on cloud macOS | User requires website coexistence and has Ubuntu/EAS/iPhone access; initial signed build installed and core flow verified. Remaining acceptance and the B-027 session-policy update are tracked in Plan 023 |
| D-013 | Temporary iOS WebView website data store, with native cookie sharing disabled | User requested fresh login after force-close/relaunch. `incognito` uses WebKit's memory-only store; no unreliable termination callback or change to website/server login policy. IOS-09/10 track delivery and device proof |
| D-014 | Native 1 Hz WebView snapshots, private project-local image storage and MariaDB metadata, with admin-only review | User requested one screenshot/second and authorized Plan 024 implementation. Local capture preview delivered; receiver/UI/controller implemented and under validation. Receiver rollout waits for signed-iPhone image proof; final device acceptance remains open |
| D-015 | Sparse change-triggered images plus lightweight motion events; reconstruct video on EC2, beginning with existing images | User requires change-only screenshots and FFmpeg movement. Stage A reviewed and progression authorized; Stage B receiver/web and signed preview are implemented for phone acceptance |
| D-016 | Negotiate capture policy in the existing bridge; store context in a sidecar and bounded interaction rows | Working choice preserves old native builds and 12-column frame inserts. Native owns timing/sequences, web emits fixed kinds/geometry, MariaDB owns metadata; only capable clients replace periodic images |
| D-017 | Local comparison of content-view capture against owning-window capture cropped to the banking area | Working choice for owner-authorized Plan 026. Local Expo module/fixture implemented; three actual bubble trials and keyboard exclusion confirmed. Baseline remains the normal method; optional integrated candidate follows D-018 |
| D-018 | Bind experimental window capture to separate approval and per-frame provenance in existing metadata | Working choice after three owner-confirmed tooltip trials and keyboard exclusion. Reuse approval_version and JSON sidecar; no schema migration. Method fixed per session; normal page capture remains default, with a separately gated receiver and conservative overlay replay cuts |
| D-019 | Per-recording sparse page references with timestamped image patches and explicit partial coverage | User requirements: same-session references, valid partial coverage and image diffs. Implemented working choices in Plan 027: server-first immutable tile derivatives, provenance/coverage, versioned page/clip metadata and conservative layout/layer fallback. Signed-device validation remains open |

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

Plan 022 adds the owner-requested `cta-clicked` custom tag using the validated
readable Summary banner entry captured by the landing page. It is sent alongside
the generic CTA event only after the existing interaction API acknowledges the
CTA; lost responses/retries retain that API's idempotency and per-page emission
guard. Direct/menu/discovery entries, invalid ownership/route, and legacy entries
without a readable alias do not supply the new tag. This is an action observation,
not a persistent context field: do not initialize it on page loads or reset it to
none on navigation. Session values accumulate, representing confirmed CTA origins
without linking unrelated sessions' tag/event combinations. Strict tracing admits
only known Summary aliases and mirrors the actual call to Phoenix. Existing
UUID-based reporting remains authoritative for per-action counts/attribution.
No schema change, collection-policy change or export importer is introduced.

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

Consent in sessionStorage is bound to user UUID and revision. The unanswered
choice uses a native modal dialog: the browser makes the background inert and
contains keyboard focus; the app locks page scroll and treats Escape as decline.
Both explicit choices dismiss it. Known choices retain page-bottom management
controls and do not reopen the modal on navigation/reload. Global off/on, logout
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
Plan 014 replaces the Summary linked image with a shared inactive strip after
checking/savings/credit and before activity. Each account detail page uses the
same strip between its balance and activity cards. One CSS height token makes
the strip half the balance-card minimum height. Clarity treats Summary as banking
with no banner/feature/campaign tags, rather than tagging unrendered artwork.
Banner selection/history and admin
assets are retained; the placeholder creates no banner visibility/click events. The upper-right modal menu contains keyboard focus, closes
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

## Bulk customer generation — Plan 006

Migration 0006 adds `customer_generation_batches` and `customer_starting_balances`
without changing existing user/template rows. Batch metadata owns a unique request
UUID, globally allocated numeric ID and keyed HMAC of normalized configuration,
including the password; plaintext passwords are never persisted. The protected
`POST /api/admin/users/generate` creates all users/amounts in one transaction.
An exclusive upsert lock serializes duplicate request UUIDs without shared-lock
upgrade deadlocks. Exact retries read the same manifest; changed configuration
returns 409. A name collision rolls back the whole batch, with no partial users.

Usernames are `<prefix>.<batch>.<position>`; fictional display names include the
same batch/position marker. Prefix/ranges/count are strictly validated. Balances
use bounded random integer cents. Each password gets its own scrypt salt/hash;
two hashes run concurrently to bound per-request memory. In test, 200 customers
complete in about 14 seconds. Concurrent batch creation uses independent rows;
this admin tool is not a background scheduler.

Opening amounts are keyed by user UUID and applied when `bindRun` creates a new
run, covering first login, customer reset and admin reset. Existing runs never
get overwritten by login or seed; manual users without opening rows retain their
templates. Generated credit/history remain template examples, not a reconciled
ledger. The batch form keeps its request UUID and inputs on an uncertain response;
Start new batch explicitly changes the UUID. CSV uses a local browser Blob and
omits passwords. All routes remain in the masked, analytics-excluded admin subtree.

This schema is additive, but pre-006 APIs cannot restore generated starting amounts
on reset. Keep a compatible release for rollback, or return current code to the
collection-off deployment profile; do not downgrade applied migrations.

## Customer device/browser preferences — Plan 007

0007 adds `customer_browser_profiles`, keyed by user UUID with cascading deletion.
Missing rows resolve to Desktop/Chrome; no retained user, run or history is changed
by migration. Existing positional user inserts and older authenticated APIs remain
compatible with the additive table. The shared pure catalog defines seven valid
pairs, enforced by API schemas and a MariaDB CHECK. Manual and bulk creation save
preferences in their existing transaction. A protected profile update locks the
user and upserts the preference without revoking sessions or resetting runs.

The UI uses two selectors, restricting browsers when device changes. CSV adds
device/browser IDs. The runner resolver uses built-in Playwright presets: Desktop
Chrome/Edge/Firefox/Safari, Pixel 9, iPhone 17 and iPad Pro 11. It sets viewport,
screen size, density, mobile/touch flags and UA, with matching Chromium, Firefox or
WebKit engines. Edge uses the Chromium engine/Edge identity; Safari is WebKit on
Linux, not physical Apple hardware. Preset details follow the installed Playwright
version, and exact Clarity classification still needs dashboard observation.

The explicit pilot accepts a saved enabled Automation customer UUID and a private
`PILOT_CUSTOMER_PASSWORD`. It reads the pair through protected admin APIs before
launching the browser and records the resolved profile in password-free evidence.
It can instead create its two labeled users with explicit device/browser flags.
No collection, bot-detection changes or scheduling happen when preferences are
saved. Consent and private automation/capture gates remain required. Routine tests
block collection; no UA spoofing is used to evade Clarity's bot detection.
The pilot attaches private headers through a route scoped to the application
origin; third-party SDK requests receive no automation/capture secrets. A local
intercepted test verifies both directions. Default Desktop/Chrome generation
fingerprints preserve the pre-007 normalized payload for compatible retries.

Sources: [Playwright emulation](https://playwright.dev/docs/emulation),
[engine fidelity](https://playwright.dev/docs/browsers), and
[Clarity bot filtering](https://clarity.microsoft.com/blog/bots-vs-real-users-who-is-really-visiting-your-site/).

## Shared starting-account controls — Plan 008

User-requested simplification removes the Alex/Jamie selectors from creation,
generation and admin reset. Both seeded profiles use the same accounts and activity.
The independent `demo_users.eligible` value supplies the new-run eligibility
override; the template's eligibility does not determine a customer's assignment.

New manual/bulk requests omit `profileId` and default to the internal Alex fixture.
Admin reset accepts an optional legacy profile field; when omitted it resolves
to the locked user's existing profile. Legacy explicit overrides remain valid.
No schema migration, user rewrite or fixture deletion is required, preserving
foreign keys, historical runs and existing API clients. Generated opening amounts
remain keyed by user UUID and are restored through the existing bindRun path.

## Permanent customer deletion — Plan 009

Owner explicitly requested hard deletion. `POST /api/admin/users/:id/delete` uses
admin authentication, origin/CSRF checks, a UUID parameter and strict empty body.
It locks the selected user in a transaction, removes owned interactions and banner
presentations before visit cascades, then deletes every owned active/retired run
and the user. Run/user FK cascades remove banking, receipts, events, sessions,
rotation, saved amounts and device/browser preferences. Missing users are a safe
no-op for concurrent/repeated deletion; a login that loses the user before its
lock returns 401. Shared templates, banners/assets and anonymous runs are untouched.

Generation batches retain request metadata for idempotency. The existing MariaDB
no-op upsert returns insertId=0 for a previously committed batch; generation returns
its surviving customers even if the list is empty. A committed empty batch is
not re-generated. Integration tests cover concurrent first generation and partial/
all deletion retries. No migration is needed. Deleted local events cease to appear
in reports; this endpoint does not remove Microsoft Clarity's existing recordings.

## Plan 012 — Customer feature catalog

`feature-catalog.tsx` groups the existing shared feature IDs into five ordered
sections and renders their full `name` values. `/explore` is an authenticated
customer route and a bounded API/Clarity route tag. The hamburger menu contains
one catalog link; Admin navigation is unchanged. Native buttons expose expanded
state/controlled panels; search filters product names locally without changing
URLs or writing preferences. Harbor tokens supply all styling.

Catalog links carry only `fromCatalog: true` in Router history for a return link.
This is navigation state, not analytics attribution: immutable owned banner and
discovery entry validation remains authoritative and takes precedence. Catalog
page views use existing interaction events; product landings/CTAs use existing
feature observations. No new event type, schema migration or collection gate.

## Plan 013 — Read-only account details

`account-pages.ts` supplies three static paths/kinds and bounded route keys, shared
by navigation and first-party/Clarity context. Account pages render only the
current authenticated `State.accounts` entry for that kind, without account IDs
in URLs or analytics tags. Existing `/api/state` additionally returns transaction
`accountId` from its owned-run query, letting details filter by identity rather
than a display name. Saved history remains the existing twelve-row recent-activity
window across accounts; full account-history retrieval/search remains B-002.

`account-details.tsx` supplements that saved history with explicitly labeled display
fixtures from the demo's October 2026 period. Amounts vary deterministically by
owned account ID and stay stable for the run. Illustrative fees/APY/credit terms
are display fixtures as well. No new financial endpoint, schema or seeding of
retained customers is needed; only existing authenticated reads/page observations
occur. Balance, account information and history containers are Clarity-masked.
Owner deferred Explore placements to a subsequent discussion; existing contextual
journeys and collection gates remain independent.

## Feature Explorer configuration — Plan 015

Migration 0010 adds only `feature_explorer_widgets`, with a unique (space, feature)
constraint and nullable FK to existing `banner_assets`. Shared catalog/space
identities derive titles/internal URLs; admin mutation accepts no destination URL.
Blank widgets are disabled, and enabling requires an asset in both API validation
and a MariaDB check. All endpoints use the existing independent admin session,
Origin/CSRF checks and multipart authentication before reading the image body.
The new upload endpoint gets a scoped Nginx 6 MiB limit; all other limits remain.

Image decoding/publication reuses bounded Sharp processing and immutable WebP
storage. Replacement swaps a widget's current asset inside a transaction while
retaining old assets; failed publication/unknown widget removes the new file.
Controls share the existing resource/loading/error components and masked admin
shell. `feature_explorer_widgets` is deliberately independent of legacy
`demo_banners` and participant banking state. This phase has no customer reader,
rotation cursor, presentation table or analytics events for the new configuration.
Owner-selected future activation must add owned attribution and per-space rotation
without treating a configuration inclusion flag as consent or a recorded exposure.

Plan 015 EXP-06 adds an admin/Origin/CSRF-protected widget deletion endpoint. It
locks the selected widget and deletes only its configuration row. Missing IDs
return success for a repeated deletion; immutable assets are retained. Existing
upload/settings locks serialize against deletion. UI confirmation names the feature
and banner space; row deletion reloads the list, configuration deletion returns to
Feature Explorer, and failures retain the current UI for retry. No migration or
customer activation is needed.

## Summary feature-banner activation — Plan 016

Migration 0011 adds a per-user Summary widget cursor with user-deletion cascade;
its last widget ID intentionally has no widget FK so deletion cannot erase cursor
history or block configuration removal. Selection serializes through the existing
user/run lock. Enabled uploaded Summary widgets sort by order/ID, with a request
UUID deduplicating advances. Tab/run-owned cache restores an exact presentation
while validating current enablement/asset; disabled/deleted/replaced artwork recovers
without reusing another customer's selection. Empty lists create no presentation.

Existing `banner_presentations` stores immutable feature/widget/asset snapshots,
identified by reserved `explorer-summary:` request keys. Legacy `/banners/current`
excludes those snapshots, preserving the old independent cursor/API contract.
New snapshots have no Savings Goals campaign; existing `/interactions` ownership,
feature matching/deduplication and Feature Activity joins provide banner/CTA
attribution without a second reporting pipeline or ENUM change.

The new customer reader is mounted only in Summary. Account details remain inactive.
The shared linked-image component gains compact contained rendering and placeholder
recovery. Clarity context comes from loaded artwork held in scoped memory, rather
than a cached legacy selection; route/customer transitions clear it. Confirmed
interaction events now read the existing structured consent helper correctly.
Collection/actor/admin/impersonation rules are preserved. Impersonation can preview
current Summary artwork without advancing its customer's cursor.

## iOS shell — Plan 023

`apps/mobile` is an Expo TypeScript workspace for an iOS WebView opening the
existing Softek HTTPS website. The browser and app share hosted web screens and the same
API/MariaDB boundary. Standard WebView cookies keep authentication within the
website origin; a native token store, cross-origin API or mirrored banking state
is unnecessary for the initial shell. Safari and app cookie stores are separate.

EAS cloud builds supply the Mac/Xcode build environment unavailable on this
Ubuntu host. A distinct Softek app identity and signed Release/internal preview
build provide device acceptance without Metro. The owner's AWS EAS configuration
is a read-only workflow reference; do not reuse its project identity or modify
its services. Preserve root web/API build behavior and inspect the scoped mobile
upload archive before cloud submission, excluding server secrets and owner files.

Top-level navigation stays on the configured exact HTTPS origin; selected
external links open outside the WebView. Native UI handles safe areas, loading,
navigation and connection recovery. Existing web consent rules remain in force;
there is no new native capture SDK or native message bridge in this phase.
The future capture experiment must separately establish compatibility with
WebViews and native controls. [Plan 023](plans/023-expo-ios-webview-poc.md) owns
implementation tasks and actual-device acceptance.

Implementation selects Expo **58.0.23**, React **19.3.0** and React Native
**0.88.1** with Expo-recommended WebView/safe-area packages. SDK 58 matches the
website's existing React version, avoiding duplicate React in native resolution
without changing existing web/API package versions. Expo Go must support SDK 58;
signed-preview acceptance does not depend on Expo Go. Splash artwork is configured
through the supported `expo-splash-screen` plugin. There are no hand-edited Xcode
projects in the working tree.

The website build now names web/API workspaces explicitly, so the mobile export
does not run as part of collection-profile builds or deployment. The EAS helper
uses a project-owned tool cache after the shared cache failed, and no-VCS mode
with an explicit repository root to omit Git history from uploads. Root manifests
and the single lockfile remain; web/API package manifests are included for npm
workspace resolution, while their source and private data are excluded.
`archive:check` verifies the actual EAS archive against an allowlist before upload.

### Shared main-content focus bounds — B-026

The owner authorized a focused layout correction after observing whole-page
sideways movement and an over-wide rust line below titles. The line is reproduced
as the top edge of main's route/skip-link focus outline: the shared 3px outline
with a 4px outward offset paints 7px beyond each viewport edge. Desktop WebKit
and Chromium still report no root horizontal scroll in this state; actual iPhone
scrolling must be confirmed separately rather than inferred from root scrollWidth.

Inset only `#main:focus-visible` with a -7px offset. Keep programmatic route focus,
skip-link behavior and the original visible outward indicators on interactive
controls. Do not clip the document or disable intentional table/vertical scrolling.
Release only the compiled CSS delta and its stylesheet reference over the existing
frontend release, preserving exact application JavaScript, collection profile,
API/runtime configuration and Nginx. This is a working implementation choice for
the authorized B-026 correction, not a native-wrapper change.

The owner subsequently reported that outline containment did not resolve the
sideways movement, but pinching out immediately restored the signed-in page's
fit. Treat that as evidence of an enlarged visual viewport rather than resize
the cards. Shared form controls were 15px; raise their text to 16px to avoid
small-input iPhone focus zoom. Keep normal viewport metadata and user pinch zoom;
do not add `user-scalable=no`, scale caps or native scrolling suppression.
Browser checks enforce the readable control size and unrestricted zoom metadata;
the owner must verify prevention through a fresh iPhone login, since desktop
WebKit does not reproduce iOS keyboard-driven zoom. Publish the one-rule CSS
delta over the retained frontend without changing application JavaScript or APIs.

### Temporary app sessions — B-027

`incognito` selects the iOS nonpersistent website data store and
`sharedCookiesEnabled={false}` prevents importing a native shared cookie jar.
This replaces the default persistent store used by native build 1. It requires a
new bundled app build (0.1.1 / 2); no hosted web/API deployment is part of this
change. Memory-only website data disappears with that WebView instance. Reload
and normal app switching keep the instance. Build 9 also remounted it on ordinary
load errors, which lost login during the phone's offline check. Build 10 retains
the mounted WebView under a blocking/accessibility-hidden connection-error
overlay; manual Try again issues a fresh GET at home in that same view. A retry
counter query parameter forces navigation because iOS ignores an identical source
URL; it carries no identity/authentication data and is ignored by the website.
Failure invalidates capture immediately, failed loadEnd cannot bootstrap the
bridge, and recovery never restarts recording. Actual content-process termination
is still an explicit replacement-on-retry path; force-close/new app process or
that replacement starts a fresh session. This is a working recovery correction
within REC-05/07; the owner has now accepted signed build-10 connection/cookie
recovery and the follow-up upload is server-confirmed (PROJECT_STATE owns evidence).
This also resets browser-local consent/preferences. MariaDB user/banking state
persists, and server sessions retain their normal expiry rather than being
revoked by an unreliable app-termination callback. Existing persistent app data
is not imported, and Safari's separate data store is not cleared.

## Screenshot recording — Plan 024

The user requested planning for an explicit Record/Stop workflow at one snapshot
per second. Proposed architecture keeps pixel capture in the native Expo shell,
customer control/status in the shared website header via a narrow typed bridge,
and receiver/review within the existing HTTPS/API/MariaDB application. A browser
capability handshake controls presentation; server authentication is independent.

Create sessions through existing customer cookie/Origin/CSRF checks. Give the
native uploader a short-lived recording-only credential held in memory, never
the website's HttpOnly cookie or an admin credential. Validate the originating
customer session and capture eligibility; exclude login/admin/impersonation and
stop on lifecycle/auth changes. Store bytes outside public releases at
`/var/lib/softek/recordings`, with MariaDB ownership/timing/integrity metadata;
admin-authorized reads serve each image with no public asset route. Retention,
quota and DB/file reconciliation are part of the receiver, not deferred cleanup.

Keep device capture UTC, monotonic elapsed time/sequence and server receipt UTC
separate. Playback exposes gaps and clock uncertainty. Preserve the existing
temporary-login policy and independent Clarity consent/settings. This is an
implemented design with a deployed receiver and accepted native functional flow;
profiling/operational follow-ups are tracked separately. [Plan 024](plans/024-ios-screenshot-recording-poc.md) owns
contracts, limits, implementation order and verification criteria.

Implementation uses view-shot 6.1.1 and Expo FileSystem 58.0.13. The first signed
capture preview uses a self-contained fictional WebView fixture and retains only
the latest eight local frames for review, without network upload. The integrated
controller snapshots the banking WebView container after a main-document
handshake and eligibility checks before/after capture, with an authentication
generation that invalidates late results. A monotonic deadline scheduler skips
missed slots rather than overlapping captures or catching up in a burst.
Round timer delays upward and recheck the expected deadline/epoch after waking;
early or stale timer callbacks cannot produce zero/duplicate frame sequences.
One active session per customer is a working choice: a new explicit approval
replaces an unclosed prior session, so force-close/re-login does not impose a
timeout before the user can record again. A lost creation response retries the
same request ID, while different customers still share the two-active limit.

The initial phone check failed with zero frames. The corrected adapter converts
iOS view-shot's absolute temporary path into an encoded `file://` URI for Expo
File, while releasing the original native path. iOS view-shot renders at device
scale; divide requested width/height by PixelRatio to target 720 physical pixels.
Report a safe operation stage and allowlisted reason locally, keeping native
paths/arbitrary errors out of the UI; cleanup must not mask the primary failure.
These contract fixes do not establish the original native failure's exact cause.
The later phone diagnostic identified size rejection. Expo FileSystem's `copy()`
is asynchronous; await it before reading metadata, releasing the source, or
publishing the owned file. Reading size immediately raced the copy and the old
zero-fallback getter concealed the distinction. Use `info()` for checked metadata
and separate missing/invalid/empty/oversized outcomes. A deferred-copy boundary
test proves that sizing and source release wait for completion, including rejection;
it does not establish native image fidelity. This is an implementation correction,
not a change to the recording limits or capture method.
The `capture-check` EAS profile sets `EXPO_PUBLIC_CAPTURE_CHECK=1` at bundle time
and opens only the network-free fixture, without mounting the banking shell or
uploader. Ordinary preview builds explicitly set it to `0`. This temporary working choice
isolates pixel-path diagnosis before receiver deployment; no new server access
or general screen-capture permission is needed by this local fixture.

Native upload credentials are HMAC-derived from the random server recording ID,
customer-session hash and idempotent creation request, with a separate domain
separator. Only their hash is stored. This allows a lost creation response to be
retried without storing plaintext credentials. They remain scoped to frames,
heartbeat and stop, and validate the original live customer/run/session. Admin
deletion follows the project's existing POST `/delete` + CSRF convention.

All recording file/quota mutations share a MariaDB advisory lock across the API
and cleanup CLI. Publish a private file atomically and sync it before committing
metadata. A crash before commit can leave an orphan, handled by reconciliation;
an unacknowledged retry can replace it safely. Commit deletion tombstones before
unlinking, so failures leave retryable deletion intent. Cleanup prunes only this
feature's known files, marks missing committed files as interrupted/gaps, and
recalculates counters. Production storage refuses paths outside the dedicated
Softek recording directory. UTC discrepancy flags are indicators of clock/start
uncertainty, not a measurement of network latency or proof of phone clock drift.

## Animated replay — Plan 025

The owner requested a plan for change-triggered screenshots and FFmpeg-generated
movement. First prove reconstructed scrolling with existing images, preserving
capture/elapsed timing and unknown intervals. Only then introduce versioned capture
triggers and bounded gesture/scroll events. Both policies are implemented: old
clients retain the 1 Hz contract; capable clients negotiate `changes-v2`.

Use a deterministic timeline manifest to distinguish observed images/events from
estimated movement. Align overlapping content and animate a crop across bounded
composites; stationary layers stay stationary only where supported. Page changes
or uncertain/non-overlapping content use cuts/transitions. Capture UTC labels and
elapsed playback clocks remain separate; receipt UTC does not drive replay.

Implemented Stage A working choices: a bounded project-only CLI renderer, private per-recording
derived artifacts with shared quota/retention/deletion, and authenticated admin
delivery. No automatic render queue/service is needed for the experiment. Do not
hold the receiver's shared lock during encoding; coordinate brief source/publish
operations and revalidate deletion/expiry before publishing output.

Use a separate per-schema render advisory lock, a 1 GiB per-job filesystem work
reservation, short receiver locks around source copy/publication, and private atomic
directory publication. Receiver capacity includes derived bytes/reservations alongside
image DB counters; no schema change is needed for Stage A. Cleanup reaps abandoned
work after 30 minutes and retains published exports until parent deletion/expiry.
Encoding uses 24 generated frames/second, bounded pan/composite geometry and H.264
faststart MP4. It does not capture additional phone images. The normal page header
scrolls with this site's content; no fixed-header layer is invented for these views.
Registration permits up to three-quarters of a viewport of vertical displacement,
retaining at least one-quarter overlap and the existing strict pixel/edge checks.
The earlier half-viewport limit incorrectly cut the owner-observed source 14→15
and 15→16 scrolls. Optional replacement uses a Linux
[atomic directory exchange](https://www.man7.org/linux/man-pages/man2/rename.2.html)
after complete rendering/validation; failed replacement leaves the prior export.
Renderer revision 5 excludes a narrow outer gutter (one-sixtieth of the image
width on each side) from alignment scores because WebKit scroll indicators move
independently of page content. Full-resolution refinement checks every content
pixel instead of a three-pixel stride; acceptance thresholds and full-width source
composites stay unchanged. This working choice fixes false cuts on matching text
without relaxing content checks. Unsupported stationary-layer/layout mismatches retain observed cuts. Admin replay
uses authenticated no-store range delivery; no public static media alias or job UI.

Migration 0014 adds default legacy policy/counters, a frame-context sidecar and
interaction rows without changing the 12-column frame insert shape. Migration 0013
is immutable. Native/WebKit clocks are calibrated per session with uncertainty;
eligibility/geometry probes bracket snapshots. One pending change and minimum
500 ms spacing replace periodic images; the remaining idle timers are metadata
heartbeat and session expiry. Terminal upload failures cannot restart the pump.

Explicit React page/menu/alert hooks and a local observer of committed customer
content request images. Passive scroll/touch observations send fixed kinds and
geometry, not DOM/input/error text. Aggregate motion sampling and bounded event
batches share image storage quotas. Stable opaque menu/dialog IDs prevent gesture
marks being assigned to another visible surface. Points use one viewport-to-image
scale in both axes. Sparse replay holds idle states, uses observed timing where
alignment/geometry support it, and retains estimated motion/cuts otherwise.
Renderer revision 4 preserves preceding idle time even when a moving endpoint
requires estimated interpolation: with complete events and a stable starting
image, bound motion onset by the first compatible scroll sample minus its 100 ms
sampling window and clock uncertainty. Stable paths also hold until that bound.
This is a working reconstruction choice, not an exact onset observation; missing
events or unstable starting geometry do not establish such a bound.
Known device boundary: inline application validation is captured, while the iOS
required-field validation bubble was absent despite error-triggered snapshots.
The current adapter snapshots a referenced view hierarchy; WebKit presents this
bubble as a [native UIKit popover](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/ios/ValidationBubbleIOS.mm).
A wider in-app hierarchy capture is a possible follow-up experiment, not verified
support or authorization to broaden collection. Do not claim pixel-complete native
overlay capture. Input events request a content image after a 300 ms pause without
reading values; approved screenshots can still display intermediate typed text.
All existing recording authorization, eligibility,
privacy/lifecycle boundaries and independent Clarity controls remain in force.
[Plan 025](plans/025-change-triggered-video-replay.md) owns proposed limits, concrete
tasks and acceptance; lifecycle status/evidence stay in PROJECT_STATE.

## Native overlay capture experiment — Plan 026

The owner authorized a local-first experiment for broader in-app capture after native required-field
popover pixels were absent from otherwise successful captures. The proposed working
choice is to render from the foreground window associated with the approved content
view, cropped to that same banking area, using public APIs. Scene/window ownership,
keyboard/system exclusion and coordinate mapping must be verified; a global
key-window or all-window screenshot is not an accepted shortcut. A small local Expo
iOS module is an option if the installed adapter cannot target the correct window.

Prove the real bubble in a local fictional fixture before integrating uploads.
Retain the current capture adapter, scheduling/timing/file contract and lifecycle
checks. Native popovers may appear after web validation events and need bounded
settle handling; no idle polling or continuous recording is proposed. Preserve
source/capture-method provenance and use cuts for unsupported overlay transitions.
No receiver/schema change is assumed; any negotiated contract expansion must retain
old clients and strict validation. The local-only candidate and fixture are
implemented. The owner confirms one successful actual validation-popover capture
on the iPhone; repeatability, keyboard-visible exclusion and remaining acceptance
still require physical checks. [Plan 026](plans/026-ios-native-overlay-capture-experiment.md) owns tasks,
boundaries, device acceptance and fallback; PROJECT_STATE owns lifecycle/evidence.


The local candidate is `SoftekOverlayCapture`, an Expo module resolved from
`apps/mobile/modules`. It resolves the referenced view through the installed Expo
Fabric-compatible context and takes only its owning foreground normal-level window.
Rendering translates/scales directly into a 720 px crop rather than saving a full
screen. Keyboard transition rectangles conservatively clip drawing above their
highest intersection before pixels are rendered. A modal hosting the approved view
is allowed; another presentation must be a popover anchored inside that view, or
capture is rejected. No window enumeration, private class-name matching or private
API is used. Keyboard clipping and window/popover assumptions are device hypotheses.

`overlay-check` opens only a network-free fictional fixture. Start arms a one-minute
comparison; initial/event requests coalesce for 350 ms and pairs start at least
500 ms apart. Each pair sequentially invokes the unchanged baseline adapter and
the window candidate, rechecking foreground/eligibility between results. Stop or
interruption discards late files. Only eight samples are retained locally; they
carry method, UTC/elapsed time, dimensions, byte/capture cost and mask/popover flags.
The local fixture has no upload wiring. The separate experimental banking preview
now offers candidate recording as described below. The normal preview retains
the original capture adapter.


The local comparison's Clear & reset action stops and invalidates pending captures,
deletes accepted local files, closes Review and remounts the fictional WebView.
A document epoch rejects load/message events from the old view; Start remains
unavailable until the new document loads. Reset never automatically starts a check.
New test labels distinguish runs whose pair numbers restart at 1, and Review gets
a fresh scroll container on each opening. This addresses confusing cross-run
numbering and retained review position without changing native pixel capture.


After local pixel/exclusion proof, `overlay-preview` advertises `window-crop-v1`
alongside `changes-v2`. The hosted recording panel defaults to page capture and
lets capable preview users explicitly select native-tooltip coverage before Record.
Selection is locked during recording/draining and fixed in the native session.
The candidate uses the same private upload pipeline, with before/after eligibility,
Stop and bounded files/queues; no silent method fallback is permitted.

Window approval is `screenshots-window-v1` with policy `changes-v2`. Existing
`approval_version` stores it; each frame's strict JSON context carries only
`surface: { method: 'window-crop-v1', maskedKeyboard, anchoredPopover }`. The receiver
requires approval/provenance agreement and rejects retry approval changes. The
new `WINDOW_CAPTURE_ENABLED` gate defaults off and can reject new/writable window
sessions while allowing Stop. Legacy view approvals retain their behavior. No new
MariaDB column/migration, port, public file route or collection setting is needed.
Admin method labels derive from approval and show native popover/mask flags.

A window validation error waits at least 350 ms before the capture attempt, with
500 ms minimum capture spacing maintained by the change loop. Stop cancels pending
work. Native-reported capture request time feeds elapsed timestamps. Ordinary web
taps additionally request a candidate UI capture to observe native dismissal;
there is no idle polling. Native-only actions lacking a web signal are not claimed
to have complete transition coverage until observed in the integrated device test.
Replay cuts intervals touching a reported popover, keyboard mask or window error,
and omits page gesture marks on those uncertain surfaces. Ordinary supported
window scrolls can still use image/event alignment. These metadata are client
reports, not device attestation or proof that every possible overlay is captured.


### Labeled keyboard placeholder — OVL-08

The owner selected an explanatory placeholder in derived replay videos. Renderer
revision 6 adds “Keyboard area / Not captured” only to held `window-crop-v1` frames
reporting `maskedKeyboard`. Existing frames do not persist exact masked bounds.
As a working choice, scan full-width bottom rows matching the known native canvas
color `#f5f6f1` within 3 RGB levels for JPEG rounding; retain an 8-pixel boundary
margin and require at least 128 blank pixels. Center a compact panel wholly inside
that region. Placement is inferred, not an assertion of exact keyboard dimensions.
Nonblank page content is preserved. If no safe region exists, the video header
still says “Keyboard area not captured,” without an in-image panel. Unmasked and
legacy frames remain unchanged. No actual keys, suggestions or covered page
content are synthesized, and originals/approval/native masking remain unchanged.
The manifest records this convention and each video report counts labeled source
intervals. Existing native-layer holds and marker exclusions continue to apply.


### Page reconstruction beneath the keyboard — OVL-09

The owner authorized this experiment after accepting the placeholder. Renderer
revision 7 keeps placeholder-only behavior as the default; explicit
`--reconstruct-keyboard` plans an inferred fill for held masked window frames.
Within the same consecutive frame/route/document-container segment, consider only
the nearest stable unmasked, nonpopover window observation before and after, each
within 30 seconds. Require equal image dimensions/viewport width, scale 1 and no
horizontal panning. Geometry predicts a vertical offset; a 120-pixel-wide image
comparison searches nearby shifts. Require agreement in two textured bands,
>=90% matching visible pixels (84% for a reported popover), bounded image error,
and strict agreement near the seam. Full-resolution seam refinement establishes
integer pixel alignment. Blank/unrelated/reflowed overlaps fail conservatively.
Choose the accepted donor with greatest coverage, then closest time. These are
working choices for this bounded demo, not proof of historical hidden state.

Mask bounds were not persisted. Start from the uniform bottom canvas detection,
without the placeholder's padding, and allow at most 16 faded JPEG-boundary rows
within 25 RGB levels of the fill color. Strong content stops that extension.
Everything above the inferred boundary is preserved byte-for-byte before video
encoding, including the native tooltip. Copy only the donor strip that fits;
never stretch, generate pixels, or fill across an unobserved source extent. The
remaining region keeps the placeholder when it fits, otherwise the video/header
still explains partial reconstruction. Tiny JPEG clipping/lighting seams may
remain. Native/masked intervals remain holds, without synthetic gesture marks.

Every reconstructed interval labels donor snapshot number and relative time in
video; the private export note explicitly states that hidden state at that moment
is unknown. The existing website summary still describes movement generically;
reconstruction provenance is carried in the video itself. The private manifest records per-frame donor, elapsed/relative time,
rectangle, pixel shift and match scores. The small served report contains opt-in
status and counts, not a potentially oversized per-frame array. Original JPEGs,
receiver/native capture, keyboard exclusion and consent are unchanged. Without
`--reconstruct-keyboard`, rerendering restores the accepted placeholder-only view.


## Session page references and image diffs — Plan 027

The reference key is recording + page visit + layout revision + document extent,
viewport/font metrics and image dimensions. The first version supports the main
vertically scrolling document at scale 1; overlays, selection, horizontal overflow
and uncertain mapping retain raw viewport replay. No other recording supplies pixels.

`PageCanvas` stores sparse 256px PNG tiles with transparent unknown pixels and
immutable hash-named revisions. New/changed/cleared observations update only the
applicable historical state; JPEG noise up to eight channel levels may retain the
previous tile, while original screenshots remain authoritative. Provenance includes
source hash/time, mapped region and placement method. As-of views cannot introduce
later coverage; retrospective keyboard fill uses past observations first and later
pixels only for remaining holes, with time-range labeling and a manifest audit.
Unobserved areas use a checkerboard. Space beyond a measured page end is separate
from unknown page content. Legacy native footage instead uses bounded sequential
registration of several raw donors; native tooltip pixels remain unchanged.

Spatial coverage, temporal revisions and freshness are separate. Off-screen pixels
retain their last observation, not a guarantee of unchanged state. Complete spatial
coverage requires a measured extent, endpoint observations and full pixel coverage
of the supported document domain in one layout. The 12px right scrollbar gutter
is a separate viewport region, excluded from the reference domain/preview; full
original screenshots retain it. Legacy extent/endpoints remain unknown. Previews
are bounded; a tall reference can be retained even when its preview is truncated.

The optional `page-context-v1` capability is negotiated by the new
`screenshots-window-canvas-v1` approval, fixed per session in the existing approval
column. Strict `context.page` version 1 holds whitelisted web page/extent/layout/
layer/boundary numbers and the native renderer's actual valid/excluded pixel
rectangles. It is stored in existing MariaDB frame-context JSON; no schema change.
The viewport size/offset and actual document scroll origin remain distinct. Native
bounds describe the same top clip used before drawing, never a keyboard screenshot.
The separately controlled PAGE_CANVAS_ENABLED gate blocks new-mode starts/writes
while preserving Stop, readers and old clients.

Web layout identity combines document size, client width, computed font metrics
and up to 64 numeric main/card position/size anchors; no DOM text/HTML/form values
are read into metadata. Route visits, layout changes and incompatible rendering
create separate references. Full moving observations can be placed when strong
image overlap agrees with metadata within bounded uncertainty (up to 128 image
pixels); their actual aligned position is recorded. Without a reliable anchor,
unstable or mismatched scroll observations remain viewport-only. Registered
positions outside the measured page (including a one-pixel negative return near
the top) also remain viewport-only, rather than clamping or aborting the export. Keyboard-masked
moving frames and reported native popovers are not page-base donors. These are
client-reported geometry and experimental alignment, not device attestation.

A keyboard-transition follow-up admits a narrowly scoped lower tail when focus
styling spoils whole-image registration. After a keyboard observation in the same
page key within 10 seconds, a stable unmasked/nonpopover forward-scroll frame needs its
best shift within 6px of metadata, plus the existing 97% pixel/edge quality across
two 128px full-width textured bands separated by at least 256px. The overall fit
must still have 90% agreement, mean error below 6 and edge error below 25. This
exception copies only new pixels below the prior observed bounds, beginning in
the lower half of the donor. It never replaces already observed pixels or promotes
that full image to a new alignment anchor. The manifest records `image-anchors`,
band positions, source hash and the exact imported tail. Unverified holes remain
unknown; retrospective video fill retains its source-time labels. This is a
working choice for the owner-reported focus transition, not a relaxed general
scroll/moving/overlay matcher.

Plan 027 first delivery assembled/diffed completed recordings through the manual
replay operator command; Plan 028 below adds automatic completion jobs. The renderer keeps full viewport uploads and immutable originals. Tile
patches can increase total storage; patch-only uploads remain deferred. Use one
reduced-priority job, two encoding threads, existing timing/decoded-image bounds,
64 references/4,096 patch versions and 128 MiB of nested canvas derivatives,
including per-page previews. Fixed-name preview/manifest and hashed tiles count
toward capacity and retention; size limits fall back to observed viewport replay.
The small served report bounds gap detail; the private manifest keeps the full audit.

Authenticated admin review can select each generated page/layout preview, inspect
coverage/endpoints/capture-time range, then compare original screenshots and timed
MP4 replay. Page previews use fixed numeric routes; tile files stay private.
All outputs publish atomically with source-deletion/expiry rechecks. Existing
capture approval, lifecycle, native tooltip/keyboard exclusions and independent
Clarity/Phoenix gates remain. [Plan 027](plans/027-session-page-references-and-image-diffs.md)
owns acceptance, PROJECT_STATE the actual rollout/build/evidence, and LOCAL_SETUP
and TESTING the executable operator/verification commands.


## Automatic replay worker and 30 fps — Plan 028

The owner requires automatic generation after recording ends and 30 fps video.
Working choice: migration0015 adds a separate MariaDB `screenshot_replay_jobs`
table, one cascading row per recording. Final Stop inserts the job in the same
transaction as finalization, after upload drain; drain alone creates no job.
Empty/no-duration sources are ineligible. Duplicate finish preserves an existing
queued/ready/failed job. No historical backfill runs on deployment.

A separate `softek-replay-worker` service polls every 3 seconds, holds a connection-scoped
worker lock and launches the existing renderer from its immutable API release.
A bundled ESM renderer keeps production independent of the writable development
checkout/tsx. The renderer retains its separate manual/automatic render lock,
source-copy/publication lock and deletion/expiry recheck. The HTTP process does
not encode video. Ready publication precedes the durable ready status; a worker
restart can recognize completed 30 fps outputs before rerendering.

Interrupted rendering rows are recovered only while the worker owns its exclusive
lock. Attempts are bounded at 3, with 30-second/120-second retry delays; failed jobs require an
admin/CSRF-protected retry. On recovery the renderer may remove only the exact
session's `.replay-work`, under both existing locks, rejecting a non-directory.
Output publication remains atomic and original screenshots remain immutable.
Each renderer gets a 256 MiB JS heap, two encoder threads and the existing 15-minute
render deadline; the service has Nice 10, CPUQuota 150%, MemoryMax 1 GiB and 64 tasks.
A 16-minute parent deadline and shutdown terminate the child process group, with a
5-second force-kill fallback. Diagnostic logs expose only jobID and a whitelisted phase.

REPLAY_WORKER_ENABLED independently gates new enqueueing and worker processing.
Admin polling exposes safe queue status and automatically displays ready output;
errors preserve screenshots and offer retry after the bounded attempts. Generated
animation is 30 fps (renderer10); source timestamps and screenshot cadence do not
change. Static legacy recordings can render timed holds without inferred scroll.
Earlier accepted 24 fps exports are retained until an explicit rebuild. Schema 15
is additive; rollback disables/stops the worker while preserving readers/cleanup.
