import assert from 'node:assert/strict';
import { pageWeb, pageBounds } from './page-context-fixtures.js';
import { test } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import {
  readFile,
  stat,
  writeFile,
  mkdir,
  access,
  rename,
  unlink,
  rm,
  utimes,
} from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { createApp } from '../apps/api/src/app.js';
import { RecordingStore, recordingLimits } from '../apps/api/src/recordings.js';
import { fixtureUser, cleanUsers } from './fixtures.js';

test('private screenshot receiver, timestamps, retries, lifecycle and cleanup', async (t) => {
  process.env.PUBLIC_ORIGIN = 'http://127.0.0.1:5173';
  const { app, pool } = createApp(true),
    server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const store = new RecordingStore(pool, true),
    users: string[] = [];
  let cookie = '',
    csrf = '',
    adminCookie = '',
    adminCsrf = '',
    adminRaw = '';
  let recording: { id: string; credential: string },
    requestId = randomUUID(),
    documentId = randomUUID();
  const sample = await sharp({
    create: { width: 720, height: 1100, channels: 3, background: '#205747' },
  })
    .jpeg()
    .toBuffer();
  async function request(
    path: string,
    body?: unknown,
    auth: 'customer' | 'admin' | 'none' | 'bearer' = 'customer',
    method?: string,
    credential?: string,
  ) {
    const r = await fetch(base + path, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: {
        'X-Demo-Automation': process.env.AUTOMATION_SECRET!,
        ...(auth === 'bearer'
          ? { Authorization: `Bearer ${credential ?? recording?.credential}` }
          : { Origin: process.env.PUBLIC_ORIGIN! }),
        ...(auth === 'customer'
          ? { Cookie: cookie, 'X-CSRF-Token': csrf }
          : {}),
        ...(auth === 'admin'
          ? { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf }
          : {}),
        'X-Browser-Session': documentId,
        ...(body instanceof FormData
          ? {}
          : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined
        ? {}
        : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    });
    const data = r.headers.get('content-type')?.includes('application/json')
      ? await r.json()
      : Buffer.from(await r.arrayBuffer());
    return { status: r.status, data, response: r };
  }
  const form = (
    sequence = 1,
    image: Uint8Array = sample,
    change: Record<string, unknown> = {},
  ) => {
    const f = new FormData();
    f.set('image', new Blob([new Uint8Array(image)]), 'frame.jpg');
    f.set(
      'metadata',
      JSON.stringify({
        sequence,
        capturedAt: '2020-01-01T00:00:00.123Z',
        elapsedMs: sequence * 1000,
        captureMs: 20,
        ...change,
      }),
    );
    return f;
  };
  const start = () =>
    request('/api/recordings', {
      requestId,
      documentId,
      approvalVersion: 'screenshots-v1',
    });
  try {
    const user = await fixtureUser(pool);
    users.push(user.id);
    const login = await request(
      '/api/auth/login',
      {
        username: user.username,
        password: user.password,
        requestId: randomUUID(),
      },
      'none',
    );
    assert.equal(login.status, 200);
    cookie = login.response.headers
      .getSetCookie()
      .find((s) => s.startsWith('softek_user='))!
      .split(';')[0]!;
    // Existing login response returns state through /api/state, not an extracted cookie token bridge.
    const state = await request('/api/state');
    csrf = state.data.csrf;
    const loggedAdmin = await request(
      '/api/admin/login',
      { password: process.env.DEMO_ADMIN_SECRET },
      'none',
    );
    adminCsrf = loggedAdmin.data.csrf;
    adminCookie = loggedAdmin.response.headers
      .getSetCookie()
      .find((s) => s.startsWith('softek_admin='))!
      .split(';')[0]!;
    adminRaw = adminCookie.split('=')[1]!;

    await t.test(
      'creation is authenticated, approved and server-owned; retry returns the same scoped credential',
      async () => {
        assert.equal(
          (
            await request(
              '/api/recordings',
              { requestId, documentId, approvalVersion: 'screenshots-v1' },
              'none',
            )
          ).status,
          403,
        );
        const started = await start();
        assert.equal(started.status, 201);
        recording = started.data;
        assert.equal((await start()).data.credential, recording.credential);
        const [r] = await pool.query(
          'SELECT * FROM screenshot_recordings WHERE id=?',
          [recording.id],
        );
        assert.equal(r.user_id, user.id);
        assert.equal(r.approval_version, 'screenshots-v1');
        assert.equal(
          r.credential_hash,
          createHash('sha256').update(recording.credential).digest('hex'),
        );
        assert.notEqual(r.session_hash, r.credential_hash);
        const old = recording;
        requestId = randomUUID();
        const replacement = await start();
        assert.equal(replacement.status, 201);
        recording = replacement.data;
        assert.notEqual(recording.id, old.id);
        assert.equal(
          (
            await pool.query(
              'SELECT state FROM screenshot_recordings WHERE id=?',
              [old.id],
            )
          )[0].state,
          'interrupted',
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${old.id}/heartbeat`,
              {},
              'bearer',
              undefined,
              old.credential,
            )
          ).status,
          409,
        );
        // Make early slots immediately uploadable without waiting on wall-clock timers.
        await pool.query(
          'UPDATE screenshot_recordings SET started_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 10 SECOND) WHERE id=?',
          [recording.id],
        );
      },
    );
    await t.test(
      'image/private metadata require admin access; upload rejects missing/wrong credentials before parsing',
      async () => {
        assert.equal(
          (await request('/api/admin/recordings', undefined, 'none')).status,
          401,
        );
        assert.equal(
          (await request(`/api/admin/recordings/${recording.id}`, undefined))
            .status,
          401,
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(),
              'none',
            )
          ).status,
          401,
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(),
              'bearer',
              undefined,
              'a'.repeat(64),
            )
          ).status,
          401,
        );
      },
    );
    await t.test(
      'valid JPEG persists independent capture/receipt times, integrity and private permissions',
      async () => {
        const uploaded = await Promise.all([
          request(`/api/recordings/${recording.id}/frames`, form(), 'bearer'),
          request(
            `/api/recordings/${recording.id.toUpperCase()}/frames`,
            form(),
            'bearer',
          ),
        ]);
        assert.deepEqual(uploaded.map((r) => r.status).sort(), [200, 201]);
        const [f] = await pool.query(
          'SELECT * FROM screenshot_frames WHERE recording_id=?',
          [recording.id],
        );
        assert.equal(
          new Date(f.captured_at).toISOString(),
          '2020-01-01T00:00:00.123Z',
        );
        assert.ok(
          new Date(f.received_at).getTime() > new Date(f.captured_at).getTime(),
        );
        assert.equal(f.clock_skew, 1);
        assert.equal(f.elapsed_ms, 1000);
        assert.equal(f.width, 720);
        const p = store.framePath(recording.id, 1),
          bytes = await readFile(p);
        assert.equal(
          createHash('sha256').update(bytes).digest('hex'),
          f.image_hash,
        );
        assert.equal((await stat(p)).mode & 0o777, 0o640);
        assert.equal(
          (await stat(join(store.directory, recording.id))).mode & 0o777,
          0o750,
        );
        assert.equal(
          (
            await request(
              `/api/admin/recordings/${recording.id}/frames/1`,
              undefined,
              'customer',
            )
          ).status,
          401,
        );
        const read = await request(
          `/api/admin/recordings/${recording.id}/frames/1`,
          undefined,
          'admin',
        );
        assert.equal(read.status, 200);
        assert.equal(read.response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(read.data, bytes);
      },
    );
    await t.test(
      'derived replay remains private, supports range reads, shares quotas and removes stale work',
      async () => {
        const folder = join(store.directory, recording.id, 'replay');
        const work = join(store.directory, recording.id, '.replay-work');
        const bytes = Buffer.from('fictional-mp4-range-fixture');
        await mkdir(folder, { mode: 0o750 });
        await writeFile(join(folder, 'sample.mp4'), bytes, { mode: 0o640 });
        await writeFile(join(folder, 'full.mp4'), bytes, { mode: 0o640 });
        await writeFile(
          join(folder, 'report.json'),
          JSON.stringify({
            version: 1,
            sample: { durationMs: 15000 },
            full: { durationMs: 139250 },
            reconstructedIntervals: 3,
          }),
          { mode: 0o640 },
        );
        await writeFile(
          join(folder, 'canvas-preview.png'),
          Buffer.from('fictional-page-preview'),
          { mode: 0o640 },
        );
        const canvasFolder = join(folder, 'canvas', 'page-1');
        await mkdir(canvasFolder, { recursive: true, mode: 0o750 });
        await writeFile(
          join(canvasFolder, 'preview.png'),
          Buffer.from('fictional-page-preview'),
          { mode: 0o640 },
        );
        const route = `/api/admin/recordings/${recording.id}/replay/sample.mp4`;
        const cap = recordingLimits.totalBytes;
        try {
          assert.equal((await request(route, undefined, 'none')).status, 401);
          assert.equal(
            (await request(route, undefined, 'customer')).status,
            401,
          );
          const previewRoute = `/api/admin/recordings/${recording.id}/replay/canvas-preview.png`;
          assert.equal(
            (await request(previewRoute, undefined, 'none')).status,
            401,
          );
          const preview = await request(previewRoute, undefined, 'admin');
          assert.equal(preview.status, 200);
          assert.ok(
            preview.response.headers
              .get('content-type')
              ?.startsWith('image/png'),
          );
          assert.equal(
            preview.response.headers.get('cache-control'),
            'no-store',
          );
          const pageRoute = `/api/admin/recordings/${recording.id}/page-references/0`;
          assert.equal(
            (await request(pageRoute, undefined, 'none')).status,
            401,
          );
          const pageRead = await request(pageRoute, undefined, 'admin');
          assert.equal(pageRead.status, 200);
          assert.equal(
            pageRead.response.headers.get('cache-control'),
            'no-store',
          );
          assert.equal(
            (
              await request(
                `/api/admin/recordings/${recording.id}/page-references/64`,
                undefined,
                'admin',
              )
            ).status,
            400,
          );
          const read = await request(route, undefined, 'admin');
          assert.equal(read.status, 200);
          assert.deepEqual(read.data, bytes);
          assert.equal(read.response.headers.get('cache-control'), 'no-store');
          const range = await fetch(base + route, {
            headers: {
              Cookie: adminCookie,
              Range: 'bytes=0-9',
              'X-Demo-Automation': process.env.AUTOMATION_SECRET!,
            },
          });
          assert.equal(range.status, 206);
          assert.deepEqual(
            Buffer.from(await range.arrayBuffer()),
            bytes.subarray(0, 10),
          );
          assert.equal(
            (
              await request(
                `/api/admin/recordings/${recording.id}`,
                undefined,
                'admin',
              )
            ).data.replay.version,
            1,
          );
          const [imageUsage] = await pool.query(
            'SELECT COALESCE(SUM(stored_bytes),0) AS bytes FROM screenshot_recordings',
          );
          recordingLimits.totalBytes = Number(imageUsage.bytes) + bytes.length;
          await assert.rejects(
            store.locked((c) => store.capacity(c)),
            /storage limit/,
          );
          recordingLimits.totalBytes = cap;
          await mkdir(work, { mode: 0o750 });
          await utimes(
            work,
            new Date(Date.now() - 31 * 60_000),
            new Date(Date.now() - 31 * 60_000),
          );
          assert.equal((await store.cleanup(true)).staleReplayWork, 1);
          await store.cleanup(false);
          await assert.rejects(access(work));
          await access(join(folder, 'sample.mp4'));
          const [r] = await pool.query(
            'SELECT retained_until FROM screenshot_recordings WHERE id=?',
            [recording.id],
          );
          try {
            await pool.query(
              'UPDATE screenshot_recordings SET retained_until=UTC_TIMESTAMP(6) WHERE id=?',
              [recording.id],
            );
            assert.equal(
              (await request(route, undefined, 'admin')).status,
              404,
            );
          } finally {
            await pool.query(
              'UPDATE screenshot_recordings SET retained_until=? WHERE id=?',
              [r.retained_until, recording.id],
            );
          }
        } finally {
          recordingLimits.totalBytes = cap;
          await rm(folder, { recursive: true, force: true });
          await rm(work, { recursive: true, force: true });
        }
      },
    );
    await t.test(
      'identical retries deduplicate, altered sequence payloads conflict, and arrivals need not be ordered',
      async () => {
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(),
              'bearer',
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(1, sample, { captureMs: 21 }),
              'bearer',
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(3),
              'bearer',
            )
          ).status,
          201,
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(2),
              'bearer',
            )
          ).status,
          201,
        );
        const listed = await request(
          `/api/admin/recordings/${recording.id}`,
          undefined,
          'admin',
        );
        assert.deepEqual(
          listed.data.frames.map((f: any) => f.sequence_number),
          [1, 2, 3],
        );
        assert.equal(listed.data.recording.received_frames, 3);
      },
    );
    await t.test(
      'invalid image/timing, overlarge multipart and session quota fail without an acknowledged frame',
      async () => {
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(4, new TextEncoder().encode('invalid')),
              'bearer',
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(4, new Uint8Array(1_048_577)),
              'bearer',
            )
          ).status,
          413,
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(4, sample, { elapsedMs: 1000 }),
              'bearer',
            )
          ).status,
          400,
        );
        await pool.query(
          'UPDATE screenshot_recordings SET stored_bytes=268435456 WHERE id=?',
          [recording.id],
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(4),
              'bearer',
            )
          ).status,
          413,
        );
        await pool.query(
          'UPDATE screenshot_recordings SET stored_bytes=(SELECT SUM(byte_length) FROM screenshot_frames WHERE recording_id=?) WHERE id=?',
          [recording.id, recording.id],
        );
      },
    );
    await t.test(
      'low free space and the shared storage cap reject uploads before publication',
      async () => {
        const savedFree = recordingLimits.minFreeBytes;
        const savedTotal = recordingLimits.totalBytes;
        try {
          recordingLimits.minFreeBytes = Number.MAX_SAFE_INTEGER;
          assert.equal(
            (
              await request(
                `/api/recordings/${recording.id}/frames`,
                form(4),
                'bearer',
              )
            ).status,
            503,
          );
          recordingLimits.minFreeBytes = savedFree;
          recordingLimits.totalBytes = 0;
          assert.equal(
            (
              await request(
                `/api/recordings/${recording.id}/frames`,
                form(4),
                'bearer',
              )
            ).status,
            503,
          );
          const [row] = await pool.query(
            'SELECT COUNT(*) AS count FROM screenshot_frames WHERE recording_id=? AND sequence_number=4',
            [recording.id],
          );
          assert.equal(Number(row.count), 0);
          await assert.rejects(access(store.framePath(recording.id, 4)));
        } finally {
          recordingLimits.minFreeBytes = savedFree;
          recordingLimits.totalBytes = savedTotal;
        }
      },
    );
    await t.test(
      'two-session cap and customer deletion preserve another customer recording',
      async () => {
        const original = recording,
          savedCookie = cookie,
          savedCsrf = csrf;
        try {
          const second = await fixtureUser(pool);
          users.push(second.id);
          const login = await request(
            '/api/auth/login',
            {
              username: second.username,
              password: second.password,
              requestId: randomUUID(),
            },
            'none',
          );
          assert.equal(login.status, 200);
          cookie = login.response.headers
            .getSetCookie()
            .find((s) => s.startsWith('softek_user='))!
            .split(';')[0]!;
          csrf = (await request('/api/state')).data.csrf;
          requestId = randomUUID();
          recording = (await start()).data;
          assert.equal(
            (
              await request(
                `/api/recordings/${original.id}/frames`,
                form(4),
                'bearer',
              )
            ).status,
            401,
          );
          await pool.query(
            'UPDATE screenshot_recordings SET started_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 5 SECOND) WHERE id=?',
            [recording.id],
          );
          assert.equal(
            (
              await request(
                `/api/recordings/${recording.id}/frames`,
                form(),
                'bearer',
              )
            ).status,
            201,
          );
          const secondPath = store.framePath(recording.id, 1);
          const third = await fixtureUser(pool);
          users.push(third.id);
          const thirdLogin = await request(
            '/api/auth/login',
            {
              username: third.username,
              password: third.password,
              requestId: randomUUID(),
            },
            'none',
          );
          assert.equal(thirdLogin.status, 200);
          cookie = thirdLogin.response.headers
            .getSetCookie()
            .find((v) => v.startsWith('softek_user='))!
            .split(';')[0]!;
          csrf = (await request('/api/state')).data.csrf;
          assert.equal(
            (
              await request('/api/recordings', {
                requestId: randomUUID(),
                documentId,
                approvalVersion: 'screenshots-v1',
              })
            ).status,
            429,
          );
          assert.equal(
            (await request(`/api/admin/users/${second.id}/delete`, {}, 'admin'))
              .status,
            200,
          );
          await assert.rejects(access(secondPath));
          await access(store.framePath(original.id, 1));
          assert.equal(
            (
              await request(
                `/api/admin/recordings/${original.id}`,
                undefined,
                'admin',
              )
            ).data.recording.received_frames,
            3,
          );
        } finally {
          recording = original;
          cookie = savedCookie;
          csrf = savedCsrf;
        }
      },
    );
    await t.test(
      'filesystem publication failure leaves no acknowledged metadata and retry succeeds after repair',
      async () => {
        const path = join(store.directory, recording.id);
        const backup = join(store.directory, `.blocked-${recording.id}`);
        await rename(path, backup);
        await writeFile(path, sample);
        try {
          assert.equal(
            (
              await request(
                `/api/recordings/${recording.id}/frames`,
                form(4),
                'bearer',
              )
            ).status,
            500,
          );
        } finally {
          await unlink(path);
          await rename(backup, path);
        }
        assert.equal(
          (
            await request(
              `/api/admin/recordings/${recording.id}`,
              undefined,
              'admin',
            )
          ).data.recording.received_frames,
          3,
        );
      },
    );
    await t.test(
      'Stop bounds queued capture time and finalization is idempotent',
      async () => {
        const stopped = {
          phase: 'drain',
          elapsedMs: 4000,
          slots: 4,
          reason: 'Stopped',
        };
        assert.equal(
          (
            await pool.query(
              'SELECT COUNT(*) AS n FROM screenshot_replay_jobs WHERE recording_id=?',
              [recording.id],
            )
          )[0].n,
          0,
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/stop`,
              stopped,
              'bearer',
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await pool.query(
              'SELECT COUNT(*) AS n FROM screenshot_replay_jobs WHERE recording_id=?',
              [recording.id],
            )
          )[0].n,
          0,
          'Drain must not start rendering before uploads finish',
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(5),
              'bearer',
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(4),
              'bearer',
            )
          ).status,
          201,
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/stop`,
              { ...stopped, phase: 'finish' },
              'bearer',
            )
          ).status,
          200,
        );
        const jobs = await pool.query(
          'SELECT state,attempts FROM screenshot_replay_jobs WHERE recording_id=?',
          [recording.id],
        );
        assert.equal(jobs.length, 1);
        assert.equal(jobs[0].state, 'queued');
        assert.equal(jobs[0].attempts, 0);
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/stop`,
              { ...stopped, phase: 'finish' },
              'bearer',
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(5),
              'bearer',
            )
          ).status,
          409,
        );
      },
    );
    await t.test(
      'video status is private and failed retry requires admin/CSRF without duplicating queued work',
      async () => {
        const path = `/api/admin/recordings/${recording.id}/replay/retry`;
        assert.equal((await request(path, {}, 'customer')).status, 403);
        const denied = await fetch(base + path, {
          method: 'POST',
          headers: {
            Origin: process.env.PUBLIC_ORIGIN!,
            'Content-Type': 'application/json',
            Cookie: adminCookie,
            'X-Demo-Automation': process.env.AUTOMATION_SECRET!,
          },
          body: '{}',
        });
        assert.equal(denied.status, 403);
        assert.equal((await request(path, {}, 'admin')).status, 409);
        await pool.query(
          "UPDATE screenshot_replay_jobs SET state='failed',attempts=3,last_error='Video generation failed' WHERE recording_id=?",
          [recording.id],
        );
        const view = await request(
          `/api/admin/recordings/${recording.id}`,
          undefined,
          'admin',
        );
        assert.equal(view.data.replayJob.state, 'failed');
        assert.equal((await request(path, {}, 'admin')).status, 200);
        assert.equal((await request(path, {}, 'admin')).status, 409);
        const [job] = await pool.query(
          'SELECT state,attempts,last_error FROM screenshot_replay_jobs WHERE recording_id=?',
          [recording.id],
        );
        assert.equal(job.state, 'queued');
        assert.equal(job.attempts, 0);
        assert.equal(job.last_error, null);
      },
    );
    await t.test(
      'cleanup dry-run preserves files; explicit admin deletion revokes uploads and removes bytes',
      async () => {
        const orphan = randomUUID();
        await mkdir(join(store.directory, orphan));
        await writeFile(join(store.directory, orphan, '1.jpg'), sample);
        const dry = await store.cleanup(true);
        assert.ok(dry.directories >= 1);
        await access(join(store.directory, orphan, '1.jpg'));
        await store.cleanup(false);
        await assert.rejects(access(join(store.directory, orphan)));
        assert.equal(
          (
            await request(
              `/api/admin/recordings/${recording.id}/delete`,
              {},
              'customer',
              'POST',
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(
              `/api/admin/recordings/${recording.id}/delete`,
              {},
              'admin',
              'POST',
            )
          ).status,
          200,
        );
        await assert.rejects(access(store.framePath(recording.id, 1)));
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(),
              'bearer',
            )
          ).status,
          401,
        );
      },
    );
    await t.test(
      'reconciliation recovers orphan/temp/missing files and retention denies expired reads',
      async () => {
        requestId = randomUUID();
        recording = (await start()).data;
        await pool.query(
          'UPDATE screenshot_recordings SET started_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 5 SECOND) WHERE id=?',
          [recording.id],
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(),
              'bearer',
            )
          ).status,
          201,
        );
        await writeFile(store.framePath(recording.id, 9), sample);
        const temporary = join(
          store.directory,
          recording.id,
          `.upload-${randomUUID()}.tmp`,
        );
        await writeFile(temporary, sample);
        await unlink(store.framePath(recording.id, 1));
        const dry = await store.cleanup(true);
        assert.equal(dry.missingFrames, 1);
        assert.equal(dry.orphanFrames, 1);
        assert.equal(dry.temporary, 1);
        assert.equal(
          (
            await request(
              `/api/admin/recordings/${recording.id}`,
              undefined,
              'admin',
            )
          ).data.recording.received_frames,
          1,
        );
        await store.cleanup(false);
        const recovered = (
          await request(
            `/api/admin/recordings/${recording.id}`,
            undefined,
            'admin',
          )
        ).data.recording;
        assert.equal(recovered.state, 'interrupted');
        assert.equal(recovered.received_frames, 0);
        assert.equal(Number(recovered.stored_bytes), 0);
        await assert.rejects(access(temporary));
        await assert.rejects(access(store.framePath(recording.id, 9)));
        await pool.query(
          'UPDATE screenshot_recordings SET retained_until=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE id=?',
          [recording.id],
        );
        assert.equal(
          (
            await request(
              `/api/admin/recordings/${recording.id}`,
              undefined,
              'admin',
            )
          ).status,
          404,
        );
        assert.equal((await store.cleanup(true)).expired, 1);
        await store.cleanup(false);
        assert.equal(
          (
            await pool.query(
              'SELECT id FROM screenshot_recordings WHERE id=?',
              [recording.id],
            )
          ).length,
          0,
        );
      },
    );
    await t.test(
      'change policy accepts near-zero and same-second frames, bounds private events, and records loss',
      async () => {
        requestId = randomUUID();
        recording = (await start()).data;
        const g = {
          route: '/',
          width: 440,
          height: 812,
          scale: 1,
          offsetX: 0,
          offsetY: 0,
          scrollX: 0,
          scrollY: 0,
          container: 'document',
          containerX: 0,
          containerY: 0,
        };
        const context = {
          reason: 'start',
          geometry: g,
          uncertaintyMs: 10,
          unstable: false,
        };
        const event = {
          sequence: 1,
          elapsedMs: 500,
          kind: 'tap',
          geometry: g,
          uncertaintyMs: 10,
          x: 0.25,
          y: 0.5,
        };
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(1, sample, { elapsedMs: 0 }),
              'bearer',
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/events`,
              { requestId: randomUUID(), events: [event] },
              'bearer',
            )
          ).status,
          409,
        );
        requestId = randomUUID();
        const body = {
          requestId,
          documentId,
          approvalVersion: 'screenshots-v2',
          policy: 'changes-v2',
        };
        assert.equal(
          (
            await request('/api/recordings', {
              ...body,
              approvalVersion: 'screenshots-v1',
            })
          ).status,
          400,
        );
        const created = await request('/api/recordings', body);
        assert.equal(created.status, 201);
        recording = created.data;
        await pool.query(
          'UPDATE screenshot_recordings SET started_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 10 SECOND) WHERE id=?',
          [recording.id],
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(1, sample, { elapsedMs: 0, context }),
              'bearer',
            )
          ).status,
          201,
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(2, sample, {
                elapsedMs: 500,
                context: { ...context, reason: 'ui' },
              }),
              'bearer',
            )
          ).status,
          201,
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(3, sample, {
                elapsedMs: 600,
                context: { ...context, inputValue: 'excluded' },
              }),
              'bearer',
            )
          ).status,
          400,
        );
        const endpoint = `/api/recordings/${recording.id}/events`,
          batch = {
            requestId: randomUUID(),
            events: [event, { ...event, sequence: 3, elapsedMs: 600 }],
          };
        assert.equal((await request(endpoint, batch, 'bearer')).status, 201);
        assert.equal((await request(endpoint, batch, 'bearer')).status, 200);
        assert.equal(
          (
            await request(
              endpoint,
              { ...batch, events: [{ ...event, x: 0.75 }] },
              'bearer',
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await request(
              endpoint,
              { ...batch, events: [{ ...event, inputValue: 'never allowed' }] },
              'bearer',
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              `/api/admin/recordings/${recording.id}/events`,
              undefined,
              'customer',
            )
          ).status,
          401,
        );
        const reviewed = await request(
          `/api/admin/recordings/${recording.id}/events`,
          undefined,
          'admin',
        );
        assert.equal(reviewed.data.events.length, 2);
        const stopped = {
          phase: 'drain',
          elapsedMs: 800,
          slots: 2,
          events: 3,
          lostEvents: 0,
          coalesced: 5,
          reason: 'Stopped',
        };
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/stop`,
              stopped,
              'bearer',
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await request(
              endpoint,
              { ...batch, events: [{ ...event, sequence: 4, elapsedMs: 900 }] },
              'bearer',
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/stop`,
              { ...stopped, phase: 'finish' },
              'bearer',
            )
          ).status,
          200,
        );
        const [r] = await pool.query(
          'SELECT * FROM screenshot_recordings WHERE id=?',
          [recording.id],
        );
        assert.equal(r.capture_policy, 'changes-v2');
        assert.equal(r.received_events, 2);
        assert.equal(r.lost_events, 1);
        assert.equal(r.coalesced_triggers, 5);
        assert.ok(Number(r.event_bytes) > 0);
        await request(
          `/api/admin/recordings/${recording.id}/delete`,
          {},
          'admin',
        );
        assert.equal(
          Number(
            (
              await pool.query(
                'SELECT COUNT(*) n FROM screenshot_events WHERE recording_id=?',
                [recording.id],
              )
            )[0].n,
          ),
          0,
        );
        assert.equal(
          Number(
            (
              await pool.query(
                'SELECT COUNT(*) n FROM screenshot_frame_context WHERE recording_id=?',
                [recording.id],
              )
            )[0].n,
          ),
          0,
        );
      },
    );
    await t.test(
      'native window provenance requires matching approval and survives private readback',
      async () => {
        const context = {
          reason: 'error',
          geometry: {
            route: '/',
            width: 440,
            height: 812,
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            scrollX: 0,
            scrollY: 0,
            container: 'document',
            containerX: 0,
            containerY: 0,
          },
          uncertaintyMs: 25,
          unstable: false,
        };
        const surface = {
          method: 'window-crop-v1',
          maskedKeyboard: true,
          anchoredPopover: true,
        };
        const body = {
          requestId: randomUUID(),
          documentId,
          policy: 'changes-v2',
          approvalVersion: 'screenshots-v2',
        };
        const base = await request('/api/recordings', body);
        assert.equal(base.status, 201);
        recording = base.data;
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(1, sample, {
                elapsedMs: 0,
                context: { ...context, surface },
              }),
              'bearer',
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await request('/api/recordings', {
              ...body,
              approvalVersion: 'screenshots-window-v1',
            })
          ).status,
          409,
        );
        const windowBody = {
          ...body,
          requestId: randomUUID(),
          approvalVersion: 'screenshots-window-v1',
        };
        assert.equal(
          (
            await request('/api/recordings', {
              ...windowBody,
              policy: 'periodic-v1',
            })
          ).status,
          400,
        );
        const created = await request('/api/recordings', windowBody);
        assert.equal(created.status, 201);
        recording = created.data;
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(1, sample, { elapsedMs: 0, context }),
              'bearer',
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(1, sample, {
                elapsedMs: 0,
                context: {
                  ...context,
                  surface: { ...surface, inputValue: 'excluded' },
                },
              }),
              'bearer',
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(1, sample, {
                elapsedMs: 0,
                context: { ...context, surface },
              }),
              'bearer',
            )
          ).status,
          201,
        );
        const read = await request(
          `/api/admin/recordings/${recording.id}`,
          undefined,
          'admin',
        );
        assert.equal(read.status, 200);
        assert.equal(read.data.recording.capture_method, 'window-crop-v1');
        assert.deepEqual(read.data.frames[0].context.surface, surface);
        assert.equal(
          (
            await request(
              `/api/admin/recordings/${recording.id}`,
              undefined,
              'none',
            )
          ).status,
          401,
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/stop`,
              { phase: 'finish', elapsedMs: 1000, slots: 1, reason: 'Stopped' },
              'bearer',
            )
          ).status,
          200,
        );
        await request(
          `/api/admin/recordings/${recording.id}/delete`,
          {},
          'admin',
        );
      },
    );
    await t.test(
      'page references bind versioned context to approval and validate decoded image bounds',
      async () => {
        const created = await request('/api/recordings', {
          requestId: randomUUID(),
          documentId,
          policy: 'changes-v2',
          approvalVersion: 'screenshots-window-canvas-v1',
        });
        assert.equal(created.status, 201);
        assert.equal(created.data.pageContextVersion, 1);
        recording = created.data;
        const context = {
          reason: 'scroll',
          geometry: {
            route: '/goals',
            width: 440,
            height: 812,
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            scrollX: 0,
            scrollY: 0,
            container: 'document',
            containerX: 0,
            containerY: 0,
          },
          uncertaintyMs: 25,
          unstable: false,
          surface: {
            method: 'window-crop-v1',
            maskedKeyboard: true,
            anchoredPopover: false,
          },
          page: { version: 1, web: pageWeb, image: pageBounds },
        };
        const send = (c: unknown) =>
          request(
            `/api/recordings/${recording.id}/frames`,
            form(1, sample, { elapsedMs: 0, context: c }),
            'bearer',
          );
        const { page, ...missing } = context;
        assert.equal((await send(missing)).status, 400);
        assert.equal(
          (
            await send({
              ...context,
              page: {
                ...page,
                image: {
                  ...pageBounds,
                  height: 1099,
                  excluded: [{ x: 0, y: 700, width: 720, height: 399 }],
                },
              },
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await send({
              ...context,
              page: { ...page, web: { ...pageWeb, inputValue: 'excluded' } },
            })
          ).status,
          400,
        );
        assert.equal((await send(context)).status, 201);
        assert.equal((await send(context)).status, 200);
        const read = await request(
          `/api/admin/recordings/${recording.id}`,
          undefined,
          'admin',
        );
        assert.equal(read.data.recording.capture_method, 'window-crop-v1');
        assert.deepEqual(read.data.frames[0].context.page, page);
        await request(
          `/api/recordings/${recording.id}/stop`,
          { phase: 'finish', elapsedMs: 1000, slots: 1, reason: 'Stopped' },
          'bearer',
        );
        await request(
          `/api/admin/recordings/${recording.id}/delete`,
          {},
          'admin',
        );
      },
    );
    await t.test(
      'expired heartbeat and revoked customer session stop receiver access',
      async () => {
        requestId = randomUUID();
        recording = (await start()).data;
        await pool.query(
          'UPDATE screenshot_recordings SET heartbeat_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 91 SECOND) WHERE id=?',
          [recording.id],
        );
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/heartbeat`,
              {},
              'bearer',
            )
          ).status,
          409,
        );
        await store.cleanup(false);
        assert.equal(
          (
            await request(
              `/api/admin/recordings/${recording.id}`,
              undefined,
              'admin',
            )
          ).data.recording.state,
          'interrupted',
        );
        requestId = randomUUID();
        recording = (await start()).data;
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/heartbeat`,
              {},
              'bearer',
            )
          ).status,
          200,
        );
        await request('/api/auth/logout', {});
        assert.equal(
          (
            await request(
              `/api/recordings/${recording.id}/frames`,
              form(),
              'bearer',
            )
          ).status,
          401,
        );
      },
    );
  } finally {
    await cleanUsers(pool, users);
    await store.cleanup(false);
    if (adminRaw)
      await pool.query('DELETE FROM admin_sessions WHERE token_hash=?', [
        createHash('sha256').update(adminRaw).digest('hex'),
      ]);
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
