# MariaDB schema migration contract

Status: migrations `0001_demo_foundation.sql` through
`0007_customer_browser_profiles.sql` are committed and applied to `demo` and `demo_test`.
Both ledgers are version 7, no pending/checksum drift. 0007 was committed in
**7eb7290** before application. It adds per-user device/browser preferences;
existing users/runs/history and 0006 balances are unchanged. Scoped production
schema/data/ledger backup (0600):
`/var/backups/softek/demo-before-0007-20261012T004021Z.sql`.
Applied files are immutable; next schema change uses `0008_<description>.sql`.
0005's persistent collection switch and its earlier backup remain intact.
Earlier 0004 appends two feature ENUM values; its committed history and backup
are preserved in PROJECT_STATE.

Migrations 0002/0003 were committed in `e239925` before test application. Production
backup including the ledger: `/var/backups/softek/demo-before-0002-20261011T165522Z.sql`
(private, 0600). All ten pre-upgrade run IDs and retained banking/history rows
were preserved. Anonymous historical ownership remains NULL; no user is inferred
from a legacy cookie. The first authenticated release replaces public anonymous
entry: old releases are not a compatible public authentication rollback. See
[LOCAL_SETUP.md](../../LOCAL_SETUP.md#rollback-and-renewal).

## Implemented commands

```bash
npm run db:status
npm run db:migrate
npm run db:status -- --test
npm run db:migrate -- --test
```

The runner uses `scripts/lib/migrations.ts`, the scoped `MIGRATION_DB_*` account,
and an explicit allowlist: `demo` normally, `demo_test` with `--test`. It does not
accept an arbitrary CLI database or migration-directory override. Status is read
only. Applying an empty migration set is a no-op and creates no ledger.

The ledger is `_schema_migrations`. A schema-specific `GET_LOCK` prevents
concurrent applications. Changed/missing applied files, duplicate versions,
historical insertions, and unresolved running/failed records stop application.
Migration files execute as reviewed MariaDB SQL; do not use client-only
`DELIMITER` directives or leave a transaction open at the end of a file.

`npm test` exercises clean/upgrade/no-op/drift/locking/partial-failure behavior
against its own `_contract_migrations` test ledger / probe tables on `demo_test`,
leaving the application ledger and tables intact; see [TESTING.MD](../../TESTING.MD).

## Files and ownership

- Use ordered filenames: `0001_demo_foundation.sql`, `0002_<description>.sql`, etc.
- Commit each schema change with its code and relevant validation.
- Applied files are immutable. Corrections use the next migration.
- SQL targets MariaDB only; MySQL portability is not required.
- Fixtures belong in `db/seeds/`; participant reset belongs in application logic.
- Only the migration runner manages the schema ledger. Do not bypass it with
  manual DDL, ORM schema push, or automatic application-startup migrations.

## Runner requirements

1. Validate the configured schema against the explicit Softek environment
   allowlist. Display target host/schema without credentials. Use a scoped
   migration account and prevent accidental operations against other databases.
2. Provide status without applying changes: current versions, pending files,
   failed/running records, missing applied files, and checksum drift.
3. Acquire a schema-specific migration lock so concurrent runners cannot apply
   the same migration. Hold/release it through the entire application sequence.
4. Track version, filename, SHA-256 checksum, start/completion time, and result in
   a migration ledger. Fail on modified or missing applied files, duplicate IDs,
   reordered historical insertions, or unresolved failed/running migrations.
5. Apply pending migrations in order and stop at the first failure. A repeat run
   with no pending work must be a no-op.
6. Do not assume a whole DDL migration can be rolled back. Record failures clearly
   and refuse blind automatic retries after a partially applied migration.
7. Provide explicit, documented recovery steps to inspect partial state, repair
   or restore it, and reconcile the ledger only after verifying the intended
   schema. Never silently mark a failed migration as successful.
8. Validate behavior on a dedicated MariaDB test schema before the runner or a
   new migration is used against retained demo data.

Many MariaDB DDL operations commit implicitly; see
[MariaDB's documentation](https://mariadb.com/docs/server/reference/sql-statements/transactions/sql-statements-that-cause-an-implicit-commit).
Keep migrations small and reviewable so recovery is concrete.

## Applying a schema change

1. Inspect target environment and migration status.
2. Review the SQL and whether retained data needs a backup or transformation.
3. Run the clean-schema and applicable upgrade checks on the dedicated test schema.
4. Apply only to the intended Softek schema and verify status afterward.
5. Run focused API/browser smoke checks and update `PROJECT_STATE.md`.

Prefer forward corrective migrations. A previous application version is safe to
restore only when compatible with the resulting schema. Destructive migrations
need a specific backup/recovery plan and authorization within the current task.

## First schema acceptance

The first real migration should define the minimal M1 model, relationships,
participant scoping, constraints, and useful reporting/query indexes. Review it
against `ARCHITECTURE.md` before execution. The actual applied version is **7**; current evidence is in `PROJECT_STATE.md`.

## Partial-failure recovery

The runner stores only an error code in the failed ledger entry, leaves the
partial schema visible, and blocks subsequent application. An interrupted process
can leave a `running` record, which blocks retries in the same way.

Before migrating retained data, take a schema/data backup including the ledger.
After a partial failure, inspect the schema and recorded migration, restore that
pre-migration backup to the same identified Softek schema, and rerun status before
attempting corrected work. Recover from a verified backup rather than editing
checksums or blindly marking a failed record applied. No automatic rollback or
ledger-forcing command is provided. If no verified backup exists, stop application
and develop a scoped repair/recovery plan from the actual partial state.
