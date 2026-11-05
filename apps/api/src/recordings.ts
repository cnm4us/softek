import type { Express, Request } from 'express';
import type { Pool, PoolConnection } from 'mariadb';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import {
  mkdir,
  open,
  rename,
  rm,
  readdir,
  statfs,
  chmod,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import sharp from 'sharp';
import { z } from 'zod';
import { projectRoot } from './config.js';
import { customerContext, tokenHash } from './customer-context.js';
import { HttpError } from './errors.js';

type Row = Record<string, any>;
const uuid = z
  .string()
  .uuid()
  .transform((id) => id.toLowerCase());
const idPattern = /^[a-f0-9-]{36}$/;
const hash = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');
export const recordingLimits = {
  frameBytes: 1_048_576,
  sessionBytes: 256 * 1_048_576,
  totalBytes: 5 * 1024 ** 3,
  minFreeBytes: 5 * 1024 ** 3,
  slots: 900,
  activeSessions: 2,
  retentionDays: 7,
};
export function recordingDirectory(test = false) {
  if (test) return resolve(projectRoot, 'artifacts/test-recordings');
  const directory = resolve(
    process.env.RECORDING_DIR ?? '/var/lib/softek/recordings',
  );
  if (directory !== '/var/lib/softek/recordings')
    throw new Error(
      'Refusing recording storage outside the dedicated Softek directory.',
    );
  return directory;
}
const metadata = z
  .object({
    sequence: z.number().int().min(1).max(900),
    capturedAt: z.iso.datetime(),
    elapsedMs: z.number().int().min(900).max(900_999),
    captureMs: z.number().int().min(0).max(30_000),
  })
  .strict()
  .refine(
    (m) => Math.floor(m.elapsedMs / 1000) === m.sequence,
    'Invalid scheduled slot',
  );

export class RecordingStore {
  readonly directory: string;
  constructor(
    readonly pool: Pool,
    readonly test = false,
  ) {
    this.directory = recordingDirectory(test);
  }
  enabled() {
    return this.test || process.env.SCREENSHOT_RECORDING_ENABLED === 'true';
  }
  assertEnabled() {
    if (!this.enabled())
      throw new HttpError(503, 'Screenshot recording is unavailable.');
  }
  framePath(id: string, sequence: number) {
    id = uuid.parse(id);
    z.number().int().min(1).max(900).parse(sequence);
    return join(this.directory, id, `${sequence}.jpg`);
  }
  // Advisory lock serializes quota/file publication/cleanup across API and CLI
  // processes. Existing banking transactions never acquire this lock.
  async locked<T>(action: (c: PoolConnection) => Promise<T>) {
    const c = await this.pool.getConnection();
    const key = `softek-recordings-${this.test ? 'demo_test' : 'demo'}`;
    let acquired = false;
    try {
      const [lock] = await c.query('SELECT GET_LOCK(?,5) AS acquired', [key]);
      if (!lock.acquired)
        throw new HttpError(503, 'Recording storage is busy. Try again.');
      acquired = true;
      await c.beginTransaction();
      const result = await action(c);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      try {
        if (acquired) await c.query('SELECT RELEASE_LOCK(?)', [key]);
      } finally {
        c.release();
      }
    }
  }
  async capacity(c: PoolConnection, bytes = 0) {
    const fs = await statfs(this.directory);
    if (
      Number(fs.bavail) * Number(fs.bsize) <
      recordingLimits.minFreeBytes + bytes
    )
      throw new HttpError(503, 'Recording storage is low on space.');
    const [usage] = await c.query(
      'SELECT COALESCE(SUM(stored_bytes),0) AS bytes FROM screenshot_recordings',
    );
    if (Number(usage.bytes) + bytes > recordingLimits.totalBytes)
      throw new HttpError(503, 'Recording storage limit reached.');
  }
  async validate(
    c: Pool | PoolConnection,
    id: string,
    credential: string,
    writable = false,
  ): Promise<Row> {
    if (!/^[a-f0-9]{64}$/.test(credential))
      throw new HttpError(401, 'Recording access expired.');
    id = uuid.parse(id);
    if ('beginTransaction' in c) {
      const [owner] = await c.query(
        'SELECT user_id FROM screenshot_recordings WHERE id=?',
        [id],
      );
      if (owner)
        await c.query('SELECT id FROM demo_users WHERE id=? FOR UPDATE', [
          owner.user_id,
        ]);
    }
    const [r] = await c.query(
      `SELECT r.* FROM screenshot_recordings r
      JOIN demo_users u ON u.id=r.user_id AND u.enabled=TRUE
      JOIN user_sessions s ON s.user_id=u.id AND s.token_hash=r.session_hash AND s.expires_at>UTC_TIMESTAMP(6)
      JOIN user_current_runs cr ON cr.user_id=u.id AND cr.run_id=r.run_id
      WHERE r.id=? AND r.credential_hash=? AND r.credential_expires_at>UTC_TIMESTAMP(6)
      AND r.retained_until>UTC_TIMESTAMP(6)${'beginTransaction' in c ? ' FOR UPDATE' : ''}`,
      [id, hash(credential)],
    );
    if (!r) throw new HttpError(401, 'Recording access expired.');
    if (r.state === 'deleting' || r.state === 'interrupted')
      throw new HttpError(409, 'This recording has ended.');
    if (writable && !['active', 'uploading'].includes(r.state))
      throw new HttpError(409, 'This recording has ended.');
    if (writable && Date.now() - new Date(r.heartbeat_at).getTime() > 90_000)
      throw new HttpError(409, 'This recording was interrupted.');
    if (
      writable &&
      r.state === 'uploading' &&
      Date.now() - new Date(r.capture_stopped_at).getTime() > 30_000
    )
      throw new HttpError(409, 'The screenshot upload window has ended.');
    return r;
  }
  async interrupt(c: PoolConnection) {
    await c.query(`UPDATE screenshot_recordings SET state='interrupted',finalized_at=UTC_TIMESTAMP(6),stop_reason='Connection or app interrupted'
      WHERE state IN ('active','uploading') AND (heartbeat_at<DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 90 SECOND) OR credential_expires_at<=UTC_TIMESTAMP(6) OR (state='uploading' AND capture_stopped_at<DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 30 SECOND)))`);
  }
  async cleanup(dryRun = true) {
    const result = await this.locked(async (c) => {
      if (!dryRun) await this.interrupt(c);
      const expired: Row[] = await c.query(
        "SELECT id FROM screenshot_recordings WHERE retained_until<=UTC_TIMESTAMP(6) OR state='deleting'",
      );
      const all: Row[] = await c.query('SELECT id FROM screenshot_recordings');
      const retained = new Set(all.map((r) => r.id));
      const expiredIds = new Set(expired.map((r) => r.id));
      const directories: string[] = [],
        temporary: string[] = [],
        orphanFrames: string[] = [];
      const missingFrames: { id: string; sequence: number }[] = [];
      const foundDirectories = new Set<string>();
      const entries = await readdir(this.directory, {
        withFileTypes: true,
      }).catch((e: NodeJS.ErrnoException) => {
        if (e.code === 'ENOENT') return [];
        throw e;
      });
      for (const entry of entries) {
        if (!entry.isDirectory() || !idPattern.test(entry.name)) continue;
        foundDirectories.add(entry.name);
        if (!retained.has(entry.name) || expiredIds.has(entry.name)) {
          directories.push(entry.name);
          continue;
        }
        const frames: Row[] = await c.query(
          'SELECT sequence_number FROM screenshot_frames WHERE recording_id=?',
          [entry.name],
        );
        const sequences = new Set(
          frames.map((r) => `${r.sequence_number}.jpg`),
        );
        const files = await readdir(join(this.directory, entry.name), {
          withFileTypes: true,
        });
        const present = new Set(
          files.filter((f) => f.isFile()).map((f) => f.name),
        );
        for (const f of frames)
          if (!present.has(`${f.sequence_number}.jpg`))
            missingFrames.push({ id: entry.name, sequence: f.sequence_number });
        for (const file of files) {
          if (!file.isFile()) continue;
          if (/^\.upload-[a-f0-9-]+\.tmp$/.test(file.name))
            temporary.push(join(entry.name, file.name));
          else if (
            /^[0-9]{1,3}\.jpg$/.test(file.name) &&
            !sequences.has(file.name)
          )
            orphanFrames.push(join(entry.name, file.name));
        }
      }
      for (const r of all)
        if (!foundDirectories.has(r.id) && !expiredIds.has(r.id)) {
          const frames: Row[] = await c.query(
            'SELECT sequence_number FROM screenshot_frames WHERE recording_id=?',
            [r.id],
          );
          for (const f of frames)
            missingFrames.push({ id: r.id, sequence: f.sequence_number });
        }
      if (!dryRun) {
        // Persist tombstones before unlinking. The advisory lock survives commit;
        // a crash/failure leaves explicit deletion intent for the next run.
        for (const r of expired) {
          await c.query(
            "UPDATE screenshot_recordings SET state='deleting' WHERE id=?",
            [r.id],
          );
        }
        await c.commit();
        await c.beginTransaction();
        for (const r of expired) {
          await rm(join(this.directory, r.id), {
            recursive: true,
            force: true,
          });
          await c.query('DELETE FROM screenshot_recordings WHERE id=?', [r.id]);
        }
        for (const id of directories)
          if (!expiredIds.has(id))
            await rm(join(this.directory, id), {
              recursive: true,
              force: true,
            });
        for (const file of [...temporary, ...orphanFrames])
          await rm(join(this.directory, file), { force: true });
        for (const f of missingFrames)
          await c.query(
            'DELETE FROM screenshot_frames WHERE recording_id=? AND sequence_number=?',
            [f.id, f.sequence],
          );
        for (const id of new Set(missingFrames.map((f) => f.id))) {
          await c.query(
            `UPDATE screenshot_recordings SET received_frames=(SELECT COUNT(*) FROM screenshot_frames WHERE recording_id=?),stored_bytes=(SELECT COALESCE(SUM(byte_length),0) FROM screenshot_frames WHERE recording_id=?),state='interrupted',stop_reason='Screenshot file recovery',finalized_at=UTC_TIMESTAMP(6) WHERE id=?`,
            [id, id, id],
          );
        }
      }
      return {
        dryRun,
        expired: expired.length,
        directories: directories.length,
        temporary: temporary.length,
        orphanFrames: orphanFrames.length,
        missingFrames: missingFrames.length,
      };
    });
    if (!dryRun) {
      await mkdir(this.directory, { recursive: true, mode: 0o750 });
      const temporary = join(
        this.directory,
        `.maintenance-${randomUUID()}.tmp`,
      );
      try {
        await writeFile(
          temporary,
          JSON.stringify({ completedAt: new Date().toISOString(), ...result }),
          { mode: 0o640 },
        );
        await rename(temporary, join(this.directory, '.maintenance.json'));
      } finally {
        await rm(temporary, { force: true });
      }
    }
    return result;
  }
}

type Context = {
  app: Express;
  pool: Pool;
  test: boolean;
  active: (c: PoolConnection, req: Request) => Promise<Row>;
  admin: (req: Request, mutate?: boolean) => Promise<{ csrf: string }>;
  token: (req: Request) => string;
  checkCsrf: (req: Request, raw: string) => void;
};
export function registerRecordings({
  app,
  pool,
  test,
  active,
  admin,
  token,
  checkCsrf,
}: Context) {
  const store = new RecordingStore(pool, test);
  const bearer = (req: Request) =>
    (req.get('authorization') ?? '').replace(/^Bearer /, '');
  const credential = (r: Row) =>
    createHmac('sha256', process.env.SESSION_SECRET!)
      .update(`screenshot-v1:${r.id}:${r.session_hash}:${r.request_id}`)
      .digest('hex');
  app.post('/api/recordings', async (req, res) => {
    store.assertEnabled();
    checkCsrf(req, token(req));
    const b = z
      .object({
        requestId: uuid,
        documentId: uuid,
        approvalVersion: z.literal('screenshots-v1'),
      })
      .strict()
      .parse(req.body);
    const result = await store.locked(async (c) => {
      const run = await active(c, req);
      if (customerContext(req).source !== 'customer')
        throw new HttpError(
          403,
          'Recording is unavailable during admin viewing.',
        );
      await mkdir(store.directory, { recursive: true, mode: 0o750 });
      await store.interrupt(c);
      const sessionHash = tokenHash(token(req));
      const [old] = await c.query(
        'SELECT * FROM screenshot_recordings WHERE user_id=? AND request_id=?',
        [run.user_id, b.requestId],
      );
      if (old) {
        if (
          old.session_hash !== sessionHash ||
          old.document_id !== b.documentId ||
          old.state !== 'active'
        )
          throw new HttpError(409, 'Start a new recording.');
        return {
          id: old.id,
          credential: credential(old),
          limits: recordingLimits,
        };
      }
      const [recent] = await c.query(
        'SELECT COUNT(*) AS n FROM screenshot_recordings WHERE user_id=? AND started_at>DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 MINUTE)',
        [run.user_id],
      );
      if (Number(recent.n) >= 10)
        throw new HttpError(
          429,
          'Please wait before starting another recording.',
        );
      // A new explicit approval replaces this customer's previous recording,
      // including an app that was force-closed without a termination callback.
      await c.query(
        "UPDATE screenshot_recordings SET state='interrupted',stop_reason='Replaced by a new recording',capture_stopped_at=UTC_TIMESTAMP(6),finalized_at=UTC_TIMESTAMP(6) WHERE user_id=? AND state IN ('active','uploading')",
        [run.user_id],
      );
      const [n] = await c.query(
        "SELECT COUNT(*) AS n FROM screenshot_recordings WHERE state IN ('active','uploading')",
      );
      if (Number(n.n) >= recordingLimits.activeSessions)
        throw new HttpError(
          429,
          'Two recordings are already active. Try again shortly.',
        );
      await store.capacity(c);
      const r = {
        id: randomUUID(),
        session_hash: sessionHash,
        request_id: b.requestId,
      };
      const raw = credential(r);
      await c.query(
        `INSERT INTO screenshot_recordings
        (id,user_id,run_id,session_hash,credential_hash,request_id,document_id,approval_version,state,started_at,heartbeat_at,credential_expires_at,retained_until)
        VALUES (?,?,?,?,?,?,?,?,'active',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 16 MINUTE),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 7 DAY))`,
        [
          r.id,
          run.user_id,
          run.id,
          sessionHash,
          hash(raw),
          b.requestId,
          b.documentId,
          b.approvalVersion,
        ],
      );
      return { id: r.id, credential: raw, limits: recordingLimits };
    });
    res.status(201).json(result);
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: recordingLimits.frameBytes,
      files: 1,
      fields: 1,
      fieldSize: 2048,
      parts: 2,
    },
  }).single('image');
  let uploading = 0;
  const frameLimiter = rateLimit({
    windowMs: 60_000,
    limit: 180,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => String(req.params.id).toLowerCase(),
    message: { error: 'Please slow screenshot uploads.' },
  });
  app.post(
    '/api/recordings/:id/frames',
    async (req, _res, next) => {
      store.assertEnabled();
      await store.validate(pool, uuid.parse(req.params.id), bearer(req), true);
      next();
    },
    frameLimiter,
    async (req, res) => {
      store.assertEnabled();
      const id = uuid.parse(req.params.id),
        raw = bearer(req);
      await store.validate(pool, id, raw, true);
      if (uploading >= 2)
        throw new HttpError(429, 'Recording receiver is busy.');
      uploading++;
      try {
        try {
          await new Promise<void>((ok, fail) =>
            upload(req, res, (e) => (e ? fail(e) : ok())),
          );
        } catch {
          throw new HttpError(
            413,
            'Use one JPEG screenshot up to 1 MiB and small timing metadata.',
          );
        }
        if (!req.file || typeof req.body?.metadata !== 'string')
          throw new HttpError(
            400,
            'Screenshot and timestamp metadata are required.',
          );
        let parsed: unknown;
        try {
          parsed = JSON.parse(req.body.metadata);
        } catch {
          throw new HttpError(400, 'Invalid screenshot metadata.');
        }
        const m = metadata.parse(parsed);
        const requestHash = hash(
          Buffer.concat([Buffer.from(JSON.stringify(m)), req.file.buffer]),
        );
        let image: Buffer, width: number, height: number;
        try {
          if (
            req.file.buffer[0] !== 0xff ||
            req.file.buffer[1] !== 0xd8 ||
            req.file.buffer[2] !== 0xff
          )
            throw new Error('Not JPEG');
          const decoder = sharp(req.file.buffer, {
            limitInputPixels: 4_000_000,
            animated: false,
          });
          const info = await decoder.metadata();
          if (
            info.format !== 'jpeg' ||
            !info.width ||
            !info.height ||
            info.width > 1080 ||
            info.height > 4096 ||
            (info.pages ?? 1) !== 1
          )
            throw new Error('Invalid dimensions');
          width = info.width;
          height = info.height;
          image = await decoder.jpeg({ quality: 85 }).toBuffer();
          if (image.length > recordingLimits.frameBytes)
            throw new Error('Oversized');
        } catch {
          throw new HttpError(
            400,
            'Use a valid, single JPEG screenshot up to 1080 × 4096 pixels.',
          );
        }
        const result = await store.locked(async (c) => {
          const r = await store.validate(c, id, raw, true);
          const age = Date.now() - new Date(r.started_at).getTime();
          if (
            m.elapsedMs > age + 2000 ||
            m.elapsedMs < age - 40_000 ||
            m.elapsedMs + m.captureMs > 931_000
          )
            throw new HttpError(
              400,
              'Screenshot timing is outside this recording.',
            );
          if (r.stop_elapsed_ms !== null && m.elapsedMs > r.stop_elapsed_ms)
            throw new HttpError(409, 'Screenshot was captured after Stop.');
          const [old] = await c.query(
            'SELECT * FROM screenshot_frames WHERE recording_id=? AND sequence_number=?',
            [id, m.sequence],
          );
          if (old) {
            if (old.request_hash !== requestHash)
              throw new HttpError(
                409,
                'This frame sequence already contains different data.',
              );
            return {
              sequence: m.sequence,
              receivedAt: new Date(old.received_at).toISOString(),
              duplicate: true,
            };
          }
          if (
            Number(r.stored_bytes) + image.length >
            recordingLimits.sessionBytes
          )
            throw new HttpError(413, 'Recording size limit reached.');
          await store.capacity(c, image.length);
          const directory = join(store.directory, id);
          await mkdir(directory, { recursive: true, mode: 0o750 });
          await chmod(directory, 0o750);
          const temporary = join(directory, `.upload-${randomUUID()}.tmp`),
            final = store.framePath(id, m.sequence);
          let handle;
          try {
            handle = await open(temporary, 'wx', 0o640);
            await handle.chmod(0o640);
            await handle.writeFile(image);
            await handle.sync();
            await handle.close();
            handle = undefined;
            await rename(temporary, final);
            const dir = await open(directory, 'r');
            try {
              await dir.sync();
            } finally {
              await dir.close();
            }
            const receivedAt = new Date();
            const skew =
              Math.abs(
                new Date(m.capturedAt).getTime() -
                  (new Date(r.started_at).getTime() + m.elapsedMs),
              ) > 5000;
            await c.query(
              `INSERT INTO screenshot_frames VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
              [
                id,
                m.sequence,
                new Date(m.capturedAt),
                receivedAt,
                m.elapsedMs,
                m.captureMs,
                width,
                height,
                image.length,
                requestHash,
                hash(image),
                skew,
              ],
            );
            await c.query(
              'UPDATE screenshot_recordings SET received_frames=received_frames+1,stored_bytes=stored_bytes+?,scheduled_slots=GREATEST(scheduled_slots,?) WHERE id=?',
              [image.length, m.sequence, id],
            );
            return {
              sequence: m.sequence,
              receivedAt: receivedAt.toISOString(),
              duplicate: false,
            };
          } finally {
            await handle?.close();
            await rm(temporary, { force: true });
          }
        });
        res.status(result.duplicate ? 200 : 201).json(result);
      } finally {
        uploading--;
      }
    },
  );
  app.post('/api/recordings/:id/heartbeat', async (req, res) => {
    store.assertEnabled();
    z.object({}).strict().parse(req.body);
    await store.locked(async (c) => {
      const r = await store.validate(
        c,
        uuid.parse(req.params.id),
        bearer(req),
        true,
      );
      await c.query(
        'UPDATE screenshot_recordings SET heartbeat_at=UTC_TIMESTAMP(6) WHERE id=?',
        [r.id],
      );
    });
    res.json({ ok: true });
  });
  app.post('/api/recordings/:id/stop', async (req, res) => {
    store.assertEnabled();
    const b = z
      .object({
        phase: z.enum(['drain', 'finish']),
        elapsedMs: z.number().int().min(0).max(901_000),
        slots: z.number().int().min(0).max(900),
        reason: z.enum([
          'Stopped',
          'Backgrounded',
          'Navigation',
          'Signed out',
          'Capture failed',
          'Upload failed',
          'Duration limit',
          'Closed',
        ]),
      })
      .strict()
      .parse(req.body);
    await store.locked(async (c) => {
      const r = await store.validate(c, uuid.parse(req.params.id), bearer(req));
      if (r.state === 'stopped') return;
      await c.query(
        `UPDATE screenshot_recordings SET state=?,capture_stopped_at=COALESCE(capture_stopped_at,UTC_TIMESTAMP(6)),stop_elapsed_ms=COALESCE(stop_elapsed_ms,?),stop_reason=COALESCE(stop_reason,?),scheduled_slots=GREATEST(scheduled_slots,?),heartbeat_at=UTC_TIMESTAMP(6),finalized_at=? WHERE id=?`,
        [
          b.phase === 'finish' ? 'stopped' : 'uploading',
          b.elapsedMs,
          b.reason,
          b.slots,
          b.phase === 'finish' ? new Date() : null,
          r.id,
        ],
      );
    });
    res.json({ ok: true });
  });
  app.get('/api/admin/recordings', async (req, res) => {
    await admin(req);
    const q = z
      .object({ page: z.coerce.number().int().min(0).max(10_000).default(0) })
      .strict()
      .parse(req.query);
    const rows = await pool.query(
      `SELECT r.id,r.user_id,r.state,r.started_at,r.finalized_at,r.stop_reason,r.stop_elapsed_ms,r.scheduled_slots,r.received_frames,r.stored_bytes,u.username FROM screenshot_recordings r JOIN demo_users u ON u.id=r.user_id WHERE r.state<>'deleting' AND r.retained_until>UTC_TIMESTAMP(6) ORDER BY r.started_at DESC,r.id LIMIT 25 OFFSET ?`,
      [q.page * 25],
    );
    const [usage] = await pool.query(
      "SELECT COUNT(*) AS sessions,COALESCE(SUM(stored_bytes),0) AS bytes,MAX(heartbeat_at) AS last_liveness,SUM(state IN ('active','uploading')) AS active,SUM(state='interrupted') AS interrupted FROM screenshot_recordings",
    );
    let availableBytes: number | null = null;
    const [uploads] = await pool.query(
      'SELECT MAX(received_at) AS lastUpload FROM screenshot_frames',
    );
    try {
      const fs = await statfs(store.directory);
      availableBytes = Number(fs.bavail) * Number(fs.bsize);
    } catch {
      /* Not provisioned yet. */
    }
    let maintenance: unknown = null;
    try {
      const text = await readFile(
        join(store.directory, '.maintenance.json'),
        'utf8',
      );
      if (text.length < 4096) maintenance = JSON.parse(text);
    } catch {
      /* First cleanup has not completed. */
    }
    res.json({
      recordings: rows,
      page: q.page,
      enabled: store.enabled(),
      usage,
      availableBytes,
      maintenance,
      lastUpload: uploads.lastUpload,
      limits: recordingLimits,
    });
  });
  app.get('/api/admin/recordings/:id', async (req, res) => {
    await admin(req);
    const id = uuid.parse(req.params.id);
    const q = z
      .object({ after: z.coerce.number().int().min(0).max(900).default(0) })
      .strict()
      .parse(req.query);
    const [recording] = await pool.query(
      "SELECT id,user_id,state,started_at,finalized_at,stop_reason,stop_elapsed_ms,scheduled_slots,received_frames,stored_bytes FROM screenshot_recordings WHERE id=? AND state<>'deleting' AND retained_until>UTC_TIMESTAMP(6)",
      [id],
    );
    if (!recording) throw new HttpError(404, 'Recording not found.');
    const frames = await pool.query(
      'SELECT sequence_number,captured_at,received_at,elapsed_ms,capture_ms,width,height,byte_length,image_hash,clock_skew FROM screenshot_frames WHERE recording_id=? AND sequence_number>? ORDER BY sequence_number LIMIT 100',
      [id, q.after],
    );
    res.json({ recording, frames });
  });
  app.get(
    '/api/admin/recordings/:id/frames/:sequence',
    async (req, res, next) => {
      await admin(req);
      const id = uuid.parse(req.params.id),
        sequence = z.coerce
          .number()
          .int()
          .min(1)
          .max(900)
          .parse(req.params.sequence);
      const [frame] = await pool.query(
        "SELECT f.sequence_number FROM screenshot_frames f JOIN screenshot_recordings r ON r.id=f.recording_id WHERE f.recording_id=? AND f.sequence_number=? AND r.state<>'deleting' AND r.retained_until>UTC_TIMESTAMP(6)",
        [id, sequence],
      );
      if (!frame) throw new HttpError(404, 'Screenshot not found.');
      res.set('Content-Type', 'image/jpeg');
      res.sendFile(
        store.framePath(id, sequence),
        { dotfiles: 'deny' },
        (error) => {
          if (error && !res.headersSent)
            next(new HttpError(404, 'Screenshot file is unavailable.'));
        },
      );
    },
  );
  app.post('/api/admin/recordings/:id/delete', async (req, res) => {
    await admin(req, true);
    const id = uuid.parse(req.params.id);
    await store.locked(async (c) => {
      await c.query(
        "UPDATE screenshot_recordings SET state='deleting' WHERE id=?",
        [id],
      );
      await c.commit();
      await c.beginTransaction();
      await rm(join(store.directory, id), { recursive: true, force: true });
      await c.query('DELETE FROM screenshot_recordings WHERE id=?', [id]);
    });
    res.json({ ok: true });
  });
  return store;
}
