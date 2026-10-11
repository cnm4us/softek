import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const envFile = resolve(projectRoot, '.env');
if (existsSync(envFile)) loadEnvFile(envFile);

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required setting: ${name}`);
  return value;
}

export function databaseConfig(
  role: 'runtime' | 'migration' | 'admin',
  test = false,
) {
  const admin = role === 'admin';
  const userKey = admin
    ? 'ADMIN_DB_USER'
    : role === 'migration'
      ? 'MIGRATION_DB_USER'
      : test
        ? 'TEST_DB_USER'
        : 'DB_USER';
  const passwordKey = userKey.replace('USER', 'PASSWORD');
  const host = required(admin ? 'ADMIN_DB_HOST' : 'DB_HOST');
  const port = Number(required(admin ? 'ADMIN_DB_PORT' : 'DB_PORT'));
  if (host !== '127.0.0.1' || port !== 3306)
    throw new Error(
      'Database tooling currently requires local TCP 127.0.0.1:3306.',
    );
  const database = test ? required('TEST_DB_NAME') : required('DB_NAME');
  if (database !== (test ? 'demo_test' : 'demo'))
    throw new Error(
      'Refusing a database outside the explicit demo/demo_test allowlist.',
    );
  return {
    host,
    port,
    database,
    user: required(userKey),
    password: required(passwordKey),
    connectTimeout: 5000,
  };
}

export function serverConfig() {
  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number(
    process.env.PORT ??
      (process.env.NODE_ENV === 'production' ? '3100' : '3101'),
  );
  if (
    host !== '127.0.0.1' ||
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535
  ) {
    throw new Error(
      'API requires loopback HOST and an unprivileged valid PORT.',
    );
  }
  if (
    process.env.CLARITY_ENABLED === 'true' ||
    process.env.VITE_CLARITY_ENABLED === 'true'
  ) {
    if (
      process.env.CLARITY_CONFIG_VERIFIED !== 'true' ||
      process.env.CLARITY_ENABLED !== 'true' ||
      !/^[a-z0-9]{6,30}$/.test(process.env.CLARITY_PROJECT_ID ?? '')
    ) {
      throw new Error(
        'Clarity requires verified settings, a project ID, and an explicit backend collection gate.',
      );
    }
  }
  return { host, port };
}

export function analyticsConfig() {
  const enabled =
    process.env.CLARITY_ENABLED === 'true' &&
    process.env.CLARITY_CONFIG_VERIFIED === 'true';
  return {
    enabled,
    projectId: enabled ? (process.env.CLARITY_PROJECT_ID ?? null) : null,
  };
}
