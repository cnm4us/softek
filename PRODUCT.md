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
- Immediately below that title, show the three account widgets, then a compact
  full-width banner placeholder before recent activity and goals (Plan 014).
  The same placeholder follows the balance widget on each account detail page.
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

## Implemented feature campaign phase — Plan 005

The user supplied twelve feature campaigns. Plan 012 supersedes the original
Explore Features submenu with Customer Menu → **Explore more ways to bank**
at `/explore`. Each product opens a themed landing page with
basic descriptions and **one primary CTA**. Each card starts with the supplied
headline in larger green uppercase type; the page title identifies the feature,
so there is no repeated “Explore” line or decorative star. The CTA shows only a
demo confirmation.
The admin banner editor retains these internal destinations. Plan 014 suspends
linked Summary image rendering and adds inactive placeholder strips on Summary
and the three account detail pages; future rotating content is separate scope.

Feature views and CTA clicks are engagement observations separate from the
existing Savings Goals adoption funnel. They imply no enrollment, eligibility,
application, credit inquiry, investment order, or financial transaction. Existing
banking state and banner rotation rules remain unchanged.

[Plan 005](plans/005-feature-campaign-landing-pages.md) owns the twelve menu names,
routes, supplied copy, tracking/migration design, and acceptance tasks.
Harbor branding remains the working default. The report's secondary CTAs and
simulated enrollment/application destinations are superseded by confirmation-only
behavior. All twelve pages and banner destinations are implemented. Feature Activity
within Adoption Report distinguishes raw views/clicks from distinct users/runs and
uses the existing actor/variant/UTC filters. Plan 005 itself did not enable collection;
the owner-authorized Plan 002 phase now provides the collection control.

## Bulk customer generation — Plan 006

Manage Customers → Generate customers creates 1–200 fictional customers in a
chosen batch. The owner can set a username prefix, shared demo password, checking
and savings amount ranges, eligibility, variant and activity mode.
Generated usernames and display names carry a unique batch/position marker.
Each customer's sampled starting amounts are saved separately from the templates;
login resumes current amounts and reset restores those saved starting amounts.
Credit balance and recent activity use the shared fictional starting accounts.

A successful batch offers a downloadable CSV of IDs, usernames, display names,
starting checking/savings amounts and activity mode. Passwords are not exported.
Creation does not sign in customers, grant analytics consent or create banking
runs before first login. Human is the default for manual testing; Automation is
for a trusted future runner. A repeated submission returns the same batch;
conflicting settings require a new request. The large production cohort and
scheduled browsing remain later owner-selected work. See [Plan 006](plans/006-bulk-customer-generation.md).

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
claiming recording acceptance. The owner authorized collection and an Admin Menu → Clarity Settings control.
The global switch persists; collection requires customer opt-in. The initial opt-in
appears in a centered modal overlay with Allow analytics and Keep analytics off.
Escape declines. After choosing, page-bottom controls allow changing the choice. Turning it off
stops open pages at the next settings check and re-enabling requires fresh consent.
Admin pages and routine automation are excluded. The owner reviews recordings and
heatmaps first; Chris's project invitation is deferred until the demo is ready.

On **2026-10-13, America/Los_Angeles**, the owner accepted automated activity
appearing in Clarity Dashboard and human activity in saved Recordings as
sufficient for the current demo. Saved automated recordings are not required;
their absence is an accepted limitation. Further investigation is stopped unless
the owner reopens it. Human recording/masking and heatmap evaluation retain their
separate acceptance requirements. See [Plan 002](plans/002-clarity-validation.md).

Synthetic activity demonstrates instrumentation. Human walkthroughs are necessary
to investigate human behavior; higher click counts alone do not prove adoption.

## Contextual discovery — first phase

Owner selected **EasyCoin Cryptocurrency** for savings/investment exploration and
**Skip A Pay** on an eligible fictional loan-payment screen. Customer Menu gains
Savings & Investing and Loans. EasyCoin follows an explicit Explore investing
choice, using educational risk-aware copy without balance-based targeting. The
auto-loan fixture can show “See whether you can defer an upcoming payment.” The
personal-loan fixture has no Skip A Pay invitation. Primary payment actions stay
prominent; review/confirmation simulates a payment without changing banking state.

