import sharp from 'sharp';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { assetDirectory } from '../../apps/api/src/banner-assets.js';
import { features } from '../../apps/api/src/features.js';
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
    .getByRole('link', { name: 'Explore more ways to bank', exact: true })
    .click();
  await page
    .getByRole('link', { name: 'EasyCoin Cryptocurrency', exact: true })
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
  const summaryTags = new Map(
    (await calls(page))
      .filter((c: any[]) => c[0] === 'set')
      .map((c: any[]) => [c[1], c[2]]),
  );
  expect(summaryTags.get('route')).toBe('summary');
  expect(summaryTags.get('banner')).toBe('none');
  expect(summaryTags.get('feature')).toBe('none');
  expect(summaryTags.get('campaign')).toBe('none');
  expect(summaryTags.get('service')).toBe('banking');

  for (const [name, route] of [
    ['Everyday checking', 'account-checking'],
    ['Harbor savings', 'account-savings'],
    ['Harbor credit card', 'account-credit'],
  ]) {
    await page.getByRole('link', { name: `Open ${name}`, exact: true }).click();
    await expect(
      page.getByTestId('account-detail-balance').locator('..'),
    ).toHaveAttribute('data-clarity-mask', 'true');
    await expect(page.locator('.account-detail-number')).toHaveAttribute(
      'data-clarity-mask',
      'true',
    );
    await expect(page.locator('.account-information')).toHaveCount(0);
    if (name === 'Harbor credit card')
      await expect(page.locator('.account-credit-metrics')).toHaveAttribute(
        'data-clarity-mask',
        'true',
      );
    await expect(page.locator('.account-detail-activity')).toHaveAttribute(
      'data-clarity-mask',
      'true',
    );
    await expect
      .poll(
        async () =>
          (await calls(page))
            .filter((c: any[]) => c[0] === 'set' && c[1] === 'route')
            .at(-1)?.[2],
      )
      .toBe(route);
    const tags = new Map(
      (await calls(page))
        .filter((c: any[]) => c[0] === 'set')
        .map((c: any[]) => [c[1], c[2]]),
    );
    expect(tags.get('feature')).toBe('none');
    expect(tags.get('banner')).toBe('none');
    expect(tags.get('service')).toBe('banking');
    await page
      .getByRole('link', { name: 'Back to Account Summary', exact: true })
      .click();
  }
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
    history.pushState(null, '', '/controls/feature-explorer');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(
    page.getByRole('heading', { name: 'Feature Explorer', exact: true }),
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

test('impersonation enters saved customer, preserves menu banners and exits to admin without collection', async ({
  page,
}) => {
  const user = await fixtureUser(pool);
  ids.push(user.id);
  let vendor = 0;
  page.on('request', (r) => {
    if (/clarity\.ms|bing\.com/.test(r.url())) vendor++;
  });
  await page.goto(`/controls/customers/${user.id}`);
  await expect(
    page.getByRole('button', { name: 'Impersonate customer', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Impersonate customer', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Account Summary', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Viewing as Test Harbor User', { exact: true }),
  ).toBeVisible();
  const data = await page.evaluate(async () =>
    (
      await fetch('/api/state', {
        headers: {
          'X-Browser-Session': sessionStorage.getItem('softek_browser')!,
          'X-Customer-Context': JSON.parse(
            sessionStorage.getItem('softek_impersonation_context')!,
          ).contextId,
        },
      })
    ).json(),
  );
  expect(data.analytics.enabled).toBe(false);
  expect(data.analytics.actor).toBe('automation');
  const presentations = await pool.query(
    'SELECT * FROM banner_presentations WHERE user_id=?',
    [user.id],
  );
  expect(presentations.length).toBe(1);
  const initial = await page.evaluate(() =>
    sessionStorage.getItem('softek_banner'),
  );
  await expect(page.getByTestId('banner-placeholder')).toBeVisible();
  await expect(page.locator('.image-banner')).toHaveCount(0);
  await feature(page);
  await page
    .getByRole('button', { name: 'Explore Crypto Investing', exact: true })
    .click();
  await expect(page.locator('.feature-confirmation')).toBeVisible();
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page
    .getByRole('link', { name: 'Account Summary', exact: true })
    .click();
  expect(
    await page.evaluate(() => sessionStorage.getItem('softek_banner')),
  ).toBe(initial);
  await expect(page.getByTestId('banner-placeholder')).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('Viewing as Test Harbor User', { exact: true }),
  ).toBeVisible();
  const after = await pool.query(
    'SELECT * FROM banner_presentations WHERE user_id=?',
    [user.id],
  );
  expect(after.length).toBe(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole('button', { name: 'Allow analytics', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  const actions = page.locator('.menu-secondary button');
  expect((await actions.allTextContents()).slice(-2)).toEqual([
    'Exit to Admin',
    'Sign out',
  ]);
  await page
    .getByRole('button', { name: 'Exit to Admin', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/controls/customers/${user.id}$`));
  await expect(
    page.getByRole('button', { name: 'Impersonate customer', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'View activity', exact: true })
    .click();
  await expect(page.getByText(/Admin impersonation/).first()).toBeVisible();
  expect(vendor).toBe(0);
});

test('impersonation stops prior consent across tabs and customer sign out keeps admin', async ({
  page,
  context,
}) => {
  const human = await fixtureUser(pool),
    target = await fixtureUser(pool);
  ids.push(human.id, target.id);
  await login(page, human);
  await page
    .getByRole('button', { name: 'Allow analytics', exact: true })
    .click();
  await expect
    .poll(async () =>
      (await calls(page)).some((a: any[]) => a[0] === 'identify'),
    )
    .toBe(true);
  const control = await context.newPage();
  await control.goto(`/controls/customers/${target.id}`);
  await control
    .getByRole('button', { name: 'Impersonate customer', exact: true })
    .click();
  await expect(
    control.getByText('Viewing as Test Harbor User', { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/controls\/customers$/);
  let requests = 0;
  control.on('request', (r) => {
    if (/clarity\.ms|bing\.com/.test(r.url())) requests++;
  });
  await control.getByRole('button', { name: 'Open menu', exact: true }).click();
  await control.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(control.getByLabel('Username', { exact: true })).toBeVisible();
  await expect(
    control.getByRole('button', { name: 'Exit to Admin', exact: true }),
  ).toHaveCount(0);
  expect((await control.request.get('/api/admin/status')).ok()).toBe(true);
  expect(
    (await (await control.request.get('/api/admin/status')).json())
      .authenticated,
  ).toBe(true);
  expect(requests).toBe(0);
  await control.close();
});

test('impersonation errors keep admin details usable and expiry returns to admin sign in', async ({
  page,
  context,
}) => {
  const user = await fixtureUser(pool);
  ids.push(user.id);
  await page.goto(`/controls/customers/${user.id}`);
  await page.route('**/api/admin/users/*/impersonate', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Try again shortly.' }),
    }),
  );
  await page
    .getByRole('button', { name: 'Impersonate customer', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('Try again shortly.');
  await expect(
    page.getByRole('button', { name: 'Impersonate customer', exact: true }),
  ).toBeEnabled();
  await page.unroute('**/api/admin/users/*/impersonate');
  await page
    .getByRole('button', { name: 'Impersonate customer', exact: true })
    .click();
  await expect(
    page.getByText('Viewing as Test Harbor User', { exact: true }),
  ).toBeVisible();
  const raw = (await context.cookies()).find(
    (c) => c.name === 'softek_admin',
  )!.value;
  const metadata = await page.evaluate(() => ({
    context: sessionStorage.getItem('softek_impersonation_context')!,
    browser: sessionStorage.getItem('softek_browser')!,
  }));
  const other = await context.newPage();
  await other.goto('/controls');
  await other.evaluate((saved) => {
    sessionStorage.setItem('softek_impersonation_context', saved.context);
    sessionStorage.setItem('softek_browser', saved.browser);
  }, metadata);
  await other.goto('/');
  await expect(
    other.getByText('Viewing as Test Harbor User', { exact: true }),
  ).toBeVisible();
  await page.route('**/api/auth/impersonation/exit', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Exit temporarily unavailable.' }),
    }),
  );
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page
    .getByRole('button', { name: 'Exit to Admin', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Exit temporarily unavailable.',
  );
  await expect(other).toHaveURL(/\/controls\/customers$/);
  await expect(
    other.getByRole('heading', { name: 'Manage Customers', exact: true }),
  ).toBeVisible();
  await page.unroute('**/api/auth/impersonation/exit');
  await other.close();
  await pool.query(
    'UPDATE admin_sessions SET expires_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE token_hash=?',
    [createHash('sha256').update(raw).digest('hex')],
  );
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/controls/customers/${user.id}$`));
  await expect(
    page.getByRole('heading', { name: 'Admin Sign In', exact: true }),
  ).toBeVisible();
  expect(
    (await context.cookies()).some((c) => c.name === 'softek_impersonation'),
  ).toBe(false);
});

test('Summary artwork has consent-gated banner tags, click events and cleared account context', async ({
  page,
}) => {
  const before = await pool.query(
    "SELECT id,enabled FROM feature_explorer_widgets WHERE section_key='summary'",
  );
  let widgetId = '',
    assetKey = '';
  try {
    await pool.query(
      "UPDATE feature_explorer_widgets SET enabled=FALSE WHERE section_key='summary'",
    );
    const csrf = await admin(page),
      origin = 'http://127.0.0.1:5173';
    const created = await page.request.post('/api/admin/feature-explorer', {
      headers: { Origin: origin, 'X-CSRF-Token': csrf },
      data: { section: 'summary', featureId: 'identity-protect' },
    });
    expect(created.status()).toBe(201);
    widgetId = (await created.json()).id;
    const buffer = await sharp({
      create: { width: 960, height: 315, channels: 3, background: '#205747' },
    })
      .png()
      .toBuffer();
    const uploaded = await page.request.post(
      `/api/admin/feature-explorer/${widgetId}/image`,
      {
        headers: { Origin: origin, 'X-CSRF-Token': csrf },
        multipart: {
          image: { name: 'owned-privacy.png', mimeType: 'image/png', buffer },
        },
      },
    );
    expect(uploaded.status()).toBe(201);
    assetKey = (await uploaded.json()).imageUrl.split('/').at(-1);
    const enabled = await page.request.post(
      `/api/admin/feature-explorer/${widgetId}/settings`,
      {
        headers: { Origin: origin, 'X-CSRF-Token': csrf },
        data: {
          altText: 'Explore identity protection',
          enabled: true,
          sortOrder: 0,
        },
      },
    );
    expect(enabled.status()).toBe(200);
    const user = await fixtureUser(pool);
    ids.push(user.id);
    await login(page, user);
    const modal = page.getByRole('dialog', {
      name: 'Allow experience analytics?',
      exact: true,
    });
    await modal
      .getByRole('button', { name: 'Allow analytics', exact: true })
      .click();
    const tags = async () =>
      new Map(
        (await calls(page))
          .filter((c: any[]) => c[0] === 'set')
          .map((c: any[]) => [c[1], c[2]]),
      );
    await expect.poll(async () => (await tags()).get('banner')).toBe(widgetId);
    expect((await tags()).get('feature')).toBe('identity-protect');
    expect((await tags()).get('campaign')).toBe('none');
    const banner = page.getByTestId('promotion-banner');
    await banner.scrollIntoViewIfNeeded();
    await expect
      .poll(async () => JSON.stringify(await calls(page)))
      .toContain('banner_visible');
    await banner.click();
    await expect(page).toHaveURL('/features/identity-protect');
    await expect
      .poll(async () => JSON.stringify(await calls(page)))
      .toContain('banner_clicked');
    await page
      .getByRole('button', {
        name: features.find((f) => f.id === 'identity-protect')!.cta,
        exact: true,
      })
      .click();
    await expect(page.getByRole('status')).toBeVisible();
    await expect
      .poll(async () => JSON.stringify(await calls(page)))
      .toContain('feature_cta_clicked');
    expect((await tags()).get('banner')).toBe(widgetId);
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page
      .getByRole('link', { name: 'Account Summary', exact: true })
      .click();
    await page
      .getByRole('link', { name: 'Open Everyday checking', exact: true })
      .click();
    await expect
      .poll(async () => (await tags()).get('route'))
      .toBe('account-checking');
    expect((await tags()).get('banner')).toBe('none');
    expect((await tags()).get('feature')).toBe('none');
    expect(JSON.stringify(await calls(page))).not.toContain(user.username);
  } finally {
    if (widgetId)
      await pool.query('DELETE FROM feature_explorer_widgets WHERE id=?', [
        widgetId,
      ]);
    for (const row of before)
      await pool.query(
        'UPDATE feature_explorer_widgets SET enabled=? WHERE id=?',
        [row.enabled, row.id],
      );
    // Remove the fixture's snapshots/observations before its asset FK; user cleanup
    // afterAll handles their remaining banking/session state.
    if (widgetId) {
      const presentations = await pool.query(
        'SELECT id FROM banner_presentations WHERE banner_id=?',
        [widgetId],
      );
      for (const p of presentations) {
        await pool.query(
          'DELETE FROM interaction_events WHERE selection_id=?',
          [p.id],
        );
        await pool.query('DELETE FROM banner_presentations WHERE id=?', [p.id]);
      }
    }
    if (assetKey) {
      await pool.query('DELETE FROM banner_assets WHERE asset_key=?', [
        assetKey,
      ]);
      await unlink(join(assetDirectory(true), assetKey)).catch(() => {});
    }
  }
});
