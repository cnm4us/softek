# Plan 002 — Clarity validation and presentation readiness

Plan ID: **002**. Milestone: **M2**.
Lifecycle status: [PROJECT_STATE.md](../PROJECT_STATE.md#plan-status-registry).

Depends on [Plan 001](001-login-layout-and-banners.md) for authenticated users,
creative rotation, and interaction context, and [Plan 004](004-admin-and-customer-menus.md)
for the final Admin/Customer menu surfaces. M2-01 project/access/settings review
can proceed independently. Plans 004/005 implement the final menus, twelve feature
landing pages and separate feature engagement observations. Capture acceptance
uses those verified surfaces; preserve existing settings/hosting evidence.
M2-02/03 retain their existing completed hosting evidence.

Owns actual project verification, human recordings/heatmaps, a small controlled
synthetic pilot, and the presentation runbook. Full automation scheduling and a
scenario-builder UI remain [Plan 003](003-automation-journeys.md) scope.

### M2-01 — Verify project settings and access

- [x] Record owner-reported settings for project `yvs5hp3ivb` on
  `demo.bawebtech.com`: Balanced masking, cookies on, bot detection on, and cookie
  consent required (2026-10-11 UTC). Owner authorized collection and the admin switch in the current phase.
  The owner subsequently reported switching Bot Detection Off on 2026-10-12 UTC;
  no independent dashboard inspection or new capture was performed for this change.
  Real capture/consent/masking behavior still requires M2-04 verification.
- Chris invitation/access is deferred by the owner: evaluation is owner-only until
  the demo is ready. Team access is separate from banking login; no Microsoft
  password or manual-install snippet is needed.
- [x] Preserve explicit visitor opt-in and ConsentV2: analytics storage follows
  the choice; advertising storage remains denied. Decline/withdrawal checked with the stub; actual SDK pilot evidence below.
- [x] Review all new DOM masks before a pilot. Confirm public banner/CSS access.
- [x] Identify the actual script/collection domains needed for a narrow CSP
  allowance using official guidance and observed pilot network requests.
- [x] Update the deployment script's current unconditional collection-off behavior
  to support an explicit verified evaluation mode, still defaulting off.
  Ensure the build-time frontend flag and runtime backend configuration agree.
  A normal deploy or test command must not accidentally start collection.

References: [ConsentV2](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2),
[masking](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking),
and [team access](https://learn.microsoft.com/en-us/clarity/setup-and-installation/team-management).

### M2-C01–05 — Owner-authorized admin collection control

- [x] C01: add protected Admin Menu → Clarity Settings, readiness/status/project,
  persistent global on/off, revision conflict handling and retry-safe writes.
- [x] C02: commit/apply migration 0005 after scoped production backup; verify
  both ledgers, retained data and repeat no-op.
- [x] C03: bind consent to user/revision; stop and replace captured documents on
  withdrawal/admin entry/expiry and observed disabling. Poll without rotation.
  Preserve opt-in, ad-storage denial and exclusion of routine automated users.
- [x] C04: explicit matching build/deploy profiles and narrow site-only CSP;
  normal commands remain collection-off and mismatches fail before host changes.
- [x] C05: complete API/privacy/banking/public checks, real SDK transport pilot,
  deployment, documentation and owner-ready collection control. Dashboard
  recording/heatmap acceptance remains separately unchecked below.

### M2-C06 — Initial consent modal

- [x] Replace the initial bottom prompt with a themed, responsive modal overlay;
  keep explicit allow/decline, focus containment, Escape-as-decline, scroll lock
  and later consent management. Verify privacy journeys at mobile/desktop widths,
  short viewports, deploy and update the handoff. No schema change.

### Existing completed hosting work

- [x] M2-02 Inspect the existing Nginx configuration and establish the
  exposure/deployment scope.
- [x] M2-03 Implement the dedicated service, HTTPS proxy/SPA routing, reproducible
  migration/build/deploy runbook, rollback, and public browser smoke checks.

### M2-04 — Human walkthrough and real recording acceptance

- [x] After settings verification and within authorized collection scope, enable
  the evaluation configuration and allowlisted CSP on this site.
- [ ] Log in with a pilot user, grant opt-in, view/click a banner, inspect a linked
  page, use its action, open the menu, return to Account Summary, refresh to the
  next creative, use savings goals, and sign out.
- [ ] Repeat with a no-click journey and a second user in the same browser.
  Exercise a later login and explicit reset under the original user's stable ID.
- [ ] Confirm collection requests and then actual recordings in the project.
  Find each user using the ID copied from admin, verify account switching,
  route/menu/submenu replay, feature view/CTA context, image/CSS rendering, and
  masking of private content. Feature CTA engagement must remain distinct from
  Savings Goals enrollment/first/repeat use.
- [ ] Compare banner-specific heatmaps and screenshots using creative tags and,
  if adopted, exact public URL parameters. Record whether historical creatives,
  expanded menus, and mobile/desktop layouts render correctly.
- [ ] Record real observations and any collection/processing delay. If capture,
  masking, or attribution fails, fix it and repeat the affected pilot before
  claiming presentation readiness.

Acceptance requires both working software and observable data in the actual
Clarity account. If project access is unavailable, application implementation can
continue but the real-recording checks remain incomplete.

### M2-05 — Controlled synthetic pilot

- [x] Implement/run the small harness against dedicated automation users: banner
  click versus skip, action versus skip, explicit waits, and menu returns.
- [ ] Start with a small number of journeys; verify actual recordings before
  expanding traffic. Keep timestamps/user IDs/scenario labels for lookup.
- [x] Review bot detection with the project owner. Clarity excludes detected bot
  traffic from analytics by default and provides an advanced-setting toggle.
  The owner chose Off and reported changing it on 2026-10-12 UTC. Keep synthetic
  data labeled; any subsequent setting change requires owner direction.
- [ ] Record the difference between harness success, database observations, and
  what Clarity actually captured. Do not promise every synthetic run is recorded.

Reference: [installation verification and bot detection](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-setup).

Transport evidence: `npm run clarity:pilot -- --collect` passed two labeled
click/skip journeys at 360px on 2026-10-11 UTC; ten `/collect` responses acknowledged.
Decline made no vendor requests; withdrawal removed cookies and stopped traffic;
admin made no requests. UUID/run/visit/time lookup is in ignored 0600
`artifacts/clarity-pilot.json`. Bot detection was On for that pilot (now owner-reported Off).
Recordings/heatmaps and
actual masking replay remain unchecked; transport is not dashboard acceptance.

Owner-authorized follow-up on **2026-10-12 14:30:12–14:32:09 UTC**:
`npm run clarity:pilot -- --collect --device=desktop --browser=chrome` passed two
longer Chromium click/skip journeys with scrolling and explicit reading pauses.
Clarity acknowledged **19 uploads** (10 click / 9 skip). Decline/withdrawal/admin
exclusion and browser/CSP checks passed. Independent local history confirmed one
EasyCoin view per user and CTA counts **1 / 0**. The runner now sets custom tags
`pilot_run` and `pilot_scenario`; lookup tag and customer UUIDs are recorded in
[PROJECT_STATE.md](../PROJECT_STATE.md#october-12-authorized-playwright-capture-pilot)
and ignored 0600 `artifacts/clarity-pilot.json`. Bot Detection is owner-reported Off.
The agent's project browser requires Microsoft sign-in; owner dashboard inspection
is requested. Actual recordings, classification, masking and heatmaps remain
unchecked. No larger suite or traffic expansion was executed.

After the owner found neither original recording, one additional diagnostic user
was exercised at **14:46 UTC**. Six HTTP 204 uploads matched the project, with
playback events, hashed custom identity and the lookup tag verified in memory.
SDK metadata reports playback enabled and analytics consent granted. The owner
confirmed the diagnostic **appears in Clarity's live-users view** (native user ID
`owexj9`, session `114qxaa`). Replay, completed recordings, masks and heatmaps
remain unverified; owner playback inspection is requested. See the current state
for the ignored diagnostic evidence and exact next check. The owner's own and
ten batch-created customers were not used/reset.

Owner replay feedback confirms screen changes, clicks and EasyCoin CTA
confirmation, but no visible scrolling. A collection-free geometry check confirms
both pages can scroll. One focused capture on a fourth owned pilot customer at
**07:56–07:58 PDT** verified six actual document scroll movements and **eight
Scroll events in eleven acknowledged HTTP 204 payloads**, plus playback/identity
tags. Native Clarity user ID `91iamz`, session `1oi305m`; ignored 0600 evidence is
`artifacts/clarity-scroll-diagnostic.json`. Owner visual scroll replay and completed
recording availability remain pending. Do not infer full replay/masking/heatmap
acceptance from live CTA playback or transport counts.

Owner confirms the focused session is visible but still sees no scrolling.
Visual scroll acceptance remains unresolved. Next inspect full completed playback
(Normal speed, Skip inactivity off) and More details → Events → Scroll; first
confirm the owner is not watching Highlights or joining Go Live after the scroll.
The owner now confirms **full recording from the beginning**; next check whether
Scroll entries appear under More details → Events. Speed/Skip inactivity settings
have not been independently verified.
Additional capture sessions require owner direction; do not mark replay acceptance
on count-only transport evidence. Previous raw payloads were discarded; manifests retain only
safe metadata/counts and actual measured document offsets.

The owner subsequently reports **scrolling visible in mobile view**, adding
visual scroll confirmation to page changes/clicks/CTA replay. The earlier desktop
display discrepancy is unresolved; the exact player control/session was not
independently inspected. All four captures used Desktop Chrome, so this report
does not establish mobile-profile capture or browser/device classification.
Next confirm completed recording/custom-tag lookup and review masking/heatmaps;
broader automation remains deferred until separately authorized.

Owner explicitly requested a further **menu-only visit to all twelve features**
on October 12 evening (October 13 UTC). One new customer completed the journey:
normal login, Allow analytics, each Explore Features link once with 12-second
pauses, ordinary sign-out, and no CTA clicks. Protected local history confirms
**12 views, one per feature, and zero CTAs**; Clarity acknowledged **26 uploads**.
Owner observed all twelve pages in playback. Native user `1sblz1g`, session
`1q6lmba`; exact times, tags and private evidence are in
[PROJECT_STATE.md](../PROJECT_STATE.md#october-12-evening--authorized-feature-menu-capture).
Owner subsequently confirms all feature pages appear in Dashboard, but this test
is missing from All Recordings even after clearing filters and selecting Last 7
days; manual recordings are visible. The subsequently owner-authorized headed
comparison completed at 21:11–21:14 PDT: exactly 12 views, zero CTAs and 26 uploads.
Owner reports Clarity browser label Chrome for user `1mwvoop`, session `qlil7v`.
Host-local command, times, tags and private evidence are recorded in
[PROJECT_STATE.md](../PROJECT_STATE.md#october-12-night--authorized-headed-feature-menu-comparison).
Owner now reports the headed recording is also missing. Both runs already sent
custom tags using `clarity('set', ...)`, verified in acknowledged payloads; the
suggested `test_run` alias does not establish a fix or bot-filter exemption.
Next inspect session/consent shutdown and assemble support evidence; no additional
capture or support contact was performed for this follow-up.
Keep automated recording availability unresolved; current evidence
does not prove bot filtering or a headless-specific cause.
Completed-recording lookup, masking and heatmaps remain separate unchecked
acceptance criteria. No broader automation implementation was authorized.

### M2-06 — Repeatable demonstration and findings

- [x] Write a short presentation runbook covering user creation, copied Clarity
  ID, banner setup, deterministic rotation, click/skip cases, and explicit reset.
- [ ] Document how Chris filters recordings and heatmaps and how to distinguish
  users, banking runs, visits, creatives, and human/automated activity.
- [ ] Record masking/consent/bot settings, observed limitations, and repeatable
  lookup examples without including credentials or sensitive screenshots.
- [x] Leave a fresh-agent handoff with checked task IDs, outstanding acceptance,
  exact current configuration, and the next executable task.

**Exit criteria:** The owner can exercise assigned users and inspect distinguishable
recordings and relevant heatmaps in the real project before involving Chris.
Reset/relogin/rotation are repeatable. Findings distinguish observed behavior from adoption claims.

## Owner's first recording walkthrough

1. Open Admin Menu → Clarity Settings and confirm Collection On. Create/select a
   **Human** customer in Manage Customers and copy its Clarity lookup UUID.
2. Sign into that customer on the customer site; choose Allow analytics. Pause on
   Summary, click the banner, open the menu and Explore Features, view a landing
   page and its CTA, then return to Summary and refresh to advance the creative.
3. Optionally exercise Savings Goals enrollment/goal/contribution separately.
   Pause between actions. Repeat a skip case; sign out and try another customer.
4. Open Microsoft Clarity project `yvs5hp3ivb`, filter recordings by the copied
   custom user ID and test time. Check masked banking/form text, readable public
   copy/artwork, routes/menu playback and feature/adoption event distinction.
5. Compare database Adoption Report and Feature Activity using the same actor,
   variant and UTC window. Clarity starts after opt-in, can filter bots, and has
   its own session definition; exact totals need not match. Session custom tags
   retain earlier values, so use the timeline to attribute a specific page entry.
6. Review banner/layout heatmaps and screenshot selection; record any delay or
   mixed-creative limitation. Turning collection Off stops open foreground pages
   on their next settings check; On requires a new customer opt-in. Chris's access
   is added later when the owner is ready.
