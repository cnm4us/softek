# Tools

## Observed tools

Inventory verified on 2026-10-10, America/Los_Angeles. Recheck before relying on
version-specific behavior.

| Tool | Status | Use |
| --- | --- | --- |
| Bash | Available | Scoped workspace commands |
| Git | 2.34.1 | Local history and supplied GitHub origin |
| Node.js | 22.21.1 via NVM | API/build/tooling runtime |
| npm | 10.9.4 | Workspaces and root lockfile |
| MariaDB CLI | Available, 10.6.22 distribution | Scoped inspection and migration verification |
| MySQL-named CLI | Available | Not a separate database target; use MariaDB terminology/tools |
| systemctl | Available | Read service status; dedicated Softek service operation |
| Nginx | 1.18.0, active | Dedicated HTTPS banking demo for `demo.bawebtech.com` |
| Certbot | 1.21.0; timer active | Webroot certificate, per-certificate reload hook, renewal verified |
| `rg` | Available | First choice for file/text searches |
| Python 3 | 3.10.12 | Optional local documentation checks; not an app dependency |
| pnpm / GitHub CLI (`gh`) | Not found on initial PATH | Not required; use npm and Git |
| Playwright | Installed; Chromium downloaded | Mobile/desktop banking acceptance |

## Git workflow

Local repository: `/home/ubuntu/softek`; origin:
`https://github.com/cnm4us/softek.git`. Initial branch: `main`.

Inspect the working tree before edits and preserve user changes. Make focused
commits when requested or appropriate to the authorized implementation workflow.
Do not push merely because a remote is configured. Local commits record foundation/schema and M1 implementation; no push is
authorized merely by configuring the remote. Consult PROJECT_STATE.md.

Avoid force pushes, resets, or blanket cleans of unknown work. Do not store
credentials in the remote URL. A public/readable remote does not establish push
authentication or authorization.

## Database access

The `ubuntu` user cannot connect as a database user without credentials. Existing
`sudo -n mariadb` socket administration was used to provision the user-configured
`demo` schema and local runtime account. Application TCP login using `.env`
`DB_*` settings is verified; its grants are limited to CRUD on `demo.*`.

The supplied admin settings use `ADMIN_DB_*`; password login is verified over TCP
and socket after the user corrected `.env`. `softek_migrator` has schema-management
privileges only on `demo`/`demo_test`; `softek_test_app` has CRUD only on `demo_test`.
Generated secrets are private in `.env`; see `LOCAL_SETUP.md`.

Use explicit schema selection, migration status, and parameterized application
queries. Keep credentials outside committed files and command-line arguments.
The migration contract is in [db/migrations/README.md](db/migrations/README.md).

## Browser and analytics tools

Use Playwright for reproducible journeys and browser tooling for actual layout
inspection. Check screenshots at mobile and desktop widths; a successful build
does not establish visual quality.

Clarity is an optional evaluation tool. Verify current official API, masking,
consent/collection guidance, and observed recordings before relying on behavior.
Keep routine development and test traffic separate from presentation data.

## Official references for implementation

- [MariaDB Node.js connector](https://mariadb.com/docs/connectors/mariadb-connector-nodejs)
- [MariaDB implicit-commit statements](https://mariadb.com/docs/server/reference/sql-statements/transactions/sql-statements-that-cause-an-implicit-commit)
- [Clarity setup](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-setup)
- [Clarity client API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-api)
- [Clarity ConsentV2](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2)
- [Clarity custom tags](https://learn.microsoft.com/en-us/clarity/filters/custom-tags)
- [Certbot webroot and renewal](https://eff-certbot.readthedocs.io/en/stable/using.html)
- [Nginx server configuration](https://nginx.org/en/docs/http/ngx_http_core_module.html)

References do not imply that Clarity has been configured or its current behavior
verified. Prefer primary documentation when selecting packages or implementing APIs.
