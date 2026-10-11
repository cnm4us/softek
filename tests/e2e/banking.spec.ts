import { test, expect, type Page } from '@playwright/test';
import mariadb from 'mariadb';
import { databaseConfig } from '../../apps/api/src/config.js';
import { fixtureUser, cleanUsers } from '../fixtures.js';
import sharp from 'sharp';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { features } from '../../apps/api/src/features.js';
import { assetDirectory } from '../../apps/api/src/banner-assets.js';
const headers = { 'X-Demo-Automation': process.env.AUTOMATION_SECRET! };
test.use({ extraHTTPHeaders: headers });
const ids: string[] = [];
const userIds: string[] = [];
const uploads: { id: string; asset_key: string }[] = [];
const pool = mariadb.createPool({
  ...databaseConfig('runtime', true),
  connectionLimit: 2,
  bigIntAsNumber: true,
});
async function state(page: Page) {
  return page.evaluate(async () => {
    const r = await fetch('/api/state', {
      headers: {
        'X-Browser-Session': sessionStorage.getItem('softek_browser')!,
      },
    });
    return r.json();
  });
}
async function entry(page: Page, profile = 'Alex Morgan') {
  const user = await fixtureUser(
    pool,
    profile === 'Jamie Chen' ? 'jamie' : 'alex',
  );
  userIds.push(user.id);
  await page.goto('/');
  await page.getByLabel('Username', { exact: true }).fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Account Summary', exact: true }),
  ).toBeVisible();
  ids.push((await state(page)).runId);
  return user;
}
async function menu(page: Page, label: string) {
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('link', { name: label, exact: true }).click();
}
async function resetDemo(page: Page) {
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page
    .getByRole('button', { name: 'Reset my demo', exact: true })
    .click();
}
test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => void dialog.accept());
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
async function count(runId: string, name: string, placement?: string) {
  const r = await pool.query(
    'SELECT COUNT(*) AS n FROM adoption_events WHERE run_id=? AND name=? AND (? IS NULL OR placement=?)',
    [runId, name, placement ?? null, placement ?? null],
  );
  return Number(r[0].n);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
test.afterAll(async () => {
  await cleanUsers(pool, userIds);
  for (const row of uploads) {
    await pool.query('DELETE FROM demo_banners WHERE id=?', [row.id]);
    await pool.query('DELETE FROM banner_assets WHERE asset_key=?', [
      row.asset_key,
    ]);
    await unlink(join(assetDirectory(true), row.asset_key)).catch(() => {});
  }
  await pool.end();
});

test('banner rotation, menu actions, keyboard close, logout and relogin', async ({
  page,
}) => {
  const user = await entry(page);
  const banner = page.getByTestId('promotion-banner');
  await expect(banner).toHaveAttribute('href', '/savings-goals');
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Customer Menu' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Open menu', exact: true }),
  ).toBeFocused();
  await menu(page, 'Bill Pay');
  await expect(
    page.getByRole('heading', { name: 'Bill Pay', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Try bill pay', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(
    'Demo action completed.',
  );
  await menu(page, 'Account Summary');
  await expect(banner).toHaveAttribute('href', '/savings-goals');
  await page.reload();
  await expect(banner).toHaveAttribute('href', '/bill-pay');
  await banner.click();
  await expect(
    page.getByRole('heading', { name: 'Bill Pay', exact: true }),
  ).toBeVisible();
  await page.reload();
  await menu(page, 'Account Summary');
  await expect(banner).toHaveAttribute('href', '/bill-pay');
  const before = await state(page);
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(banner).toHaveAttribute('href', '/cards');
  const after = await state(page);
  expect(after.runId).toBe(before.runId);
  expect(after.user.id).toBe(before.user.id);
  expect(after.visitId).not.toBe(before.visitId);
  const events = await pool.query(
    'SELECT name FROM interaction_events WHERE run_id=?',
    [after.runId],
  );
  expect(
    events.some((e: { name: string }) => e.name === 'placeholder_action'),
  ).toBe(true);
  await noOverflow(page);
});

