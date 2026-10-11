import mariadb from 'mariadb';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { databaseConfig, projectRoot } from '../apps/api/src/config.js';

const envPath = resolve(projectRoot, '.env');
const originalEnv = readFileSync(envPath, 'utf8');
const connection = await mariadb.createConnection(databaseConfig('admin'));
const newSettings: Record<string, string> = {};
try {
  const existingSchemas = await connection.query(
    "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='demo_test'",
  );
  const existingUsers = await connection.query(
    "SELECT User FROM mysql.user WHERE User IN ('softek_migrator','softek_test_app')",
  );
  if (existingSchemas.length || existingUsers.length) {
    if (!process.env.MIGRATION_DB_PASSWORD || !process.env.TEST_DB_PASSWORD) {
      throw new Error(
        'Provisioning resources already exist without recorded credentials; refusing to replace them.',
      );
    }
    const migration = await mariadb.createConnection(
      databaseConfig('migration', true),
    );
    await migration.end();
    const runtime = await mariadb.createConnection(
      databaseConfig('runtime', true),
    );
    await runtime.end();
    console.log(
      'Existing test and migration accounts authenticate; no changes made.',
    );
  } else {
    const migrationPassword = randomBytes(32).toString('base64url');
    const testPassword = randomBytes(32).toString('base64url');
    Object.assign(newSettings, {
      MIGRATION_DB_USER: 'softek_migrator',
      MIGRATION_DB_PASSWORD: migrationPassword,
      TEST_DB_NAME: 'demo_test',
      TEST_DB_USER: 'softek_test_app',
      TEST_DB_PASSWORD: testPassword,
      HOST: '127.0.0.1',
      PORT: '3100',
      NODE_ENV: 'development',
      CLARITY_ENABLED: 'false',
      VITE_CLARITY_ENABLED: 'false',
    });
    // Record generated secrets privately before DDL, so an interrupted setup is recoverable.
    if (readFileSync(envPath, 'utf8') !== originalEnv)
      throw new Error('Environment changed; provisioning stopped.');
    const additions = Object.entries(newSettings)
      .filter(([key]) => !process.env[key])
      .map(([key, value]) => `${key}=${value}`);
    if (
      process.env.MIGRATION_DB_USER ||
      process.env.MIGRATION_DB_PASSWORD ||
      process.env.TEST_DB_USER ||
      process.env.TEST_DB_PASSWORD ||
      process.env.TEST_DB_NAME
    ) {
      throw new Error(
        'Partial provisioning settings already exist; inspect before proceeding.',
      );
    }
    writeFileSync(
      envPath,
      `${originalEnv.trimEnd()}\n\n# Scoped migration/test access and development defaults\n${additions.join('\n')}\n`,
      { mode: 0o600 },
    );
    await connection.query(
      'CREATE DATABASE `demo_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
    );
    await connection.query('CREATE USER ?@? IDENTIFIED BY ?', [
      'softek_migrator',
      '127.0.0.1',
      migrationPassword,
    ]);
    await connection.query('CREATE USER ?@? IDENTIFIED BY ?', [
      'softek_test_app',
      '127.0.0.1',
      testPassword,
    ]);
    for (const schema of ['demo', 'demo_test']) {
      await connection.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES ON \`${schema.replaceAll('_', '\\_')}\`.* TO ?@?`,
        ['softek_migrator', '127.0.0.1'],
      );
    }
    await connection.query(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON `demo\\_test`.* TO ?@?',
      ['softek_test_app', '127.0.0.1'],
    );
    console.log(
      'Created demo_test, a schema-scoped migrator, and a test runtime account. Secrets are stored only in .env.',
    );
  }
} catch (error) {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String(error.code)
      : undefined;
  console.error(
    code
      ? `Provisioning failed (${code}); inspect recorded settings and partial resources.`
      : error instanceof Error
        ? error.message
        : 'Provisioning failed.',
  );
  process.exitCode = 1;
} finally {
  await connection.end();
}
