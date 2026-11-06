import type { Pool, PoolConnection } from 'mariadb';

export async function enqueueReplay(c: PoolConnection, id: string) {
  await c.query(
    `INSERT INTO screenshot_replay_jobs(recording_id)
     SELECT id FROM screenshot_recordings WHERE id=? AND state='stopped'
       AND stop_elapsed_ms>0 AND received_frames>0 AND retained_until>UTC_TIMESTAMP(6)
     ON DUPLICATE KEY UPDATE recording_id=VALUES(recording_id)`,
    [id],
  );
}

export async function replayJob(pool: Pool, id: string) {
  const [row] = await pool.query(
    'SELECT state,attempts,queued_at,started_at,finished_at,last_error FROM screenshot_replay_jobs WHERE recording_id=?',
    [id],
  );
  return row ?? null;
}

// The connection-scoped lock serializes workers, including crash recovery. The
// renderer separately retains its existing manual/automatic global render lock.
export async function runReplayJob(
  pool: Pool,
  test: boolean,
  render: (id: string) => Promise<void>,
) {
  const c = await pool.getConnection();
  const lock = `softek-replay-worker-${test ? 'demo_test' : 'demo'}`;
  let acquired = false;
  try {
    const [result] = await c.query('SELECT GET_LOCK(?,0) AS acquired', [lock]);
    if (Number(result.acquired) !== 1) return false;
    acquired = true;
    await c.query(
      `UPDATE screenshot_replay_jobs SET
       state=IF(attempts<3,'queued','failed'), available_at=UTC_TIMESTAMP(6),
       finished_at=IF(attempts<3,NULL,UTC_TIMESTAMP(6)),last_error='Worker interrupted'
       WHERE state='rendering'`,
    );
    const [job] = await c.query(
      `SELECT j.recording_id,j.attempts FROM screenshot_replay_jobs j
       JOIN screenshot_recordings r ON r.id=j.recording_id
       WHERE j.state='queued' AND j.available_at<=UTC_TIMESTAMP(6)
       AND r.state='stopped' AND r.retained_until>UTC_TIMESTAMP(6)
       AND r.stop_elapsed_ms>0 AND r.received_frames>0
       ORDER BY j.queued_at,j.recording_id LIMIT 1`,
    );
    if (!job) return false;
    await c.query(
      `UPDATE screenshot_replay_jobs SET state='rendering',attempts=attempts+1,
       started_at=UTC_TIMESTAMP(6),finished_at=NULL,last_error=NULL WHERE recording_id=?`,
      [job.recording_id],
    );
    try {
      await render(job.recording_id);
      await c.query(
        `UPDATE screenshot_replay_jobs SET state='ready',finished_at=UTC_TIMESTAMP(6),last_error=NULL WHERE recording_id=?`,
        [job.recording_id],
      );
    } catch {
      const retry = Number(job.attempts) + 1 < 3;
      await c.query(
        `UPDATE screenshot_replay_jobs SET state=?,last_error='Video generation failed',
         available_at=TIMESTAMPADD(SECOND,?,UTC_TIMESTAMP(6)),
         finished_at=IF(?,NULL,UTC_TIMESTAMP(6)) WHERE recording_id=?`,
        [
          retry ? 'queued' : 'failed',
          Number(job.attempts) === 0 ? 30 : 120,
          retry,
          job.recording_id,
        ],
      );
    }
    return true;
  } finally {
    try {
      if (acquired) await c.query('SELECT RELEASE_LOCK(?)', [lock]);
    } finally {
      c.release();
    }
  }
}