test('two tabs retain their selected banner independently', async ({
  page,
  context,
}) => {
  await entry(page);
  await expect(page.getByTestId('promotion-banner')).toHaveAttribute(
    'href',
    '/savings-goals',
  );
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.getByTestId('promotion-banner')).toHaveAttribute(
    'href',
    '/bill-pay',
  );
  await expect(page.getByTestId('promotion-banner')).toHaveAttribute(
    'href',
    '/savings-goals',
  );
  await menu(page, 'Savings Goals');
  await menu(page, 'Account Summary');
  await expect(page.getByTestId('promotion-banner')).toHaveAttribute(
    'href',
    '/savings-goals',
  );
  await other.reload();
  await expect(other.getByTestId('promotion-banner')).toHaveAttribute(
    'href',
    '/cards',
  );
  await expect(page.getByTestId('promotion-banner')).toHaveAttribute(
    'href',
    '/savings-goals',
  );
  await other.close();
});

test('admin can create a login, upload a banner, and persist its settings', async ({
  page,
}) => {
  await page.goto('/controls');
  await page.getByLabel('Admin password').fill(process.env.DEMO_ADMIN_SECRET!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Admin Home', exact: true }),
  ).toBeVisible();
  await menu(page, 'Manage Customers');
  await page
    .getByRole('link', { name: 'Create customer', exact: true })
    .click();
  const username = `test.ui-${Date.now()}@example.com`;
  const form = page.locator('form');
  const usernameInput = form.getByLabel('Username', { exact: true });
  await usernameInput.fill('invalid username');
  expect(
    await usernameInput.evaluate(
      (input: HTMLInputElement) => input.validity.patternMismatch,
    ),
  ).toBe(true);
  await usernameInput.fill(username);
  expect(
    await usernameInput.evaluate((input: HTMLInputElement) =>
      input.checkValidity(),
    ),
  ).toBe(true);
  await form.getByLabel('Display name', { exact: true }).fill('Demo UI User');
  await form.getByLabel('Initial password').fill('temporary-test-password');
  await form.getByLabel('Activity mode').selectOption('automation');
  await form.getByRole('button', { name: 'Create customer' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Customer created.' }),
  ).toBeVisible();
  const [created] = await pool.query(
    'SELECT id FROM demo_users WHERE username=?',
    [username],
  );
  userIds.push(created.id);
  await page
    .getByRole('button', { name: 'View activity', exact: true })
    .click();
  await expect(
    page.getByText('No recorded activity for this customer yet.'),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Disable customer', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('Customer disabled');
  await page
    .getByRole('button', { name: 'Enable customer', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('Customer enabled.');
  await page
    .getByLabel(`New password for ${username}`)
    .fill('replaced-test-password');
  await page
    .getByRole('button', { name: 'Reset password', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('Password replaced');
  await expect(page.getByLabel(`New password for ${username}`)).toHaveValue('');
  await menu(page, 'Manage Customers');
  await page.getByLabel('Search customers').fill('no-such-test-customer');
  await expect(page.getByText('No customers match your search.')).toBeVisible();
  await page.getByLabel('Search customers').fill(username);
  await expect(page.locator('.customer-row')).toHaveCount(1);
  await page.locator('.customer-row').click();
  await expect(
    page.getByRole('heading', { name: 'Customer Details', exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await menu(page, 'Manage Banners');
  const bannerSection = page.locator('.admin-revision > section'),
    upload = bannerSection.locator('form').first();
  const buffer = await sharp({
    create: { width: 1200, height: 400, channels: 3, background: '#205747' },
  })
    .png()
    .toBuffer();
  await upload
    .getByLabel('Image', { exact: true })
    .setInputFiles({ name: 'demo.png', mimeType: 'image/png', buffer });
  await upload.getByLabel('Banner title').fill('UI Upload Test');
  await upload
    .getByLabel('Accessible link text')
    .fill('Explore fictional cards');
  await upload.getByLabel('Destination').selectOption('cards');
  await upload.getByLabel('Display order').fill('99');
  await upload.getByRole('button', { name: 'Upload banner' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Banner uploaded and enabled.',
  );
  const [uploaded] = await pool.query(
    "SELECT id,asset_key FROM demo_banners WHERE title='UI Upload Test' ORDER BY created_at DESC LIMIT 1",
  );
  uploads.push(uploaded);
  await page.reload();
  await expect(
    page
      .locator('.admin-banner')
      .filter({ has: page.locator('input[value="UI Upload Test"]') }),
  ).toBeVisible();
  const uploadedCard = page
    .locator('.admin-banner')
    .filter({ has: page.locator('input[value="UI Upload Test"]') });
  await uploadedCard
    .getByLabel('Internal destination')
    .selectOption('bill-pay');
  await uploadedCard
    .getByRole('button', { name: 'Save banner', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText(
    'Banner settings saved.',
  );
  await page.reload();
  await expect(uploadedCard.getByLabel('Internal destination')).toHaveValue(
    'bill-pay',
  );
  const oldImageUrl = await uploadedCard.locator('img').getAttribute('src');
  await uploadedCard
    .locator('summary')
    .filter({ hasText: 'Replace image' })
    .click();
  await uploadedCard
    .getByLabel('Replacement image')
    .setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer });
  await uploadedCard
    .getByRole('button', { name: 'Replace image', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText(
    'Banner uploaded and enabled.',
  );
  const [replacement] = await pool.query(
    "SELECT id,asset_key FROM demo_banners WHERE title='UI Upload Test' AND id<>? ORDER BY created_at DESC LIMIT 1",
    [uploaded.id],
  );
  uploads.push(replacement);
  expect(replacement.asset_key).not.toBe(uploaded.asset_key);
  expect((await page.request.get(oldImageUrl!)).status()).toBe(200);
  const [retained] = await pool.query(
    'SELECT enabled FROM demo_banners WHERE id=?',
    [uploaded.id],
  );
  expect(Boolean(retained.enabled)).toBe(false);
  await noOverflow(page);
  await page.goto('/');
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page
    .getByLabel('Password', { exact: true })
    .fill('replaced-test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Account Summary', exact: true }),
  ).toBeVisible();
  await noOverflow(page);
});

test('complete enrollment, persistence, contribution, later visit, and reset', async ({
  page,
  context,
  browser,
}, testInfo) => {
  const clarityRequests: string[] = [];
  page.on('request', (r) => {
    if (/https?:\/\/[^/]*clarity\.ms\//.test(r.url()))
      clarityRequests.push(r.url());
  });
  await entry(page);
  const initial = await state(page);
  await noOverflow(page);
  await expect(page.getByText('$4,286.42', { exact: true })).toBeVisible();
  await page.getByTestId('promotion-banner').scrollIntoViewIfNeeded();
  await expect
    .poll(() => count(initial.runId, 'promotion_visible', 'banner'))
    .toBe(1);
  // The sidebar (inline on mobile) is rendered below the fold, but is not an exposure.
  if (testInfo.project.name === 'mobile')
    expect(await count(initial.runId, 'promotion_visible', 'sidebar')).toBe(0);
  await page.screenshot({
    path: `artifacts/banking-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByTestId('promotion-banner').click();
  await expect(
    page.getByRole('heading', { name: 'Something to look forward to.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Get started' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Enable savings goals' }),
  ).toBeDisabled();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Enable savings goals' }).click();
  await expect(
    page.getByText('Savings goals is ready. Create your first goal below.'),
  ).toBeVisible();
  await page.getByLabel('Goal name').fill('Weekend at the coast');
  await page.getByLabel('Target amount ($)').fill('500.00');
  await page.getByRole('button', { name: 'Create goal', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Weekend at the coast', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Contribution from checking ($)').fill('25.00');
  await page.getByRole('button', { name: 'Add contribution' }).click();
  await expect(page.getByText('$25.00 added to your goal.')).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Weekend at the coast' }),
  ).toBeVisible();
  const saved = await state(page);
  expect(saved.enrolled).toBe(true);
  expect(saved.goals[0].currentMinor).toBe(2500);
  expect(saved.accounts[0].balanceMinor).toBe(
    initial.accounts[0].balanceMinor - 2500,
  );
  expect(saved.accounts[1].balanceMinor).toBe(
    initial.accounts[1].balanceMinor + 2500,
  );
  expect(saved.visitId).toBe(initial.visitId);
  await noOverflow(page);
  expect(await count(initial.runId, 'repeat_use')).toBe(0);
  // A fresh browser session retains the same secure run cookie but has a new visit.
  const later = await browser.newContext({
    storageState: await context.storageState(),
    viewport: testInfo.project.use.viewport,
    extraHTTPHeaders: headers,
  });
  const laterPage = await later.newPage();
  await laterPage.goto('http://127.0.0.1:5173/goals');
  await expect(
    laterPage.getByRole('heading', { name: 'Weekend at the coast' }),
  ).toBeVisible();
  const returnState = await state(laterPage);
  expect(returnState.runId).toBe(initial.runId);
  expect(returnState.visitId).not.toBe(initial.visitId);
  await laterPage.getByLabel('Contribution from checking ($)').fill('5.00');
  await laterPage.getByRole('button', { name: 'Add contribution' }).click();
  await expect(laterPage.getByText('$5.00 added to your goal.')).toBeVisible();
  expect(await count(initial.runId, 'repeat_use')).toBe(1);
  await later.close();
  await resetDemo(page);
  await expect(
    page.getByRole('heading', { name: 'Account Summary', exact: true }),
  ).toBeVisible();
  const reset = await state(page);
  ids.push(reset.runId);
  expect(reset.runId).not.toBe(initial.runId);
  expect(reset.goals).toHaveLength(0);
  expect(reset.enrolled).toBe(false);
  expect(reset.accounts[0].balanceMinor).toBe(initial.accounts[0].balanceMinor);
  expect(reset.variant).toBe(initial.variant);
  expect(await count(initial.runId, 'first_use')).toBe(1);
  expect(clarityRequests).toHaveLength(0);
});

test('independent participants and unavailable profile', async ({
  page,
  browser,
}) => {
  await entry(page, 'Jamie Chen');
  const jamie = await state(page);
  expect(jamie.eligible).toBe(false);
  await expect(page.getByTestId('promotion-banner')).toBeVisible();
  await page.goto('/savings-goals');
  await expect(
    page.getByText('Savings goals isn’t available for this demo profile.'),
  ).toBeVisible();
  await noOverflow(page);
  const other = await browser.newContext({ extraHTTPHeaders: headers });
  const otherPage = await other.newPage();
  await entry(otherPage);
  const alex = await state(otherPage);
  ids.push(alex.runId);
  expect(alex.runId).not.toBe(jamie.runId);
  expect(alex.eligible).toBe(true);
  await other.close();
});

test('visibility requires continuous active display and deduplicates exposure', async ({
  page,
}) => {
  await entry(page);
  const s = await state(page);
  const promo = page.getByTestId('promotion-sidebar');
  if ((await page.evaluate(() => innerWidth)) < 1100) {
    expect(await count(s.runId, 'promotion_visible', 'sidebar')).toBe(0);
  }
  await promo.scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  await page.evaluate(() => window.scrollTo(0, 0));
  if ((await page.evaluate(() => innerWidth)) < 1100)
    expect(await count(s.runId, 'promotion_visible', 'sidebar')).toBe(0);
  await promo.scrollIntoViewIfNeeded();
  await expect
    .poll(() => count(s.runId, 'promotion_visible', 'sidebar'))
    .toBe(1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await promo.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  expect(await count(s.runId, 'promotion_visible', 'sidebar')).toBe(1);
});

test('protected controls show explicit funnel denominators and start a new variant', async ({
  page,
}) => {
  await entry(page);
  const original = await state(page);
  await page.goto('/controls/report');
  await page.getByLabel('Admin password').fill(process.env.DEMO_ADMIN_SECRET!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Adoption Report', exact: true }),
  ).toBeVisible();
  await page
    .locator('.report-filters')
    .getByLabel('Activity')
    .selectOption('automation');
  await expect(
    page.getByText('Eligible denominator', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: 'Previous stage' }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: `artifacts/report-${test.info().project.name}.png`,
    fullPage: true,
  });
  await menu(page, 'Manage Customers');
  await page.getByLabel('Search customers').fill(original.user.username);
  await page.locator('.customer-row').click();
  const userCard = page
    .locator('.admin-user')
    .filter({ hasText: original.user.username });
  await userCard
    .locator('summary')
    .filter({ hasText: 'Reset banking state' })
    .click();
  await userCard.getByLabel('Campaign variant').selectOption('baseline');
  await userCard
    .getByRole('button', { name: 'Reset banking state', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('Banking state reset.');
  const configured = await state(page);
  ids.push(configured.runId);
  expect(configured.variant).toBe('baseline');
  expect(configured.runId).not.toBe(original.runId);
  await menu(page, 'Adoption Report');
  await expect(
    page.locator('.report-filters').getByLabel('Activity'),
  ).toHaveValue('automation');
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('Admin password')).toBeVisible();
});

test('abandonment and direct entry preserve form errors and keyboard actions', async ({
  page,
}) => {
  await entry(page);
  const abandoned = await state(page);
  const promotion = page.getByTestId('promotion-banner');
  await promotion.focus();
  await promotion.press('Enter');
  await page.getByRole('link', { name: 'Get started' }).click();
  await expect(
    page.getByRole('button', { name: 'Continue', exact: true }),
  ).toBeVisible();
  await expect.poll(() => count(abandoned.runId, 'enrollment_started')).toBe(1);
  expect(await count(abandoned.runId, 'enrollment_completed')).toBe(0);
  expect(await count(abandoned.runId, 'first_use')).toBe(0);
  await resetDemo(page);
  await expect(
    page.getByRole('heading', { name: 'Account Summary', exact: true }),
  ).toBeVisible();
  const direct = await state(page);
  ids.push(direct.runId);
  await page.goto('/enroll');
  const next = page.getByRole('button', { name: 'Continue', exact: true });
  await next.focus();
  await next.press('Enter');
  const checkbox = page.getByRole('checkbox');
  await checkbox.focus();
  await checkbox.press('Space');
  const enable = page.getByRole('button', { name: 'Enable savings goals' });
  await enable.focus();
  await enable.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Your savings goals.' }),
  ).toBeVisible();
  await page.getByLabel('Goal name').fill('Keep my entered name');
  await page.getByLabel('Target amount ($)').fill('5.555');
  await page.getByRole('button', { name: 'Create goal', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(/up to two decimal places/);
  await expect(page.getByLabel('Goal name')).toHaveValue(
    'Keep my entered name',
  );
  await expect(page.getByLabel('Target amount ($)')).toHaveValue('5.555');
  await page.getByLabel('Target amount ($)').fill('100');
  await page.getByRole('button', { name: 'Create goal', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Keep my entered name' }),
  ).toBeVisible();
  await page.getByLabel('Contribution from checking ($)').fill('101');
  await page.getByRole('button', { name: 'Add contribution' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Choose an amount within the remaining goal.',
  );
  await expect(page.getByLabel('Contribution from checking ($)')).toHaveValue(
    '101',
  );
  expect((await state(page)).goals[0].currentMinor).toBe(0);
  expect(await count(direct.runId, 'promotion_clicked')).toBe(0);
  expect(await count(direct.runId, 'first_use')).toBe(1);
  await noOverflow(page);
});

test('admin-only child routes, menu keyboard, missing pages, and expired access', async ({
  page,
  context,
}) => {
  const customerRequests: string[] = [];
  page.on('request', (r) => {
    if (
      /\/api\/(state|interactions|events|banners\/next)(?:[/?]|$)/.test(
        r.url(),
      ) ||
      /clarity\.ms/.test(r.url())
    )
      customerRequests.push(r.url());
  });
  await page.goto('/controls/customers');
  await expect(page.getByLabel('Admin password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open menu' })).toHaveCount(0);
  await page.getByLabel('Admin password').fill(process.env.DEMO_ADMIN_SECRET!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Search customers')).toBeVisible();
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Admin Menu', exact: true });
  await expect(dialog).toBeVisible();
  await page.screenshot({
    path: `artifacts/admin-menu-${test.info().project.name}.png`,
  });
  await expect(
    dialog.getByRole('link', { name: 'Manage Customers' }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(
    dialog.getByRole('link', { name: 'Account Summary' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Close menu', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(
    dialog.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Close menu', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Open menu', exact: true }),
  ).toBeFocused();
  await noOverflow(page);
  await page.screenshot({
    path: `artifacts/admin-customers-${test.info().project.name}.png`,
    fullPage: true,
  });
  await menu(page, 'Adoption Report');
  await page
    .locator('.report-filters')
    .getByLabel('Activity')
    .selectOption('automation');
  await page
    .locator('.report-filters')
    .getByLabel('Variant')
    .selectOption('baseline');
  await expect(
    page.getByText('Eligible denominator', { exact: true }),
  ).toBeVisible();
  await menu(page, 'Manage Banners');
  await expect(
    page.getByRole('heading', { name: 'Banner images', exact: true }),
  ).toBeVisible();
  await menu(page, 'Adoption Report');
  await expect(
    page.locator('.report-filters').getByLabel('Activity'),
  ).toHaveValue('automation');
  await expect(
    page.locator('.report-filters').getByLabel('Variant'),
  ).toHaveValue('baseline');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Adoption Report', exact: true }),
  ).toBeVisible();
  await page.goto('/controls/customers/missing-test-id');
  await expect(
    page.getByText('Customer not found. Choose a customer from the list.'),
  ).toBeVisible();
  await page.goto('/controls/unknown');
  await expect(
    page.getByRole('heading', { name: 'Admin page not found' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to Admin Home' }).click();
  await expect(
    page.getByRole('heading', { name: 'Admin Home', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/admin-home-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Admin page not found' }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole('heading', { name: 'Admin Home', exact: true }),
  ).toBeVisible();
  const cookie = (await context.cookies()).find(
    (c) => c.name === 'softek_admin',
  )!;
  await pool.query('DELETE FROM admin_sessions WHERE token_hash=?', [
    createHash('sha256').update(cookie.value).digest('hex'),
  ]);
  await menu(page, 'Manage Customers');
  await expect(page.getByLabel('Admin password')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('admin session expired');
  await expect(page.getByLabel('Search customers')).toHaveCount(0);
  expect(customerRequests).toEqual([]);
});

test('customer-only protection and independent sign-out with both sessions', async ({
  page,
  context,
}) => {
  await entry(page);
  const original = await state(page);
  await page.goto('/controls/customers');
  await expect(page.getByLabel('Admin password')).toBeVisible();
  await expect(page.getByLabel('Search customers')).toHaveCount(0);
  const response = await context.request.get('/api/admin/users');
  expect(response.status()).toBe(401);
  await page.getByLabel('Admin password').fill(process.env.DEMO_ADMIN_SECRET!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Search customers')).toBeVisible();
  await page.getByLabel('Search customers').fill(original.user.username);
  await page.locator('.customer-row').click();
  await page
    .getByRole('button', { name: 'View activity', exact: true })
    .click();
  await expect(
    page.getByText('Recent customer activity', { exact: true }),
  ).toBeVisible();
  await menu(page, 'Manage Banners');
  await page
    .getByRole('heading', { name: 'Banner images', exact: true })
    .waitFor();
  const unchanged = await state(page);
  expect(unchanged.runId).toBe(original.runId);
  // Menu navigation and admin reads do not create another banking banner presentation.
  const [presentations] = await pool.query(
    'SELECT COUNT(*) AS n FROM banner_presentations WHERE run_id=?',
    [original.runId],
  );
  expect(Number(presentations.n)).toBe(1);
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('Admin password')).toBeVisible();
  expect((await state(page)).runId).toBe(original.runId);
  await page.getByLabel('Admin password').fill(process.env.DEMO_ADMIN_SECRET!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Banner images', exact: true })
    .waitFor();
  await page.goto('/');
  await page
    .getByRole('heading', { name: 'Account Summary', exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  const customerMenu = page.getByRole('dialog', {
    name: 'Customer Menu',
    exact: true,
  });
  await expect(
    customerMenu.getByRole('link', { name: 'Manage Customers' }),
  ).toHaveCount(0);
  await expect(
    customerMenu.getByRole('link', { name: 'Account Summary' }),
  ).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await page.goto('/controls/banners');
  await expect(
    page.getByRole('heading', { name: 'Banner images', exact: true }),
  ).toBeVisible();
  expect((await context.request.get('/api/state')).status()).toBe(401);
  await noOverflow(page);
});

test('all twelve feature pages, one CTA, retry confirmation, and preserved banking', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('request', (r) => {
    if (/clarity\.ms/.test(r.url())) errors.push(r.url());
  });
  await entry(page);
  const original = await state(page);
  const before = await pool.query(
    'SELECT name FROM adoption_events WHERE run_id=? ORDER BY name',
    [original.runId],
  );
  let failed = false;
  const requests: string[] = [];
  await page.route('**/api/interactions', async (route) => {
    const body = route.request().postDataJSON();
    if (body.name === 'feature_cta_clicked' && body.routeKey === 'easycoin') {
      requests.push(body.requestId);
      if (!failed) {
        failed = true;
        await route.fetch();
        await route.abort('failed');
        return;
      }
    }
    await route.continue();
  });
  for (const f of features) {
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    const group = page.getByRole('button', {
      name: 'Explore Features',
      exact: true,
    });
    if ((await group.getAttribute('aria-expanded')) === 'false')
      await group.click();
    if (f.id === 'easycoin')
      await page.screenshot({
        path: `artifacts/feature-menu-${test.info().project.name}.png`,
      });
    await page.getByRole('link', { name: f.label, exact: true }).click();
    await expect(
      page.getByRole('heading', { name: f.headline, exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('promotion-banner')).toHaveCount(0);
    await expect(page.locator('form')).toHaveCount(0);
    const cta = page.getByRole('button', { name: f.cta, exact: true });
    await expect(cta).toHaveCount(1);
    if (f.id === 'easycoin') {
      await cta.click();
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByRole('status')).toHaveCount(0);
      await cta.click();
      expect(requests).toHaveLength(2);
      expect(requests[0]).toBe(requests[1]);
    } else
      await cta.evaluate((button: HTMLButtonElement) => {
        button.click();
        button.click();
      });
    await expect(page.getByRole('status')).toContainText(
      'does not activate a service',
    );
    await expect(cta).toBeDisabled();
    await noOverflow(page);
    if (f.id === 'easycoin')
      await page.screenshot({
        path: `artifacts/feature-confirmation-${test.info().project.name}.png`,
        fullPage: true,
      });
    await expect
      .poll(async () =>
        Number(
          (
            await pool.query(
              "SELECT COUNT(*) AS n FROM interaction_events WHERE run_id=? AND route_key=? AND name='feature_cta_clicked'",
              [original.runId, f.id],
            )
          )[0].n,
        ),
      )
      .toBe(1);
  }
  const current = await state(page);
  expect(current.accounts).toEqual(original.accounts);
  expect(current.goals).toEqual(original.goals);
  expect(current.enrolled).toBe(original.enrolled);
  expect(current.runId).toBe(original.runId);
  expect(
    await pool.query(
      'SELECT name FROM adoption_events WHERE run_id=? ORDER BY name',
      [original.runId],
    ),
  ).toEqual(before);
  await menu(page, 'Account Summary');
  await expect(page.getByTestId('promotion-banner')).toHaveAttribute(
    'href',
    '/savings-goals',
  );
  expect(errors).toEqual([]);
});

test('feature banner attribution, reload, direct/menu entry, tabs and report', async ({
  page,
  context,
}) => {
  await entry(page);
  const original = await state(page);
  const logged = await context.request.post('/api/admin/login', {
    headers: { Origin: 'http://127.0.0.1:5173' },
    data: { password: process.env.DEMO_ADMIN_SECRET! },
  });
  expect(logged.status()).toBe(200);
  const admin = await logged.json();
  const buffer = await sharp({
    create: { width: 1200, height: 400, channels: 3, background: '#205747' },
  })
    .png()
    .toBuffer();
  const uploaded = await context.request.post('/api/admin/banners/upload', {
    headers: { Origin: 'http://127.0.0.1:5173', 'X-CSRF-Token': admin.csrf },
    multipart: {
      image: { name: 'feature.png', mimeType: 'image/png', buffer },
      title: 'Owned feature banner',
      altText: 'Explore crypto demo',
      destination: 'easycoin',
      sortOrder: '3',
    },
  });
  expect(uploaded.status()).toBe(201);
  const uploadedData = await uploaded.json();
  const [row] = await pool.query(
    'SELECT id,asset_key FROM demo_banners WHERE id=?',
    [uploadedData.id],
  );
  uploads.push(row);
  await pool.query(
    "UPDATE banner_rotation SET last_banner_id='harbor-cards' WHERE user_id=?",
    [original.user.id],
  );
  await page.reload();
  const banner = page.getByTestId('promotion-banner');
  await expect(banner).toHaveAttribute('href', '/features/easycoin');
  await banner.click();
  await expect(
    page.getByRole('heading', { name: features[0].headline, exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: features[0].cta, exact: true })
    .click();
  await expect(page.getByRole('status')).toBeVisible();
  const other = await context.newPage();
  await other.goto('/features/easycoin');
  await other
    .getByRole('button', { name: features[0].cta, exact: true })
    .click();
  await expect(other.getByRole('status')).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: features[0].cta, exact: true }),
  ).toBeEnabled();
  await menu(page, 'Account Summary');
  await expect(banner).toHaveAttribute('href', '/features/easycoin');
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page
    .getByRole('button', { name: 'Explore Features', exact: true })
    .click();
  await page
    .getByRole('link', { name: features[0].label, exact: true })
    .click();
  await page
    .getByRole('button', { name: features[0].cta, exact: true })
    .click();
  await expect(page.getByRole('status')).toBeVisible();
  await expect
    .poll(async () =>
      Number(
        (
          await pool.query(
            "SELECT COUNT(*) AS n FROM interaction_events WHERE run_id=? AND name='feature_viewed'",
            [original.runId],
          )
        )[0].n,
      ),
    )
    .toBe(4);
  const clicks = await pool.query(
    "SELECT selection_id FROM interaction_events WHERE run_id=? AND name='feature_cta_clicked' ORDER BY created_at",
    [original.runId],
  );
  expect(clicks).toHaveLength(3);
  expect(clicks[0].selection_id).toBeTruthy();
  expect(clicks[1].selection_id).toBeNull();
  expect(clicks[2].selection_id).toBeNull();
  const [presentations] = await pool.query(
    'SELECT COUNT(*) AS n FROM banner_presentations WHERE run_id=?',
    [original.runId],
  );
  expect(Number(presentations.n)).toBe(2);
  await other.close();
  await page.goto('/controls/report');
  await page
    .locator('.report-filters')
    .getByLabel('Activity')
    .selectOption('automation');
  await expect(
    page.getByRole('heading', { name: 'Feature Activity', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByTestId('feature-activity').locator('[data-feature="easycoin"]'),
  ).toContainText('from banners');
  await noOverflow(page);
  await page.screenshot({
    path: `artifacts/feature-report-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto('/controls/banners');
  await expect(
    page.getByRole('combobox', { name: 'Destination', exact: true }),
  ).toContainText('EasyCoin Crypto');
});

test('feature deep-link login, unavailable savings profile, unknown page and submenu keyboard', async ({
  page,
}) => {
  const user = await fixtureUser(pool, 'jamie');
  userIds.push(user.id);
  await page.goto('/features/youth-banking');
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: features[10].headline, exact: true }),
  ).toBeVisible();
  expect((await state(page)).eligible).toBe(false);
  await page
    .getByRole('button', { name: features[10].cta, exact: true })
    .click();
  await expect(page.getByRole('status')).toBeVisible();
  const width = page.viewportSize()!.width;
  await page.setViewportSize({ width, height: 500 });
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  const group = page.getByRole('button', {
    name: 'Explore Features',
    exact: true,
  });
  await expect(group).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.getByRole('link', { name: 'Youth Banking', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await group.focus();
  await group.press('Space');
  await expect(group).toHaveAttribute('aria-expanded', 'false');
  await group.press('Enter');
  await expect(group).toHaveAttribute('aria-expanded', 'true');
  await page
    .getByRole('link', { name: 'Business Invoicing', exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole('link', { name: 'Business Invoicing', exact: true }),
  ).toBeInViewport();
  await page.getByRole('button', { name: 'Close menu', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Close menu', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Open menu', exact: true }),
  ).toBeFocused();
  await noOverflow(page);
  await menu(page, 'Account Summary');
  await page.goto('/features/not-a-feature');
  await expect(
    page.getByRole('heading', { name: 'Feature not found' }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Account Summary', exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole('heading', { name: 'Feature not found' }),
  ).toBeVisible();
  const invalid = await pool.query(
    "SELECT id FROM interaction_events WHERE run_id=? AND route_key='not-a-feature'",
    [(await state(page)).runId],
  );
  expect(invalid).toHaveLength(0);
});
