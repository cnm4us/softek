import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mariadb from 'mariadb';
import { databaseConfig } from '../apps/api/src/config.js';
import { migrate } from '../scripts/lib/migrations.js';

test('change-capture migration preserves legacy inserts, enables early frames and blocks partial-DDL retry', async () => {
  const c = await mariadb.createConnection(databaseConfig('migration', true));
  const dir = await mkdtemp(join(tmpdir(), 'softek-change-migration-'));
  const names = [
    'screenshot_frame_context',
    'screenshot_events',
    'screenshot_frames',
    'screenshot_recordings',
  ];
  const tables = names.map((n) => n + '_change_probe');
  let owned = false;
  const rewrite = (s: string) =>
    names.reduce(
      (out, name) => out.replaceAll(name, name + '_change_probe'),
      s,
    );
  try {
    assert.equal(
      (
        await c.query(
          `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${tables.map(() => '?').join(',')},'_contract_migrations')`,
          tables,
        )
      ).length,
      0,
    );
    owned = true;
    await writeFile(
      join(dir, '0013_screenshot_recordings.sql'),
      rewrite(
        await readFile('db/migrations/0013_screenshot_recordings.sql', 'utf8'),
      ),
    );
    const options = { test: true, contract: true, directory: dir };
    await migrate(options);
    await c.query('SET FOREIGN_KEY_CHECKS=0');
    const id = '01234567-89ab-4cde-8fab-0123456789ab';
    await c.query(
      `INSERT INTO screenshot_recordings_change_probe (id,user_id,run_id,session_hash,credential_hash,request_id,document_id,approval_version,state,started_at,heartbeat_at,credential_expires_at,retained_until) VALUES (?,?,?,REPEAT('a',64),REPEAT('b',64),?,?,'screenshots-v1','stopped',UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP())`,
      [id, id, id, id, id],
    );
    await c.query(
      `INSERT INTO screenshot_frames_change_probe VALUES (?,1,UTC_TIMESTAMP(),UTC_TIMESTAMP(),1000,20,720,1000,100,REPEAT('a',64),REPEAT('b',64),FALSE)`,
      [id],
    );
    await c.query('SET FOREIGN_KEY_CHECKS=1');
    const sql = rewrite(
      await readFile('db/migrations/0014_change_triggered_capture.sql', 'utf8'),
    );
    await writeFile(join(dir, '0014_change_triggered_capture.sql'), sql);
    assert.equal((await migrate(options)).applied.length, 2);
    assert.equal((await migrate(options)).applied.length, 2);
    const [legacy] = await c.query(
      'SELECT capture_policy,received_events,event_bytes FROM screenshot_recordings_change_probe WHERE id=?',
      [id],
    );
    assert.equal(legacy.capture_policy, 'periodic-v1');
    assert.equal(Number(legacy.received_events), 0);
    assert.equal(Number(legacy.event_bytes), 0);
    assert.equal(
      (await c.query('SHOW COLUMNS FROM screenshot_frames_change_probe'))
        .length,
      12,
    );
    await c.query(
      `INSERT INTO screenshot_frames_change_probe VALUES (?,2,UTC_TIMESTAMP(),UTC_TIMESTAMP(),0,20,720,1000,100,REPEAT('a',64),REPEAT('b',64),FALSE)`,
      [id],
    );
    await c.query(
      `INSERT INTO screenshot_frame_context_change_probe VALUES (?,2,'{"reason":"start"}')`,
      [id],
    );
    await c.query(
      `INSERT INTO screenshot_events_change_probe VALUES (?,1,0,'tap','{}',REPEAT('a',64),?,UTC_TIMESTAMP())`,
      [id, id],
    );
    await c.query('DELETE FROM screenshot_recordings_change_probe WHERE id=?', [
      id,
    ]);
    assert.equal(
      Number(
        (
          await c.query('SELECT COUNT(*) n FROM screenshot_events_change_probe')
        )[0].n,
      ),
      0,
    );
    for (const name of [...tables, '_contract_migrations'])
      await c.query(`DROP TABLE IF EXISTS ${name}`);
    await rm(join(dir, '0014_change_triggered_capture.sql'));
    await migrate(options);
    await writeFile(
      join(dir, '0014_change_triggered_capture.sql'),
      sql.replace(
        'CREATE TABLE screenshot_frame_context_change_probe',
        'INSERT INTO nonexistent_change_probe VALUES (1); CREATE TABLE screenshot_frame_context_change_probe',
      ),
    );
    await assert.rejects(migrate(options), /failed/);
    assert.equal(
      (
        await c.query(
          "SHOW COLUMNS FROM screenshot_recordings_change_probe LIKE 'capture_policy'",
        )
      ).length,
      1,
    );
    await assert.rejects(migrate(options), /Unresolved failed/);
  } finally {
    await c.query('SET FOREIGN_KEY_CHECKS=1');
    if (owned)
      for (const name of [...tables, '_contract_migrations'])
        await c.query(`DROP TABLE IF EXISTS ${name}`);
    await c.end();
    await rm(dir, { recursive: true, force: true });
  }
});
