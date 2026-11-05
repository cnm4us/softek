import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

export default defineConfig({
  ...base,
  testMatch: ['recordings.spec.ts'],
  projects: [
    ...base.projects!,
    {
      name: 'webkit-iphone',
      use: {
        browserName: 'webkit',
        viewport: { width: 440, height: 956 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
  ],
});
