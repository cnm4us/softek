# Start here

Softek is a fictional banking application for evaluating how Microsoft Clarity
helps explain adoption of optional banking services.

## Fresh-agent sequence

1. Read [AGENTS.md](AGENTS.md) for working rules.
2. Read [PROJECT_STATE.md](PROJECT_STATE.md) for the plan status registry, verified
   status, current request scope, and the next task.
3. Read [PRODUCT.md](PRODUCT.md) for the intended outcome and design constraints.
4. Open the active individual plan linked from the state registry. Use
   [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the roadmap/dependencies;
   detailed tasks and acceptance criteria are in `plans/`.
5. Read [ARCHITECTURE.md](ARCHITECTURE.md), [LOCAL_SETUP.md](LOCAL_SETUP.md), and
   [TESTING.MD](TESTING.MD) as needed for that task.
6. Inspect `git status --short --branch`, existing code, and relevant migration
   status before editing. Recheck environment facts that may have changed.
7. Complete the next authorized task, run relevant checks, and update the state.

Suggested prompt when opening a fresh thread:

> Read AGENTS.md and START_HERE.MD, inspect PROJECT_STATE.md and the active
> plan linked from its status registry, then continue the next authorized task.
> Verify current files before assuming the documented state is still accurate.

## Document map

| File | Purpose |
| --- | --- |
| [PRODUCT.md](PRODUCT.md) | Product requirements and first-demo definition |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Design boundaries and decision record |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Roadmap and individual plan index |
| [plans/](plans/) | Numbered plans with scope, tasks, and acceptance criteria |
| [BACKLOG.md](BACKLOG.md) | Deferred features and open questions |
| [PROJECT_STATE.md](PROJECT_STATE.md) | Plan status registry, current handoff, and verification evidence |
| [LOCAL_SETUP.md](LOCAL_SETUP.md) | Setup, configuration, and host operation |
| [TESTING.MD](TESTING.MD) | Meaningful verification and acceptance checks |
| [TOOLS.md](TOOLS.md) | Available tools and usage conventions |
| [db/migrations/README.md](db/migrations/README.md) | Schema migration contract |
| [Original handoff](agents/plans/initial_handoff.md) | Historical product context |

## Important corrections to the original handoff

Development already takes place on EC2 at `/home/ubuntu/softek`, using MariaDB.
There is no Windows development environment or separate MySQL target to support.
The GitHub remote is `https://github.com/cnm4us/softek.git`.

The site must be mobile first, use a uniform theme throughout, and adapt well to
desktop. Database changes must use versioned migrations.

The banking demo is live at `https://demo.bawebtech.com` through Nginx/Certbot.
M1 and Plan 001 include real demo-user login, persistent user-owned runs,
protected user/banner administration, ordered image rotation, savings goals,
reset, and adoption reporting. Plan 004 separates the Admin Menu and Customer
Menu, with focused `/controls/*` pages and independent sign-outs. Plan 002 adds
Admin Menu → Clarity Settings and owner-authorized, consent-required collection;
actual dashboard playback and heatmaps remain to be reviewed. Plan 005 adds twelve Explore Features
landing pages, internal banner destinations and separate Feature Activity reporting;
their CTAs only confirm a demo action. Plan 006 adds Generate Customers under
Manage Customers: 1–200 unique fictional identities per batch, saved individual
checking/savings balances, and a password-free CSV for later automation. Plan 007
adds compatible Device/Browser preferences and matching pilot emulation. Normal
visits keep their actual browser; saving preferences does not start automation.
Plan 008 removes redundant starting-account template selectors and keeps Savings
Goals eligibility independent; generated balances still vary per customer.
Plan 009 adds permanent Delete on each customer card, removing local banking and
report history after confirmation; original batch retries cannot recreate them.
Plan 010 adds admin impersonation from customer details, conditional Exit to Admin,
admin-bound sessions and labeled local activity with Clarity excluded.
Production API runs as `softek` on loopback 3100; development/test uses 3101.
Plan 011 adds Savings & Investing → EasyCoin contextual education and Loans →
eligible fictional auto-loan Skip A Pay invitations, saved discovery preferences
and separate first-party reporting. One contextual recommendation per visit;
the payment flow remains a simulation. The owner accepted automated Dashboard
activity with human saved recordings; missing automated recordings are not a blocker.
Plan 012 replaces the feature submenu with Explore more ways to bank at `/explore`,
a five-group searchable catalog retaining all twelve existing educational pages.
Plan 013 links the Summary widgets to read-only checking, savings and credit card
account pages with owned balances/activity and labeled fictional statement entries.
Plan 014 replaces the large Summary image with a compact inactive banner placeholder
below the three accounts and adds the same strip between balance/activity on each
account page. Plan 015 adds Feature Explorer admin-only banner spaces, catalog-selected widgets,
derived URLs and mobile image configuration. Plan 016 activates the owner-configured Summary widgets with refresh rotation,
real feature links and owned attribution. Checking/savings/credit slots remain
inactive; their activation and wider Explore placements await owner discussion.
Consult `PROJECT_STATE.md` for verified status and the exact next task.

[017 — Clarity API-call tracing in Phoenix](plans/017-clarity-api-phoenix-tracing.md)
is delivered: application calls are mirrored without replacing the hosted SDK,
with a durable MariaDB audit/export queue and private Phoenix access on port 6006.
The independent control is in Clarity Settings; current switch values are in PROJECT_STATE. Schema is 12;
customer collection settings are preserved. LOCAL_SETUP owns the private tunnel
and inspection runbook. Raw upload capture and the stopped missing-recording
inquiry remain separate.

[018 — Phoenix span presentation](plans/018-phoenix-span-presentation.md) adds the
readable call in Input/Attributes, local outcome in Output and bounded Status/Error
for newly exported spans. Kind remains unknown; acknowledged historical spans
are not rewritten. LOCAL_SETUP explains each field and its limits.
