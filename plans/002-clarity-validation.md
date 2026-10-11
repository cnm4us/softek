# Plan 002 — Clarity validation and presentation readiness

Plan ID: **002**. Milestone: **M2**.
Lifecycle status: [PROJECT_STATE.md](../PROJECT_STATE.md#plan-status-registry).

Depends on [Plan 001](001-login-layout-and-banners.md) for authenticated users,
creative rotation, and interaction context. M2-01 project/access/settings review
can proceed independently; final capture acceptance follows Plan 001's deployment.
M2-02/03 retain their existing completed hosting evidence.

Owns actual project verification, human recordings/heatmaps, a small controlled
synthetic pilot, and the presentation runbook. Full automation scheduling and a
scenario-builder UI remain [Plan 003](003-automation-journeys.md) scope.

### M2-01 — Verify project settings and access

- [x] Record owner-reported settings for project `yvs5hp3ivb` on
  `demo.bawebtech.com`: Balanced masking, cookies on, bot detection on, and cookie
  consent required (2026-10-11 UTC). Collection remains off in the application.
  Real capture/consent/masking behavior still requires M2-04 verification.
- [ ] Owner invites Chris through Settings → Team as a Member and verifies he
  can access recordings/heatmaps. This is separate from his banking demo login.
  No Microsoft password or manual-install snippet is needed.
- [ ] Preserve explicit visitor opt-in and ConsentV2: analytics storage follows
  the choice; advertising storage remains denied. Check decline and withdrawal.
- [ ] Review all new DOM masks before a pilot. Confirm public banner/CSS access.
- [ ] Identify the actual script/collection domains needed for a narrow CSP
  allowance using official guidance and observed pilot network requests.
- [ ] Update the deployment script's current unconditional collection-off behavior
  to support an explicit verified evaluation mode, still defaulting off.
  Ensure the build-time frontend flag and runtime backend configuration agree.
  A normal deploy or test command must not accidentally start collection.

References: [ConsentV2](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2),
[masking](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking),
and [team access](https://learn.microsoft.com/en-us/clarity/setup-and-installation/team-management).

### Existing completed hosting work

- [x] M2-02 Inspect the existing Nginx configuration and establish the
  exposure/deployment scope.
- [x] M2-03 Implement the dedicated service, HTTPS proxy/SPA routing, reproducible
  migration/build/deploy runbook, rollback, and public browser smoke checks.

### M2-04 — Human walkthrough and real recording acceptance

- [ ] After settings verification and within authorized collection scope, enable
  the evaluation configuration and allowlisted CSP on this site.
- [ ] Log in with a pilot user, grant opt-in, view/click a banner, inspect a linked
  page, use its action, open the menu, return to Account Summary, refresh to the
  next creative, use savings goals, and sign out.
- [ ] Repeat with a no-click journey and a second user in the same browser.
  Exercise a later login and explicit reset under the original user's stable ID.
- [ ] Confirm collection requests and then actual recordings in the project.
  Find each user using the ID copied from admin, verify account switching,
  route/menu replay, image/CSS rendering, and masking of private content.
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

- [ ] Implement/run the small harness against dedicated automation users: banner
  click versus skip, action versus skip, explicit waits, and menu returns.
- [ ] Start with a small number of journeys; verify actual recordings before
  expanding traffic. Keep timestamps/user IDs/scenario labels for lookup.
- [ ] Review bot detection with the project owner. Clarity excludes detected bot
  traffic from analytics by default and provides an advanced-setting toggle.
  If adjusted for the pilot, document the change, label synthetic data, and
  restore the agreed project setting afterward.
- [ ] Record the difference between harness success, database observations, and
  what Clarity actually captured. Do not promise every synthetic run is recorded.

Reference: [installation verification and bot detection](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-setup).

### M2-06 — Repeatable demonstration and findings

- [ ] Write a short presentation runbook covering user creation, copied Clarity
  ID, banner setup, deterministic rotation, click/skip cases, and explicit reset.
- [ ] Document how Chris filters recordings and heatmaps and how to distinguish
  users, banking runs, visits, creatives, and human/automated activity.
- [ ] Record masking/consent/bot settings, observed limitations, and repeatable
  lookup examples without including credentials or sensitive screenshots.
- [ ] Leave a fresh-agent handoff with checked task IDs, outstanding acceptance,
  exact current configuration, and the next executable task.

**Exit criteria:** Chris can exercise assigned users and inspect distinguishable
recordings and relevant heatmaps in the real project. Reset/relogin/rotation are
repeatable. Findings distinguish observed behavior from adoption claims.
