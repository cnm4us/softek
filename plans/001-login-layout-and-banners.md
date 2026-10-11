# Plan 001 — Login, layout, and rotating banners

Plan ID: **001**. Milestone: **M1-R**. Depends on: [Plan 000](000-foundation-and-first-demo.md).
Lifecycle status and current task: [PROJECT_STATE.md](../PROJECT_STATE.md#plan-status-registry).

Owns M1-R01–07: users and sessions, persistent ownership, layout/navigation,
banner administration and rotation, interaction instrumentation, verification,
and collection-off deployment. [Plan 002](002-clarity-validation.md) owns live
Clarity acceptance. [Plan 003](003-automation-journeys.md) outlines later automation.

Product requirements were approved during discussion. Endpoint names, table
names and limits were working choices and are now implemented as documented in
ARCHITECTURE.md. Live capture acceptance is tracked in Plan 002. See the state registry for current implementation progress.

The revision supports the Clarity demonstration. Keep the existing enrollment,
goals, contribution transactions, adoption definitions, and report history.

### Requirements and working defaults

| Area | Approved requirement | Proposed implementation choice |
| --- | --- | --- |
| Entry | Logo/name above real login | Shared Harbor branding, then username/password form; adapt spacing to short screens and the mobile keyboard |
| Users | Admin creates users and resets passwords; no signup | Keep the existing separate admin login at `/controls`; no customer admin-role system |
| Persistence | Same accounts, enrollment, and goals after logout/login until reset | Separate permanent demo-user identity, expiring authentication sessions, and resettable banking runs |
| Home | Account Summary title, padded image banner, then current accounts/activity/goals | Preserve Everyday checking, Harbor savings, Harbor credit card, Recent activity, and Your goals |
| Navigation | Upper-right hamburger and banking placeholder pages | Same menu on mobile and desktop; accessible drawer/popover with native links |
| Banners | Admin uploads images and chooses internal destinations | Destination dropdown backed by a server-owned route registry; enable/disable and explicit ordering |
| Rotation | Advance on login and full Account Summary refresh; preserve on menu return | Server-owned per-user sequence plus an immutable selected presentation for each tab |
| Clarity | Find individual demo users and inspect their behavior | Stable pseudonymous user ID, copyable in admin; run/visit/page/banner context kept separate |
| Automation | Eventually assign user journeys, waits, clicks, and navigation | Prepare stable controls and a small pilot scenario format now; defer a scheduler and scenario-builder UI |

Defaults can be adjusted during implementation when evidence warrants it; record
changes in ARCHITECTURE.md. They do not reopen approved product decisions.

### Dependency order

1. M1-R01 establishes users, sessions, and retained-history boundaries.
2. M1-R02 implements login, admin user management, and ownership enforcement.
3. M1-R03 builds the shared section shell, menu, and destination routes.
4. M1-R04 adds persistent banner assets and admin management.
5. M1-R05 adds predictable rotation and Account Summary placement.
6. M1-R06 connects identities, banner interactions, and automation foundations.
7. M1-R07 verifies and deploys the application with collection off.
8. M2 verifies the actual Clarity project, enables a controlled pilot, and proves
   recordings/heatmaps. Project-setting review can proceed earlier, independently.

### M1-R01 — Additive database model and upgrade safety

- [x] Inspect current code, Git changes, the migration ledger, and the retained
  data before authoring SQL. Do not alter applied `0001_demo_foundation.sql`.
- [x] Draft `0002_demo_users.sql` for users, authenticated sessions, and ownership.
- [x] Draft `0003_demo_banners.sql` for creatives, presentations/rotation state,
  and interaction observations. Keep each migration small enough to recover.
- [x] Commit reviewed migration files before applying them, including to
  `demo_test`. Verify upgrades there before touching production.
- [x] Document MariaDB partial-DDL recovery and the application compatibility
  boundary. Production schema/data/ledger backup is required before this upgrade.

Proposed data model:

| Entity | Fields and purpose |
| --- | --- |
| `demo_users` | UUID, unique normalized username, fictional display label, versioned salted password hash, enabled flag, fixture profile and initial assignment settings, creation/update timestamps |
| User identity | Use an opaque user UUID as the stable Clarity lookup value; never a username or password-derived ID |
| `user_sessions` | Hashed opaque token, user FK, creation/expiry timestamps; revocation deletes the session; fixed 24-hour expiry |
| `participant_runs.user_id` | Nullable user FK; historical anonymous runs stay null and retain all owned rows/events |
| `user_current_runs` | Unique user-to-current-run mapping; ensure the mapped run belongs to that user, with transactional user locking |
| `banner_assets` | Immutable public asset key, format, dimensions, bytes, creation timestamp; no original upload filename in the public path |
| `demo_banners` | Stable public creative ID, asset FK, admin title, accessible link text/alt text, destination key, enabled flag, integer sort order; optional explicit association to the existing savings campaign |
| `banner_rotation` | Per-user cursor/last-selected banner, updated under a user lock; independent of banking reset |
| `banner_presentations` | Immutable selection ID, user/run/visit context, banner/asset/destination snapshot, selection reason and timestamp |
| `interaction_events` | Allowlisted observations, page/selection reference, run/visit context, timestamp, and unique retry/deduplication key |

Avoid circular foreign keys: create users, then add run ownership, then create
the current-run mapping. Enforce ownership in both SQL queries and transaction
logic; a UUID supplied by the browser does not grant access.

The existing run stores both banking state and the old anonymous token/expiry.
Keep those columns compatible initially, but stop using them to authenticate
user-owned runs. Their old 30-day expiry must not discard or block a returning
user's banking state. Only explicit reset/reconfiguration retires that state.

Historical runs stay queryable in reports; do not guess which new user owns an
old browser cookie. Public anonymous entry will be retired in M1-R02.

**Acceptance:** migrations upgrade the existing test schema without losing runs,
events, goals, or receipts; repeat application is a no-op; constraints reject
duplicate usernames and invalid references; no checksum drift exists. Evidence
must distinguish schema validation from the existing migration-runner tests.

### M1-R02 — Authentication, persistent ownership, and admin users

- [x] Replace profile selection with username/password login and protected-route
  loading/error states. Keep admin controls accessible independently.
- [x] Hash passwords using a versioned salted password KDF; proposed choice is
  asynchronous Node scrypt with parameters verified for the installed runtime.
  Never store/recover plaintext passwords. Use bounded password lengths without
  elaborate composition rules.
- [x] Apply username normalization consistently on create and login. Proposed
  usernames are case-insensitive ASCII letters, digits, dots, underscores, and
  hyphens, 3–40 characters; display labels remain separate.
- [x] Retain HTTPS cookie protections, exact-origin checks, CSRF for mutations,
  parameterized queries, and bounded login retries. Return a generic invalid-login
  message and avoid account discovery through distinct error text.
- [x] Issue a new opaque cookie after successful authentication; store only its
  hash. Logout revokes that session and clears client banking/banner state.
- [x] On first login, transactionally create a fixture-backed run. On later
  login, resolve the same current run and resume it. Two concurrent first logins
  must not create competing current runs.
- [x] Start a new demo visit on explicit login, even in the same browser; ordinary
  refresh/navigation keeps the visit unless the existing inactivity rule renews
  it. This permits a genuine later-login repeat-use journey.
- [x] Audit every state, enrollment, goal, contribution, event, reset, and admin
  restart route to resolve the authenticated user's current run server-side.
- [x] Reject legacy anonymous cookies and disable public `/api/entry`. Test and
  smoke scripts must switch to authenticated fixture users.
- [x] Make explicit reset retire the old run and create a clean current run,
  retaining the same user ID, eligibility/variant, and historical report data.
  Session expiry and password reset must never reset banking data.
- [x] Extend `/controls` with Users: list, create, enable/disable, set a replacement
  password, select fixture/initial assignment, inspect current-run status, and
  copy the Clarity lookup ID.
- [x] Password reset or disabling a user revokes all that user's login sessions.
  A disabled user cannot log in. Clear password fields after submission.
- [x] Changing the fixture, eligibility, or variant for an existing user must
  explicitly create a new run, preserving previous assignments and history.
  Existing admin restart must target a selected user, not mint anonymous access.
- [x] Keep administrative sessions separate. Do not log an administrator into a
  selected customer's account as a side effect of user management.

Implemented API contract:

| Route | Behavior |
| --- | --- |
| `POST /api/auth/login` | Validate credentials, establish session/visit, resolve current run, select login banner, return bootstrap context |
| `POST /api/auth/logout` | Revoke current user session; preserve banking state |
| `GET /api/state` | Authenticated current state, safe identity context, CSRF token |
| `POST /api/reset` | Authenticated explicit reset, with CSRF and retained history |
| `GET /api/admin/users` | Protected user list and copyable pseudonymous IDs |
| `POST /api/admin/users` | Protected creation; fixture-backed state is initialized on first login |
| `POST /api/admin/users/:id/password` | Replace password and revoke sessions |
| `POST /api/admin/users/:id/status` | Enable/disable user; revoke on disable |
| `POST /api/admin/users/:id/reset` | Explicit selected-user reset/reconfiguration |

**Acceptance:** users A and B retain different mutable state; relogin and expired
sessions preserve state; A cannot submit B's IDs; logout/reset/disable revoke
the intended access; admin APIs reject ordinary customer credentials. No signup,
email delivery, MFA, or password-recovery service is required.

### M1-R03 — Uniform login, section header, and hamburger navigation

- [x] Reuse existing theme tokens, logo, buttons, fields, cards, and focus styles.
  Put branding in the upper part of login and the form below; allow the page to
  shrink/scroll naturally rather than locking it to screen-height fractions.
- [x] Introduce a shared authenticated shell: section title left, hamburger
  right, main content below. Account Summary is the home title.
- [x] Replace horizontally scrolling primary navigation on all authenticated
  banking screens. Keep the upper-right menu on desktop too.
- [x] Implement a labeled menu button with expanded state, focus management,
  Escape/outside-close handling, focus return, and close-on-selection. If it is
  a modal drawer, contain keyboard focus while open.
- [x] Use actual links and buttons, visible keyboard focus, comfortable touch
  targets, route-specific document titles, and sensible focus on route changes.
- [x] Add the following initial destination registry and themed pages:

| Menu label | Proposed route | Initial behavior |
| --- | --- | --- |
| Account Summary | `/` | Existing balances, recent activity, goals, image banner |
| Transfers | `/transfers` | Placeholder with clearly simulated action |
| Bill Pay | `/bill-pay` | Placeholder with clearly simulated action |
| Cards | `/cards` | Placeholder with clearly simulated action |
| Savings Goals | `/goals` | Existing functional service; retain details/enrollment routes |
| Statements | `/statements` | Placeholder with clearly simulated action |
| Support | `/support` | Placeholder with clearly simulated action |
| Sign out | Action | Revoke session and show branded login |

Each placeholder has a short description, one named demo action, a visible
confirmation, and an easy route back through the menu. It does not pretend to
execute a real transfer, payment, or card action. The interaction is observable
for automation without being counted as enrollment or service adoption.

**Acceptance:** unauthenticated deep links lead to login; after login the home is
Account Summary. Menu and placeholders work at 360/390px and desktop, with no
horizontal page scrolling and no hover dependency. Existing service forms remain
usable with the mobile keyboard and preserve values on validation errors.

### M1-R04 — Banner uploads, configuration, and persistent assets

- [x] Add a Banners area in protected controls: upload, preview, accessible text,
  internal destination dropdown, order, enable/disable, and replacement upload.
- [x] Support JPEG, PNG, and WebP initially. Proposed limits: 5 MiB upload,
  4096×4096 maximum dimensions and a bounded decoded pixel count. Validate actual
  decoded content, re-encode a safe raster output, remove metadata, and generate
  filenames; verify any selected imaging dependency before installation.
- [x] Do not accept arbitrary HTML/SVG, remote image URLs, filesystem paths,
  protocol-relative links, or arbitrary destination URLs. Validate destination
  keys against the same registry used by navigation.
- [x] Document a recommended 3:1 creative ratio, such as 1200×400, with important
  content inside the image margins. Preview scaling without unexpectedly cutting
  off CTA text; provide accessible link text independently of embedded artwork.
- [x] Provide at least two safe starter creatives/fixtures so cycling can be
  demonstrated immediately. Seeds update fixture definitions without replacing
  uploaded banners, user configuration, or participant state.
- [x] Store generated images outside application release directories. Proposed
  production path: `/var/lib/softek/banner-assets`; separate temporary/test paths.
- [x] Adjust the systemd writable-path allowance for this asset directory only.
  Keep code, runtime credentials, and unrelated system paths protected.
- [x] Serve only published fictional banner assets publicly at
  `/media/banners/<generated-key>`, with correct content type and no listing.
  Assets must be available without a banking login for replay rendering.
- [x] Raise Nginx's existing 32 KiB body limit only for the upload endpoint, with
  multipart overhead allowed. Add route-specific multipart parsing rather than
  increasing the global 16 KiB JSON parser.
- [x] Enforce admin session, exact origin, and CSRF on upload. The current CSRF
  helper assumes JSON; add a deliberate multipart path retaining the same checks.
- [x] Write/validate temporary files, publish atomically, then commit the database
  reference; remove files created by a failed request. Never expose partial files.
- [x] Replacements create a new asset/creative revision rather than overwriting
  an old URL. Retain old assets and selection snapshots for recordings/history;
  disable instead of physically deleting referenced creatives.
- [x] Give zero enabled banners a clean no-banner state. A missing/failed asset
  must not prevent account access or create a visibility event.

**Acceptance:** valid uploads survive restart, deployment, and application
rollback; invalid/oversized/fake-format uploads are rejected without orphaned
public content; external destinations cannot be stored; historic asset URLs
remain readable. Admin preview matches the customer mobile/desktop treatment.

### M1-R05 — Rotation and Account Summary composition

- [x] Place the section title and menu first, then one linked banner image with
  space on every side, then the existing checking, savings, credit, activity, and
  goals content. Proposed spacing: 16px mobile, increasing with shared tokens.
- [x] Replace the existing primary textual hero promotion with the image slot;
  preserve the working savings details/enrollment journey and existing secondary
  promotion until a separate change is warranted.
- [x] Sort enabled banners by explicit order and stable ID as a tiebreaker.
  For a new user choose the first banner; subsequent advances choose the next,
  wrapping after the last. One enabled banner stays the same.
- [x] Select exactly once for a successful explicit login. Failed login,
  session restoration, state fetches, enrollment/goal mutations, or server retries
  do not advance the cursor.
- [x] Select again for a full browser document load whose initial authenticated
  route is Account Summary. Reloading another banking section does not advance.
- [x] Keep the current tab's selection when returning by menu, back/forward, or
  ordinary SPA navigation. Restoring a page from browser history does not count
  as a new full document load.
- [x] Give each true document initialization a request UUID. Repeated initialization
  and network retries return the existing presentation, even under duplicate
  component mounts. Use CSRF-protected POST for selection; GET state stays read-only
  with respect to banner rotation.
- [x] Login returns its selected presentation to the SPA. Its immediate move to
  Account Summary consumes that selection without a second refresh advance.
- [x] Advance the cursor and create the presentation atomically under a user lock.
  Tabs share sequence order but keep their own selected presentation; another
  tab's refresh does not silently replace an already displayed banner.
- [x] Keep the rotation cursor across logout and banking reset. Configuration
  changes use the next enabled ordered banner; disabled/replaced selections are
  invalidated once, with a recorded fallback reason. Invalid query parameters
  never choose an arbitrary banner or advance the sequence.
- [x] Use the server-approved selection for navigation and click attribution.
  Snapshot the displayed asset/destination so an admin edit cannot misattribute
  a previous impression.

Proposed endpoints: `POST /api/banners/select` for an explicit refresh selection,
`GET /api/banners/current` to restore an existing presentation, and protected
`GET/POST /api/admin/banners` plus named update/upload routes.

**Acceptance sequence with A/B/C:** user 1 logs in → A; visits Bill Pay and
returns → A; refreshes Account Summary → B; background state refetch → B;
logs out/in → C. User 2's first login → A. Duplicate refresh requests advance
once. Verify wraparound, zero/one banner, edits, missing assets, and two tabs.

### M1-R06 — User identity, interaction evidence, and automation foundations

- [x] Replace the current Clarity custom user ID (`runId`) with the stable
  pseudonymous demo-user ID. Use visit ID as custom session context and an
  allowlisted route key as custom page context; keep run ID separately tagged.
  Reapply context on authenticated route changes.
- [x] Show a Copy Clarity ID action in protected Users controls. Exact real
  dashboard lookup is a separate Plan 002 / M2-04 acceptance check.
- [x] Keep run-level adoption reports comparable. A returning user is still the
  same run until reset; reset creates another report cohort under the same user.
  Never label counts of runs as counts of unique users.
- [x] Add observations for banner visibility/click, page view, menu open/selection,
  and placeholder action. Existing banking success events remain server-confirmed.
- [x] Attribute every banner event to the selected presentation, creative, route,
  run, visit, and server-derived actor. Validate that the presentation belongs
  to the current user and run.
- [x] Reuse the 50%-visible-for-one-continuous-second rule, starting only after
  the image loads while the document is visible. Deduplicate exposure per page
  presentation. A rendered or selected banner is not automatically an impression.
- [x] Keep per-presentation interaction counts separate from distinct-run adoption
  milestones. Forward a banner to the savings funnel only when it is explicitly
  associated with that campaign; generic banking banners must not inflate it.
- [x] Preserve milestone deduplication while retaining repeated page/banner
  observations. Record a real click before navigation with a retry-safe observation
  ID; navigation must still work if analytics delivery fails.
- [x] Expose bounded Clarity event/tag allowlists: institution, service/campaign
  where relevant, variant, actor, run, current route, and current public banner ID.
  No usernames, credentials, amounts, goal text, or user IDs in URLs.
- [ ] Evaluate `/?banner=<public-creative-id>` for exact per-creative heatmaps.
  Deferred to Plan 002 / M2-04 until real URL filters/screenshots can be verified;
  no query parameter has been adopted. It must never drive selection.
- [x] Make account switching explicit: clear user-specific frontend caches and
  pending observation queues, use a full-document login/logout boundary where
  needed, and reserve consent/session lifecycle verification against Clarity for M2.
  Recalling Identify alone is not proof that recordings split between users.
- [x] Keep login/admin/banking private content masked and marketing/navigation
  visible. Avoid loading the tracker on admin screens; close any existing capture
  before entering controls. Actual playback verification remains Plan 002 / M2-04.
- [x] Add stable accessible control names and necessary test hooks for login,
  banner, menu sections, placeholder actions, and goals.
- [x] Reserve a small harness scenario format: assigned demo user, viewport,
  wait durations, banner click/skip, destination/action click/skip, menu navigation.
  Use isolated browser contexts and private environment credentials.
- [x] Require trusted harness labeling and dedicated automation users/runs. Preserve
  the existing immutable run actor; reject a human/automation mode mismatch or
  explicitly start a new configured run rather than relabel historical traffic.
  Never expose `AUTOMATION_SECRET` in the frontend.
- [x] Keep routine tests collection-off. The Clarity pilot is a separate deliberate
  execution with labeled synthetic activity and recorded project settings.

Clarity supports custom user/session/page identifiers and user-ID lookup through
its [Identify API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/identify-api).
Its [heatmap URL parameter controls](https://learn.microsoft.com/en-us/clarity/heatmaps/heatmaps-overview)
can distinguish exact public creative URLs; verify the proposed SPA behavior in
the actual project before accepting it.

**Application acceptance:** the admin lookup ID stays stable across login/reset;
banner observations agree with server selections; simulated actions never become
confirmed banking success events. Plan 002 / M2-04 owns actual ID lookup, returning
user and shared-browser distinction, masking and replay. Unit/API evidence does
not substitute for those real Clarity checks.

### M1-R07 — Regression checks, release, and operational handoff

- [x] Extend API checks for credential handling, sessions, ownership, reset,
  retained history, admin operations, banner validation, rotation concurrency,
  and forged observation rejection.
- [x] Update browser journeys and public smoke to use admin-created test users.
  Production smoke uses dedicated automation accounts and preserves history.
  Test cleanup removes only test-owned users/assets/runs and never real demo data.
- [x] Exercise login, menu, banner display, click/skip journeys, placeholder actions,
  functional savings flow, relogin persistence, and reset at existing 360/390/1440px
  viewports. Include keyboard operation, short viewport, and error/loading states.
- [x] Run the existing typecheck/build/API/browser/format checks once after the
  relevant implementation is complete; rerun affected checks after later changes.
- [x] Record actual results in TESTING.MD and PROJECT_STATE.md. Check private
  credentials are absent from Git diffs, public bundles, and request/log outputs.
- [x] Back up production schema/data/ledger and record current app/static release,
  dedicated Nginx config, collection settings, and assets before the upgrade.
- [x] Apply committed migrations explicitly; deployment must never migrate on
  application startup. Verify ledger status before deploying built releases.
- [x] Extend deployment to provision persistent asset paths and the constrained
  service write allowance without changing unrelated Nginx sites.
- [x] Deploy the revision with Clarity off, verify API/HTTPS/session behavior,
  asset serving and persistence, then inspect mobile/desktop screenshots.
- [x] Document rollback: schema is additive but old anonymous-entry releases do
  not meet the new login boundary. For the first auth release, use a scoped
  maintenance fallback if no compatible authenticated release exists. Subsequent
  rollback targets a compatible authenticated release; retain assets and history.
- [x] Update ARCHITECTURE.md for implemented decisions, LOCAL_SETUP.md for admin
  creation/uploads/backups/rollback, TESTING.MD for coverage, and PROJECT_STATE.md
  with release IDs, migration versions, evidence, failures, and next task.

**Exit criteria:** the public revision meets the agreed layout, authentication,
persistence, internal-link, and deterministic rotation rules. Historical data
survives; unrelated host services remain unchanged. Live Clarity acceptance
belongs to M2 and is not claimed merely because application tests pass.

### Release evidence and remaining boundary

Migrations 0002/0003 were committed before application, upgraded both retained
schemas to version 3 without checksum drift, and preserved the ten production
pre-upgrade runs. API/migration checks: 31 TAP entries; browser checks: 24 journeys
at 360/390/1440px; production HTTPS smoke: 360/1440px. Actual production uploads
survive service restart and deployment; immutable historical image URLs work.
Typecheck/build/format checks pass. See PROJECT_STATE.md for release and backups.

The unchecked heatmap URL evaluation and all actual recording/masking/account
switching lookup checks are explicitly owned by Plan 002. Plan 001 completion
means the deployed application acceptance above, with collection off.
