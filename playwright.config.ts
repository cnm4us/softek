import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5173', screenshot: 'only-on-failure' },
  projects: [
    { name: 'mobile', use: { viewport: { width: 360, height: 800 } } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    { command: 'npm run dev -w @softek/api', url: 'http://127.0.0.1:3100/api/health', reuseExistingServer: false, env: { NODE_ENV: 'test', CLARITY_ENABLED: 'false', VITE_CLARITY_ENABLED: 'false' } },
    { command: 'npm run dev -w @softek/web', url: 'http://127.0.0.1:5173', reuseExistingServer: false, env: { VITE_CLARITY_ENABLED: 'false' } },
  ],
});
