import { expect, test } from '@playwright/test';

test('foundation routes, viewport layout, API connection, and disabled tracking', async ({ page }) => {
  const errors: string[] = [];
  const trackingRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/clarity\.(ms|microsoft\.com)/.test(request.url())) trackingRequests.push(request.url()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A little clarity. A lot of possibility.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const health = await page.request.get('/api/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: 'ok', database: 'connected' });
  await page.getByRole('link', { name: 'About this demo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A place to explore.' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A place to explore.' })).toBeVisible();
  await page.screenshot({ path: `artifacts/foundation-${test.info().project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
  expect(trackingRequests).toEqual([]);
});
