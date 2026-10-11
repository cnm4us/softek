# Local setup and host runbook

Here, "local" means the development workspace on the current EC2 instance.
The M0 frontend/API scaffold runs locally. The public site currently serves the
static test page; banking features are not implemented or deployed yet.

## Verified environment

Observed on 2026-10-10, America/Los_Angeles:

| Item | Observed value |
| --- | --- |
| Workspace | `/home/ubuntu/softek` |
| Operating system | Ubuntu 22.04.5 LTS |
| Git | 2.34.1 |
| Node.js | 22.21.1, installed through the `ubuntu` user's NVM |
| npm | 10.9.4 |
| MariaDB server | 10.6.22-MariaDB-0ubuntu0.22.04.1 |
| MariaDB service | Active |
| Nginx service | Active; dedicated public site for `demo.bawebtech.com` |
| Git remote | `https://github.com/cnm4us/softek.git` |
| Local branch | `main`, initialized without a commit |

Git branch/commit details change; use `PROJECT_STATE.md` and `git status` for
current state. Runtime observations are not pinned dependency requirements.

## Available inspection commands

These commands work in the current shell and do not install the application:

```bash
cd /home/ubuntu/softek
git status --short --branch
git remote -v
node --version
npm --version
mariadb --version
systemctl is-active mariadb
systemctl is-active nginx
```

An uncredentialed connection as `ubuntu` was denied. A read-only server-version
query succeeded through the local administrative socket:

```bash
sudo -n mariadb --batch --skip-column-names -e 'SELECT VERSION();'
```

Use that access only for specifically scoped setup/inspection tasks. Do not run
the API as a database administrator or treat it as the application's credential.

## Provisioned database access

The user supplied admin and application credentials in the ignored `.env` file.
The original two blocks reused `DB_*` names; the admin block was renamed to
`ADMIN_DB_*`, while `DB_*` now identifies only the application connection.
Passwords were preserved. `.env` is owned by `ubuntu` with mode `0600`.

- Application endpoint: TCP `127.0.0.1:3306`.
- Application schema: `demo`, explicitly selected by the user's `DB_NAME`.
- Application username/password: `DB_USER` and `DB_PASSWORD` in `.env`.
- Account host: `127.0.0.1`; the app must connect using the configured TCP endpoint.
- Database encoding: `utf8mb4`, collation `utf8mb4_unicode_ci`.
- Runtime grants: `SELECT`, `INSERT`, `UPDATE`, `DELETE` on `demo.*` only.
  No grant option, schema-management privileges, or global administrative privileges.
- Login with the supplied application password succeeded; reading `mysql.user`
  was denied as expected. The database currently contains no application tables.

The supplied admin login initially returned error 1045. After the user corrected
an unintended trailing character in `.env`, password authentication succeeded
over both the configured TCP endpoint and `/run/mysqld/mysqld.sock`. Admin settings
use `ADMIN_DB_*`; keep them separate from runtime credentials. The earlier
provisioning used `sudo -n mariadb` socket administration, and did not change the
admin account/password. Reverification made no database changes.

Additional access is provisioned and verified:

- Test schema: `demo_test`, with `softek_test_app` restricted to CRUD on that schema.
- Migration account: `softek_migrator`, with CRUD, CREATE, ALTER, DROP, INDEX, and
  REFERENCES on `demo` and `demo_test` only. No global privileges or grant option.
- Generated passwords are stored only in ignored `.env` as `MIGRATION_DB_*` and
  `TEST_DB_*`. Account host is `127.0.0.1` for both.
- `npm run db:provision` provisions these additional resources and can recheck an
  already completed setup. It refuses unknown/partial existing resources.

Both schemas are currently empty: no application migrations exist, and test
fixtures are removed after verification. Provisioning is host bootstrap work;
versioned migrations will create application tables.

## Running the scaffold

Dependencies and the npm lockfile exist. On a fresh checkout use `npm ci`; keep
this instance's private `.env` or restore its credentials securely. Do not replace
the working `.env` with the placeholder example.

```bash
npm run dev
```

The frontend runs at `http://127.0.0.1:5173` and the API at
`http://127.0.0.1:3100`. Vite forwards `/api` to the API. Use VS Code port forwarding
to preview from your own machine; loopback here belongs to EC2. Stop development
servers with Ctrl+C. No persistent application service has been installed.

The API's `/api/health` confirms a database connection. The public `/healthz` is a
separate Nginx-only marker. Test-mode API startup uses the test runtime account.

Next implementation step: M1's first real schema migration and fictional seeds.

Do not recreate or reconfigure the existing MariaDB/Nginx installation for this
project. Do not assume another database or site belongs to Softek.

## Configuration

Database/dev/Clarity-disable settings exist in `.env`.
[`.env.example`](.env.example) contains placeholders, not passwords. Session and
admin-control secrets are planned for the banking-session implementation.

