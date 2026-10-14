import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mariadb from 'mariadb';
import { databaseConfig } from '../apps/api/src/config.js';
import { migrate } from '../scripts/lib/migrations.js';
test('committed tracing migration is additive, initially off and repeat-safe', async () => {
  const c = await mariadb.createConnection(databaseConfig('migration', true));
  const dir = await mkdtemp(join(tmpdir(), 'softek-trace-schema-'));
  const tables = [
    'clarity_api_calls_probe',
    'clarity_trace_contexts_probe',
    'clarity_tracing_probe',
    '_contract_migrations',
  ];
  let owned = false;
  try {
    assert.equal(
      (
        await c.query(
          `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${tables.map(() => '?').join(',')})`,
          tables,
        )
      ).length,
      0,
    );
    owned = true;
    const before = await c.query('SHOW COLUMNS FROM interaction_events');
    let sql = await readFile(
      'db/migrations/0012_clarity_api_tracing.sql',
      'utf8',
    );
    for (const name of tables.slice(0, 3))
      sql = sql.replaceAll(name.replace('_probe', ''), name);
    await writeFile(join(dir, '0012_clarity_api_tracing.sql'), sql);
    const options = { test: true, contract: true, directory: dir };
    assert.equal((await migrate(options)).applied.length, 1);
    assert.equal((await migrate(options)).applied.length, 1);
    const [config] = await c.query(
      'SELECT enabled FROM clarity_tracing_probe WHERE id=1',
    );
    assert.equal(Boolean(config.enabled), false);
    assert.deepEqual(
      await c.query('SHOW COLUMNS FROM interaction_events'),
      before,
    );
    await assert.rejects(
      c.query(
        "INSERT INTO clarity_trace_contexts_probe (id,user_id,run_id,visit_id,document_id,session_hash,collection_revision,tracing_revision,consent_at,expires_at) VALUES (UUID(),UUID(),UUID(),UUID(),UUID(),REPEAT('a',64),UUID(),UUID(),UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",
      ),
    );
  } finally {
    if (owned)
      for (const name of tables) await c.query(`DROP TABLE IF EXISTS ${name}`);
    await c.end();
    await rm(dir, { recursive: true, force: true });
  }
});
