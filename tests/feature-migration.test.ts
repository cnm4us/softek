import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mariadb from 'mariadb';
import { databaseConfig } from '../apps/api/src/config.js';
import { migrate } from '../scripts/lib/migrations.js';

test('committed feature ENUM upgrade preserves old rows/ordinals and repeats cleanly', async () => {
  const c = await mariadb.createConnection(databaseConfig('migration', true));
  const dir = await mkdtemp(join(tmpdir(), 'softek-feature-enum-'));
  let owned = false;
  try {
    const existing = await c.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('feature_enum_probe','_contract_migrations')",
    );
    assert.equal(
      existing.length,
      0,
      'Existing probe/ledger must not be overwritten.',
    );
    owned = true;
    const old = [
      'banner_visible',
      'banner_clicked',
      'page_view',
      'menu_open',
      'menu_selected',
      'placeholder_action',
    ];
    await writeFile(
      join(dir, '0001_probe.sql'),
      `CREATE TABLE feature_enum_probe (id INT PRIMARY KEY, name ENUM(${old.map((s) => `'${s}'`).join(',')}) NOT NULL);`,
    );
    const options = { test: true, contract: true, directory: dir };
    await migrate(options);
    for (const [i, name] of old.entries())
      await c.query('INSERT INTO feature_enum_probe VALUES (?,?)', [
        i + 1,
        name,
      ]);
    const before = await c.query(
      'SELECT id,name,name+0 AS ordinal FROM feature_enum_probe ORDER BY id',
    );
    const sql = (
      await readFile('db/migrations/0004_feature_interactions.sql', 'utf8')
    ).replace(
      'ALTER TABLE interaction_events',
      'ALTER TABLE feature_enum_probe',
    );
    await writeFile(join(dir, '0004_feature_interactions.sql'), sql);
    assert.equal((await migrate(options)).applied.length, 2);
    assert.deepEqual(
      await c.query(
        'SELECT id,name,name+0 AS ordinal FROM feature_enum_probe ORDER BY id',
      ),
      before,
    );
    await c.query(
      "INSERT INTO feature_enum_probe VALUES (7,'feature_viewed'),(8,'feature_cta_clicked')",
    );
    assert.equal((await migrate(options)).applied.length, 2);
    const rows = await c.query(
      'SELECT name,name+0 AS ordinal FROM feature_enum_probe ORDER BY id',
    );
    assert.equal(Number(rows[6].ordinal), 7);
    assert.equal(Number(rows[7].ordinal), 8);
    assert.equal(rows.length, 8);
  } finally {
    if (owned) {
      await c.query('DROP TABLE IF EXISTS feature_enum_probe');
      await c.query('DROP TABLE IF EXISTS _contract_migrations');
    }
    await c.end();
    await rm(dir, { recursive: true, force: true });
  }
});
