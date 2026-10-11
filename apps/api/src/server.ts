import express from 'express';
import mariadb from 'mariadb';
import { databaseConfig, serverConfig } from './config.js';

const { host, port } = serverConfig();
const pool = mariadb.createPool({ ...databaseConfig('runtime', process.env.NODE_ENV === 'test'), connectionLimit: 3 });
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1');
    response.json({ status: 'ok', database: 'connected' });
  } catch {
    response.status(503).json({ status: 'unavailable', database: 'unavailable' });
  }
});

app.use((_request, response) => response.status(404).json({ error: 'Not found' }));
app.use((_error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  response.status(400).json({ error: 'Invalid request' });
});

const server = app.listen(port, host, () => console.log(`Softek API: http://${host}:${port}`));
server.on('error', async () => {
  console.error('API listener failed. Check the configured loopback port.');
  await pool.end();
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close(() => { void pool.end(); }));
}
