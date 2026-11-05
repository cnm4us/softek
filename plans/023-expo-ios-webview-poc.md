# 023 — Expo iOS WebView POC

Lifecycle/evidence: [PROJECT_STATE](../PROJECT_STATE.md#plan-status-registry).
Product scope: [PRODUCT](../PRODUCT.md#ios-poc--plan-023).
Design rationale: [ARCHITECTURE](../ARCHITECTURE.md#ios-shell--plan-023).

The owner authorized implementation after reviewing this plan. Current build,
signing and device evidence is in PROJECT_STATE. The unchecked tasks below remain
incomplete; local validation alone does not establish installed-device acceptance.

## Outcome and boundaries

Deliver a separately installable iOS app that opens the existing fictional banking
demo at `https://demo.bawebtech.com` in a React Native WebView. Keep the website
usable in browsers and reuse its screens, API, MariaDB data and shared theme.
This establishes an iPhone testbed for Access Softek's later evaluation of FI
usability testing and customer-help workflows.

Initial acceptance is on the owner's iPhone 17 Pro Max, using an EAS-built,
signed internal preview app. Expo Go is an optional early preview, not evidence
that the standalone app is installable. The native JavaScript bundle must be
included in the preview build so Metro and an EC2 development tunnel are not
needed after installation. Banking pages still require the live HTTPS website.

Screen/video recording, gesture/error telemetry, native session-replay SDKs,
recording consent controls, upload/review tools and native banking-screen rewrites
are later scope, tracked in [BACKLOG](../BACKLOG.md). Do not add recording buttons
or permissions that have no working recording implementation. Android, App Store
publication, TestFlight delivery and EAS Update are outside initial acceptance.

## Verified starting point and assumptions

- At planning time Softek had only `apps/web` and `apps/api` npm workspaces and
  a root lockfile. Implementation now adds `apps/mobile` and EAS configuration.
- The web API client uses relative `/api` URLs and same-origin credentials.
  The backend checks the exact website Origin and uses Secure/HttpOnly/Lax cookies.
  Loading the real HTTPS website preserves this arrangement; no CORS widening,
  new token system, cookie extraction or native API client is planned.
- Existing website consent is sessionStorage-based. App WebView storage is
  separate from Safari; login/session survival must be measured on the device,
  and analytics consent must never be inferred from a successful login.
- The owner reports an iPhone 17 Pro Max, Apple Developer Program membership,
  Expo Go and a working EAS pipeline for `/home/ubuntu/aws` on this server.
  No local Mac/Xcode is available.
- Read-only inspection of `/home/ubuntu/aws/mobile` found Expo 57, React Native
  0.86.3, and separate `development` and Release/internal `preview` EAS profiles.
  Reuse the workflow pattern, not its IDs, application code, credentials or files.
  Its Expo account/team access and device registration have not been verified
  for Softek. EAS CLI was not found on the current shell PATH during planning.
- Dependencies must be selected and pinned against current Expo guidance and
  the owner's Expo Go version during implementation; AWS's installed versions
  are reference evidence, not an instruction to copy a potentially older SDK.
- No database migration, backend service change, new public ingress or website
  deployment is expected. Any necessary web fixes must be identified, scoped and
  tested before changing the live release.

## Working design

Add `apps/mobile` as an Expo TypeScript workspace. Keep Expo app configuration,
EAS profiles, shell components and small native assets there. Run EAS from that
directory. Maintain the repository's single lockfile, resolving Expo/React Native
version requirements without forcing an incompatible React upgrade onto the web
app. Keep the existing web/API build and deploy path independent of mobile
exports and cloud builds; its current `--workspaces` build must be reviewed.

Display name: **Softek POC**. Softek now has a distinct EAS project and Apple
bundle identifier, recorded in app.json and PROJECT_STATE. Use existing
authorized account context first; do not reuse AWS's project ID/bundle ID or
replace/revoke its signing assets. The owner completed Apple signing setup using
a separate Softek provisioning profile and the reusable team certificate.

Use the existing Harbor theme for a small shell around the WebView: safe-area
layout, initial loading, bounded load failure with Retry, and accessible Back
and Reload actions. Back follows available WebView history; avoid a second
customer menu. Disable automatic refresh-on-resume and automatic retry of failed
banking submissions. Handle main-document load failures separately from API
validation errors, which remain the website's responsibility.

Allow top-level navigation only to the exact configured Softek HTTPS origin.
Handle user-selected external HTTPS links in the system browser; reject unexpected
schemes/origins and inspect popup behavior. Do not disable TLS validation, expose
credentials in injected JavaScript, or add a native message bridge without an
actual first-phase need. Restrict navigation without accidentally blocking the
website's legitimate resources. A fixed public site URL is not a credential.

Use `preview` as a Release/internal build with a bundled JS frontend and no
development client. Configure a separate `development` profile for later native
SDK work; only the preview build is required for first-phase device acceptance.
Use managed prebuild/configuration rather than depending on local Xcode edits.
Expo Go can provide an early iteration path if its supported SDK matches; it
must not become a prerequisite for opening the installed preview app.

Review the EAS upload archive before sending it. A repository-root `.easignore`
must preserve existing secret exclusions and exclude owner `temp/`, private
artifacts, DB exports and unrelated server-only files while retaining the mobile
workspace and required package manifests/lockfile. Do not add server `.env`
values, DB/admin credentials or the automation secret to the app or build upload.

## Tasks and acceptance

Implementation is authorized. Mark each task done
only after its acceptance evidence exists; record current progress in the registry.

- [x] **IOS-01 — Establish Softek-specific build identity and prerequisites.**
  Verify the available EAS CLI/account and Apple team using read-only context
  first. Resolve app name/slug/bundle ID, available cloud-build quota and SDK/Expo
  Go compatibility. Identify an unused Metro port and a phone-accessible Expo
  development connection without changing AWS's processes or host firewall.
  Register/reuse the owner's iPhone under the correct team for ad hoc provisioning;
  the owner may need to complete device enrollment or Apple authentication.
  **Acceptance:** record nonsecret identities, chosen versions and concrete
  remaining owner actions; keep secrets and device UDID out of committed notes.

- [x] **IOS-02 — Scaffold the isolated Expo workspace and build configuration.**
  Add TypeScript, compatible Expo/React Native/WebView/safe-area dependencies,
  app icon/splash configuration and the preview/development profiles. Configure
  iPhone portrait presentation as the initial working choice. Keep mobile
  scripts explicit and the existing web/API scripts working. Add ignore rules
  and inspect the actual EAS source archive before upload.
  **Acceptance:** mobile typecheck, Expo dependency/config diagnostics and iOS
  JS export pass; archive contains required mobile sources and no private files;
  existing web/API typecheck and build still pass. No cloud command runs as a
  side effect of the normal website build or deployment.

- [x] **IOS-03 — Implement the website shell.**
  Load the fixed Softek HTTPS origin, add safe areas/loading/Retry/Back/Reload,
  enforce navigation policy and handle WebView process/load failure. Preserve
  standard WebView cookies and website origin/CSRF behavior. Add focused policy
  checks for lookalike hosts, non-HTTPS schemes and external links, plus checks
  for meaningful error/retry behavior. Do not mirror banking state natively.
  **Acceptance:** shell checks and iOS export pass; optional Expo Go preview
  reaches login and supports customer navigation, keyboard and scrolling.
  Device acceptance remains IOS-05 even if Expo Go works.

- [x] **IOS-04 — Produce and install the signed iPhone preview.**
  Link the distinct Softek EAS project, confirm the intended Apple team and
  provisioning, and request an iOS preview build. Install it using the internal
  build link on the registered iPhone. Resolve build/signing failures within
  Softek scope without changing the AWS app. No public store submission.
  **Acceptance:** successful cloud build ID/version/profile and nonsecret
  installation evidence recorded; app opens from its icon with Metro stopped.
  A queued build, successful JS export or simulator-only artifact is insufficient.

- [ ] **IOS-05 — Verify the installed app and browser coexistence.**
  Work through the matrix below with the owner on the iPhone and capture actual
  results. Use fictional test identities and an owned test fixture; no unrelated
  customer changes or data reset. Decline existing web analytics consent in a
  fresh WebView session; routine checks must not send Clarity traffic. Automated
  web checks use existing collection-off/stub conventions. Do not change global
  collection/tracing switches or add a native SDK as part of device acceptance.
  **Acceptance:** required rows pass on the signed preview and the website still
  works in Safari. Document any unverified row rather than claiming acceptance
  from screenshots, exports or Expo Go alone.

- [ ] **IOS-06 — Deliver the reproducible runbook and handoff.**
  Add verified commands to LOCAL_SETUP and TESTING only when available; document
  the working app-directory commands, profile/device enrollment, secret handling,
  independent process stop, rebuild/install flow and known limits. Record exact
  build/release/device results, owned fixture disposition, unresolved issues and
  the next task in PROJECT_STATE. Update this checklist and backlog.
  **Acceptance:** owner can reopen the installed app without Expo Go/Metro and
  follow the documented rebuild process from Ubuntu through EAS. Later recording
  work remains separately scoped; do not claim native-screen capture feasibility.

## Horizontal scrolling amendment — B-026

The owner authorized this focused correction after observing that all signed-in
pages shift sideways and stay shifted, while login fits normally. The red/brown
line below page titles appears wider than surrounding content. Verify the shared
main-content focus outline as a candidate; do not assume it is the cause or mask
unmeasured overflow with a global clipping rule.

- [x] **IOS-07 — Reproduce and correct the shared overflow source.**
  Measure document width, focus/outline bounds and actual horizontal scroll in
  WebKit and Chromium at mobile widths, including the installed phone's logical
  width. Compare focused/unfocused main content and a narrowly scoped correction.
  Fix the confirmed source while retaining route/skip-link focus, visible keyboard
  focus, vertical scrolling and intentional table scrolling.
  The outline-only release did not resolve the phone symptom. Owner reports
  pinching out restores normal width; inspect visual-viewport zoom after login.
  Shared form text was 15px. Verify a 16px minimum for text controls, retain user
  pinch zoom, and confirm a fresh login no longer leaves the view enlarged.
- [x] **IOS-08 — Verify and release the website correction.**
  Check login, Summary, account/feature pages, menu, keyboard navigation and a
  contained report table across mobile/desktop browsers. Run focused regression,
  type/build/format checks. Publish only the verified website correction while
  preserving the existing release's collection profile, server settings, data and
  unrelated services; retain rollback. Verify the served asset and public health.
  Ask the owner to reload the existing app and confirm the sideways movement is
  gone under IOS-05. A native build is needed only if a native change is necessary.

The focus-paint correction did not resolve the phone symptom. A second verified
CSS-only release sets shared form text to 16px after the owner confirmed pinching
out restores fit. The owner then confirmed Summary/account detail fit after a
fresh login without pinching, completing IOS-07. Desktop browser checks verify control sizes and
layout without reproducing iPhone keyboard zoom. Current release, evidence and
exact resume point are in PROJECT_STATE.

## Fresh-launch login amendment — B-027

The owner authorized requiring sign-in after force-close/relaunch. This supersedes
the previously accepted login persistence in build 1, without changing the
website's normal browser login policy or saved banking data.

- [x] **IOS-09 — Implement temporary iOS web sessions and deliver a signed build.**
  Use WebView `incognito` (iOS nonpersistent website data store) and explicitly
  disable shared native cookies. Keep the session through normal navigation,
  Reload and foreground/background while that WebView survives. No termination
  callback or server-logout-on-kill assumption. A new WebView (including genuine
  content-process failure recovery) starts a fresh session; website preferences/consent
  stored only in browser storage also start fresh. Server session records retain
  their normal expiry; this change discards local access, not backend data.
  Bump the native version/build, run mobile checks/export/archive inspection,
  create the EAS preview and inspect the IPA identity/profile. Preserve the old
  build and all web/backend settings. No recording SDK or new native dependency.
- [ ] **IOS-10 — Verify session policy on the installed iPhone update.**
  Install the new preview over build 1. Confirm first launch requires login,
  login/navigation and ordinary Reload work, a brief app switch retains a valid
  session while the process lives, and force-close/reopen shows login. Re-login
  must restore the same fictional banking state. Explicit sign-out must persist.
  Verify manual zoom/layout correction and that Safari's independent website
  session was not changed. Record actual phone results; mocked WebView tests
  cannot establish native cookie lifetime.

Plan 024's offline check found that build 9 unnecessarily created a new WebView
after ordinary connection failures. Its build-10 follow-up retains the view for
connection/HTTP/timeout recovery and requests a fresh GET on Try again; recording
must stay stopped. Signed-device verification of that correction is tracked in
PROJECT_STATE, without weakening the force-close/new-process login requirement.

The owner confirmed on installed 0.1.1 (2) that Reload/app switching retain login
and force-close/reopen requires it. That completes B-027's requested behavior.
IOS-10 stays open for the remaining saved-data/sign-out/layout/Safari assertions;
do not infer those results from the session-policy confirmation alone.

## Installed-device acceptance matrix

| Case | Required result |
| --- | --- |
| Cold launch without Metro/Expo Go | Updated app opens hosted login with no previous app session; no development-server dependency |
| Correct/incorrect demo credentials | Successful login and readable validation; no secrets in logs or native storage |
| Banking navigation | Summary, an account detail, Explore and a feature page open; Back/menu links work |
| Refresh and app lifecycle | Reload/background preserve a valid live WebView session; force-close/new process requires sign-in; saved banking data persists |
| Cookie persistence and sign-out | Temporary cookies do not survive a fresh WebView/app launch; explicit sign-out stays effective; no Safari-cookie sharing |
| iPhone 17 Pro Max layout | Keyboard leaves inputs/actions reachable; safe areas, scrolling, taps and menus work without horizontal overflow |
| Visible website error | Invalid login/form submission shows the website's existing message without becoming a shell network error |
| Network loss and recovery | Airplane-mode launch/reload produces an actionable retry state; reconnect/Retry recovers without duplicate action submission |
| Navigation boundaries | Same-origin links stay in app; allowed external HTTPS links leave it; unexpected schemes/lookalike origins do not replace the banking view |
| Analytics separation | Existing consent respected; decline-path checks produce no Clarity requests; no new capture permissions, recording SDK or upload path |
| Browser coexistence | Safari still loads the demo, signs in/out and navigates; saved fictional data remains server-owned and consistent |
| Separate app identity | Softek installs beside the AWS app; AWS app/pipeline and unrelated services remain untouched |

## Effort and dependencies

Working estimate: **1–2 development days** for the thin shell and first build,
assuming account access and signing are ready. Device enrollment, cloud queues,
Apple processing and owner-assisted acceptance add elapsed time. Resolve any
WebView/session/platform issue against observed behavior before revising the
estimate. The owner must install and exercise the iPhone app; this Ubuntu host
cannot independently prove actual-device behavior.

Local implementation/checks and IOS-01 signing setup are complete. EAS finished
the first signed-preview build and the IPA's identity/profile were checked;
actual status/evidence and installation link are in PROJECT_STATE.
The owner confirmed the signed app installs and login/navigation work with Metro
stopped, completing IOS-04. IOS-05 still requires the remaining device matrix;
IOS-06 final handoff remains open. PROJECT_STATE distinguishes confirmed basic
device behavior from unverified robustness/privacy/browser checks.

## References checked during planning

- [Expo WebView](https://docs.expo.dev/versions/latest/sdk/webview/) — renders the
  hosted site and is included in Expo Go.
- [EAS build setup](https://docs.expo.dev/build/setup/) and
  [monorepo layout](https://docs.expo.dev/build-reference/build-with-monorepos/)
  — distinct app-directory configuration and cloud-build workflow.
- [Internal distribution](https://docs.expo.dev/build/internal-distribution/)
  — ad hoc iOS builds require device provisioning; adding devices can require a
  new build or re-signing.
- [EAS upload exclusions](https://docs.expo.dev/build-reference/easignore/)
  — root ignore-file precedence and archive inspection before upload.
- [Custom native code](https://docs.expo.dev/workflow/customizing/)
  — later SDK/native-module work uses a custom development build.
