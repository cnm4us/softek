import { migrate, migrationStatus } from './lib/migrations.js';

const [command, ...args] = process.argv.slice(2);
if (
  !['status', 'migrate'].includes(command) ||
  args.some((arg) => arg !== '--test') ||
  args.length > 1
) {
  console.error('Usage: npm run db:status|db:migrate -- [--test]');
  process.exitCode = 1;
} else {
  try {
    const status = await (command === 'migrate' ? migrate : migrationStatus)({
      test: args.includes('--test'),
    });
    console.log(
      JSON.stringify(
        { target: { host: '127.0.0.1', schema: status.database }, ...status },
        null,
        2,
      ),
    );
    if (status.problems.length) process.exitCode = 1;
  } catch (error) {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? String(error.code)
        : undefined;
    console.error(
      code
        ? `Database command failed (${code}); check connection configuration.`
        : error instanceof Error
          ? error.message
          : 'Database command failed.',
    );
    process.exitCode = 1;
  }
}
