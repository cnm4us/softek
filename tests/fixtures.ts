import { randomUUID } from 'node:crypto';
import type { Pool } from 'mariadb';
import { passwordHash } from '../apps/api/src/passwords.js';

export async function fixtureUser(
  pool: Pool,
  profileId = 'alex',
  actor = 'automation',
) {
  const id = randomUUID(),
    username = `test.${randomUUID().slice(0, 20)}`,
    password = randomUUID();
  await pool.query(
    "INSERT INTO demo_users VALUES (?,?,?,?,TRUE,?,'value',?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",
    [
      id,
      username,
      'Test Harbor User',
      await passwordHash(password),
      profileId,
      profileId === 'alex',
      actor,
    ],
  );
  return { id, username, password };
}
export async function cleanUsers(pool: Pool, ids: string[]) {
  for (const id of ids) {
    const [user] = await pool.query(
      "SELECT id FROM demo_users WHERE id=? AND username LIKE 'test.%'",
      [id],
    );
    if (!user) continue;
    await pool.query(
      'DELETE e FROM interaction_events e JOIN participant_runs r ON r.id=e.run_id WHERE r.user_id=?',
      [id],
    );
    await pool.query(
      'DELETE p FROM banner_presentations p JOIN participant_runs r ON r.id=p.run_id WHERE r.user_id=?',
      [id],
    );
    await pool.query('DELETE FROM participant_runs WHERE user_id=?', [id]);
    await pool.query('DELETE FROM demo_users WHERE id=?', [id]);
  }
}