Inline invitations have Learn more and Dismiss, use the existing feature pages,
and appear at most once per visit. Seen features rest fourteen days; dismissals
last ninety days. Discovery preferences persist across logins/devices and offer
standard, fewer (one per seven days) and off for these contextual suggestions.
Explore more ways to bank remains available. Existing Summary banners and Savings Goals
experiments retain their separate behavior. First-party Contextual Discovery
reporting distinguishes selection, actual visibility, dismissal, clicks and linked
feature views/CTAs; engagement does not constitute activation or adoption.

The supplied brief's two-FI switching, wider catalogue organization, additional
placements, experiment assignments and simulated activation belong to later phases.
See [Plan 011](plans/011-contextual-feature-discovery.md).

## Customer device and browser preferences

Customer Device and Browser preferences are saved separately from banking state.
Create Customer, Generate Customers and Customer Details provide both selectors;
bulk CSV includes their IDs. Existing customers default to Desktop/Chrome. Choices
are Desktop (Chrome/Edge/Firefox/Safari), Android phone (Chrome), iPhone (Safari)
and iPad (Safari). Only compatible combinations can be saved. Manual visits use
the real browser; automated sessions use the saved emulation profile. Saving a
preference does not reset banking, sign in, grant analytics consent or start a job.
Clarity remains responsible for classification and bot filtering; dashboard
acceptance is not implied by a saved profile. See [Plan 007](plans/007-customer-device-browser-profiles.md).

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

## Shared starting accounts — Plan 008

Manual creation, bulk generation and banking reset use one account setup without
Alex/Jamie or Eligible/Standard template selectors. Eligibility for Savings Goals
is controlled solely by its independent checkbox. All customers start with
Everyday checking, Harbor savings, Harbor credit card and sample recent activity;
bulk generation still samples and saves individual checking/savings amounts.
Existing balances, names and report history remain intact.
See [Plan 008](plans/008-simplify-starting-accounts.md).

## Permanent customer deletion — Plan 009

Every card on Manage Customers has a Delete button separate from its details
link. Confirmation identifies the customer and states that deletion permanently
removes their login, banking state and demo activity history. Cancel keeps them;
success removes the card while retaining the search. The local adoption and
feature reports no longer include deleted customers' active or retired runs.
Shared banners and other customers remain intact. Prior batch requests cannot
recreate deleted customers. See [Plan 009](plans/009-delete-customers.md).

## Admin customer impersonation — Plan 010

Authenticated admins can use **Impersonate customer** on an enabled customer's
admin details page without their password, opening Account Summary in their
actual saved demo state. A persistent **Viewing as [display name]** indicator
identifies the mode. Normal customer actions and resets persist; eligibility,
activity assignment and saved device/browser preferences remain unchanged.

**Exit to Admin**, immediately above Customer Menu → Sign out, appears only in
this mode and returns to the selected customer's details. Sign out instead opens
customer login; both preserve admin access and end impersonation. Sessions expire
with/revoke alongside the initiating admin session and customer access changes.
Clarity collection and its consent UI are excluded. Local visits are labeled
Admin impersonation, retained in individual history and excluded from normal
adoption/feature report counts. Admin-only runs enter customer cohorts after a
customer visit, retaining original run-start dates. Business effects remain, but
admin enrollment does not imply customer adoption. See
[Plan 010](plans/010-admin-customer-impersonation.md) for verified acceptance.

## Grouped feature catalog — Plan 012

The customer-initiated catalog follows the owner-supplied screenshot, using the
shared Harbor theme. Groups start expanded and collapse independently:

| Group | Products in display order |
| --- | --- |
| Save & Invest | Savings Accounts & Certificates; EasyVest Automated Investing; EasyVest Self-Directed Investing; EasyCoin Cryptocurrency |
| Borrow & Manage Payments | Buy Now, Pay Later; Auto Loans & Refinancing; Skip A Pay |
| Move Money | Instant Payments |
| Protect & Understand | Credit Score Monitoring; Identity Protection |
| Family & Business | Youth Banking; Small Business Invoicing |

