# Agent working agreement

## Start here

Read [START_HERE.MD](START_HERE.MD), then [PROJECT_STATE.md](PROJECT_STATE.md),
[PRODUCT.md](PRODUCT.md), and the active plan linked from the state registry.
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) is the roadmap/index; detailed
task checklists live in `plans/`. Read architecture, setup, and
testing guidance for the task before changing code. Inspect the actual files and
Git status; documentation is context, not proof that code exists or checks pass.

The latest user instructions take precedence. The original
[handoff](agents/plans/initial_handoff.md) is historical background. Its Windows,
local MySQL, and separate EC2 deployment assumptions have been superseded.

## Project constraints

- Work in `/home/ubuntu/softek` on the existing Ubuntu EC2 instance.
- Target MariaDB only. Do not add MySQL portability requirements.
- Build a mobile-first banking demo with one consistent theme and good desktop
  layouts. Use shared tokens and components, not independent screen styling.
- Use fictional identities, accounts, and simulated money movement only.
- Deliver the first complete adoption experiment before expanding banking scope.
- Store persistent state and structured adoption events in MariaDB. The backend
  confirms successful enrollments and service actions.
- Keep Clarity disabled in routine development and automated tests. Enabling
  collection requires verified project settings, masking, and collection rules.
- Treat the EC2 host as shared: change only this project's database, processes,
  files, and explicitly identified web-server configuration.

## Working discipline

- Implement authorized work without repeatedly requesting permission for routine,
  reversible decisions. Ask for missing information only when it affects the work;
  continue independent tasks while waiting.
- Inspect existing implementation before replacing it. Keep scope proportionate
  to a demo; avoid speculative abstractions and unrelated cleanup.
- Record consequential design choices in `ARCHITECTURE.md`, including their
  rationale and whether they are user requirements or working choices.
- Track work by task IDs in the relevant `plans/` document and `BACKLOG.md`. Mark work
  complete only when its acceptance criteria have been checked.
- Use the smallest meaningful checks for the change. No application tests are
  needed for prose-only edits; check links, consistency, and Git diff instead.
- Do not expose credentials in commands, logs, documentation, or commits. Use
  ignored environment files and placeholder-only examples.
- Do not push, publish, enable collection, or change unrelated services merely
  because access exists. Respect the scope of the current user request.
- Do not delegate to sub-agents unless the user explicitly requests delegation.

## Database changes

All application schema changes use numbered, committed SQL migrations under
`db/migrations/`. See [the migration contract](db/migrations/README.md).

Do not manually patch a table as a substitute for a migration. Applied migrations
are immutable; fixes use new migrations. Keep deterministic seeds and participant
reset logic separate from schema migrations. Never use resets to drop a database.

Before applying a migration, establish the exact host, schema, and migration
account; inspect current migration status. Use only dedicated Softek schemas.
The application's runtime account must not be a database administrator.

MariaDB schema operations can commit implicitly. A migration needs a documented
recovery path when a failure can leave partial changes. Back up retained data
before destructive schema changes; resolve destructive or shared-host scope with
the user if the current request does not authorize it.

## Durable documentation

Keep each fact in its primary document; link rather than copying long sections:

| Document | Owns |
| --- | --- |
| `PRODUCT.md` | Goals, scope, UX, adoption definitions, acceptance criteria |
| `ARCHITECTURE.md` | System design, data boundaries, design decisions |
| `IMPLEMENTATION_PLAN.md` | Ordered roadmap, plan links, and dependencies |
| `plans/NNN-short-description.md` | Individual scope, task checklist, and acceptance criteria |
| `BACKLOG.md` | Deferred work and unresolved questions |
| `PROJECT_STATE.md` | Canonical plan status registry, current reality, evidence, blockers, exact resume point |
| `LOCAL_SETUP.md` | Reproducible setup and operational runbook |
| `TESTING.MD` | Test strategy, commands, and acceptance coverage |
| `TOOLS.md` | Tool inventory and safe usage |
| `START_HERE.MD` | Navigation and fresh-agent startup sequence |

Before handing off or ending an implementation session, update
`PROJECT_STATE.md` with what changed, checks actually run, known failures,
uncommitted work, and the next concrete task. Update the individual plan's
checkboxes, the state registry, and the backlog when progress changes. Plans link
to the registry rather than duplicating lifecycle statuses. Active planning is
not authorization to implement; preserve the user's current request scope.
Update setup/testing commands in the same change that makes
them available. Never report a planned command as executable.

Do not append chat transcripts or duplicate full plans into state. Keep it short,
current, and sufficient for a new agent to continue. Preserve the original handoff
as background; use the maintained root documents for current direction.
