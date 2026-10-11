import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import mariadb from 'mariadb';
import { databaseConfig } from '../apps/api/src/config.js';
import { migrate, migrationStatus } from '../scripts/lib/migrations.js';

test('migration contract against dedicated MariaDB test schema', async t => {
  const connection = await mariadb.createConnection(databaseConfig('migration', true));
  const directory = await mkdtemp(join(tmpdir(), 'softek-migrations-'));
  const options = { test: true, directory };
  const tables = ['_schema_migrations', 'migration_probe', 'upgrade_probe', 'partial_probe'];
  let cleanupAllowed = false;
  try {
    const existing = await connection.query('SHOW TABLES');
    assert.equal(existing.length, 0, 'Migration contract tests require an empty demo_test schema; refusing to erase existing data.');
    cleanupAllowed = true;
    await t.test('empty status/migrate do not create a ledger', async () => {
      assert.equal((await migrationStatus(options)).ledgerExists, false);
      assert.equal((await migrate(options)).ledgerExists, false);
    });
    await writeFile(join(directory, '0001_probe.sql'), 'CREATE TABLE migration_probe (id INT PRIMARY KEY); INSERT INTO migration_probe VALUES (1);');
    await t.test('clean application and repeat no-op', async () => {
      assert.equal((await migrate(options)).applied.length, 1);
      assert.equal((await migrate(options)).applied.length, 1);
      const result = await connection.query('SELECT COUNT(*) AS count FROM migration_probe');
      assert.equal(Number(result[0].count), 1);
    });
    await t.test('modified applied SQL is rejected', async () => {
      await writeFile(join(directory, '0001_probe.sql'), 'DROP TABLE migration_probe;');
      await assert.rejects(migrate(options), /Applied file changed/);
      await writeFile(join(directory, '0001_probe.sql'), 'CREATE TABLE migration_probe (id INT PRIMARY KEY); INSERT INTO migration_probe VALUES (1);');
    });
    await t.test('missing applied files and duplicate versions are rejected', async () => {
      await rm(join(directory, '0001_probe.sql'));
      await assert.rejects(migrate(options), /Applied file missing/);
      await writeFile(join(directory, '0001_probe.sql'), 'CREATE TABLE migration_probe (id INT PRIMARY KEY); INSERT INTO migration_probe VALUES (1);');
      await writeFile(join(directory, '0001_duplicate.sql'), 'SELECT 1;');
      await assert.rejects(migrate(options), /Duplicate migration version/);
      await rm(join(directory, '0001_duplicate.sql'));
    });
    await writeFile(join(directory, '0003_upgrade.sql'), 'CREATE TABLE upgrade_probe (id INT PRIMARY KEY);');
    await t.test('concurrent migration attempt is blocked', async () => {
      await connection.query("SELECT GET_LOCK('softek:migrations:demo_test', 0)");
      try { await assert.rejects(migrate(options), /Another migration runner/); }
      finally { await connection.query("SELECT RELEASE_LOCK('softek:migrations:demo_test')"); }
    });
    await t.test('upgrade applies only the new file', async () => {
      assert.equal((await migrate(options)).applied.length, 2);
    });
    await t.test('historical insertion is rejected', async () => {
      await writeFile(join(directory, '0002_late.sql'), 'SELECT 1;');
      await assert.rejects(migrate(options), /Historical insertion/);
      await rm(join(directory, '0002_late.sql'));
    });
    await t.test('partial DDL failure remains visible and cannot be blindly retried', async () => {
      await writeFile(join(directory, '0004_partial.sql'), 'CREATE TABLE partial_probe (id INT); INSERT INTO nonexistent_probe VALUES (1);');
      await assert.rejects(migrate(options), /failed/);
      const status = await migrationStatus(options);
      assert.equal(status.applied.at(-1)?.state, 'failed');
      assert.ok(status.problems.some(problem => problem.includes('Unresolved failed')));
      const partial = await connection.query("SHOW TABLES LIKE 'partial_probe'");
      assert.equal(partial.length, 1);
      await assert.rejects(migrate(options), /Unresolved failed/);
    });
  } finally {
    if (cleanupAllowed) for (const table of tables) await connection.query(`DROP TABLE IF EXISTS \`${table}\``);
    await connection.end();
    await rm(directory, { recursive: true, force: true });
  }
});
