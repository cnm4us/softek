import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({
  ...base,
  testMatch: 'clarity.spec.ts',
  webServer: [
    {
      command: 'npm run dev -w @softek/api',
      url: 'http://127.0.0.1:3101/api/health',
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        PORT: '3101',
        PUBLIC_ORIGIN: 'http://127.0.0.1:5173',
        CLARITY_ENABLED: 'true',
        VITE_CLARITY_ENABLED: 'true',
        CLARITY_CONFIG_VERIFIED: 'true',
        CLARITY_PROJECT_ID: 'yvs5hp3ivb',
      },
    },
    {
      command: 'npm run dev -w @softek/web',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false,
      env: { VITE_CLARITY_ENABLED: 'true' },
    },
  ],
});
