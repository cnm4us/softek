import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mariadb from 'mariadb';
import { databaseConfig } from '../apps/api/src/config.js';
import { migrate } from '../scripts/lib/migrations.js';

test('committed impersonation migration creates clean additive probes and repeats without changing retained visits', async () => {
  const c = await mariadb.createConnection(databaseConfig('migration', true));
  const dir = await mkdtemp(join(tmpdir(), 'softek-impersonation-migration-'));
  let owned = false;
  try {
    const existing = await c.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('impersonation_sessions_probe','visit_contexts_probe','_contract_migrations')",
    );
    assert.equal(existing.length, 0, 'Do not overwrite probe fixtures.');
    owned = true;
    const visits = await c.query('SELECT * FROM visits ORDER BY id');
    const layout = await c.query('SHOW COLUMNS FROM visits');
    const sql = (
      await readFile('db/migrations/0008_admin_impersonation.sql', 'utf8')
    )
      .replaceAll('impersonation_sessions', 'impersonation_sessions_probe')
      .replaceAll('visit_contexts', 'visit_contexts_probe');
    await writeFile(join(dir, '0008_admin_impersonation.sql'), sql);
    const options = { test: true, contract: true, directory: dir };
    assert.equal((await migrate(options)).applied.length, 1);
    assert.equal((await migrate(options)).applied.length, 1);
    assert.deepEqual(await c.query('SELECT * FROM visits ORDER BY id'), visits);
    assert.deepEqual(await c.query('SHOW COLUMNS FROM visits'), layout);
    assert.equal(
      (await c.query('SHOW COLUMNS FROM impersonation_sessions_probe')).length,
      8,
    );
    assert.equal(
      (await c.query('SHOW COLUMNS FROM visit_contexts_probe')).length,
      3,
    );
    await assert.rejects(
      c.query(
        "INSERT INTO visit_contexts_probe VALUES ('missing','admin_impersonation','context')",
      ),
    );
  } finally {
    if (owned) {
      await c.query('DROP TABLE IF EXISTS visit_contexts_probe');
      await c.query('DROP TABLE IF EXISTS impersonation_sessions_probe');
      await c.query('DROP TABLE IF EXISTS _contract_migrations');
    }
    await c.end();
    await rm(dir, { recursive: true, force: true });
  }
});
