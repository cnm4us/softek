import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import mariadb from 'mariadb';
import { databaseConfig } from '../apps/api/src/config.js';
import {
  enqueueReplay,
  replayJob,
  runReplayJob,
} from '../apps/api/src/replay-jobs.js';
import { fixtureUser, cleanUsers } from './fixtures.js';

test('durable replay jobs serialize, recover, retry within bounds and follow source deletion', async (t) => {
  const pool = mariadb.createPool({
    ...databaseConfig('runtime', true),
    connectionLimit: 4,
    timezone: 'Z',
  });
  const user = await fixtureUser(pool);
  const run = randomUUID();
  const hash = () => createHash('sha256').update(randomUUID()).digest('hex');
  const create = async (
    overrides: { frames?: number; duration?: number } = {},
  ) => {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO screenshot_recordings
      (id,user_id,run_id,session_hash,credential_hash,request_id,document_id,approval_version,state,
       started_at,heartbeat_at,credential_expires_at,retained_until,finalized_at,stop_elapsed_ms,received_frames)
       VALUES (?,?,?,?,?,?,?,'screenshots-v2','stopped',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),
       DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 HOUR),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 DAY),UTC_TIMESTAMP(6),?,?)`,
      [
        id,
        user.id,
        run,
        hash(),
        hash(),
        randomUUID(),
        randomUUID(),
        overrides.duration ?? 2000,
        overrides.frames ?? 1,
      ],
    );
    const c = await pool.getConnection();
    try {
      await enqueueReplay(c, id);
      await enqueueReplay(c, id);
    } finally {
      c.release();
    }
    return id;
  };
  try {
    await pool.query(
      `INSERT INTO participant_runs
      (id,token_hash,profile_id,campaign_id,variant,eligible,actor,user_id,created_at,expires_at)
      VALUES (?,?,'alex','savings-launch','value',TRUE,'automation',?,UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 DAY))`,
      [run, hash(), user.id],
    );
    await t.test('empty and zero-duration sources do not enqueue', async () => {
      assert.equal(await replayJob(pool, await create({ frames: 0 })), null);
      assert.equal(await replayJob(pool, await create({ duration: 0 })), null);
    });
    await t.test(
      'one durable job per source, single worker across independent connections',
      async () => {
        const id = await create();
        let entered!: () => void, release!: () => void;
        const started = new Promise<void>((r) => (entered = r)),
          hold = new Promise<void>((r) => (release = r));
        let count = 0;
        const first = runReplayJob(pool, true, async (n) => {
          assert.equal(n, id);
          count++;
          entered();
          await hold;
        });
        await started;
        assert.equal((await replayJob(pool, id)).state, 'rendering');
        assert.equal(
          await runReplayJob(pool, true, async () => {
            count++;
          }),
          false,
        );
        release();
        assert.equal(await first, true);
        assert.equal(count, 1);
        assert.equal((await replayJob(pool, id)).state, 'ready');
        const c = await pool.getConnection();
        try {
          await enqueueReplay(c, id);
        } finally {
          c.release();
        }
        assert.equal((await replayJob(pool, id)).state, 'ready');
        assert.equal(
          await runReplayJob(pool, true, async () => {
            throw Error('Duplicate');
          }),
          false,
        );
      },
    );
    await t.test(
      'failed renders back off, stop after three attempts and preserve terminal status',
      async () => {
        const id = await create();
        const fail = async () => {
          throw Error('private failure details');
        };
        await runReplayJob(pool, true, fail);
        assert.equal((await replayJob(pool, id)).state, 'queued');
        assert.equal(
          await runReplayJob(pool, true, fail),
          false,
          'Backoff is durable',
        );
        for (let i = 0; i < 2; i++) {
          await pool.query(
            'UPDATE screenshot_replay_jobs SET available_at=UTC_TIMESTAMP(6) WHERE recording_id=?',
            [id],
          );
          await runReplayJob(pool, true, fail);
        }
        const job = await replayJob(pool, id);
        assert.equal(job.state, 'failed');
        assert.equal(job.attempts, 3);
        assert.equal(job.last_error, 'Video generation failed');
        assert.equal(await runReplayJob(pool, true, fail), false);
      },
    );
    await t.test(
      'a new worker recovers interrupted attempts under its exclusive lock',
      async () => {
        const id = await create();
        await pool.query(
          "UPDATE screenshot_replay_jobs SET state='rendering',attempts=1 WHERE recording_id=?",
          [id],
        );
        assert.equal(
          await runReplayJob(pool, true, async (n) => assert.equal(n, id)),
          true,
        );
        const job = await replayJob(pool, id);
        assert.equal(job.state, 'ready');
        assert.equal(job.attempts, 2);
      },
    );
    await t.test(
      'expired recordings are not rendered and deleted recordings remove jobs',
      async () => {
        const expired = await create();
        await pool.query(
          'UPDATE screenshot_recordings SET retained_until=UTC_TIMESTAMP(6) WHERE id=?',
          [expired],
        );
        assert.equal(
          await runReplayJob(pool, true, async () => {
            throw Error('Expired');
          }),
          false,
        );
        const id = await create();
        await runReplayJob(pool, true, async (n) => {
          assert.equal(n, id);
          await pool.query('DELETE FROM screenshot_recordings WHERE id=?', [n]);
        });
        assert.equal(await replayJob(pool, id), null);
      },
    );
  } finally {
    await cleanUsers(pool, [user.id]);
    await pool.end();
  }
});