Show counts (4/3/1/2/2), the introduction “Discover services available through your
financial institution.” and the supplied FI configuration note. The search icon
reveals a name search with result counts and a clear action. Catalog links use full
product names. The two EasyVest landing titles, EasyCoin Cryptocurrency and
Small Business Invoicing now match their full catalog names; other titles and
existing feature IDs remain stable. Catalog
entries return to the catalog. Banner and contextual entries retain their own
return paths and attribution. Browsing the catalog is a page view; opening a
landing and clicking its CTA remain separate feature observations. Discovery
preferences do not restrict deliberate exploration. Multi-FI configuration is
still deferred; the footer describes the future configuration model.

## Account details — Plan 013

The entire checking, savings and credit card widget on Account Summary is a link
with a chevron. The old View savings options link is removed. Each opens a
mobile-first account page with its saved name, masked last four and live demo
balance and recent activity. The checking balance card shows Personal Checking
upper-left, its masked number upper-right, and the amount/available-balance label
lower-left. Its Account Information widget is removed and Recent Activity uses the
full width. The savings balance card omits
the generic heading/subtitle: Personal Savings sits upper-left, its masked number
is upper-right, and Interest 1.25% / Compounded Monthly appears middle-left. The
amount and available-balance label stay lower-left. Savings has no separate Account
Information widget; Recent Activity follows the balance card at full width. Checking includes spending/
deposit examples; savings includes transfers/interest and illustrative monthly compounding;
credit includes purchases/payments, available credit and a fictional credit limit.
Its balance card follows the same compact layout: Credit Card upper-left, masked
number upper-right, Available Credit / Credit Limit in the middle, and current
amount owed lower-left. Its Account Information widget is removed, with full-width
Recent Activity immediately below.

Pages are read-only. Saved ledger activity appears for that account; additional
stable sample entries are labeled and do not modify balances or history. Rates,
fees, limits and payment terms are explicitly fictional examples. Return to Account
Summary preserves the banner selection; direct login and refresh retain the account
route. Existing goal contributions appear in the appropriate checking/savings
history and balances. These are banking page views, separate from feature/adoption
observations. Explore links/placements on these pages require the next owner
conversation and are not part of this release.

## Compact banner placeholders — Plan 014

Summary's three account widgets sit directly below the section header. A full-width
Harbor strip follows them and precedes Recent Activity. Checking, savings and
credit-card detail pages use the same strip below their balance widget and above
Recent Activity. A shared 210px balance-card minimum and 105px strip keep the
placeholder half as tall on mobile and desktop. Full width means the padded main
content width, preserving the site's margins.

The strip says More ways to bank and has no image, link, button or impression/
click tracking. Future rotating images/destinations and Explore invitations require
separate work. Existing admin assets, rotation selections and historical reporting
are retained, while actual linked image rendering is suspended. Sidebar Savings
Goals promotion and banking activity remain functional.

## Feature Explorer administration — Plan 015

Admin Menu → Feature Explorer lists four banner spaces: Account Summary, Everyday
Checking, Harbor Savings and Harbor Credit Card. Each space header has its own
Explore feature widgets. Add a title from all twelve catalog features, then open
its title to configure its mobile artwork and view/copy the automatically derived
feature URL. One widget per feature per space; a feature may appear in multiple
spaces. Titles/destinations remain catalog-owned.

Upload JPEG/PNG/WebP up to 5 MiB, recommended 960×315 for a 320×105 mobile slot.
The responsive preview preserves the image proportions. Replacements keep old
image URLs immutable. Accessible link text, display order and inclusion in future
rotation are saved per widget. Image-less widgets cannot be included.

The owner selected **admin controls only for now**. Adding/uploading/saving a widget
does not activate customer artwork, impressions, clicks, rotation or discovery.
The four customer pages retain Plan 014's inactive placeholders. Future section
rotation, attribution and desktop artwork behavior remain B-016.

Feature Explorer widget rows and configuration pages have confirmed Delete actions.
Deletion permanently removes only that space's widget and settings; the catalog
feature/landing page, matching widgets in other spaces and immutable artwork remain.
The feature becomes available to add again in that space, with fresh settings.
