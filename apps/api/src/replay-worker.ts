import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';
import { join } from 'node:path';
import mariadb from 'mariadb';
import { databaseConfig } from './config.js';
import { runReplayJob } from './replay-jobs.js';
import { replaySummary } from './recording-replay-files.js';
import { recordingDirectory } from './recordings.js';

const args = process.argv.slice(2);
if (args.some((a) => !['--test', '--once'].includes(a)))
  throw new Error('Usage: replay-worker [--test] [--once]');
const test = args.includes('--test');
const pool = mariadb.createPool({
  ...databaseConfig('runtime', test),
  connectionLimit: 2,
  timezone: 'Z',
});
const shutdown = new AbortController();
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.once(signal, () => shutdown.abort());

async function render(id: string) {
  const existing = await replaySummary(join(recordingDirectory(test), id));
  // Publication may have succeeded just before the worker lost its DB connection.
  if (existing?.full?.fps === 30) return;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        '--max-old-space-size=256',
        fileURLToPath(new URL('./replay-renderer.mjs', import.meta.url)),
        '--recording',
        id,
        '--session-reference',
        '--recover-work',
        '--replace',
        ...(test ? ['--test'] : []),
      ],
      { stdio: ['ignore', 'ignore', 'pipe'], detached: true },
    );
    let diagnostic = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      diagnostic = (diagnostic + chunk.toString()).slice(-2048);
    });
    let forced: ReturnType<typeof setTimeout> | undefined;
    const kill = (signal: NodeJS.Signals) => {
      if (child.pid) {
        try {
          process.kill(-child.pid, signal);
        } catch {
          /* Already exited. */
        }
      }
    };
    const stop = () => {
      kill('SIGTERM');
      forced ??= setTimeout(() => kill('SIGKILL'), 5000);
    };
    shutdown.signal.addEventListener('abort', stop, { once: true });
    const deadline = setTimeout(stop, 16 * 60_000);
    child.once('error', () => {
      clearTimeout(deadline);
      clearTimeout(forced);
      shutdown.signal.removeEventListener('abort', stop);
      reject(new Error('Renderer could not start'));
    });
    child.once('exit', (code) => {
      clearTimeout(deadline);
      clearTimeout(forced);
      shutdown.signal.removeEventListener('abort', stop);
      if (code === 0) resolve();
      else {
        const phase = diagnostic.match(
          /Replay failed during (preflight|image alignment|sample encoding|full-session encoding|publication)\./,
        )?.[1];
        console.error(
          `Replay job ${id} failed${phase ? ` during ${phase}` : ''}.`,
        );
        reject(new Error('Renderer failed'));
      }
    });
    if (shutdown.signal.aborted) stop();
  });
  const result = await replaySummary(join(recordingDirectory(test), id));
  if (result?.full?.fps !== 30) throw new Error('Generated video unavailable');
}

try {
  do {
    if (shutdown.signal.aborted) break;
    if (test || process.env.REPLAY_WORKER_ENABLED === 'true') {
      try {
        await runReplayJob(pool, test, render);
      } catch {
        console.error('Replay worker could not process its queue.');
      }
    }
    if (args.includes('--once')) break;
    await pause(3000, undefined, { signal: shutdown.signal }).catch(() => {});
  } while (!shutdown.signal.aborted);
} finally {
  await pool.end();
}