| Setting | Purpose |
| --- | --- |
| `NODE_ENV` | Development/test/presentation behavior |
| `HOST`, `PORT` | Loopback listener address and chosen unused API port |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Scoped runtime database connection |
| `ADMIN_DB_HOST`, `ADMIN_DB_PORT`, `ADMIN_DB_USER`, `ADMIN_DB_PASSWORD` | Supplied admin connection; password login verified over TCP and socket |
| `MIGRATION_DB_USER`, `MIGRATION_DB_PASSWORD` | Separate migration credentials |
| `TEST_DB_NAME`, `TEST_DB_USER`, `TEST_DB_PASSWORD` | Dedicated test schema/runtime connection |
| `SESSION_SECRET` | Server-side session protection; no default production secret |
| `DEMO_ADMIN_SECRET` | Protection for administrative demo controls |
| `CLARITY_ENABLED`, `CLARITY_PROJECT_ID` | Server collection configuration, default off |
| `VITE_CLARITY_ENABLED`, `VITE_CLARITY_PROJECT_ID` | Public browser configuration, default off |

Only public configuration may use `VITE_` variables. Never expose database,
session, or administrative secrets through frontend build variables. The API
currently rejects enabled Clarity flags because integration is not yet
implemented/verified. Automated tests force collection off.

Keep `.env.example` updated with placeholders during scaffolding. Runtime passwords
must not appear in committed examples, shell command arguments, or documentation.
Avoid printing the environment or reading unrelated host configuration wholesale.

## Available npm commands

| Command | Intended purpose |
| --- | --- |
| `npm ci` | Reproducible install from the repository lockfile |
| `npm run dev` | Start API/frontend development processes |
| `npm run build` | Build the complete application |
| `npm run typecheck` | TypeScript checks |
| `npm test` | Eight MariaDB migration-contract scenarios |
| `npm run test:e2e` | Mobile/desktop foundation journeys with Clarity disabled |
| `npm run db:status` | Inspect migration target, applied versions, and drift |
| `npm run db:migrate` | Apply pending schema migrations to the identified target |
| `npm run db:provision` | Provision/recheck scoped test and migration access |

Add `-- --test` to `db:status`/`db:migrate` for `demo_test`. No SQL migrations exist
yet, so `db:migrate` is currently a verified no-op. `db:seed` is not implemented.
Reset will be an application operation scoped to a run, not a database drop.

## Public Nginx site and HTTPS

Live URL: `https://demo.bawebtech.com`. DNS resolves to this instance, and HTTP
redirects to HTTPS. The certificate was issued using the existing production
Certbot account and the webroot authenticator. Its renewal dry run passed.

| Item | Path |
| --- | --- |
| Available site | `/etc/nginx/sites-available/012_demo.bawebtech.com` |
| Enabled symlink | `/etc/nginx/sites-enabled/012_demo.bawebtech.com` |
| Versioned configuration | `deploy/nginx/demo.bawebtech.com.conf` |
| Initial HTTP-only configuration | `deploy/nginx/demo.bawebtech.com.http.conf` |
| Public files | `/var/www/softek/public` |
| Placeholder source | `deploy/placeholder/index.html` |
| ACME webroot | `/var/www/softek/letsencrypt` |
| Certificate/key | `/etc/letsencrypt/live/demo.bawebtech.com/` |
| Site logs | `/var/log/nginx/softek.access.log`, `/var/log/nginx/softek.error.log` |

Only public assets belong in the webroot; the project directory and `.env` are
never served. The public site has no API proxy yet. All preexisting Nginx site
files/links were checked against their prior hashes/targets and remained unchanged.

To redeploy the placeholder/config after reviewing the source:

```bash
sudo install -o ubuntu -g www-data -m 644 deploy/placeholder/index.html /var/www/softek/public/index.html
sudo install -m 644 deploy/nginx/demo.bawebtech.com.conf /etc/nginx/sites-available/012_demo.bawebtech.com
sudo nginx -t && sudo systemctl reload nginx
curl --fail https://demo.bawebtech.com/healthz
```

Nginx reload is asynchronous; wait for the new workers before checking a changed
certificate or redirect. Keep the last known-working configuration for rollback.
To disable this site, remove only its enabled symlink, test, then reload.

The existing `certbot.timer` is active. This certificate has a persisted renewal
hook that tests Nginx and reloads it after a successful renewal. Verify renewal:

```bash
sudo certbot renew --cert-name demo.bawebtech.com --dry-run --non-interactive --no-directory-hooks
```

The banking application still needs an API systemd service and its frontend/API
deployment configuration. The static placeholder remains public until then.

The deployment runbook must identify the target database, migration status,
backup/recovery needs, build command, process restart, and smoke check. Account
for the NVM runtime path when configuring a noninteractive service. Do not restart
or replace unrelated services. This runbook currently deploys only the placeholder.
