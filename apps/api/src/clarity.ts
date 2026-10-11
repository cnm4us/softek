import type { Pool, PoolConnection } from 'mariadb';
import { analyticsConfig } from './config.js';
export async function clarityStatus(db: Pool | PoolConnection) {
  const [row] = await db.query(
    'SELECT enabled,revision,updated_at AS updatedAt FROM clarity_collection WHERE id=1',
  );
  if (!row) throw new Error('Clarity configuration is missing.');
  const configuration = analyticsConfig();
  return {
    configured:
      configuration.enabled && process.env.VITE_CLARITY_ENABLED === 'true',
    requestedEnabled: Boolean(row.enabled),
    enabled:
      Boolean(row.enabled) &&
      configuration.enabled &&
      process.env.VITE_CLARITY_ENABLED === 'true',
    projectId: process.env.CLARITY_PROJECT_ID ?? null,
    revision: row.revision as string,
    updatedAt: row.updatedAt,
  };
}
export async function customerAnalytics(
  db: Pool | PoolConnection,
  actor: string,
  capture: boolean,
) {
  const status = await clarityStatus(db);
  const enabled = status.enabled && (actor === 'human' || capture);
  return {
    enabled,
    projectId: enabled ? status.projectId : null,
    revision: status.revision,
    actor,
  };
}
