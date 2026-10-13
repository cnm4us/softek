import { test, expect } from '@playwright/test';
import mariadb from 'mariadb';
import sharp from 'sharp';
import { databaseConfig } from '../../apps/api/src/config.js';
import { explorerSections } from '../../apps/api/src/feature-explorer-config.js';
import { features } from '../../apps/api/src/features.js';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { assetDirectory } from '../../apps/api/src/banner-assets.js';
const pool = mariadb.createPool({
  ...databaseConfig('runtime', true),
  connectionLimit: 1,
});
const ids: string[] = [],
  assets: string[] = [],
  adminTokens: string[] = [];
test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin !== 'http://127.0.0.1:5173') {
      await route.abort();
      throw new Error('Admin tests must not contact external services.');
    }
    await route.continue();
  });
  page.on('response', async (response) => {
    if (
      response.status() === 201 &&
      response.url().endsWith('/api/admin/feature-explorer')
    )
      ids.push((await response.json()).id);
    if (
      response.status() === 201 &&
      /\/api\/admin\/feature-explorer\/[^/]+\/image$/.test(response.url())
    )
      assets.push((await response.json()).imageUrl.split('/').at(-1));
  });
});
test.afterEach(async ({ context }) => {
  const cookie = (await context.cookies()).find(
    (c) => c.name === 'softek_admin',
  );
  if (cookie) adminTokens.push(cookie.value);
});
test.afterAll(async () => {
  for (const id of ids)
    await pool.query('DELETE FROM feature_explorer_widgets WHERE id=?', [id]);
  for (const key of assets) {
    await pool.query('DELETE FROM banner_assets WHERE asset_key=?', [key]);
    await unlink(join(assetDirectory(true), key)).catch(() => {});
  }
  for (const token of adminTokens)
    await pool.query('DELETE FROM admin_sessions WHERE token_hash=?', [
      createHash('sha256').update(token).digest('hex'),
    ]);
  await pool.end();
});
test('admin manages four banner spaces with catalog URLs and persistent mobile artwork', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', () => errors.push('Browser error'));
  await page.goto('/controls/feature-explorer');
  await expect(page.getByLabel('Admin password')).toBeVisible();
  await page.getByLabel('Admin password').fill(process.env.DEMO_ADMIN_SECRET!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Feature Explorer', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.explorer-section')).toHaveCount(4);
  for (const [index, section] of explorerSections.entries()) {
    const space = page.locator('.explorer-section').filter({
      has: page.getByRole('heading', { name: section.label, exact: true }),
    });
    await expect(space).toBeVisible();
    const selector = space.getByLabel(`Explore feature for ${section.label}`, {
      exact: true,
    });
    await expect(selector.locator('option')).toHaveCount(12);
    const feature = features[index]!;
    await selector.selectOption(feature.id);
    await space
      .getByRole('button', { name: 'Add Explore feature', exact: true })
      .click();
    await expect(
      page.getByRole('heading', {
        name: 'Configure Explore Feature',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: feature.name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(`Banner space: ${section.label}`, { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('Feature URL', { exact: true })).toHaveValue(
      `http://127.0.0.1:5173${feature.href}`,
    );
    await expect(
      page.getByLabel('Feature URL', { exact: true }),
    ).toHaveAttribute('readonly', '');
    await expect(
      page.getByLabel('Include in future rotation', { exact: true }),
    ).toBeDisabled();
    if (index === 0) {
      const buffer = await sharp({
        create: { width: 960, height: 315, channels: 3, background: '#205747' },
      })
        .png()
        .toBuffer();
      await page
        .getByLabel('Upload mobile banner', { exact: true })
        .setInputFiles({ name: 'mobile.png', mimeType: 'image/png', buffer });
      await page
        .getByRole('button', { name: 'Upload banner', exact: true })
        .click();
      await expect(page.getByRole('status')).toContainText(
        'Mobile banner uploaded.',
      );
      await expect(page.locator('.explorer-mobile-preview img')).toBeVisible();
      const first = await page
        .locator('.explorer-mobile-preview img')
        .getAttribute('src');
      await page
        .getByLabel('Accessible link text', { exact: true })
        .fill('Explore crypto investing');
      await page.getByLabel('Display order', { exact: true }).fill('2');
      await page
        .getByLabel('Include in future rotation', { exact: true })
        .check();
      await page
        .getByRole('button', { name: 'Save widget', exact: true })
        .click();
      await expect(page.getByRole('status')).toContainText(
        'Widget settings saved.',
      );
      await page.reload();
      await expect(
        page.getByLabel('Accessible link text', { exact: true }),
      ).toHaveValue('Explore crypto investing');
      await expect(
        page.getByLabel('Include in future rotation', { exact: true }),
      ).toBeChecked();
      await page
        .getByLabel('Replace mobile banner', { exact: true })
        .setInputFiles({
          name: 'replacement.png',
          mimeType: 'image/png',
          buffer,
        });
      await page
        .getByRole('button', { name: 'Replace banner', exact: true })
        .click();
      await expect(page.getByRole('status')).toContainText(
        'Mobile banner uploaded.',
      );
      await expect(
        page.locator('.explorer-mobile-preview img'),
      ).not.toHaveAttribute('src', first!);
      await page.screenshot({
        path: `artifacts/explorer-config-${test.info().project.name}.png`,
        fullPage: true,
      });
    }
    await page
      .getByRole('link', { name: 'Back to Feature Explorer', exact: true })
      .click();
    await expect(
      space.getByRole('link', { name: feature.name, exact: true }),
    ).toBeVisible();
    await expect(
      space
        .getByLabel(`Explore feature for ${section.label}`, { exact: true })
        .locator(`option[value="${feature.id}"]`),
    ).toHaveCount(0);
  }
  await page.screenshot({
    path: `artifacts/explorer-spaces-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Feature Explorer', exact: true }),
  ).toHaveClass('active');
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await page.goto('/controls');
  await expect(page.locator('.admin-home-link')).toHaveCount(5);
  await page
    .getByRole('link', { name: 'Feature Explorer', exact: false })
    .click();
  await expect(page.locator('.explorer-section')).toHaveCount(4);
  expect(errors).toEqual([]);
});

test('widget Delete cancels, reports failure, removes only its space and permits re-adding', async ({
  page,
  context,
}) => {
  const logged = await context.request.post('/api/admin/login', {
    headers: { Origin: 'http://127.0.0.1:5173' },
    data: { password: process.env.DEMO_ADMIN_SECRET },
  });
  expect(logged.status()).toBe(200);
  const csrf = (await logged.json()).csrf;
  const feature = features.at(-1)!;
  for (const section of ['summary', 'account-checking']) {
    const created = await context.request.post('/api/admin/feature-explorer', {
      headers: { Origin: 'http://127.0.0.1:5173', 'X-CSRF-Token': csrf },
      data: { section, featureId: feature.id },
    });
    expect(created.status()).toBe(201);
    ids.push((await created.json()).id);
  }
  await page.goto('/controls/feature-explorer');
  const summary = page.locator('.explorer-section').filter({
    has: page.getByRole('heading', { name: 'Account Summary', exact: true }),
  });
  const checking = page.locator('.explorer-section').filter({
    has: page.getByRole('heading', {
      name: 'Everyday Checking',
      exact: true,
    }),
  });
  const remove = summary.getByRole('button', {
    name: `Delete ${feature.name} from Account Summary`,
    exact: true,
  });
  await expect(remove).toBeVisible();
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Account Summary');
    await dialog.dismiss();
  });
  await remove.click();
  await expect(
    summary.getByRole('link', { name: feature.name, exact: true }),
  ).toBeVisible();
  const failed = '**/api/admin/feature-explorer/*/delete';
  await page.route(failed, (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Test deletion unavailable. Try again.' }),
    }),
  );
  page.once('dialog', (dialog) => dialog.accept());
  await remove.click();
  await expect(page.getByRole('alert')).toContainText(
    'Test deletion unavailable.',
  );
  await expect(
    summary.getByRole('link', { name: feature.name, exact: true }),
  ).toBeVisible();
  await page.unroute(failed);
  page.once('dialog', (dialog) => dialog.accept());
  await remove.click();
  await expect(page.getByRole('status')).toContainText(
    'Explore feature deleted.',
  );
  await expect(
    summary.getByRole('link', { name: feature.name, exact: true }),
  ).toHaveCount(0);
  await expect(
    checking.getByRole('link', { name: feature.name, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    summary.getByRole('link', { name: feature.name, exact: true }),
  ).toHaveCount(0);
  const selector = summary.getByLabel('Explore feature for Account Summary', {
    exact: true,
  });
  await selector.selectOption(feature.id);
  await summary
    .getByRole('button', { name: 'Add Explore feature', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Delete widget', exact: true }),
  ).toBeVisible();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page
    .getByRole('button', { name: 'Delete widget', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: feature.name, exact: true }),
  ).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: 'Delete widget', exact: true })
    .click();
  await expect(page).toHaveURL('/controls/feature-explorer');
  await expect(
    summary.getByRole('link', { name: feature.name, exact: true }),
  ).toHaveCount(0);
  await expect(
    checking.getByRole('link', { name: feature.name, exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
