import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mariadb from 'mariadb';
import { databaseConfig } from '../apps/api/src/config.js';
import { migrate } from '../scripts/lib/migrations.js';
test('committed discovery SQL creates clean additive tables without changing existing layouts', async () => {
  const c = await mariadb.createConnection(databaseConfig('migration', true));
  const dir = await mkdtemp(join(tmpdir(), 'softek-discovery-migration-'));
  const names = [
    'discovery_preferences_probe',
    'discovery_presentations_probe',
    'discovery_feature_observations_probe',
    '_contract_migrations',
  ];
  let owned = false;
  try {
    const tables = await c.query(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?)',
      [names],
    );
    assert.equal(tables.length, 0, 'Never overwrite existing probe fixtures.');
    owned = true;
    const before = await c.query('SHOW COLUMNS FROM interaction_events');
    const count = await c.query('SELECT COUNT(*) AS n FROM interaction_events');
    let sql = await readFile(
      'db/migrations/0009_contextual_discovery.sql',
      'utf8',
    );
    for (const name of names.slice(0, 3))
      sql = sql.replaceAll(name.replace('_probe', ''), name);
    await writeFile(join(dir, '0009_contextual_discovery.sql'), sql);
    const options = { test: true, contract: true, directory: dir };
    assert.equal((await migrate(options)).applied.length, 1);
    assert.equal((await migrate(options)).applied.length, 1);
    assert.deepEqual(
      await c.query('SHOW COLUMNS FROM interaction_events'),
      before,
    );
    assert.deepEqual(
      await c.query('SELECT COUNT(*) AS n FROM interaction_events'),
      count,
    );
    assert.equal(
      (await c.query('SHOW COLUMNS FROM discovery_presentations_probe')).length,
      12,
    );
    await assert.rejects(
      c.query(
        "INSERT INTO discovery_preferences_probe VALUES ('missing',FALSE,FALSE,UTC_TIMESTAMP(6))",
      ),
    );
  } finally {
    if (owned)
      for (const name of [names[2], names[1], names[0], names[3]])
        await c.query(`DROP TABLE IF EXISTS ${name}`);
    await c.end();
    await rm(dir, { recursive: true, force: true });
  }
});
