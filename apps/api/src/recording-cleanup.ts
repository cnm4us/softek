import mariadb from 'mariadb';
import { databaseConfig } from './config.js';
import { RecordingStore } from './recordings.js';

const args = process.argv.slice(2);
if (
  args.some((a) => !['--test', '--apply'].includes(a)) ||
  new Set(args).size !== args.length
) {
  console.error(
    'Usage: recordings:cleanup -- [--test] [--apply]; default is dry-run.',
  );
  process.exitCode = 1;
} else {
  const test = args.includes('--test');
  const pool = mariadb.createPool({
    ...databaseConfig('runtime', test),
    connectionLimit: 1,
    timezone: 'Z',
    bigIntAsNumber: true,
  });
  try {
    console.log(
      JSON.stringify(
        await new RecordingStore(pool, test).cleanup(!args.includes('--apply')),
        null,
        2,
      ),
    );
  } catch {
    console.error(
      'Recording cleanup failed; inspect the scoped schema, service permissions and storage.',
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
