import type { BrowserContext } from '@playwright/test';

// Authentication/capture secrets belong only to our API, never SDK vendors.
export async function installAutomationHeaders(
  context: BrowserContext,
  origin: string,
  secret: string,
  collect: boolean,
) {
  await context.route('**/*', async (route) => {
    const headers = { ...route.request().headers() };
    delete headers['x-demo-automation'];
    delete headers['x-demo-capture'];
    if (new URL(route.request().url()).origin === origin) {
      headers['x-demo-automation'] = secret;
      if (collect) headers['x-demo-capture'] = secret;
    }
    await route.fallback({ headers });
  });
}
