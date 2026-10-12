import type { Request } from 'express';
import type { PoolConnection } from 'mariadb';
import { createHash } from 'node:crypto';
import { HttpError } from './errors.js';

export const impersonationCookie = 'softek_impersonation';
export const tokenHash = (raw: string) =>
  createHash('sha256').update(raw).digest('hex');
type Context = { source: 'customer' | 'admin_impersonation'; id: string };
const contexts = new WeakMap<Request, Context>();
export const customerContext = (req: Request): Context =>
  contexts.get(req) ?? { source: 'customer', id: '' };
export function setCustomerContext(req: Request, context: Context) {
  contexts.set(req, context);
}
export const customerToken = (req: Request) =>
  String(req.cookies[impersonationCookie] || req.cookies.softek_user || '');

// User -> admin -> impersonation lock order, shared by entry and customer access.
export async function impersonationUser(c: PoolConnection, req: Request) {
  const [session] = await c.query(
    'SELECT * FROM impersonation_sessions WHERE token_hash=?',
    [tokenHash(String(req.cookies[impersonationCookie]))],
  );
  if (!session || req.get('x-customer-context') !== session.id)
    throw new HttpError(401, 'Your impersonation session ended. Return to Admin.');
  const [user] = await c.query(
    'SELECT * FROM demo_users WHERE id=? AND enabled=TRUE FOR UPDATE',
    [session.user_id],
  );
  const [admin] = await c.query(
    'SELECT token_hash FROM admin_sessions WHERE token_hash=? AND expires_at>UTC_TIMESTAMP(6) FOR UPDATE',
    [tokenHash(String(req.cookies.softek_admin ?? ''))],
  );
  const [valid] = await c.query(
    'SELECT id FROM impersonation_sessions WHERE token_hash=? AND admin_token_hash=? AND ended_at IS NULL AND expires_at>UTC_TIMESTAMP(6) FOR UPDATE',
    [session.token_hash, admin?.token_hash ?? ''],
  );
  if (!user || !admin || !valid)
    throw new HttpError(401, 'Your impersonation session ended. Return to Admin.');
  setCustomerContext(req, { source: 'admin_impersonation', id: session.id });
  return user;
}
