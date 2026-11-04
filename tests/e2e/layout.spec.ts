import { test, expect, type Page } from '@playwright/test';
import mariadb from 'mariadb';
import { createHash } from 'node:crypto';
import { databaseConfig } from '../../apps/api/src/config.js';
import { fixtureUser, cleanUsers } from '../fixtures.js';

test.use({
  extraHTTPHeaders: { 'X-Demo-Automation': process.env.AUTOMATION_SECRET! },
});
const pool = mariadb.createPool({
  ...databaseConfig('runtime', true),
  connectionLimit: 2,
});
const users: string[] = [];
test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin !== 'http://127.0.0.1:5173') {
      await route.abort();
      throw new Error('Layout checks must not contact external services.');
    }
    await route.continue();
  });
});
test.afterEach(async ({ context }) => {
  const cookie = (await context.cookies()).find(
    (c) => c.name === 'softek_admin',
  );
  if (cookie)
    await pool.query('DELETE FROM admin_sessions WHERE token_hash=?', [
      createHash('sha256').update(cookie.value).digest('hex'),
    ]);
});
test.afterAll(async () => {
  await cleanUsers(pool, users);
  await pool.end();
});

async function fits(page: Page, focused = false) {
  const bounds = await page.evaluate(() => {
    const main = document.querySelector('main')!;
    const rect = main.getBoundingClientRect(),
      style = getComputedStyle(main);
    const outward =
      style.outlineStyle === 'none'
        ? 0
        : Math.max(
            0,
            parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset),
          );
    window.scrollTo(100, 0);
    return {
      width: innerWidth,
      root: document.documentElement.scrollWidth,
      scrollX,
      focus: main.matches(':focus-visible'),
      left: rect.left - outward,
      right: rect.right + outward,
      outline: style.outlineStyle,
      rootOverflow: getComputedStyle(document.documentElement).overflowX,
    };
  });
  expect(bounds.root).toBeLessThanOrEqual(bounds.width);
  expect(bounds.scrollX).toBe(0);
  expect(['hidden', 'clip']).not.toContain(bounds.rootOverflow);
  if (focused) {
    expect(bounds.focus).toBe(true);
    expect(bounds.outline).not.toBe('none');
    // Painted focus must fit too: root scrollWidth alone misses outboard outlines.
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.width);
  }
}
async function focusMain(page: Page) {
  await page.locator('.skip-link').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
}

async function readableControls(page: Page) {
  // iPhone input zoom can leave the visual viewport enlarged after navigation.
  // Root scrollWidth at scale 1 alone cannot catch that device behavior.
  const sizes = await page
    .locator('input:not([type=checkbox]), select')
    .evaluateAll((elements) =>
      elements.map((el) => parseFloat(getComputedStyle(el).fontSize)),
    );
  expect(sizes.length).toBeGreaterThan(0);
  for (const size of sizes) expect(size).toBeGreaterThanOrEqual(16);
  const viewport = await page
    .locator('meta[name=viewport]')
    .getAttribute('content');
  expect(viewport).not.toMatch(
    /user-scalable\s*=\s*(?:no|0)|maximum-scale\s*=\s*1(?:\s|,|$)/i,
  );
}

test('login and signed-in routes fit, including their visible route focus', async ({
  page,
}) => {
  const user = await fixtureUser(pool);
  users.push(user.id);
  await page.goto('/login');
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await readableControls(page);
  await fits(page);
  await page.getByLabel('Username', { exact: true }).fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/');
  for (const path of [
    '/',
    '/accounts/checking',
    '/accounts/savings',
    '/accounts/credit-card',
    '/explore',
    '/features/business-invoice',
  ]) {
    await page.goto(path);
    await expect(page.locator('.section-header h1')).toBeVisible();
    await focusMain(page);
    await fits(page, true);
    await page.screenshot({
      path: `artifacts/layout-${test.info().project.name}-${path.replaceAll('/', '_') || 'summary'}.png`,
    });
  }
});

test('keyboard menu focus, vertical scrolling and contained report-table scrolling remain available', async ({
  page,
}) => {
  await page.goto('/controls/report');
  await page.getByLabel('Admin password').fill(process.env.DEMO_ADMIN_SECRET!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.table-scroll').first()).toBeVisible();
  await readableControls(page);
  await focusMain(page);
  await fits(page, true);
  const menu = page.getByRole('button', { name: 'Open menu', exact: true });
  await menu.focus();
  await menu.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Admin Menu' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  expect(
    await menu.evaluate((el) => getComputedStyle(el).outlineStyle),
  ).not.toBe('none');
  await fits(page);
  const scroll = await page
    .locator('.table-scroll')
    .first()
    .evaluate((el) => {
      el.scrollLeft = 100;
      return {
        width: el.clientWidth,
        full: el.scrollWidth,
        left: el.scrollLeft,
        screen: innerWidth,
      };
    });
  expect(scroll.width).toBeLessThanOrEqual(scroll.screen);
  if (scroll.full > scroll.width) expect(scroll.left).toBeGreaterThan(0);
  if (page.viewportSize()!.width < 600) {
    expect(scroll.full).toBeGreaterThan(scroll.width);
    await page.evaluate(() => window.scrollTo(0, 200));
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  }
});
