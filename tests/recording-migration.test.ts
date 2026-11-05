import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mariadb from 'mariadb';
import { databaseConfig } from '../apps/api/src/config.js';
import { migrate } from '../scripts/lib/migrations.js';

test('recording migration adds empty private metadata tables and is repeat-safe', async () => {
  const c = await mariadb.createConnection(databaseConfig('migration', true));
  const dir = await mkdtemp(join(tmpdir(), 'softek-recording-schema-'));
  const tables = [
    'screenshot_frames_probe',
    'screenshot_recordings_probe',
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
    const before = await c.query('SHOW COLUMNS FROM participant_runs');
    let sql = await readFile(
      'db/migrations/0013_screenshot_recordings.sql',
      'utf8',
    );
    for (const name of tables.slice(0, 2))
      sql = sql.replaceAll(name.replace('_probe', ''), name);
    await writeFile(join(dir, '0013_screenshot_recordings.sql'), sql);
    const options = { test: true, contract: true, directory: dir };
    assert.equal((await migrate(options)).applied.length, 1);
    assert.equal((await migrate(options)).applied.length, 1);
    assert.equal(
      (
        await c.query('SELECT COUNT(*) AS n FROM screenshot_recordings_probe')
      )[0].n,
      0n,
    );
    assert.deepEqual(
      await c.query('SHOW COLUMNS FROM participant_runs'),
      before,
    );
    await assert.rejects(
      c.query(
        "INSERT INTO screenshot_frames_probe VALUES (UUID(),1,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),1000,20,720,1000,100,REPEAT('a',64),REPEAT('b',64),FALSE)",
      ),
    );
    const [col] = await c.query(
      "SHOW COLUMNS FROM screenshot_recordings_probe LIKE 'state'",
    );
    assert.match(col.Type, /interrupted/);
    assert.match(col.Type, /deleting/);
    // Exercise this two-table migration's partial-DDL boundary on owned probes.
    for (const name of tables) await c.query(`DROP TABLE IF EXISTS ${name}`);
    await writeFile(
      join(dir, '0013_screenshot_recordings.sql'),
      sql.replace(
        'CREATE TABLE screenshot_frames_probe',
        'INSERT INTO nonexistent_recording_probe VALUES (1); CREATE TABLE screenshot_frames_probe',
      ),
    );
    await assert.rejects(migrate(options), /failed/);
    assert.equal(
      (await c.query("SHOW TABLES LIKE 'screenshot_recordings_probe'")).length,
      1,
    );
    assert.equal(
      (await c.query("SHOW TABLES LIKE 'screenshot_frames_probe'")).length,
      0,
    );
    await assert.rejects(migrate(options), /Unresolved failed/);
  } finally {
    if (owned)
      for (const name of tables) await c.query(`DROP TABLE IF EXISTS ${name}`);
    await c.end();
    await rm(dir, { recursive: true, force: true });
  }
});
