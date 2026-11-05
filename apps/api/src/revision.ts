import { accountPages } from './account-pages.js';
import type { Express, Request, Response } from 'express';
import type { Pool, PoolConnection } from 'mariadb';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import { features, getFeature } from './features.js';
import { HttpError } from './errors.js';
import { passwordHash, passwordMatches } from './passwords.js';
import {
  impersonationCookie,
  impersonationUser,
  customerContext,
  setCustomerContext,
} from './customer-context.js';
import { assetDirectory, decodeBanner, publishAsset } from './banner-assets.js';
import { generationSchema, generateCustomers } from './customer-generation.js';
import {
  defaultClientFields,
  validateClientProfile,
  clientProfileSchema,
} from './browser-profile.js';

type Row = Record<string, any>;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const uuid = z.string().uuid();
export const destinations = [
  { key: 'summary', label: 'Account Summary', href: '/' },
  { key: 'transfers', label: 'Transfers', href: '/transfers' },
  { key: 'bill-pay', label: 'Bill Pay', href: '/bill-pay' },
  { key: 'cards', label: 'Cards', href: '/cards' },
  { key: 'savings-goals', label: 'Savings Goals', href: '/savings-goals' },
  { key: 'statements', label: 'Statements', href: '/statements' },
  { key: 'support', label: 'Support', href: '/support' },
  ...features.map((f) => ({ key: f.id, label: f.label, href: f.href })),
] as const;
const routeKeys = [
  ...destinations.map((d) => d.key),
  'goals',
  'enroll',
  'about',
  'savings',
  'loans',
  'discovery-preferences',
  'explore',
  ...accountPages.map((page) => page.routeKey),
] as const;
const destination = z.enum(destinations.map((d) => d.key));
const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9._@+-]+$/);
const password = z.string().min(8).max(128);

export async function authenticatedRun(
  c: PoolConnection,
  req: Request,
): Promise<Row> {
  if (req.cookies[impersonationCookie]) {
    const user = await impersonationUser(c, req);
    const [run] = await c.query(
      "SELECT r.* FROM participant_runs r JOIN user_current_runs u ON u.run_id=r.id AND u.user_id=r.user_id WHERE u.user_id=? AND r.status='active' FOR UPDATE",
      [user.id],
    );
    if (!run) throw new HttpError(401, 'Your impersonation session ended.');
    return { ...run, username: user.username, display_name: user.display_name };
  }
  if (req.get('x-customer-context'))
    throw new HttpError(
      401,
      'Your impersonation session ended. Return to Admin.',
    );
  const [session] = await c.query(
    'SELECT user_id FROM user_sessions WHERE token_hash=? AND expires_at>UTC_TIMESTAMP(6)',
    [hash(String(req.cookies.softek_user ?? ''))],
  );
  if (!session) throw new HttpError(401, 'Sign in to your demo account.');
  const [user] = await c.query(
    'SELECT * FROM demo_users WHERE id=? AND enabled=TRUE FOR UPDATE',
    [session.user_id],
  );
  // Recheck revocation after acquiring the user lock; password reset/disable use it too.
  const [valid] = await c.query(
    'SELECT token_hash FROM user_sessions WHERE token_hash=? AND user_id=? AND expires_at>UTC_TIMESTAMP(6)',
    [hash(String(req.cookies.softek_user ?? '')), session.user_id],
  );
  if (!user || !valid)
    throw new HttpError(401, 'Sign in to your demo account.');
  const [run] = await c.query(
    "SELECT r.* FROM participant_runs r JOIN user_current_runs u ON u.run_id=r.id AND u.user_id=r.user_id WHERE u.user_id=? AND r.status='active' FOR UPDATE",
    [user.id],
  );
  if (!run) throw new HttpError(401, 'Sign in to your demo account.');
  return { ...run, username: user.username, display_name: user.display_name };
}

type Context = {
  app: Express;
  pool: Pool;
  test: boolean;
  transaction: <T>(fn: (c: PoolConnection) => Promise<T>) => Promise<T>;
  active: (c: PoolConnection, req: Request) => Promise<Row>;
  visit: (
    c: PoolConnection,
    run: Row,
    req: Request,
    force?: boolean,
  ) => Promise<string>;
  createRun: (
    c: PoolConnection,
    req: Request,
    res: Response,
    profile: string,
    actor: string,
    variant?: string,
    eligible?: boolean,
  ) => Promise<Row>;
  event: (...args: any[]) => Promise<string | null>;
  admin: (
    req: Request,
    mutate?: boolean,
    multipart?: boolean,
  ) => Promise<{ csrf: string }>;
  csrf: (raw: string) => string;
  token: (req: Request) => string;
  checkOrigin: (req: Request, multipart?: boolean) => void;
  checkCsrf: (req: Request, raw: string, multipart?: boolean) => void;
  cookieOptions: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax';
    path: string;
    maxAge: number;
  };
  cleanupRecordings: () => Promise<unknown>;
};

