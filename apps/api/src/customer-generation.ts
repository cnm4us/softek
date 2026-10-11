import { randomInt, randomUUID } from 'node:crypto';
import type { PoolConnection } from 'mariadb';
import { z } from 'zod';
import { passwordHash } from './passwords.js';
import { HttpError } from './errors.js';

const amount = z.number().int().min(0).max(100_000_000);
export const generationSchema = z
  .object({
    requestId: z.string().uuid(),
    count: z.number().int().min(1).max(200),
    prefix: z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(16)
      .regex(/^[a-z][a-z0-9._-]*$/),
    password: z.string().min(8).max(128),
    profileId: z.enum(['alex', 'jamie']).default('alex'),
    variant: z.enum(['baseline', 'value']).default('value'),
    eligible: z.boolean(),
    actor: z.enum(['human', 'automation']).default('human'),
    checkingMinMinor: amount,
    checkingMaxMinor: amount,
    savingsMinMinor: amount,
    savingsMaxMinor: amount,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.checkingMinMinor > value.checkingMaxMinor)
      ctx.addIssue({
        code: 'custom',
        path: ['checkingMaxMinor'],
        message: 'Checking maximum must be at least the minimum.',
      });
    if (value.savingsMinMinor > value.savingsMaxMinor)
      ctx.addIssue({
        code: 'custom',
        path: ['savingsMaxMinor'],
        message: 'Savings maximum must be at least the minimum.',
      });
  });
type Input = z.infer<typeof generationSchema>;
const firstNames = [
  'Riley',
  'Jordan',
  'Avery',
  'Morgan',
  'Casey',
  'Taylor',
  'Cameron',
  'Quinn',
  'Reese',
  'Parker',
  'Rowan',
  'Drew',
  'Sage',
  'Alex',
  'Jamie',
  'Blake',
  'Skyler',
  'Emerson',
  'Hayden',
  'Robin',
];
const lastNames = [
  'Hayes',
  'Bennett',
  'Rivera',
  'Brooks',
  'Chen',
  'Patel',
  'Reed',
  'Carter',
  'Ellis',
  'Morgan',
  'Walker',
  'Nguyen',
  'Davis',
  'Sullivan',
  'Kim',
  'Wright',
  'Foster',
  'Ramirez',
  'Wilson',
  'Gray',
];

export async function batchResult(c: PoolConnection, id: number) {
  const customers = await c.query(
    'SELECT u.id,u.username,u.display_name AS displayName,u.actor,u.profile_id AS profileId,u.variant,u.eligible,b.checking_minor AS checkingMinor,b.savings_minor AS savingsMinor FROM customer_starting_balances b JOIN demo_users u ON u.id=b.user_id WHERE b.batch_id=? ORDER BY b.position',
    [id],
  );
  return { batchId: id, customers };
}
export async function generateCustomers(
  c: PoolConnection,
  b: Input,
  fingerprint: string,
) {
  // The upsert takes an exclusive row lock, avoiding lock-upgrade deadlocks on
  // concurrent retries. A batch and all its customers commit in one transaction.
  await c.query(
    'INSERT INTO customer_generation_batches (request_id,request_fingerprint,customer_count,created_at) VALUES (?,?,?,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE id=id',
    [b.requestId, fingerprint, b.count],
  );
  const [batch] = await c.query(
    'SELECT id,request_fingerprint FROM customer_generation_batches WHERE request_id=? FOR UPDATE',
    [b.requestId],
  );
  if (batch.request_fingerprint !== fingerprint)
    throw new HttpError(
      409,
      'This request was already used with different settings. Start a new batch.',
    );
  const batchId = Number(batch.id);
  const existing = await batchResult(c, batchId);
  if (existing.customers.length) return existing;
  // Two scrypt jobs at a time keep memory bounded and 200-customer batches fast.
  for (let start = 0; start < b.count; start += 2) {
    const hashes = await Promise.all(
      Array.from({ length: Math.min(2, b.count - start) }, () =>
        passwordHash(b.password),
      ),
    );
    for (let offset = 0; offset < hashes.length; offset++) {
      const position = start + offset + 1;
      const index =
        ((batchId - 1) * 200 + position - 1) %
        (firstNames.length * lastNames.length);
      const marker = `${batchId}-${position}`;
      const name = `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length)]} (${marker})`;
      const username = `${b.prefix}.${batchId}.${position}`;
      const id = randomUUID();
      const [collision] = await c.query(
        'SELECT id FROM demo_users WHERE username=? OR display_name=? LIMIT 1',
        [username, name],
      );
      if (collision)
        throw new HttpError(
          409,
          'A generated name is already in use. Start a new batch. No customers were created.',
        );
      await c.query(
        'INSERT INTO demo_users VALUES (?,?,?,?,TRUE,?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))',
        [
          id,
          username,
          name,
          hashes[offset],
          b.profileId,
          b.variant,
          b.eligible,
          b.actor,
        ],
      );
      await c.query(
        'INSERT INTO customer_starting_balances VALUES (?,?,?,?,?)',
        [
          id,
          batchId,
          position,
          randomInt(b.checkingMinMinor, b.checkingMaxMinor + 1),
          randomInt(b.savingsMinMinor, b.savingsMaxMinor + 1),
        ],
      );
    }
  }
  return batchResult(c, batchId);
}
