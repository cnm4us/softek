# Product

## Purpose

Build a convincing fictional banking demo to evaluate Microsoft Clarity's value
in understanding optional-service adoption. Access Softek's institutional
customers may have purchased services that their banking customers rarely use.
The demo should help investigate where customers notice, explore, enroll in, and
use those services.

This is an independent evaluation. It does not establish compatibility with
Access Softek's unknown production platform or connect to real financial systems.

## Confirmed requirements

- Develop on the current EC2 instance using MariaDB, with versioned migrations.
- Design mobile first, with consistent styling and usable desktop layouts.
- Use invented institutions, identities, account information, and transactions.
- Persist simulated actions and provide independent participant state and reset.
- Show promotional banners and a desktop sidebar placement; adapt the sidebar
  promotion into an inline placement on mobile.
- Instrument the adoption journey in our database and, when enabled, Clarity.
- Preserve enough documentation for a fresh agent to resume implementation.

## Approved demo revision (2026-10-11, America/Los_Angeles)

These approved requirements are implemented and deployed. Live Clarity recording
acceptance remains in Plan 002:

- Initial screen: logo/name above a simple real username/password login form.
- Admin creates demo users and resets passwords; no self-registration.
- Each demo user retains accounts, enrollment, and goals across logout/login
  until an explicit reset. User identity persists separately from resettable runs.
- Logged-in screens use the section title at the top; the home title is
  **Account Summary**. Hamburger navigation is in the upper-right.
- Immediately below that title, show a banner image with margin on all sides,
  followed by the existing accounts, recent activity, and goals.
- Banking menu sections use themed placeholder pages initially, while existing
  savings goals continues to work.
- Admin uploads/manages ordered enabled banners and selects internal demo-page
  destinations only; external links are excluded.
- Rotate enabled banners in order on login and full Account Summary refresh.
  Returning through the menu preserves the current banner. Data refetches and
  duplicate component initialization must not advance the sequence.
- Clarity is a central acceptance requirement: Chris must be able to exercise
  individual demo users and find their activity in actual Clarity recordings
  and heatmaps. Controlled automation evaluation is separate from routine tests.

