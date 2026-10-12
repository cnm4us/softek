import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import mariadb, { type PoolConnection } from 'mariadb';
import { z } from 'zod';
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { databaseConfig } from './config.js';
import { clarityStatus, customerAnalytics } from './clarity.js';
import { HttpError } from './errors.js';
import { authenticatedRun, registerRevision } from './revision.js';
import { customerToken, customerContext } from './customer-context.js';

type Connection = PoolConnection;
// Connector rows are checked at query boundaries; internal values never enter analytics as arbitrary metadata.
type Row = Record<string, any>;
const uuid = z.string().uuid();
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const equal = (a: string, b: string) =>
  timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
const clientNames = [
  'promotion_visible',
  'promotion_clicked',
  'details_viewed',
  'enrollment_started',
] as const;
const stages = [
  'eligible',
  ...clientNames,
  'enrollment_completed',
  'first_use',
  'repeat_use',
] as const;
const service = 'savings-goals';
const cookieName = 'softek_user',
  adminCookie = 'softek_admin';

export function createApp(test = false) {
  const secret = process.env.SESSION_SECRET;
  const adminSecret = process.env.DEMO_ADMIN_SECRET;
  if (!secret || secret.length < 32 || !adminSecret || adminSecret.length < 24)
    throw new Error(
      'Set strong SESSION_SECRET and DEMO_ADMIN_SECRET in the private environment.',
    );
  const production = process.env.NODE_ENV === 'production';
  const origin = process.env.PUBLIC_ORIGIN ?? 'http://127.0.0.1:5173';
  const pool = mariadb.createPool({
    ...databaseConfig('runtime', test),
    connectionLimit: 8,
    timezone: 'Z',
    bigIntAsNumber: true,
  });
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(express.json({ limit: '16kb' }));
  app.use(cookieParser());
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });
  const cookieOptions = {
    httpOnly: true,
    secure: production,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 30 * 24 * 3600 * 1000,
  };
  const csrf = (token: string) =>
    createHmac('sha256', secret).update(token).digest('hex');
  const token = customerToken;
  function checkOrigin(req: Request, multipart = false) {
    if (
      req.get('origin') !== origin ||
      !(multipart ? req.is('multipart/form-data') : req.is('application/json'))
    )
      throw new HttpError(403, 'Please use this demo from its own website.');
  }
  function checkCsrf(req: Request, raw: string, multipart = false) {
    checkOrigin(req, multipart);
    if (!raw || !equal(req.get('x-csrf-token') ?? '', csrf(raw)))
      throw new HttpError(403, 'Your session changed. Refresh and try again.');
  }
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 1200,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Please wait a moment before trying again.' },
  });
  app.use('/api', limiter);
  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Please wait before trying this password again.' },
  });
  async function transaction<T>(
    action: (c: Connection) => Promise<T>,
    snapshot = false,
  ): Promise<T> {
    const c = await pool.getConnection();
    try {
      await c.query(
        snapshot
          ? 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'
          : 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
      );
      await c.beginTransaction();
      const result = await action(c);
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async function active(c: Connection, req: Request): Promise<Row> {
    return authenticatedRun(c, req);
  }
  async function visit(
    c: Connection,
    run: Row,
    req: Request,
    force = false,
  ): Promise<string> {
    const browser = uuid.parse(req.get('x-browser-session'));
    const context = customerContext(req);
    const rows = await c.query(
      "SELECT v.id FROM visits v LEFT JOIN visit_contexts vc ON vc.visit_id=v.id WHERE v.run_id=? AND v.browser_session=? AND COALESCE(vc.activity_source,'customer')=? AND COALESCE(vc.session_context,'')=? AND v.last_seen_at>DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 30 MINUTE) ORDER BY v.created_at DESC LIMIT 1",
      [run.id, browser, context.source, context.id],
    );
    if (rows.length && !force) {
      await c.query(
        'UPDATE visits SET last_seen_at=UTC_TIMESTAMP(6) WHERE id=?',
        [rows[0].id],
      );
      return rows[0].id;
    }
    const id = randomUUID();
    await c.query(
      'INSERT INTO visits VALUES (?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))',
      [id, run.id, browser],
    );
    await c.query('INSERT INTO visit_contexts VALUES (?,?,?)', [
      id,
      context.source,
      context.id,
    ]);
    if (context.source === 'customer' && run.eligible)
      await event(c, run, id, 'eligible', 'eligible');
    return id;
  }
  async function event(
    c: Connection,
    run: Row,
    visitId: string,
    name: string,
    key: string,
    placement = 'direct',
    presentation = 'direct',
    observed: Date | null = null,
  ) {
    const id = randomUUID();
    const [context] = await c.query(
      'SELECT activity_source FROM visit_contexts WHERE visit_id=?',
      [visitId],
    );
    if (context?.activity_source === 'admin_impersonation')
      key = `admin:${key}`;
    const result = await c.query(
      'INSERT IGNORE INTO adoption_events VALUES (?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6))',
      [
        id,
        run.id,
        visitId,
        name,
        clientNames.includes(name as (typeof clientNames)[number])
          ? 'client_observed'
          : 'server_confirmed',
        placement,
        presentation,
        key,
        observed,
      ],
    );
    return Number(result.affectedRows) === 1 ? name : null;
  }
  async function createRun(
    c: Connection,
    req: Request,
    res: Response,
    profileId: string,
    actor: string,
    variant?: string,
    eligibility?: boolean,
  ) {
    const rows = await c.query(
      `SELECT p.*,c.id AS campaign_id, s.purchased FROM customer_profiles p
   JOIN campaigns c ON c.institution_id=p.institution_id AND c.active=TRUE
   JOIN institution_services s ON s.institution_id=c.institution_id AND s.service_id=c.service_id WHERE p.id=?`,
      [profileId],
    );
    if (!rows.length)
      throw new HttpError(404, 'That demo profile is unavailable.');
    const p = rows[0],
      raw = randomBytes(32).toString('hex');
    const run: Row = {
      id: randomUUID(),
      eligible: Boolean(p.purchased) && (eligibility ?? Boolean(p.eligible)),
    };
    await c.query(
      'INSERT INTO participant_runs (id,token_hash,profile_id,campaign_id,variant,eligible,actor,created_at,expires_at) VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 30 DAY))',
      [
        run.id,
        hash(raw),
        p.id,
        p.campaign_id,
        variant ?? (randomInt(2) ? 'value' : 'baseline'),
        run.eligible,
        actor,
      ],
    );
    const templates = await c.query(
      'SELECT * FROM account_templates WHERE profile_id=?',
      [p.id],
    );
    for (const a of templates) {
      const accountId = randomUUID();
      await c.query('INSERT INTO accounts VALUES (?,?,?,?,?,?,?)', [
        accountId,
        run.id,
        a.kind,
        a.name,
        a.last_four,
        a.balance_minor,
        a.currency,
      ]);
      const history = await c.query(
        'SELECT * FROM transaction_templates WHERE account_template_id=?',
        [a.id],
      );
      for (const h of history)
        await c.query('INSERT INTO transactions VALUES (?,?,?,?,?,?)', [
          randomUUID(),
          run.id,
          accountId,
          h.description,
          h.amount_minor,
          h.occurred_at,
        ]);
    }
    const visitId = await visit(c, run, req);
    if (run.eligible) await event(c, run, visitId, 'eligible', 'eligible');
    // Set the cookie only after the transaction commits (route owns response).
    return { runId: run.id, raw, csrf: csrf(raw), visitId };
  }
  async function admin(req: Request, mutate = false, multipart = false) {
    const raw = String(req.cookies[adminCookie] ?? '');
    if (mutate) checkCsrf(req, raw, multipart);
    const rows = await pool.query(
      'SELECT token_hash FROM admin_sessions WHERE token_hash=? AND expires_at>UTC_TIMESTAMP(6)',
      [hash(raw)],
    );
    if (!rows.length) throw new HttpError(401, 'Sign in to demo controls.');
    return { csrf: csrf(raw) };
  }
  async function receipt(
    c: Connection,
    run: Row,
    req: Request,
    operation: string,
    payload: unknown,
    execute: (visitId: string) => Promise<Row>,
  ) {
    const requestId = uuid.parse(req.body.requestId);
    const context = customerContext(req);
    const digest = hash(
      JSON.stringify(
        context.source === 'customer'
          ? payload
          : { context: context.id, payload },
      ),
    );
    const prior = await c.query(
      'SELECT * FROM request_receipts WHERE run_id=? AND request_id=?',
      [run.id, requestId],
    );
    if (prior.length) {
      if (prior[0].operation !== operation || prior[0].payload_hash !== digest)
        throw new HttpError(
          409,
          'This retry contains different details. Refresh before submitting a new action.',
        );
      const data =
        typeof prior[0].response_json === 'string'
          ? JSON.parse(prior[0].response_json)
          : prior[0].response_json;
      return { ...data, events: [], replayed: true };
    }
    const result = await execute(await visit(c, run, req));
    await c.query(
      'INSERT INTO request_receipts VALUES (?,?,?,?,?,UTC_TIMESTAMP(6))',
      [run.id, requestId, operation, digest, JSON.stringify(result)],
    );
    return { ...result, replayed: false };
  }
  async function use(
    c: Connection,
    run: Row,
    visitId: string,
    requestId: string,
  ) {
    const events: string[] = [];
    await event(c, run, visitId, 'service_use', `use:${requestId}`);
    const first = await c.query(
      "SELECT e.visit_id FROM adoption_events e LEFT JOIN visit_contexts vc ON vc.visit_id=e.visit_id WHERE e.run_id=? AND e.name='first_use' AND COALESCE(vc.activity_source,'customer')=COALESCE((SELECT activity_source FROM visit_contexts WHERE visit_id=?),'customer')",
      [run.id, visitId],
    );
    if (!first.length) {
      const name = await event(c, run, visitId, 'first_use', 'first_use');
      if (name) events.push(name);
    } else if (first[0].visit_id !== visitId) {
      const name = await event(c, run, visitId, 'repeat_use', 'repeat_use');
      if (name) events.push(name);
    }
    return events;
  }
  registerRevision({
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
  });
  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', database: 'connected' });
    } catch {
      res.status(503).json({ status: 'unavailable', database: 'unavailable' });
    }
  });
  app.get('/api/profiles', async (_req, res) => {
    res.json(
      await pool.query(
        'SELECT id,display_name AS name,eligible FROM customer_profiles ORDER BY id',
      ),
    );
  });
  app.get('/api/state', async (req, res) => {
    const data = await transaction(async (c) => {
      const r = await active(c, req),
        visitId = await visit(c, r, req);
      const [p] = await c.query(
        'SELECT display_name AS name,first_name AS firstName FROM customer_profiles WHERE id=?',
        [r.profile_id],
      );
      const accounts = await c.query(
        "SELECT id,kind,name,last_four AS lastFour,balance_minor AS balanceMinor,currency FROM accounts WHERE run_id=? ORDER BY FIELD(kind,'checking','savings','credit')",
        [r.id],
      );
      const transactions = await c.query(
        'SELECT t.id,t.description,t.amount_minor AS amountMinor,t.occurred_at AS occurredAt,a.name AS accountName FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE t.run_id=? ORDER BY t.occurred_at DESC,t.id LIMIT 12',
        [r.id],
      );
      const goals = await c.query(
        'SELECT id,title,target_minor AS targetMinor,current_minor AS currentMinor FROM savings_goals WHERE run_id=? ORDER BY created_at,id',
        [r.id],
      );
      const enrollment = await c.query(
        'SELECT enrolled_at FROM enrollments WHERE run_id=? AND service_id=?',
        [r.id, service],
      );
      return {
        runId: r.id,
        visitId,
        csrf: csrf(token(req)),
        profileId: r.profile_id,
        profile: {
          ...p,
          name: r.display_name,
          firstName: r.display_name.split(' ')[0],
        },
        user: {
          id: r.user_id,
          username: r.username,
          displayName: r.display_name,
        },
        impersonation:
          customerContext(req).source === 'admin_impersonation'
            ? {
                contextId: customerContext(req).id,
                returnTo: `/controls/customers/${r.user_id}`,
              }
            : null,
        variant: r.variant,
        eligible: Boolean(r.eligible),
        enrolled: enrollment.length > 0,
        accounts,
        transactions,
        goals,
        analytics: await customerAnalytics(
          c,
          r.actor,
          equal(
            req.get('x-demo-capture') ?? '',
            process.env.AUTOMATION_SECRET ?? randomUUID(),
          ),
          customerContext(req).source === 'admin_impersonation',
        ),
      };
    });
    res.json(data);
  });
  app.get('/api/analytics', async (req, res) => {
    res.json(
      await transaction(async (c) => {
        const r = await active(c, req);
        return customerAnalytics(
          c,
          r.actor,
          equal(
            req.get('x-demo-capture') ?? '',
            process.env.AUTOMATION_SECRET ?? randomUUID(),
          ),
          customerContext(req).source === 'admin_impersonation',
        );
      }),
    );
  });
  app.get('/api/admin/clarity', async (req, res) => {
    await admin(req);
    res.json(await clarityStatus(pool));
  });
  app.post('/api/admin/clarity', async (req, res) => {
    await admin(req, true);
    const b = z
      .object({ enabled: z.boolean(), revision: z.string().uuid() })
      .strict()
      .parse(req.body);
    res.json(
      await transaction(async (c) => {
        const [row] = await c.query(
          'SELECT enabled,revision FROM clarity_collection WHERE id=1 FOR UPDATE',
        );
        const status = await clarityStatus(c);
        if (b.enabled && !status.configured)
          throw new HttpError(
            400,
            'Clarity is not configured in this deployment.',
          );
        if (Boolean(row.enabled) === b.enabled) return status;
        if (row.revision !== b.revision)
          throw new HttpError(409, 'Settings changed. Refresh and try again.');
        await c.query(
          'UPDATE clarity_collection SET enabled=?,revision=?,updated_at=UTC_TIMESTAMP(6) WHERE id=1',
          [b.enabled, randomUUID()],
        );
        return clarityStatus(c);
      }),
    );
  });
  app.post('/api/events', async (req, res) => {
    checkCsrf(req, token(req));
    const b = z
      .object({
        name: z.enum(clientNames),
        placement: z.enum(['banner', 'sidebar', 'direct']),
        presentation: z.enum(['banner', 'sidebar', 'inline', 'direct']),
        observedAt: z.iso.datetime(),
      })
      .strict()
      .parse(req.body);
    if (
      (b.placement === 'banner' && b.presentation !== 'banner') ||
      (b.placement === 'sidebar' &&
        !['sidebar', 'inline'].includes(b.presentation)) ||
      (b.placement === 'direct' && b.presentation !== 'direct')
    )
      throw new HttpError(400, 'Invalid promotion placement.');
    if (b.name.startsWith('promotion_') && b.placement === 'direct')
      throw new HttpError(400, 'A promotion requires a placement.');
    const observed = new Date(b.observedAt);
    if (Math.abs(Date.now() - observed.getTime()) > 5 * 60_000)
      throw new HttpError(400, 'Refresh before sending this observation.');
    const accepted = await transaction(async (c) => {
      const r = await active(c, req);
      if (!r.eligible)
        throw new HttpError(
          403,
          'This service is unavailable for this profile.',
        );
      const v = await visit(c, r, req);
      return event(
        c,
        r,
        v,
        b.name,
        `${b.name}:${b.name.startsWith('promotion_') ? b.placement : 'journey'}`,
        b.placement,
        b.presentation,
        observed,
      );
    });
    res.json({
      accepted: Boolean(accepted),
      events: accepted ? [accepted] : [],
    });
  });
  const enrollBody = z
    .object({ requestId: uuid, accepted: z.literal(true) })
    .strict();
  app.post('/api/enroll', async (req, res) => {
    checkCsrf(req, token(req));
    const b = enrollBody.parse(req.body);
    const data = await transaction(async (c) => {
      const r = await active(c, req);
      if (!r.eligible)
        throw new HttpError(
          403,
          'Savings goals is unavailable for this profile.',
        );
      return receipt(
        c,
        r,
        req,
        'enroll',
        { accepted: b.accepted },
        async (v) => {
          const result = await c.query(
            'INSERT IGNORE INTO enrollments VALUES (?,?,UTC_TIMESTAMP(6))',
            [r.id, service],
          );
          const name = Number(result.affectedRows)
            ? await event(
                c,
                r,
                v,
                'enrollment_completed',
                'enrollment_completed',
              )
            : null;
          return { enrolled: true, events: name ? [name] : [] };
        },
      );
    });
    res.json(data);
  });
  app.post('/api/goals', async (req, res) => {
    checkCsrf(req, token(req));
    const b = z
      .object({
        requestId: uuid,
        title: z.string().trim().min(1).max(80),
        targetMinor: z.number().int().min(100).max(100_000_000),
      })
      .strict()
      .parse(req.body);
    const data = await transaction(async (c) => {
      const r = await active(c, req);
      const enrolled = await c.query(
        'SELECT 1 FROM enrollments WHERE run_id=? AND service_id=?',
        [r.id, service],
      );
      if (!r.eligible || !enrolled.length)
        throw new HttpError(403, 'Enroll in savings goals first.');
      return receipt(
        c,
        r,
        req,
        'create_goal',
        { title: b.title, targetMinor: b.targetMinor },
        async (v) => {
          const count = await c.query(
            'SELECT COUNT(*) AS count FROM savings_goals WHERE run_id=?',
            [r.id],
          );
          if (Number(count[0].count) >= 10)
            throw new HttpError(
              409,
              'You can have up to 10 goals in this demo.',
            );
          const id = randomUUID();
          await c.query(
            'INSERT INTO savings_goals VALUES (?,?,?, ?,0,UTC_TIMESTAMP(6))',
            [id, r.id, b.title, b.targetMinor],
          );
          return { goalId: id, events: await use(c, r, v, b.requestId) };
        },
      );
    });
    res.status(201).json(data);
  });
  app.post('/api/goals/:id/contributions', async (req, res) => {
    checkCsrf(req, token(req));
    const goalId = uuid.parse(req.params.id);
    const b = z
      .object({
        requestId: uuid,
        amountMinor: z.number().int().min(1).max(100_000_000),
      })
      .strict()
      .parse(req.body);
    const data = await transaction(async (c) => {
      const r = await active(c, req);
      if (!r.eligible) throw new HttpError(403, 'This service is unavailable.');
      return receipt(
        c,
        r,
        req,
        'contribute',
        { goalId, amountMinor: b.amountMinor },
        async (v) => {
          const [goal] = await c.query(
            'SELECT * FROM savings_goals WHERE id=? AND run_id=?',
            [goalId, r.id],
          );
          if (!goal) throw new HttpError(404, 'Goal not found.');
          const [checking] = await c.query(
            "SELECT * FROM accounts WHERE run_id=? AND kind='checking'",
            [r.id],
          );
          const [savings] = await c.query(
            "SELECT * FROM accounts WHERE run_id=? AND kind='savings'",
            [r.id],
          );
          if (b.amountMinor > checking.balance_minor)
            throw new HttpError(
              409,
              'Your checking balance is too low for this amount.',
            );
          if (b.amountMinor > goal.target_minor - goal.current_minor)
            throw new HttpError(
              409,
              'Choose an amount within the remaining goal.',
            );
          await c.query(
            'UPDATE accounts SET balance_minor=balance_minor-? WHERE id=?',
            [b.amountMinor, checking.id],
          );
          await c.query(
            'UPDATE accounts SET balance_minor=balance_minor+? WHERE id=?',
            [b.amountMinor, savings.id],
          );
          await c.query(
            'UPDATE savings_goals SET current_minor=current_minor+? WHERE id=?',
            [b.amountMinor, goalId],
          );
          for (const [a, amount] of [
            [checking, -b.amountMinor],
            [savings, b.amountMinor],
          ] as const)
            await c.query(
              'INSERT INTO transactions VALUES (?,?,?,?,?,UTC_TIMESTAMP(6))',
              [randomUUID(), r.id, a.id, 'Savings goal contribution', amount],
            );
          return {
            contributedMinor: b.amountMinor,
            events: await use(c, r, v, b.requestId),
          };
        },
      );
    });
    res.json(data);
  });
  app.get('/api/admin/status', async (req, res) => {
    try {
      res.json({ authenticated: true, ...(await admin(req)) });
    } catch (error) {
      if (error instanceof HttpError && error.status === 401)
        res.json({ authenticated: false });
      else throw error;
    }
  });
  app.post('/api/admin/login', loginLimiter, async (req, res) => {
    checkOrigin(req);
    const b = z
      .object({ password: z.string().min(1).max(256) })
      .strict()
      .parse(req.body);
    if (!equal(b.password, adminSecret))
      throw new HttpError(401, 'That password didn’t match.');
    const raw = randomBytes(32).toString('hex');
    await pool.query(
      'DELETE FROM admin_sessions WHERE expires_at<UTC_TIMESTAMP(6)',
    );
    await pool.query(
      'INSERT INTO admin_sessions VALUES (?,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 HOUR))',
      [hash(raw)],
    );
    res
      .cookie(adminCookie, raw, { ...cookieOptions, maxAge: 3600_000 })
      .json({ authenticated: true, csrf: csrf(raw) });
  });
  app.post('/api/admin/logout', async (req, res) => {
    await admin(req, true);
    await pool.query('DELETE FROM admin_sessions WHERE token_hash=?', [
      hash(String(req.cookies[adminCookie])),
    ]);
    res.clearCookie(adminCookie, cookieOptions).json({ ok: true });
  });
  app.get('/api/admin/report', async (req, res) => {
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
    const start = f.start ?? '2000-01-01T00:00:00.000Z',
      end = f.end ?? new Date().toISOString(),
      cutoff = f.cutoff ?? new Date().toISOString();
    if (start > end)
      throw new HttpError(400, 'The start date must come before the end date.');
    // One consistent snapshot: report stages and denominators cannot race business commits.
    const result = await transaction(async (c) => {
      const runs: Row[] = await c.query(
        "SELECT * FROM participant_runs r WHERE created_at>=? AND created_at<=? AND created_at<=? AND (?='all' OR actor=?) AND (?='all' OR variant=?) AND EXISTS (SELECT 1 FROM visits v LEFT JOIN visit_contexts vc ON vc.visit_id=v.id WHERE v.run_id=r.id AND COALESCE(vc.activity_source,'customer')='customer' AND v.created_at<=?) ORDER BY created_at",
        [
          new Date(start),
          new Date(end),
          new Date(cutoff),
          f.actor,
          f.actor,
          f.variant,
          f.variant,
          new Date(cutoff),
        ],
      );
      const events: Row[] = await c.query(
        `SELECT e.* FROM adoption_events e JOIN participant_runs r ON r.id=e.run_id LEFT JOIN visit_contexts vc ON vc.visit_id=e.visit_id WHERE COALESCE(vc.activity_source,'customer')='customer' AND r.created_at>=? AND r.created_at<=? AND e.created_at<=? AND (?='all' OR r.actor=?) AND (?='all' OR r.variant=?) ORDER BY e.created_at,e.id`,
        [
          new Date(start),
          new Date(end),
          new Date(cutoff),
          f.actor,
          f.actor,
          f.variant,
          f.variant,
        ],
      );
      const eligible = runs.filter((r) => Boolean(r.eligible));
      const byRun = new Map<string, Row[]>();
      for (const e of events) {
        const list = byRun.get(e.run_id) ?? [];
        list.push(e);
        byRun.set(e.run_id, list);
      }
      const reach = stages.map((name) => ({
        name,
        count: eligible.filter((r) =>
          (byRun.get(r.id) ?? []).some((e) => e.name === name),
        ).length,
        denominator: eligible.length,
      }));
      let previous = eligible.map((r) => ({ id: r.id, time: 0 }));
      const funnel = stages.map((name) => {
        const denominator = previous.length;
        const reached = previous.flatMap((r) => {
          const e = (byRun.get(r.id) ?? []).find(
            (e) =>
              e.name === name && new Date(e.created_at).getTime() >= r.time,
          );
          return e
            ? [{ id: r.id, time: new Date(e.created_at).getTime() }]
            : [];
        });
        previous = reached;
        return { name, count: reached.length, denominator };
      });
      const rawCount = (name: string) =>
        runs.filter((r) => (byRun.get(r.id) ?? []).some((e) => e.name === name))
          .length;
      return {
        filters: { ...f, start, end, cutoff, timezone: 'UTC' },
        totalRuns: runs.length,
        eligibleRuns: eligible.length,
        retiredRuns: runs.filter((r) => r.status === 'retired').length,
        actors: {
          human: runs.filter((r) => r.actor === 'human').length,
          automation: runs.filter((r) => r.actor === 'automation').length,
        },
        reach,
        funnel,
        serviceUse: {
          enrolled: rawCount('enrollment_completed'),
          firstUse: rawCount('first_use'),
          repeatUse: rawCount('repeat_use'),
          directFirstUse: runs.filter((r) => {
            const list = byRun.get(r.id) ?? [];
            const first = list.find((e) => e.name === 'first_use');
            return (
              first &&
              !list.some(
                (e) =>
                  e.name === 'promotion_clicked' &&
                  new Date(e.created_at) <= new Date(first.created_at),
              )
            );
          }).length,
        },
        placements: ['banner', 'sidebar'].map((placement) => ({
          placement,
          visible: eligible.filter((r) =>
            (byRun.get(r.id) ?? []).some(
              (e) =>
                e.name === 'promotion_visible' && e.placement === placement,
            ),
          ).length,
          clicked: eligible.filter((r) =>
            (byRun.get(r.id) ?? []).some(
              (e) =>
                e.name === 'promotion_clicked' && e.placement === placement,
            ),
          ).length,
        })),
        eventCount: events.length,
      };
    }, true);
    res.json(result);
  });
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(
    (
      error: unknown,
      _req: Request,
      res: Response,
      _next: express.NextFunction,
    ) => {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        String(error.code).startsWith('LIMIT_')
      ) {
        res.status(413).json({ error: 'Use one image up to 5 MiB.' });
        return;
      }
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ error: 'Check the entered details and try again.' });
        return;
      }
      if (error instanceof HttpError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      if (error instanceof SyntaxError) {
        res.status(400).json({ error: 'Invalid request.' });
        return;
      }
      // No SQL, parameters, credentials, free text, or request body in logs.
      console.error(
        'API request failed.',
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : 'INTERNAL',
      );
      res.status(500).json({
        error:
          'We couldn’t complete that action. Try again with the same details.',
      });
    },
  );
  return { app, pool };
}