export function registerRevision(ctx: Context) {
  const {
    app,
    pool,
    test,
    transaction,
    active,
    visit,
    createRun,
    event,
    admin,
    csrf,
    token,
    checkOrigin,
    checkCsrf,
    cookieOptions,
  } = ctx;
  const publicPresentation = (p: Row | undefined) =>
    !p
      ? null
      : {
          id: p.id,
          bannerId: p.banner_id ?? null,
          imageUrl: p.asset_key ? `/media/banners/${p.asset_key}` : null,
          title: p.title ?? '',
          altText: p.alt_text ?? '',
          destination: p.destination ?? null,
          href: destinations.find((d) => d.key === p.destination)?.href ?? '/',
          campaignId: p.campaign_id ?? null,
        };
  async function selection(
    c: PoolConnection,
    r: Row,
    v: string,
    requestKey: string,
    reason: string,
    advance = true,
  ) {
    const [previous] = await c.query(
      'SELECT * FROM banner_presentations WHERE user_id=? AND run_id=? AND request_key=?',
      [r.user_id, r.id, requestKey],
    );
    if (previous) return publicPresentation(previous);
    const banners: Row[] = await c.query(
      'SELECT * FROM demo_banners WHERE enabled=TRUE ORDER BY sort_order,id',
    );
    const [rotation] = await c.query(
      'SELECT last_banner_id FROM banner_rotation WHERE user_id=?',
      [r.user_id],
    );
    const index = banners.findIndex((b) => b.id === rotation?.last_banner_id);
    const next = banners.length
      ? banners[advance ? (index + 1) % banners.length : Math.max(0, index)]!
      : null;
    const id = randomUUID();
    await c.query(
      'INSERT INTO banner_presentations (id,user_id,run_id,visit_id,request_key,banner_id,asset_key,title,alt_text,destination,campaign_id,reason,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6))',
      [
        id,
        r.user_id,
        r.id,
        v,
        requestKey,
        next?.id ?? null,
        next?.asset_key ?? null,
        next?.title ?? null,
        next?.alt_text ?? null,
        next?.destination ?? null,
        next?.campaign_id ?? null,
        reason,
      ],
    );
    await c.query(
      'INSERT INTO banner_rotation VALUES (?,?) ON DUPLICATE KEY UPDATE last_banner_id=VALUES(last_banner_id)',
      [r.user_id, next?.id ?? rotation?.last_banner_id ?? null],
    );
    return publicPresentation({
      id,
      banner_id: next?.id,
      asset_key: next?.asset_key,
      title: next?.title,
      alt_text: next?.alt_text,
      destination: next?.destination,
      campaign_id: next?.campaign_id,
    });
  }
  async function bindRun(
    c: PoolConnection,
    user: Row,
    req: Request,
    res: Response,
  ): Promise<Row> {
    const result = await createRun(
      c,
      req,
      res,
      user.profile_id,
      user.actor,
      user.variant,
      Boolean(user.eligible),
    );
    const [opening] = await c.query(
      'SELECT checking_minor,savings_minor FROM customer_starting_balances WHERE user_id=?',
      [user.id],
    );
    if (opening)
      await c.query(
        "UPDATE accounts SET balance_minor=CASE kind WHEN 'checking' THEN ? WHEN 'savings' THEN ? END WHERE run_id=? AND kind IN ('checking','savings')",
        [opening.checking_minor, opening.savings_minor, result.runId],
      );
    await c.query('UPDATE participant_runs SET user_id=? WHERE id=?', [
      user.id,
      result.runId,
    ]);
    await c.query(
      'INSERT INTO user_current_runs VALUES (?,?) ON DUPLICATE KEY UPDATE run_id=VALUES(run_id)',
      [user.id, result.runId],
    );
    return { ...result, userId: user.id };
  }
  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Please wait before trying to sign in again.' },
  });
  app.get('/media/banners/:key', async (req, res) => {
    const key = z
      .string()
      .regex(/^[a-z0-9-]+\.webp$/)
      .max(64)
      .parse(req.params.key);
    const [asset] = await pool.query(
      'SELECT asset_key FROM banner_assets WHERE asset_key=?',
      [key],
    );
    if (!asset) throw new HttpError(404, 'Image not found.');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(join(assetDirectory(test), key));
  });
  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    checkOrigin(req);
    if (req.cookies[impersonationCookie])
      throw new HttpError(409, 'Exit impersonation before signing in.');
    const b = z
      .object({ username, password, requestId: uuid })
      .strict()
      .parse(req.body);
    const [candidate] = await pool.query(
      'SELECT * FROM demo_users WHERE username=?',
      [b.username],
    );
    const matches = await passwordMatches(
      b.password,
      candidate?.password_hash ?? '',
    );
    if (!candidate || !matches)
      throw new HttpError(401, 'Username or password is incorrect.');
    const automated =
      Boolean(process.env.AUTOMATION_SECRET) &&
      hash(req.get('x-demo-automation') ?? '') ===
        hash(process.env.AUTOMATION_SECRET!);
    const raw = randomBytes(32).toString('hex');
    const result = await transaction(async (c) => {
      const [user] = await c.query(
        'SELECT * FROM demo_users WHERE id=? FOR UPDATE',
        [candidate.id],
      );
      if (
        !user ||
        !user.enabled ||
        user.password_hash !== candidate.password_hash
      )
        throw new HttpError(401, 'Username or password is incorrect.');
      if ((user.actor === 'automation') !== automated)
        throw new HttpError(
          403,
          'Use an account assigned to this demonstration mode.',
        );
      let [run] = await c.query(
        "SELECT r.* FROM user_current_runs u JOIN participant_runs r ON r.id=u.run_id AND r.user_id=u.user_id WHERE u.user_id=? AND r.status='active' FOR UPDATE",
        [user.id],
      );
      let visitId: string;
      if (!run) {
        const fresh = await bindRun(c, user, req, res);
        [run] = await c.query('SELECT * FROM participant_runs WHERE id=?', [
          fresh.runId,
        ]);
        visitId = fresh.visitId;
      } else visitId = await visit(c, run, req, true);
      if (run.eligible) await event(c, run, visitId, 'eligible', 'eligible');
      await c.query(
        'DELETE FROM user_sessions WHERE user_id=? AND expires_at<=UTC_TIMESTAMP(6)',
        [user.id],
      );
      await c.query(
        'INSERT INTO user_sessions VALUES (?,?,UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 24 HOUR))',
        [hash(raw), user.id],
      );
      return {
        runId: run.id,
        userId: user.id,
        visitId,
        banner: await selection(
          c,
          run,
          visitId,
          `login:${b.requestId}`,
          'login',
        ),
      };
    });
    res
      .clearCookie('softek_run', cookieOptions)
      .cookie('softek_user', raw, { ...cookieOptions, maxAge: 24 * 3600_000 })
      .json({ ...result, csrf: csrf(raw) });
  });
  app.post('/api/auth/logout', async (req, res) => {
    checkCsrf(req, token(req));
    z.object({}).strict().parse(req.body);
    await transaction(async (c) => {
      await active(c, req);
      if (req.cookies[impersonationCookie])
        await c.query(
          'UPDATE impersonation_sessions SET ended_at=UTC_TIMESTAMP(6) WHERE token_hash=?',
          [hash(token(req))],
        );
      else
        await c.query('DELETE FROM user_sessions WHERE token_hash=?', [
          hash(token(req)),
        ]);
    });
    res
      .clearCookie('softek_user', cookieOptions)
      .clearCookie(impersonationCookie, cookieOptions)
      .json({ ok: true });
  });
  app.post('/api/admin/users/:id/impersonate', async (req, res) => {
    await admin(req, true);
    const id = uuid.parse(req.params.id);
    const b = z.object({ requestId: uuid }).strict().parse(req.body);
    const adminHash = hash(String(req.cookies.softek_admin));
    const raw = csrf(`impersonation:${adminHash}:${id}:${b.requestId}`);
    const result = await transaction(async (c) => {
      const [user] = await c.query(
        'SELECT * FROM demo_users WHERE id=? FOR UPDATE',
        [id],
      );
      if (!user) throw new HttpError(404, 'Customer not found.');
      if (!user.enabled)
        throw new HttpError(403, 'Enable this customer before impersonating.');
      const [owner] = await c.query(
        'SELECT * FROM admin_sessions WHERE token_hash=? AND expires_at>UTC_TIMESTAMP(6) FOR UPDATE',
        [adminHash],
      );
      if (!owner) throw new HttpError(401, 'Sign in to demo controls.');
      const [prior] = await c.query(
        'SELECT *,expires_at>UTC_TIMESTAMP(6) AS current FROM impersonation_sessions WHERE admin_token_hash=? AND request_id=? FOR UPDATE',
        [adminHash, b.requestId],
      );
      if (prior && (prior.user_id !== id || prior.ended_at || !prior.current))
        throw new HttpError(
          409,
          'This impersonation request ended. Start a new visit.',
        );
      const contextId = prior?.id ?? randomUUID();
      setCustomerContext(req, { source: 'admin_impersonation', id: contextId });
      if (!prior) {
        if (req.cookies[impersonationCookie])
          await c.query(
            'UPDATE impersonation_sessions SET ended_at=UTC_TIMESTAMP(6) WHERE token_hash=? AND admin_token_hash=?',
            [hash(req.cookies[impersonationCookie]), adminHash],
          );
        await c.query(
          'INSERT INTO impersonation_sessions VALUES (?,?,?,?,?,UTC_TIMESTAMP(6),?,NULL)',
          [hash(raw), contextId, adminHash, id, b.requestId, owner.expires_at],
        );
      }
      if (req.cookies.softek_user)
        await c.query('DELETE FROM user_sessions WHERE token_hash=?', [
          hash(req.cookies.softek_user),
        ]);
      let [run] = await c.query(
        "SELECT r.* FROM user_current_runs u JOIN participant_runs r ON r.id=u.run_id WHERE u.user_id=? AND r.status='active' FOR UPDATE",
        [id],
      );
      let visitId: string;
      if (!run) {
        const fresh = await bindRun(c, user, req, res);
        [run] = await c.query('SELECT * FROM participant_runs WHERE id=?', [
          fresh.runId,
        ]);
        visitId = fresh.visitId;
      } else visitId = await visit(c, run, req, !prior);
      return {
        userId: id,
        contextId,
        csrf: csrf(raw),
        banner: await selection(
          c,
          run,
          visitId,
          `impersonate:${contextId}`,
          'login',
        ),
        expiresAt: owner.expires_at,
      };
    });
    res
      .clearCookie('softek_user', cookieOptions)
      .cookie(impersonationCookie, raw, {
        ...cookieOptions,
        expires: result.expiresAt,
        maxAge: Math.max(0, new Date(result.expiresAt).getTime() - Date.now()),
      })
      .json(result);
  });
  app.post('/api/auth/impersonation/exit', async (req, res) => {
    checkOrigin(req);
    z.object({}).strict().parse(req.body);
    const raw = String(req.cookies[impersonationCookie] ?? '');
    let destination = '/controls/customers';
    if (raw) {
      checkCsrf(req, raw);
      const [session] = await pool.query(
        'SELECT s.*,u.id AS existing_user FROM impersonation_sessions s LEFT JOIN demo_users u ON u.id=s.user_id WHERE token_hash=?',
        [hash(raw)],
      );
      if (session) {
        if (req.get('x-customer-context') !== session.id)
          throw new HttpError(
            409,
            'Your session changed. Refresh before exiting.',
          );
        await pool.query(
          'UPDATE impersonation_sessions SET ended_at=UTC_TIMESTAMP(6) WHERE token_hash=?',
          [hash(raw)],
        );
        if (session.existing_user) destination += `/${session.user_id}`;
      }
    }
    res.clearCookie(impersonationCookie, cookieOptions).json({ destination });
  });
  app.post('/api/entry', (_req, res) =>
    res
      .status(410)
      .json({ error: 'Sign in with an administrator-created demo account.' }),
  );
  app.post('/api/admin/restart', async (req, _res) => {
    await admin(req, true);
    throw new HttpError(
      410,
      'Select a user in Demo users to reset their account.',
    );
  });
  app.post('/api/reset', async (req, res) => {
    checkCsrf(req, token(req));
    z.object({}).strict().parse(req.body);
    const result = await transaction(async (c) => {
      const r = await active(c, req);
      const [user] = await c.query('SELECT * FROM demo_users WHERE id=?', [
        r.user_id,
      ]);
      await c.query(
        "UPDATE participant_runs SET status='retired',retired_at=UTC_TIMESTAMP(6) WHERE id=?",
        [r.id],
      );
      const fresh = await bindRun(
        c,
        {
          ...user,
          variant: r.variant,
          eligible: r.eligible,
          actor: r.actor,
          profile_id: r.profile_id,
        },
        req,
        res,
      );
      await selection(
        c,
        { id: fresh.runId, user_id: user.id },
        fresh.visitId,
        `reset:${fresh.runId}`,
        'fallback',
        false,
      );
      return fresh;
    });
    res.json({
      runId: result.runId,
      userId: result.userId,
      csrf: csrf(token(req)),
    });
  });
  app.get('/api/admin/users', async (req, res) => {
    await admin(req);
    res.json(
      await pool.query(
        "SELECT u.id,u.username,u.display_name AS displayName,u.enabled,u.profile_id AS profileId,u.variant,u.eligible,u.actor,m.run_id AS runId,COALESCE(p.device,'desktop') AS device,COALESCE(p.browser,'chrome') AS browser FROM demo_users u LEFT JOIN user_current_runs m ON m.user_id=u.id LEFT JOIN customer_browser_profiles p ON p.user_id=u.id ORDER BY u.created_at,u.id",
      ),
    );
  });
  app.post('/api/admin/users', async (req, res) => {
    await admin(req, true);
    const parsed = z
      .object({
        username,
        password,
        displayName: z.string().trim().min(1).max(100),
        profileId: z.enum(['alex', 'jamie']).default('alex'),
        variant: z.enum(['baseline', 'value']).default('value'),
        eligible: z.boolean(),
        actor: z.enum(['human', 'automation']).default('human'),
        ...defaultClientFields,
      })
      .strict()
      .superRefine(validateClientProfile)
      .safeParse(req.body);
    if (!parsed.success) {
      const messages: Record<string, string> = {
        username:
          'Username must be 3–40 characters and use letters, numbers, dots, underscores, hyphens, @ or +.',
        password: 'Initial password must be 8–128 characters.',
        displayName: 'Display name must be 1–100 characters.',
        profileId: 'Invalid starting accounts profile.',
        variant: 'Choose a campaign variant.',
        eligible: 'Choose whether this user is eligible for savings goals.',
        actor: 'Choose an activity mode.',
        device: 'Choose a device.',
        browser: 'Choose a browser supported by this device.',
      };
      throw new HttpError(
        400,
        messages[String(parsed.error.issues[0]?.path[0])] ??
          'Check the entered details and try again.',
      );
    }
    const b = parsed.data;
    const id = randomUUID(),
      stored = await passwordHash(b.password);
    try {
      await transaction(async (c) => {
        await c.query(
          'INSERT INTO demo_users VALUES (?,?,?,?,TRUE,?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))',
          [
            id,
            b.username,
            b.displayName,
            stored,
            b.profileId,
            b.variant,
            b.eligible,
            b.actor,
          ],
        );
        await c.query('INSERT INTO customer_browser_profiles VALUES (?,?,?)', [
          id,
          b.device,
          b.browser,
        ]);
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'ER_DUP_ENTRY')
        throw new HttpError(409, 'That username is already in use.');
      throw e;
    }
    res.status(201).json({ id, username: b.username });
  });
  app.post('/api/admin/users/generate', async (req, res) => {
    await admin(req, true);
    const parsed = generationSchema.safeParse(req.body);
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0]);
      const messages: Record<string, string> = {
        count: 'Choose between 1 and 200 customers.',
        prefix:
          'Username prefix must start with a letter and use 1–16 letters, numbers, dots, underscores or hyphens.',
        password: 'Shared demo password must be 8–128 characters.',
        device: 'Choose a device.',
        browser: 'Choose a browser supported by this device.',
        checkingMinMinor: 'Checking minimum must be between $0 and $1,000,000.',
        checkingMaxMinor:
          'Checking maximum must be between the minimum and $1,000,000.',
        savingsMinMinor: 'Savings minimum must be between $0 and $1,000,000.',
        savingsMaxMinor:
          'Savings maximum must be between the minimum and $1,000,000.',
      };
      throw new HttpError(
        400,
        messages[field] ?? 'Check the generation settings and try again.',
      );
    }
    try {
      // Keep the default configuration's fingerprint compatible with batches
      // created before device/browser preferences existed.
      const { device, browser, ...legacy } = parsed.data;
      const fingerprintPayload =
        device === 'desktop' && browser === 'chrome' ? legacy : parsed.data;
      const result = await transaction((c) =>
        generateCustomers(
          c,
          parsed.data,
          csrf(JSON.stringify(fingerprintPayload)),
        ),
      );
      res.status(201).json(result);
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY')
        throw new HttpError(
          409,
          'A generated username is already in use. Start a new batch. No customers were created.',
        );
      throw error;
    }
  });
  async function manageUser(
    req: Request,
    action: (c: PoolConnection, user: Row) => Promise<void>,
  ) {
    await admin(req, true);
    const id = uuid.parse(req.params.id);
    await transaction(async (c) => {
      const [u] = await c.query(
        'SELECT * FROM demo_users WHERE id=? FOR UPDATE',
        [id],
      );
      if (!u) throw new HttpError(404, 'Demo user not found.');
      await action(c, u);
    });
  }
  app.post('/api/admin/users/:id/delete', async (req, res) => {
    await admin(req, true);
    z.object({}).strict().parse(req.body);
    const id = uuid.parse(req.params.id);
    await transaction(async (c) => {
      const [user] = await c.query(
        'SELECT id FROM demo_users WHERE id=? FOR UPDATE',
        [id],
      );
      // A repeated deletion succeeds without touching another customer.
      if (!user) return;
      // These rows reference visits without cascading; remove them before runs.
      await c.query(
        'DELETE e FROM interaction_events e JOIN participant_runs r ON r.id=e.run_id WHERE r.user_id=?',
        [id],
      );
      await c.query('DELETE FROM banner_presentations WHERE user_id=?', [id]);
      await c.query('DELETE FROM participant_runs WHERE user_id=?', [id]);
      // FK cascades remove sessions, rotation, opening amounts and preferences.
      await c.query('DELETE FROM demo_users WHERE id=?', [id]);
    });
    await ctx.cleanupRecordings();
    res.json({ ok: true });
  });
  app.post('/api/admin/users/:id/password', async (req, res) => {
    await admin(req, true);
    const b = z.object({ password }).strict().parse(req.body);
    const stored = await passwordHash(b.password);
    await manageUser(req, async (c, u) => {
      await c.query(
        'UPDATE demo_users SET password_hash=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?',
        [stored, u.id],
      );
      await c.query('DELETE FROM user_sessions WHERE user_id=?', [u.id]);
      await c.query(
        'UPDATE impersonation_sessions SET ended_at=UTC_TIMESTAMP(6) WHERE user_id=?',
        [u.id],
      );
    });
    res.json({ ok: true });
  });
  app.post('/api/admin/users/:id/browser-profile', async (req, res) => {
    await admin(req, true);
    const parsed = clientProfileSchema.safeParse(req.body);
    if (!parsed.success)
      throw new HttpError(400, 'Choose a compatible device and browser.');
    await manageUser(req, async (c, u) => {
      await c.query(
        'INSERT INTO customer_browser_profiles VALUES (?,?,?) ON DUPLICATE KEY UPDATE device=VALUES(device),browser=VALUES(browser)',
        [u.id, parsed.data.device, parsed.data.browser],
      );
      await c.query(
        'UPDATE demo_users SET updated_at=UTC_TIMESTAMP(6) WHERE id=?',
        [u.id],
      );
    });
    res.json({ ok: true });
  });
  app.post('/api/admin/users/:id/status', async (req, res) => {
    const b = z.object({ enabled: z.boolean() }).strict().parse(req.body);
    await manageUser(req, async (c, u) => {
      await c.query(
        'UPDATE demo_users SET enabled=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?',
        [b.enabled, u.id],
      );
      if (!b.enabled) {
        await c.query('DELETE FROM user_sessions WHERE user_id=?', [u.id]);
        await c.query(
          'UPDATE impersonation_sessions SET ended_at=UTC_TIMESTAMP(6) WHERE user_id=?',
          [u.id],
        );
      }
    });
    res.json({ ok: true });
  });
  app.post('/api/admin/users/:id/reset', async (req, res) => {
    const b = z
      .object({
        profileId: z.enum(['alex', 'jamie']).optional(),
        variant: z.enum(['baseline', 'value']),
        eligible: z.boolean(),
      })
      .strict()
      .parse(req.body);
    let runId = '';
    await manageUser(req, async (c, u) => {
      const profileId = b.profileId ?? u.profile_id;
      await c.query(
        "UPDATE participant_runs r JOIN user_current_runs m ON m.run_id=r.id SET r.status='retired',r.retired_at=UTC_TIMESTAMP(6) WHERE m.user_id=?",
        [u.id],
      );
      await c.query(
        'UPDATE demo_users SET profile_id=?,variant=?,eligible=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?',
        [profileId, b.variant, b.eligible, u.id],
      );
      // Configuring state must not grant the admin a customer session.
      setCustomerContext(req, {
        source: 'admin_impersonation',
        id: `admin:${hash(String(req.cookies.softek_admin))}`,
      });
      const fresh = await bindRun(
        c,
        {
          ...u,
          profile_id: profileId,
          variant: b.variant,
          eligible: b.eligible,
        },
        req,
        res,
      );
      runId = fresh.runId;
      await selection(
        c,
        { id: runId, user_id: u.id },
        fresh.visitId,
        `reset:${runId}`,
        'fallback',
        false,
      );
    });
    res.json({ ok: true, runId });
  });
  app.post('/api/banners/select', async (req, res) => {
    checkCsrf(req, token(req));
    const b = z
      .object({ requestId: uuid, reason: z.literal('refresh') })
      .strict()
      .parse(req.body);
    res.json(
      await transaction(async (c) => {
        const r = await active(c, req),
          v = await visit(c, r, req);
        return selection(c, r, v, `refresh:${b.requestId}`, 'refresh');
      }),
    );
  });
  app.get('/api/banners/current', async (req, res) => {
    const requested =
      req.query.id === undefined ? null : uuid.parse(req.query.id);
    const data = await transaction(async (c) => {
      const r = await active(c, req);
      const [p] = await c.query(
        "SELECT * FROM banner_presentations WHERE user_id=? AND run_id=? AND request_key NOT LIKE 'explorer-summary:%' AND (? IS NULL OR id=?) ORDER BY created_at DESC,id DESC LIMIT 1",
        [r.user_id, r.id, requested, requested],
      );
      if (requested && !p)
        throw new HttpError(404, 'Banner presentation not found.');
      if (!p) return null;
      const [enabled] = await c.query(
        'SELECT id FROM demo_banners WHERE id=? AND enabled=TRUE AND asset_key=?',
        [p.banner_id, p.asset_key],
      );
      if (p.banner_id && !enabled) {
        const v = await visit(c, r, req);
        return selection(c, r, v, `fallback:${p.id}`, 'fallback');
      }
      return publicPresentation(p);
    });
    res.json(data);
  });
  app.get('/api/admin/banners', async (req, res) => {
    await admin(req);
    res.json({
      destinations,
      banners: await pool.query(
        "SELECT b.id,b.title,b.alt_text AS altText,b.destination,b.enabled,b.sort_order AS sortOrder,b.campaign_id AS campaignId,CONCAT('/media/banners/',b.asset_key) AS imageUrl,a.width,a.height FROM demo_banners b JOIN banner_assets a ON a.asset_key=b.asset_key ORDER BY b.sort_order,b.id",
      ),
    });
  });
  const bannerBody = z
    .object({
      title: z.string().trim().min(1).max(100),
      altText: z.string().trim().min(1).max(180),
      destination,
      enabled: z.boolean(),
      sortOrder: z.number().int().min(0).max(10000),
      campaignId: z.enum(['savings-launch']).nullable().default(null),
    })
    .strict();
  app.post('/api/admin/banners/:id/settings', async (req, res) => {
    await admin(req, true);
    const id = z
        .string()
        .max(40)
        .regex(/^[a-z0-9-]+$/)
        .parse(req.params.id),
      b = bannerBody.parse(req.body);
    if (b.campaignId && b.destination !== 'savings-goals')
      throw new HttpError(
        400,
        'Savings campaign banners must link to Savings Goals.',
      );
    const result = await pool.query(
      'UPDATE demo_banners SET title=?,alt_text=?,destination=?,enabled=?,sort_order=?,campaign_id=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?',
      [
        b.title,
        b.altText,
        b.destination,
        b.enabled,
        b.sortOrder,
        b.campaignId,
        id,
      ],
    );
    if (!result.affectedRows) throw new HttpError(404, 'Banner not found.');
    res.json({ ok: true });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 7, fieldSize: 1000 },
  });
  app.post(
    '/api/admin/banners/upload',
    async (req, _res, next) => {
      await admin(req, true, true);
      next();
    },
    upload.single('image'),
    async (req, res) => {
      if (!req.file)
        throw new HttpError(400, 'Choose a JPEG, PNG, or WebP image.');
      const b = z
        .object({
          title: z.string().trim().min(1).max(100),
          altText: z.string().trim().min(1).max(180),
          destination,
          sortOrder: z.coerce.number().int().min(0).max(10000),
          replaceId: z
            .string()
            .max(40)
            .regex(/^[a-z0-9-]+$/)
            .optional(),
        })
        .strict()
        .parse(req.body);
      let decoded;
      try {
        decoded = await decodeBanner(req.file.buffer);
      } catch {
        throw new HttpError(
          400,
          'Use a valid JPEG, PNG, or WebP image up to 4096 pixels per side.',
        );
      }
      const id = randomUUID(),
        key = await publishAsset(decoded.data, test);
      try {
        await transaction(async (c) => {
          let campaignId: string | null = null;
          if (b.replaceId) {
            const [old] = await c.query(
              'SELECT id,campaign_id,destination FROM demo_banners WHERE id=? FOR UPDATE',
              [b.replaceId],
            );
            if (!old) throw new HttpError(404, 'Banner not found.');
            campaignId =
              old.destination === b.destination ? old.campaign_id : null;
            await c.query(
              'UPDATE demo_banners SET enabled=FALSE,updated_at=UTC_TIMESTAMP(6) WHERE id=?',
              [b.replaceId],
            );
          }
          await c.query(
            "INSERT INTO banner_assets VALUES (?,'webp',?,?,?,UTC_TIMESTAMP(6))",
            [key, decoded.info.width, decoded.info.height, decoded.data.length],
          );
          await c.query(
            'INSERT INTO demo_banners VALUES (?,?,?,?,?,TRUE,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))',
            [
              id,
              key,
              b.title,
              b.altText,
              b.destination,
              b.sortOrder,
              campaignId,
            ],
          );
        });
      } catch (e) {
        await unlink(join(assetDirectory(test), key)).catch(() => {});
        throw e;
      }
      res.status(201).json({ id, imageUrl: `/media/banners/${key}` });
    },
  );
  app.post('/api/interactions', async (req, res) => {
    checkCsrf(req, token(req));
    const b = z
      .object({
        requestId: uuid,
        pageId: uuid,
        selectionId: uuid.optional(),
        discoveryPresentationId: uuid.optional(),
        name: z.enum([
          'banner_visible',
          'banner_clicked',
          'page_view',
          'menu_open',
          'menu_selected',
          'placeholder_action',
          'feature_viewed',
          'feature_cta_clicked',
        ]),
        routeKey: z.enum(routeKeys),
        targetKey: z.enum(routeKeys).optional(),
        observedAt: z.iso.datetime(),
      })
      .strict()
      .parse(req.body);
    const observed = new Date(b.observedAt);
    if (Math.abs(Date.now() - observed.getTime()) > 5 * 60_000)
      throw new HttpError(400, 'Refresh before sending this observation.');
    const result = await transaction(async (c) => {
      const r = await active(c, req),
        v = await visit(c, r, req);
      const featureEvent = b.name.startsWith('feature_');
      if (b.discoveryPresentationId) {
        if (!featureEvent || b.selectionId)
          throw new HttpError(400, 'Invalid discovery action.');
        const [discovery] = await c.query(
          'SELECT id FROM discovery_presentations WHERE id=? AND user_id=? AND run_id=? AND visit_id=? AND feature_id=? AND clicked_at IS NOT NULL',
          [b.discoveryPresentationId, r.user_id, r.id, v, b.routeKey],
        );
        if (!discovery)
          throw new HttpError(
            403,
            'That discovery link is not assigned to this visit.',
          );
      }
      if (featureEvent && (!getFeature(b.routeKey) || b.targetKey))
        throw new HttpError(400, 'Invalid feature action.');
      if (b.selectionId && !featureEvent && !b.name.startsWith('banner_'))
        throw new HttpError(400, 'Invalid presentation context.');
      let presentation: Row | undefined;
      if (b.name.startsWith('banner_') || (featureEvent && b.selectionId)) {
        if (!featureEvent && (b.routeKey !== 'summary' || !b.selectionId))
          throw new HttpError(
            400,
            'A banner observation requires its Account Summary presentation.',
          );
        [presentation] = await c.query(
          'SELECT * FROM banner_presentations WHERE id=? AND user_id=? AND run_id=? AND banner_id IS NOT NULL',
          [b.selectionId, r.user_id, r.id],
        );
        if (!presentation)
          throw new HttpError(
            403,
            'That banner is not assigned to this account.',
          );
      }
      if (
        featureEvent &&
        presentation &&
        presentation.destination !== b.routeKey
      )
        throw new HttpError(403, 'That banner does not lead to this feature.');
      if (
        b.name === 'placeholder_action' &&
        ![
          'transfers',
          'bill-pay',
          'cards',
          'statements',
          'support',
          'loans',
        ].includes(b.routeKey)
      )
        throw new HttpError(400, 'Invalid demo action.');
      let dedupe = featureEvent
        ? `feature:${b.name}:${b.pageId}:${b.routeKey}`
        : b.name === 'banner_visible'
          ? `visible:${b.pageId}:${b.selectionId}`
          : b.name === 'page_view'
            ? `page:${b.pageId}`
            : `event:${b.requestId}`;
      if (customerContext(req).source === 'admin_impersonation')
        dedupe = `admin:${dedupe}`;
      if (featureEvent) {
        const [previous] = await c.query(
          'SELECT id,selection_id FROM interaction_events WHERE run_id=? AND dedupe_key=?',
          [r.id, dedupe],
        );
        if (
          previous &&
          (previous.selection_id ?? null) !== (presentation?.id ?? null)
        )
          throw new HttpError(
            409,
            'Retry this action with its original context.',
          );
        if (previous) {
          const [linked] = await c.query(
            'SELECT presentation_id FROM discovery_feature_observations WHERE interaction_id=?',
            [previous.id],
          );
          if (
            (linked?.presentation_id ?? null) !==
            (b.discoveryPresentationId ?? null)
          )
            throw new HttpError(
              409,
              'Retry this action with its original discovery context.',
            );
        }
      }
      const inserted = await c.query(
        'INSERT IGNORE INTO interaction_events VALUES (?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6))',
        [
          randomUUID(),
          r.id,
          v,
          b.pageId,
          presentation?.id ?? null,
          b.name,
          b.routeKey,
          b.targetKey ?? null,
          dedupe,
          observed,
        ],
      );
      const milestones: string[] = [];
      if (b.discoveryPresentationId) {
        const [observation] = await c.query(
          'SELECT id FROM interaction_events WHERE run_id=? AND dedupe_key=?',
          [r.id, dedupe],
        );
        const [prior] = await c.query(
          'SELECT presentation_id FROM discovery_feature_observations WHERE interaction_id=?',
          [observation.id],
        );
        if (prior && prior.presentation_id !== b.discoveryPresentationId)
          throw new HttpError(
            409,
            'Retry this action with its original discovery context.',
          );
        await c.query(
          'INSERT IGNORE INTO discovery_feature_observations VALUES (?,?)',
          [observation.id, b.discoveryPresentationId],
        );
      }
      if (
        b.name.startsWith('banner_') &&
        inserted.affectedRows &&
        presentation?.campaign_id === r.campaign_id &&
        r.eligible
      ) {
        const name =
          b.name === 'banner_visible'
            ? 'promotion_visible'
            : 'promotion_clicked';
        const emitted = await event(
          c,
          r,
          v,
          name,
          `${name}:banner`,
          'banner',
          'banner',
          observed,
        );
        if (emitted) milestones.push(emitted);
      }
      return {
        accepted: Boolean(inserted.affectedRows),
        acknowledged: true,
        events: milestones,
      };
    });
    res.json(result);
  });
  app.get('/api/admin/feature-activity', async (req, res) => {
    await admin(req);
    const f = z
      .object({
        actor: z.enum(['human', 'automation', 'all']).default('human'),
        variant: z.enum(['baseline', 'value', 'all']).default('all'),
        start: z.iso.datetime().optional(),
        end: z.iso.datetime().optional(),
        cutoff: z.iso.datetime().optional(),
      })
      .strict()
      .parse(req.query);
    const now = new Date().toISOString(),
      start = f.start ?? '2000-01-01T00:00:00.000Z',
      end = f.end ?? now,
      cutoff = f.cutoff ?? now;
    if (new Date(start) > new Date(end))
      throw new HttpError(400, 'The start date must come before the end date.');
    const rows: Row[] = await pool.query(
      `SELECT e.route_key AS featureId,
      SUM(e.name='feature_viewed') AS views,
      COUNT(DISTINCT CASE WHEN e.name='feature_viewed' THEN r.user_id END) AS viewers,
      COUNT(DISTINCT CASE WHEN e.name='feature_viewed' THEN r.id END) AS viewedRuns,
      SUM(e.name='feature_cta_clicked') AS clicks,
      COUNT(DISTINCT CASE WHEN e.name='feature_cta_clicked' THEN r.user_id END) AS clickers,
      COUNT(DISTINCT CASE WHEN e.name='feature_cta_clicked' THEN r.id END) AS clickedRuns,
      SUM(e.name='feature_viewed' AND e.selection_id IS NOT NULL) AS bannerViews,
      SUM(e.name='feature_cta_clicked' AND e.selection_id IS NOT NULL) AS bannerClicks
      FROM interaction_events e JOIN participant_runs r ON r.id=e.run_id
      LEFT JOIN visit_contexts vc ON vc.visit_id=e.visit_id
      WHERE e.name IN ('feature_viewed','feature_cta_clicked')
      AND COALESCE(vc.activity_source,'customer')='customer'
      AND r.created_at>=? AND r.created_at<=? AND r.created_at<=?
      AND e.created_at<=? AND e.observed_at<=?
      AND (?='all' OR r.actor=?) AND (?='all' OR r.variant=?) GROUP BY e.route_key`,
      [
        new Date(start),
        new Date(end),
        new Date(cutoff),
        new Date(cutoff),
        new Date(cutoff),
        f.actor,
        f.actor,
        f.variant,
        f.variant,
      ],
    );
    res.json({
      filters: { ...f, start, end, cutoff, timezone: 'UTC' },
      features: features.map((feature) => {
        const row = rows.find((row) => row.featureId === feature.id);
        return {
          id: feature.id,
          label: feature.label,
          ...Object.fromEntries(
            [
              'views',
              'viewers',
              'viewedRuns',
              'clicks',
              'clickers',
              'clickedRuns',
              'bannerViews',
              'bannerClicks',
            ].map((key) => [key, Number(row?.[key] ?? 0)]),
          ),
        };
      }),
    });
  });
  app.get('/api/admin/interactions', async (req, res) => {
    await admin(req);
    const userId = uuid.parse(req.query.userId);
    res.json(
      await pool.query(
        "SELECT e.name,e.route_key AS routeKey,e.target_key AS targetKey,e.created_at AS createdAt,r.id AS runId,r.actor,p.banner_id AS bannerId,COALESCE(vc.activity_source,'customer') AS activitySource FROM interaction_events e JOIN participant_runs r ON r.id=e.run_id LEFT JOIN visit_contexts vc ON vc.visit_id=e.visit_id LEFT JOIN banner_presentations p ON p.id=e.selection_id WHERE r.user_id=? ORDER BY e.created_at DESC,e.id DESC LIMIT 100",
        [userId],
      ),
    );
  });
}
