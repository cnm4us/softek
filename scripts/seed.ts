import mariadb from 'mariadb';
import { databaseConfig } from '../apps/api/src/config.js';
import { accounts, activity, profiles } from '../db/seeds/fixtures.js';
import { seedBanners } from './lib/banner-fixtures.js';
export async function seed(test = false) {
  const connection = await mariadb.createConnection(
    databaseConfig('runtime', test),
  );
  try {
    await connection.beginTransaction();
    await connection.query(
      "INSERT INTO institutions VALUES ('harbor','Harbor Community Bank') ON DUPLICATE KEY UPDATE name=VALUES(name)",
    );
    await connection.query(
      "INSERT INTO services VALUES ('savings-goals','Savings goals') ON DUPLICATE KEY UPDATE name=VALUES(name)",
    );
    await connection.query(
      "INSERT INTO institution_services VALUES ('harbor','savings-goals',TRUE) ON DUPLICATE KEY UPDATE purchased=VALUES(purchased)",
    );
    await connection.query(
      "INSERT INTO campaigns VALUES ('savings-launch','harbor','savings-goals',TRUE) ON DUPLICATE KEY UPDATE active=VALUES(active)",
    );
    for (const p of profiles) {
      await connection.query(
        "INSERT INTO customer_profiles VALUES (?,'harbor',?,?,?) ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),first_name=VALUES(first_name),eligible=VALUES(eligible)",
        [p.id, p.name, p.first, p.eligible],
      );
      for (const a of accounts)
        await connection.query(
          "INSERT INTO account_templates VALUES (?,?,?,?,?,?,'USD') ON DUPLICATE KEY UPDATE name=VALUES(name),last_four=VALUES(last_four),balance_minor=VALUES(balance_minor)",
          [`${p.id}-${a.kind}`, p.id, a.kind, a.name, a.last, a.balance],
        );
      for (const a of activity)
        await connection.query(
          'INSERT INTO transaction_templates VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE description=VALUES(description),amount_minor=VALUES(amount_minor),occurred_at=VALUES(occurred_at)',
          [
            `${p.id}-${a.id}`,
            `${p.id}-${a.kind}`,
            a.description,
            a.amount,
            a.date,
          ],
        );
    }
    await seedBanners(connection, test);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}
if (process.argv[1]?.endsWith('/seed.ts')) {
  if (process.argv.slice(2).some((arg) => arg !== '--test'))
    throw new Error('Usage: npm run db:seed -- [--test]');
  await seed(process.argv.includes('--test'));
  console.log('Fictional templates seeded; participant records unchanged.');
}
