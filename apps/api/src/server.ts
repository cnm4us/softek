import { createApp } from './app.js';
import { serverConfig } from './config.js';
const { host, port } = serverConfig();
const { app, pool } = createApp(process.env.NODE_ENV === 'test');
const server = app.listen(port, host, () =>
  console.log(`Softek API: http://${host}:${port}`),
);
server.on('error', async () => {
  console.error('API listener failed.');
  await pool.end();
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () =>
    server.close(() => {
      void pool.end();
    }),
  );
