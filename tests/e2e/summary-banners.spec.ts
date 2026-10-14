import { test, expect, type Page } from '@playwright/test';
import mariadb from 'mariadb';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { databaseConfig } from '../../apps/api/src/config.js';
import {
  publishAsset,
  assetDirectory,
} from '../../apps/api/src/banner-assets.js';
import { features } from '../../apps/api/src/features.js';
import { fixtureUser, cleanUsers } from '../fixtures.js';
const pool = mariadb.createPool({
  ...databaseConfig('runtime', true),
  connectionLimit: 1,
});
const users: string[] = [],
  widgets: string[] = [],
  assets: string[] = [],
  initial: { id: string; enabled: boolean }[] = [];
const chosen = ['identity-protect', 'business-invoice', 'youth-banking'];
test.use({
  extraHTTPHeaders: { 'X-Demo-Automation': process.env.AUTOMATION_SECRET! },
});
test.beforeAll(async () => {
  initial.push(
    ...(await pool.query('SELECT id,enabled FROM feature_explorer_widgets')),
  );
  await pool.query(
    "UPDATE feature_explorer_widgets SET enabled=FALSE WHERE section_key='summary'",
  );
  for (const [i, featureId] of chosen.entries()) {
    const key = await publishAsset(
      await sharp({
        create: {
          width: 960,
          height: 315,
          channels: 3,
          background: ['#205747', '#305577', '#604577'][i]!,
        },
      })
        .webp()
        .toBuffer(),
      true,
    );
    assets.push(key);
    await pool.query(
      "INSERT INTO banner_assets VALUES (?,'webp',960,315,1000,UTC_TIMESTAMP(6))",
      [key],
    );
    const id = randomUUID();
    widgets.push(id);
    await pool.query(
      'INSERT INTO feature_explorer_widgets VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))',
      [
        id,
        'summary',
        featureId,
        key,
        `Explore ${features.find((f) => f.id === featureId)!.name}`,
        true,
        i,
      ],
    );
  }
});
test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin !== 'http://127.0.0.1:5173') {
      await route.abort();
      throw new Error('Summary tests must not contact external services.');
    }
    await route.continue();
  });
});
test.afterEach(async () => {
  for (const [i, id] of widgets.entries())
    await pool.query(
      'UPDATE feature_explorer_widgets SET enabled=TRUE,asset_key=? WHERE id=?',
      [assets[i], id],
    );
});
test.afterAll(async () => {
  await cleanUsers(pool, users);
  for (const id of widgets)
    await pool.query('DELETE FROM feature_explorer_widgets WHERE id=?', [id]);
  for (const row of initial)
    await pool.query(
      'UPDATE feature_explorer_widgets SET enabled=? WHERE id=?',
      [row.enabled, row.id],
    );
  for (const key of assets) {
    await pool.query('DELETE FROM banner_assets WHERE asset_key=?', [key]);
    await unlink(join(assetDirectory(true), key)).catch(() => {});
  }
  await pool.end();
});
async function login(page: Page) {
  const user = await fixtureUser(pool);
  users.push(user.id);
  await page.goto('/');
  await page.getByLabel('Username', { exact: true }).fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByTestId('promotion-banner')).toBeVisible();
  return user;
}
async function state(page: Page) {
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
async function menu(page: Page, label: string) {
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('link', { name: label, exact: true }).click();
}

test('Summary cycles configured banners and attributes feature CTA without changing banking', async ({
  page,
}) => {
  const user = await login(page),
    original = await state(page),
    banner = page.getByTestId('promotion-banner');
  await expect(banner).toHaveAttribute('href', '/features/' + chosen[0]);
  const selection = await page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem('softek_explorer_summary')!).banner.id,
  );
  const rect = (await banner.boundingBox())!,
    accounts = (await page.locator('.accounts-grid').boundingBox())!,
    activity = (await page
      .getByRole('heading', { name: 'Recent activity', exact: true })
      .boundingBox())!;
  expect(rect.y).toBeGreaterThanOrEqual(accounts.y + accounts.height);
  expect(rect.y + rect.height).toBeLessThan(activity.y);
  expect(rect.height).toBe(105);
  expect(Math.abs(rect.width - accounts.width)).toBeLessThan(2);
  expect(
    await banner
      .locator('img')
      .evaluate((img) => getComputedStyle(img).objectFit),
  ).toBe('contain');
  await banner.scrollIntoViewIfNeeded();
  await expect
    .poll(async () =>
      Number(
        (
          await pool.query(
            "SELECT COUNT(*) AS n FROM interaction_events WHERE run_id=? AND name='banner_visible' AND selection_id=?",
            [original.runId, selection],
          )
        )[0].n,
      ),
    )
    .toBe(1);
  await banner.click();
  await expect(page).toHaveURL('/features/' + chosen[0]);
  const feature = features.find((f) => f.id === chosen[0])!;
  await page.getByRole('button', { name: feature.cta, exact: true }).click();
  await expect(page.getByRole('status')).toBeVisible();
  await expect
    .poll(async () =>
      Number(
        (
          await pool.query(
            "SELECT COUNT(*) AS n FROM interaction_events WHERE run_id=? AND name='feature_cta_clicked' AND selection_id=?",
            [original.runId, selection],
          )
        )[0].n,
      ),
    )
    .toBe(1);
  await menu(page, 'Account Summary');
  await expect(banner).toHaveAttribute('href', '/features/' + chosen[0]);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem('softek_explorer_summary')!).banner
          .id,
    ),
  ).toBe(selection);
  for (const name of [
    'Everyday checking',
    'Harbor savings',
    'Harbor credit card',
  ]) {
    await page.getByRole('link', { name: `Open ${name}`, exact: true }).click();
    await expect(page.getByTestId('banner-placeholder')).toBeVisible();
    await expect(page.getByTestId('promotion-banner')).toHaveCount(0);
    await page
      .getByRole('link', { name: 'Back to Account Summary', exact: true })
      .click();
    await expect(banner).toHaveAttribute('href', '/features/' + chosen[0]);
  }
  await page.reload();
  await expect(banner).toHaveAttribute('href', '/features/' + chosen[1]);
  await page.reload();
  await expect(banner).toHaveAttribute('href', '/features/' + chosen[2]);
  await page.screenshot({
    path: `artifacts/summary-banners-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(banner).toHaveAttribute('href', '/features/' + chosen[0]);
  const after = await state(page);
  expect(after.accounts).toEqual(original.accounts);
  expect(after.transactions).toEqual(original.transactions);
  expect(after.goals).toEqual(original.goals);
  expect(after.user.id).toBe(user.id);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('failed images and disabled Summary artwork fall back to the compact placeholder', async ({
  page,
}) => {
  await page.route('**/media/banners/*', (route) => route.abort());
  await loginFallback();
  await expect(page.getByTestId('banner-placeholder')).toBeVisible();
  await expect(page.getByTestId('promotion-banner')).toHaveCount(0);
  await page.unroute('**/media/banners/*');
  await pool.query(
    "UPDATE feature_explorer_widgets SET enabled=FALSE WHERE section_key='summary'",
  );
  await page.reload();
  await expect(page.getByTestId('banner-placeholder')).toBeVisible();
  await expect(page.getByTestId('promotion-banner')).toHaveCount(0);
  async function loginFallback() {
    const user = await fixtureUser(pool);
    users.push(user.id);
    await page.goto('/');
    await page.getByLabel('Username', { exact: true }).fill(user.username);
    await page.getByLabel('Password', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'Open Everyday checking', exact: true }),
    ).toBeVisible();
  }
});
