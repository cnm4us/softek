# Project handoff: Banking demo for Microsoft Clarity

We are building a fictional online banking application to evaluate Microsoft Clarity, particularly its usefulness for understanding and improving adoption of optional banking services.

## Background and purpose

My longtime friend Chris Doner owns Access Softek, which provides white-label online banking software to smaller banks and credit unions. Chris has a substantial development team but struggles with marketing.

His main concern is adoption: financial institutions have already purchased optional services, but their customers rarely use them. Greater use can generate more revenue for both the institutions and Access Softek.

We want to demonstrate how Clarity can help investigate whether customers notice promotions, explore services, complete enrollment, and actually use those services. The application should include banner and sidebar promotional placements.

We do not know Access Softek’s current technology platform. This is an independent demonstration and evaluation, not an integration with its production systems.

## Environment and deployment direction

- Local workspace: `C:\Users\micha\Desktop\Clarity`
- Development machine: Windows, using Codex in VS Code.
- Local database: MySQL is already running.
- Deployment target: An existing EC2 instance running MariaDB.
- Intended hostname: `demo.bawebtech.com`.
- Build and test locally, then deploy to EC2.
- Use a dedicated demo database in each environment.
- Verify the installed MySQL and MariaDB versions before choosing dependencies or database features.
- EC2 access details, existing web-server configuration, and database credentials have not yet been provided.

A Microsoft Clarity project is open at:
https://clarity.microsoft.com/projects/view/yvs5hp3ivb/gettingstarted

The apparent project ID is `yvs5hp3ivb`. Verify its intended use and tracking configuration before enabling collection.

## Proposed stack

The earlier recommendation was:

- React + TypeScript + Vite.
- Tailwind CSS + shadcn/ui.
- React Router.
- Node.js + Express, also using TypeScript.
- Prisma for database access and schema migrations.
- MySQL locally; MariaDB on EC2.
- Playwright for browser testing and scripted demonstration journeys.
- Microsoft Clarity for recordings, heatmaps, custom events, and segmentation.

This is a recommended baseline, not an existing implementation. Check the repository before assuming it is empty or replacing anything. Keep architecture proportionate to a demo.

Use portable database features, environment-specific configuration, versioned migrations, and repeatable seed data. Validate against MariaDB before the final presentation.

## Banking experience

Build a convincing, responsive banking application with fictional data and persistent simulated actions. Suggested screens and functions:

- Demo entry with a choice of fictional customer.
- Account overview with checking, savings, credit card, and recent activity.
- Transaction history with search, filters, and details.
- Transfers between fictional accounts.
- Bill pay with payees, scheduled payments, and pending-payment views.
- Card controls and notification preferences.
- A service center for optional services.
- Multistep service enrollment.
- A first-use action after enrollment.

Actions should have coherent effects. For example, a transfer should update balances and transaction history; a scheduled payment should remain visible after navigation.

Give each demo participant an independent set of mutable data. Provide a reliable reset mechanism.

There is no real money and there should be no connection to live banking or payment systems. Use invented identities and account information. Simple demo access is sufficient; still protect the hosting environment and administrative controls.

## White-label configuration

Proposed scope: two or three fictional institutions using the same application, with configurable:

- Names, logos, colors, and terminology.
- Purchased services.
- Customer eligibility and enrollment state.
- Promotional copy and creative.
- Banner, sidebar, and navigation placement.
- Experiment variants.

On mobile, adapt sidebar promotions into an appropriate inline placement.

Initial service examples could include savings goals, credit monitoring, person-to-person payments, and financial-management tools. These are illustrative placeholders, not confirmed Access Softek offerings.

## Central adoption experiment

Design around this journey:

Eligible customer → promotion visible → promotion clicked → service details viewed → enrollment started → enrollment completed → first use → repeat use.

Distinguish an institution purchasing a service from a customer enrolling in or using it.

Track actual visible exposure using a documented visibility rule. Do not count a promotion as seen merely because it was rendered below the fold.

Record named milestones in Clarity and structured events in our own database. Backend-confirmed actions should determine successful enrollments and simulated transactions.

Our reporting should provide explicit counts and denominators. Clarity should help explain the observed behavior through recordings and heatmaps.

Useful context includes:

- Fictional institution.
- Service and campaign.
- Promotion placement.
- Experiment variant.
- Fictional customer/session identifier.
- Human versus automated session.

Keep experiment assignment stable during a journey. Separate synthetic activity from human evaluation. Increased clicks alone do not demonstrate increased adoption.

## Demo controls and testing harness

Provide a control panel to:

- Select institution and customer profile.
- Select campaigns and layout variants.
- Set eligibility and enrollment state.
- Reset fictional data.
- Enable deliberate, labeled sources of friction for comparison.

Use Playwright for repeatable journeys, including:

- Checking a balance without engaging with promotions.
- Clicking an offer and abandoning enrollment.
- Completing enrollment and using the service.
- Returning to use an enrolled service.
- Verifying transfers, bill pay, persistence, and reset behavior.
- Checking desktop and mobile layouts.

Ordinary automated tests should have Clarity disabled. Separate demonstration runs may enable tracking, but verify that Clarity captures them: its bot filtering may exclude automated traffic.

Synthetic journeys demonstrate instrumentation and analysis, not actual customer preferences or conversion improvements. Include human walkthroughs in the evaluation.

## Clarity evaluation boundaries

Evaluate:

- Recording fidelity.
- Heatmap usefulness.
- Navigation and workflow visibility.
- Custom events and filtering.
- Masking behavior.
- Ability to investigate service adoption by institution, campaign, and variant.

Clarity integration into this demo will not establish compatibility with Access Softek’s unknown production platform.

Microsoft documents limitations around third-party iframes and canvas content. This may matter if banking add-ons are embedded services. Verify current behavior before drawing conclusions.

Use configurable masking and demonstrate useful analysis while account details remain masked. Do not send sensitive content through custom events, tags, identifiers, or URLs.

Keep routine development activity separate from presentation data. Confirm current consent and collection requirements when configuring Clarity.

Reference documentation:

- Setup: https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-setup
- Client API: https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-api
- Custom tags: https://learn.microsoft.com/en-us/clarity/filters/custom-tags

## Recommended first milestone

Deliver one complete adoption experiment locally:

1. Fictional bank and customer.
2. Account dashboard with banner and sidebar promotions.
3. One promoted optional service.
4. Service details, enrollment, and first-use screens.
5. Persistent fictional account and enrollment data.
6. Resettable demo state.
7. Structured adoption events and a simple report.
8. Clarity integration controlled by environment settings.
9. A Playwright journey that verifies the complete flow.

Expand the surrounding banking functions after this vertical slice works.

## Current status and next action

The conversation so far has covered planning and stack recommendations only. No application code, database changes, deployment, or Clarity configuration has been performed in this chat.

Start by inspecting the workspace and any repository instructions, checking available runtimes and the local MySQL version, and identifying existing configuration without exposing secrets. Then establish the local implementation plan and begin the first milestone. Ask for missing connection details when needed; do not assume credentials or make changes to unrelated databases or EC2 services.