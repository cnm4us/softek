import mariadb from 'mariadb';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { databaseConfig, projectRoot } from '../../apps/api/src/config.js';

type Connection = Awaited<ReturnType<typeof mariadb.createConnection>>;
type Migration = { version: number; filename: string; checksum: string; sql: string };
type Entry = { version: number; filename: string; checksum: string; state: 'running' | 'applied' | 'failed'; error_code: string | null };
export type Options = { test?: boolean; directory?: string };
export type Status = { database: string; ledgerExists: boolean; applied: Entry[]; pending: string[]; problems: string[] };

const ledger = '_schema_migrations';

async function files(directory: string): Promise<Migration[]> {
  const migrations: Migration[] = [];
  for (const filename of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
    const match = /^(\d{4})_([a-z0-9_]+)\.sql$/.exec(filename);
    if (!match || Number(match[1]) < 1) throw new Error(`Invalid migration filename: ${filename}`);
    const bytes = await readFile(resolve(directory, filename));
    if (!bytes.toString('utf8').trim()) throw new Error(`Empty migration: ${filename}`);
    const version = Number(match[1]);
    if (migrations.some(item => item.version === version)) throw new Error(`Duplicate migration version: ${version}`);
    migrations.push({ version, filename, checksum: createHash('sha256').update(bytes).digest('hex'), sql: bytes.toString('utf8') });
  }
  return migrations.sort((a, b) => a.version - b.version);
}

async function inspect(connection: Connection, migrations: Migration[]): Promise<Status> {
  const exists = await connection.query('SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?', [ledger]);
  const ledgerExists = Number(exists[0].count) > 0;
  const applied: Entry[] = ledgerExists ? await connection.query(`SELECT version, filename, checksum, state, error_code FROM ${ledger} ORDER BY version`) : [];
  const problems: string[] = [];
  for (const entry of applied) {
    const migration = migrations.find(item => item.version === entry.version);
    if (!migration) problems.push(`Applied file missing for version ${entry.version}`);
    else if (migration.filename !== entry.filename || migration.checksum !== entry.checksum) problems.push(`Applied file changed: ${entry.filename}`);
    if (entry.state !== 'applied') problems.push(`Unresolved ${entry.state} migration: ${entry.filename}`);
  }
  const lastVersion = applied.reduce((max, item) => Math.max(max, item.version), 0);
  const pending = migrations.filter(item => !applied.some(entry => entry.version === item.version));
  for (const migration of pending) {
    if (migration.version < lastVersion) problems.push(`Historical insertion: ${migration.filename}`);
  }
  const rows = await connection.query('SELECT DATABASE() AS name');
  return { database: rows[0].name, ledgerExists, applied: [...applied], pending: pending.map(item => item.filename), problems };
}

export async function migrationStatus(options: Options = {}): Promise<Status> {
  const migrations = await files(options.directory ?? resolve(projectRoot, 'db/migrations'));
  const connection = await mariadb.createConnection(databaseConfig('migration', options.test));
  try { return await inspect(connection, migrations); }
  finally { await connection.end(); }
}

export async function migrate(options: Options = {}): Promise<Status> {
  const migrations = await files(options.directory ?? resolve(projectRoot, 'db/migrations'));
  const config = databaseConfig('migration', options.test);
  const connection = await mariadb.createConnection({ ...config, multipleStatements: true });
  const lockName = `softek:migrations:${config.database}`;
  let locked = false;
  try {
    const result = await connection.query('SELECT GET_LOCK(?, 0) AS acquired', [lockName]);
    locked = Number(result[0].acquired) === 1;
    if (!locked) throw new Error('Another migration runner is active for this schema.');
    const status = await inspect(connection, migrations);
    if (status.problems.length) throw new Error(status.problems.join('; '));
    // No migrations means no ledger creation or application schema mutation.
    if (!status.pending.length) return status;
    await connection.query(`CREATE TABLE IF NOT EXISTS ${ledger} (
      version INT UNSIGNED PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      state ENUM('running','applied','failed') NOT NULL,
      started_at DATETIME(6) NOT NULL,
      completed_at DATETIME(6) NULL,
      error_code VARCHAR(64) NULL
    ) ENGINE=InnoDB`);
    for (const migration of migrations.filter(item => status.pending.includes(item.filename))) {
      await connection.query(`INSERT INTO ${ledger} (version,filename,checksum,state,started_at) VALUES (?,?,?,'running',UTC_TIMESTAMP(6))`, [migration.version, migration.filename, migration.checksum]);
      try {
        await connection.query(migration.sql);
        await connection.query(`UPDATE ${ledger} SET state='applied',completed_at=UTC_TIMESTAMP(6) WHERE version=?`, [migration.version]);
      } catch (error) {
        const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'UNKNOWN';
        await connection.query(`UPDATE ${ledger} SET state='failed',completed_at=UTC_TIMESTAMP(6),error_code=? WHERE version=?`, [code, migration.version]);
        throw new Error(`Migration ${migration.filename} failed (${code}). Inspect partial schema and restore the pre-migration backup before retrying.`);
      }
    }
    return await inspect(connection, migrations);
  } finally {
    try { if (locked) await connection.query('SELECT RELEASE_LOCK(?)', [lockName]); }
    finally { await connection.end(); }
  }
}
