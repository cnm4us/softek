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

## First milestone: one complete adoption experiment

Working choice: one fictional institution, one customer profile, and a savings
goals service. Savings goals supports a clear enrollment and first-use action
without introducing external providers. This choice can change before code exists.

The participant enters a demo, sees checking/savings balances and recent activity,
encounters a service promotion, opens its details, enrolls, and creates a savings
goal. Enrollment and goal creation persist after navigation and refresh. A later
visit can use the service again. Reset starts a new run with clean fictional data.

The milestone includes:

- A customer-entry flow and session-scoped participant data.
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
- Desktop can add columns, a side navigation, and sidebar promotions while keeping
  the same components, terminology, and hierarchy.
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

Define a visit as a new browser session under the same participant run, or renewed
activity after 30 minutes of inactivity. These are demo analysis rules, not claims
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

Clarity project `yvs5hp3ivb` is a candidate from the handoff, not a verified active
configuration. Confirm project ownership/intended use, current consent and
collection requirements, masking, and recording behavior before enabling it.

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
