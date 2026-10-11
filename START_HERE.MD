# Start here

Softek is a fictional banking application for evaluating how Microsoft Clarity
helps explain adoption of optional banking services.

## Fresh-agent sequence

1. Read [AGENTS.md](AGENTS.md) for working rules.
2. Read [PROJECT_STATE.md](PROJECT_STATE.md) for verified status and the next task.
3. Read [PRODUCT.md](PRODUCT.md) for the intended outcome and design constraints.
4. Read the active milestone in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
5. Read [ARCHITECTURE.md](ARCHITECTURE.md), [LOCAL_SETUP.md](LOCAL_SETUP.md), and
   [TESTING.MD](TESTING.MD) as needed for that task.
6. Inspect `git status --short --branch`, existing code, and relevant migration
   status before editing. Recheck environment facts that may have changed.
7. Complete the next authorized task, run relevant checks, and update the state.

Suggested prompt when opening a fresh thread:

> Read AGENTS.md and START_HERE.MD, inspect PROJECT_STATE.md and the active
> implementation milestone, then continue the next task. Verify current files
> before assuming the documented state is still accurate.

## Document map

| File | Purpose |
| --- | --- |
| [PRODUCT.md](PRODUCT.md) | Product requirements and first-demo definition |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Design boundaries and decision record |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Milestones and task status |
| [BACKLOG.md](BACKLOG.md) | Deferred features and open questions |
| [PROJECT_STATE.md](PROJECT_STATE.md) | Current handoff and verification evidence |
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

The public placeholder runs at `https://demo.bawebtech.com` through Nginx with
Certbot HTTPS. The frontend/API scaffold, shared theme, scoped database accounts,
and tested migration tooling exist. Banking tables, enrollment/use flows, and
Clarity collection have not been implemented. Consult `PROJECT_STATE.md` for
verified status and the exact next task.
