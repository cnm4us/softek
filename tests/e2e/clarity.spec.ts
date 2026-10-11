import { test, expect, type Page } from '@playwright/test';
import mariadb from 'mariadb';
import { createHash } from 'node:crypto';
import { databaseConfig } from '../../apps/api/src/config.js';
import { fixtureUser, cleanUsers } from '../fixtures.js';
const pool = mariadb.createPool({
  ...databaseConfig('runtime', true),
  connectionLimit: 2,
});
const ids: string[] = [];
let saved: Record<string, any>;
const headers = {
  'X-Demo-Automation': process.env.AUTOMATION_SECRET!,
  'X-Demo-Capture': process.env.AUTOMATION_SECRET!,
};
test.use({ extraHTTPHeaders: headers });
const script = `
const queue=window.clarity.q||[];
window.clarity=function(...args){
 const calls=JSON.parse(sessionStorage.getItem('test_clarity_calls')||'[]');calls.push(args);sessionStorage.setItem('test_clarity_calls',JSON.stringify(calls));
 if(args[0]==='consentv2'&&args[1].analytics_Storage==='granted'){document.cookie='_clck=stub; Path=/';document.cookie='_clsk=stub; Path=/';}
};queue.forEach(args=>window.clarity(...args));
`;
async function calls(page: Page) {
  return page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('test_clarity_calls') ?? '[]'),
  );
}
async function customerState(page: Page) {
  return page.evaluate(async () =>
    (
      await fetch('/api/state', {
        headers: {
          'X-Browser-Session': sessionStorage.getItem('softek_browser')!,
        },
      })
    ).json(),
  );
}
async function admin(page: Page) {
  const r = await page.request.post('/api/admin/login', {
    headers: { Origin: 'http://127.0.0.1:5173' },
    data: { password: process.env.DEMO_ADMIN_SECRET },
  });
  expect(r.status()).toBe(200);
  return (await r.json()).csrf as string;
}
async function setEnabled(page: Page, csrf: string, enabled: boolean) {
  const settings = await (await page.request.get('/api/admin/clarity')).json();
  const r = await page.request.post('/api/admin/clarity', {
    headers: { Origin: 'http://127.0.0.1:5173', 'X-CSRF-Token': csrf },
    data: { enabled, revision: settings.revision },
  });
  expect(r.status()).toBe(200);
  return r.json();
}
async function login(
  page: Page,
  user: Awaited<ReturnType<typeof fixtureUser>>,
) {
  await page.goto('/');
  await page.getByLabel('Username', { exact: true }).fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Account Summary', exact: true }),
  ).toBeVisible();
}
async function feature(page: Page) {
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page
    .getByRole('button', { name: 'Explore Features', exact: true })
    .click();
  await page
    .getByRole('link', { name: 'EasyCoin Crypto', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Cryptocurrency Investing, Made More Accessible',
      exact: true,
    }),
  ).toBeVisible();
}
test.beforeEach(async ({ page }) => {
  const [row] = await pool.query('SELECT * FROM clarity_collection WHERE id=1');
  saved = row;
  const csrf = await admin(page);
  await setEnabled(page, csrf, true);
  await page.route('https://**/*', async (route) => {
    if (/^https:\/\/www\.clarity\.ms\/tag\//.test(route.request().url()))
      await route.fulfill({
        contentType: 'application/javascript',
        body: script,
      });
    else await route.abort();
  });
});
test.afterEach(async ({ context }) => {
  await pool.query(
    'UPDATE clarity_collection SET enabled=?,revision=?,updated_at=? WHERE id=1',
    [saved.enabled, saved.revision, saved.updated_at],
  );
  const cookie = (await context.cookies()).find(
    (c) => c.name === 'softek_admin',
  );
  if (cookie)
    await pool.query('DELETE FROM admin_sessions WHERE token_hash=?', [
      createHash('sha256').update(cookie.value).digest('hex'),
    ]);
});
test.afterAll(async () => {
  await cleanUsers(pool, ids);
  await pool.end();
});
test('consent, masks, feature events, withdrawal, admin boundary and shared-browser identity', async ({
  page,
  context,
}) => {
  let scripts = 0;
  page.on('request', (r) => {
    if (r.url().startsWith('https://www.clarity.ms/tag/')) scripts++;
  });
  const user = await fixtureUser(pool),
    other = await fixtureUser(pool);
  ids.push(user.id, other.id);
  await login(page, user);
  const modal = page.getByRole('dialog', {
    name: 'Allow experience analytics?',
  });
  await expect(modal).toBeVisible();
  await expect(
    modal.getByRole('button', { name: 'Keep analytics off', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(
    modal.getByRole('button', { name: 'Allow analytics', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    modal.getByRole('button', { name: 'Keep analytics off', exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: `artifacts/clarity-modal-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(scripts).toBe(0);
  await page
    .getByRole('button', { name: 'Keep analytics off', exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  expect(scripts).toBe(0);
  await page
    .getByRole('button', { name: 'Allow analytics', exact: true })
    .click();
  await expect.poll(() => scripts).toBe(1);
  await expect
    .poll(async () => JSON.stringify(await calls(page)))
    .toContain('consentv2');
  const initial = await calls(page);
  expect(initial[0]).toEqual([
    'consentv2',
    { ad_Storage: 'denied', analytics_Storage: 'granted' },
  ]);
  expect(
    initial.some((c: any[]) => c[0] === 'identify' && c[1] === user.id),
  ).toBe(true);
  await expect(page.locator('[data-clarity-mask="true"]')).not.toHaveCount(0);
  await feature(page);
  await page
    .getByRole('button', { name: 'Explore Crypto Investing', exact: true })
    .click();
  await expect(page.getByRole('status')).toBeVisible();
  await expect
    .poll(async () => JSON.stringify(await calls(page)))
    .toContain('feature_cta_clicked');
  expect(JSON.stringify(await calls(page))).not.toContain(user.username);
  await page.screenshot({
    path: `artifacts/clarity-consent-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Turn off analytics', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Allow analytics', exact: true }),
  ).toBeVisible();
  expect(scripts).toBe(1);
  expect(
    (await context.cookies()).filter((c) =>
      ['_clck', '_clsk'].includes(c.name),
    ),
  ).toHaveLength(0);
  expect(
    await page.evaluate(() =>
      Boolean((window as Window & { clarity?: unknown }).clarity),
    ),
  ).toBe(false);
  await page
    .getByRole('button', { name: 'Allow analytics', exact: true })
    .click();
  await expect.poll(() => scripts).toBe(2);
  // SPA entry crosses the captured-document boundary before private tools render.
  await page.evaluate(() => {
    history.pushState(null, '', '/controls/clarity');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(
    page.getByRole('heading', { name: 'Clarity Settings', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Boolean((window as Window & { clarity?: unknown }).clarity),
    ),
  ).toBe(false);
  await expect(
    page
      .locator('main')
      .locator('xpath=ancestor::*[@data-clarity-mask="true"]'),
  ).toHaveAttribute('data-clarity-mask', 'true');
  expect(scripts).toBe(2);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Allow analytics', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Keep analytics off', exact: true })
    .click();
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await login(page, other);
  expect(scripts).toBe(2);
  await page
    .getByRole('button', { name: 'Allow analytics', exact: true })
    .click();
  await expect.poll(() => scripts).toBe(3);
  await expect
    .poll(async () => JSON.stringify(await calls(page)))
    .toContain(other.id);
  expect(
    (await calls(page)).filter((c: any[]) => c[0] === 'identify').at(-1)[1],
  ).toBe(other.id);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('consent modal fits a short viewport and Escape declines without collection', async ({
  page,
}) => {
  await page.setViewportSize({
    width: test.info().project.use.viewport!.width,
    height: 420,
  });
  let scripts = 0;
  page.on('request', (request) => {
    if (request.url().startsWith('https://www.clarity.ms/tag/')) scripts++;
  });
  const user = await fixtureUser(pool);
  ids.push(user.id);
  await login(page, user);
  const modal = page.getByRole('dialog', {
    name: 'Allow experience analytics?',
  });
  await expect(modal).toBeVisible();
  const bounds = await modal.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(420);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    'hidden',
  );
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  expect(scripts).toBe(0);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Allow analytics', exact: true }),
  ).toBeVisible();
  await expect(modal).toHaveCount(0);
  expect(scripts).toBe(0);
});
test('admin switch stops open pages and a re-enable requires fresh consent', async ({
  page,
}) => {
  let scripts = 0;
  page.on('request', (r) => {
    if (r.url().startsWith('https://www.clarity.ms/tag/')) scripts++;
  });
  const csrf = await admin(page);
  const user = await fixtureUser(pool);
  ids.push(user.id);
  await login(page, user);
  await page
    .getByRole('button', { name: 'Allow analytics', exact: true })
    .click();
  await expect.poll(() => scripts).toBe(1);
  const before = await customerState(page);
  const reloaded = page.waitForEvent('load', { timeout: 12000 });
  const settings = await setEnabled(page, csrf, false);
  await reloaded;
  await expect(
    page.getByRole('heading', { name: 'Account Summary', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Boolean((window as Window & { clarity?: unknown }).clarity),
    ),
  ).toBe(false);
  await expect(
    page.getByRole('button', { name: 'Allow analytics', exact: true }),
  ).toHaveCount(0);
  await setEnabled(page, csrf, true);
  await expect(
    page.getByRole('button', { name: 'Allow analytics', exact: true }),
  ).toBeVisible({ timeout: 12000 });
  expect(scripts).toBe(1);
  const after = await customerState(page);
  expect(after.runId).toBe(before.runId);
  expect(after.accounts).toEqual(before.accounts);
  expect(after.analytics.revision).not.toBe(settings.revision);
  await page.goto('/controls/clarity');
  await expect(page.getByText('Collection: On', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Turn collection off', exact: true })
    .click();
  await expect(
    page.getByText('Collection: Off', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('Collection: Off', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/clarity-settings-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Turn collection on', exact: true })
    .click();
  await expect(page.getByText('Collection: On', { exact: true })).toBeVisible();
  expect(scripts).toBe(1);
});