Clarity design must use a stable pseudonymous demo-user ID, with run/visit/page
identity separate. Record banner identity and visibility/click/action milestones.
Rotation on one URL can mix creatives in an aggregate heatmap: validate filters
and screenshots, and evaluate a public banner-only URL parameter for exact
per-banner heatmaps. Do not put usernames or other private data into URLs/tags.
Verify shared-browser account switching, opt-in/masking, publicly readable
image/CSS assets, route transitions, and actual automation capture before relying
on the evaluation. See current official [Identify API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/identify-api)
and [heatmap URL filters](https://learn.microsoft.com/en-us/clarity/heatmaps/heatmaps-overview).

## Approved menu revision (2026-10-11, America/Los_Angeles)

The user approved two distinct menus: **Admin Menu** and **Customer Menu**.
Implemented in the shared Harbor shell. Details: [Plan 004](plans/004-admin-and-customer-menus.md).

- Admin Menu: Manage Customers, Manage Banners, Adoption Report, and admin
  sign-out. All customer management belongs here, including creation, access,
  password replacement, banking resets, eligibility/variant/activity mode,
  Clarity ID copy, and individual activity.
- Customer Menu: Account Summary, Transfers, Bill Pay, Cards, Savings Goals,
  Statements, Support, and customer sign-out.
- Admin uses its protected independent login; customers use their own logins.
  Both surfaces retain the uniform mobile-first theme and desktop hamburger.
- Customer administration uses a compact searchable list and selected-customer
  details. Banners and reporting have their own protected admin pages.

Routes and secondary demo-utility placement in Plan 004 are working choices.
No account-template simplification, new banking service, or Clarity collection
change was approved as part of this menu revision.

## First milestone: one complete adoption experiment

Implemented working choice: one fictional institution, two customer profiles
(one eligible, one standard), and a savings goals service. Savings goals supports a clear enrollment and first-use action
without introducing external providers. Broader services remain later scope.

The participant enters a demo, sees checking/savings balances and recent activity,
encounters a service promotion, opens its details, enrolls, and creates a savings
goal. Enrollment and goal creation persist after navigation and refresh. A later
visit can use the service again. Reset starts a new run with clean fictional data.

The milestone includes:

- An authenticated customer-entry flow and persistent user-owned banking runs.
- Account overview with a banner and sidebar/inline promotion.
- Service details, a short multistep enrollment, and savings-goal creation.
- A simple controls surface for customer/session reset and the first campaign.
- A report with distinct participant counts, denominators, and human/automated
  filters. No statistical improvement claim is required.
- Environment-controlled Clarity instrumentation, off by default.
- A repeatable browser journey proving persistence, reset, and mobile usability.

Broader transfers, bill pay, card controls, multiple institutions, and full
experiment controls follow this milestone; see [BACKLOG.md](BACKLOG.md).

## Uniform mobile-first experience

- Define one shared set of spacing, typography, color, radius, elevation, focus,
  and interaction tokens. Institution branding changes approved tokens and copy.
- Use shared page shells, navigation, cards, fields, buttons, alerts, empty states,
  and loading states. Do not restyle each feature independently.
- Start with a narrow single-column layout. Avoid horizontal page scrolling and
  reliance on hover. Forms and enrollment must work with the on-screen keyboard.
- Use a design target of at least 44 CSS pixels for primary touch controls; keep
  labels, visible focus, and readable contrast throughout the application.
- Desktop can add columns and sidebar promotions while keeping the same
  components, terminology, and hierarchy. The approved revision uses the
  upper-right hamburger menu on desktop as well as mobile.
- Errors preserve entered data and explain how to proceed. Success states explain
  the action completed and provide the next useful action.
- Make the fictional-demo status visible without exposing developer terminology
  in ordinary banking flows.

## Adoption model

Institution purchase, customer eligibility, customer enrollment, and actual use
are separate states. The journey is:

Eligible participant → visible promotion → click → details → enrollment start →
confirmed enrollment → confirmed first use → repeat use.

Working instrumentation rules to implement and verify:

| Milestone | Evidence |
| --- | --- |
| Eligible | Backend creates an eligible participant-run assignment for the campaign/service |
| Promotion visible | At least 50% of the promotion remains in the viewport for 1 continuous second while the document is visible |
| Promotion clicked | Participant activates the promotion link or button |
| Details viewed | Service details route is displayed in the active journey |
| Enrollment started | Participant begins the enrollment form |
| Enrollment completed | Backend persists successful enrollment |
| First use | Backend commits the first qualifying savings-goal action in this run |
| Repeat use | Backend commits another qualifying service action during a later visit in the same run |

Define a visit as explicit login, a new browser session under the same participant
run, or renewed activity after 30 minutes of inactivity. These are demo analysis rules, not claims
about Clarity's own session definitions. The API owns visit IDs for confirmed use.

Do not count a rendered, below-the-fold promotion as visible. Deduplicate exposure
per run/campaign/placement/variant for funnel reporting; retain separate placements
as dimensions. Stable assignments survive navigation, refresh, and later visits
until reset. Deliberate variant changes start a new run.

Reports count distinct participant runs by institution, service, campaign, and
variant. Record the eligibility/assignment snapshot when a run starts. Use that
cohort as the denominator, with a chosen run-start date range and observation
cutoff. Never use raw event volume as the number of adopters.

Show each milestone as a distinct qualifying count and its share of eligible runs.
For the ordered funnel, count only runs that reached the prerequisite stages;
show stage-to-stage conversion with that prerequisite count as denominator.
Direct service entry and enrolled return visits belong in service-use reporting
even when they did not pass through a promotion. Separate human and automated data.

## Privacy and collection

Use pseudonymous, fictional IDs. Do not include names, account numbers, balances,
free-text goals, credentials, or other sensitive content in Clarity tags, events,
identifiers, or URLs. Demonstrate masking for banking details.

The user confirmed Clarity project `yvs5hp3ivb` is the intended demo project and
has created the account. Chris does not yet have project access. The existing
loader needs only this project ID; the manual-install snippet is not required.
On 2026-10-11 UTC the owner reported Balanced masking, cookies on, bot detection
on, and cookie consent required. Verify consent/masking in real playback before
claiming recording acceptance. Collection remains off for the deployed revision. Chris needs a Clarity team-member invitation to review data.

Synthetic activity demonstrates instrumentation. Human walkthroughs are necessary
to investigate human behavior; higher click counts alone do not prove adoption.

## First-milestone acceptance

1. At narrow mobile and desktop widths, the full flow uses the same visual theme
   without page overflow or inaccessible controls.
2. Enrollment and a created goal remain visible after refresh and a later visit.
3. Two independent browser sessions cannot modify each other's participant data.
4. Reset creates a clean run; reports can still distinguish prior runs.
5. Database events agree with confirmed enrollment and service actions. Events
   retried after a network failure do not inflate distinct counts.
6. A below-the-fold promotion produces no exposure until the visibility rule is met.
7. The report displays explicit denominators and separates automated activity.
8. Automated tests make no Clarity network requests. A separately configured
   evaluation verifies collection and masking before presentation.
