import { test, expect, type Page } from '@playwright/test';
import mariadb from 'mariadb';
import { databaseConfig } from '../../apps/api/src/config.js';
import { fixtureUser, cleanUsers } from '../fixtures.js';

test.use({
  extraHTTPHeaders: { 'X-Demo-Automation': process.env.AUTOMATION_SECRET! },
});
const pool = mariadb.createPool({
  ...databaseConfig('runtime', true),
  connectionLimit: 2,
  bigIntAsNumber: true,
});
const ids: string[] = [];
test.afterAll(async () => {
  await cleanUsers(pool, ids);
  await pool.end();
});
test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin !== 'http://127.0.0.1:5173') {
      await route.abort();
      throw new Error('Catalog tests must not contact external services.');
    }
    await route.continue();
  });
});
async function entry(page: Page) {
  const user = await fixtureUser(pool);
  ids.push(user.id);
  await page.goto('/explore');
  await page.getByLabel('Username', { exact: true }).fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/explore');
  await expect(
    page.getByRole('heading', {
      name: 'Explore more ways to bank',
      exact: true,
    }),
  ).toBeVisible();
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
const expected = [
  [
    'Save & Invest',
    [
      'Savings Accounts & Certificates',
      'EasyVest Automated Investing',
      'EasyVest Self-Directed Investing',
      'EasyCoin Cryptocurrency',
    ],
  ],
  [
    'Borrow & Manage Payments',
    ['Buy Now, Pay Later', 'Auto Loans & Refinancing', 'Skip A Pay'],
  ],
  ['Move Money', ['Instant Payments']],
  ['Protect & Understand', ['Credit Score Monitoring', 'Identity Protection']],
  ['Family & Business', ['Youth Banking', 'Small Business Invoicing']],
] as const;

test('catalog deep-link login, ordered groups, keyboard toggles and search', async ({
  page,
}) => {
  const original = await entry(page);
  await expect(page.locator('.catalog-group h2')).toHaveText(
    expected.map(([name, products]) => `${name}${products.length}`),
  );
  for (const [name, products] of expected) {
    const group = page.getByRole('region', {
      name: new RegExp(`^${name}`),
    });
    await expect(group.getByRole('button')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(group.getByRole('link')).toHaveText([...products]);
  }
  const save = page.getByRole('button', { name: /Save & Invest/ });
  await save.focus();
  await save.press('Space');
  await expect(save).toHaveAttribute('aria-expanded', 'false');
  await expect(
    page.getByRole('link', { name: 'EasyCoin Cryptocurrency', exact: true }),
  ).toHaveCount(0);
  await save.press('Enter');
  await expect(save).toHaveAttribute('aria-expanded', 'true');
  await page
    .getByRole('button', { name: 'Search features', exact: true })
    .click();
  const search = page.getByRole('searchbox', {
    name: 'Search services',
    exact: true,
  });
  await expect(search).toBeFocused();
  await search.fill('  CRYPTO  ');
  await expect(page.locator('.catalog-group')).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText('1 service found');
  await expect(page.locator('.catalog-group a')).toHaveText([
    'EasyCoin Cryptocurrency',
  ]);
  await search.fill('unavailable-service');
  await expect(page.locator('.catalog-group')).toHaveCount(0);
  await expect(page.getByText(/No services match/)).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(page.locator('.catalog-group a')).toHaveCount(12);
  await page
    .getByRole('button', { name: 'Close feature search', exact: true })
    .click();
  await expect(search).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/catalog-${test.info().project.name}.png`,
    fullPage: true,
  });
  await expect
    .poll(async () =>
      Number(
        (
          await pool.query(
            "SELECT COUNT(*) AS n FROM interaction_events WHERE run_id=? AND route_key='explore' AND name='page_view'",
            [original.runId],
          )
        )[0].n,
      ),
    )
    .toBeGreaterThan(0);
  const rows = await pool.query(
    "SELECT id FROM interaction_events WHERE run_id=? AND name IN ('feature_viewed','feature_cta_clicked')",
    [original.runId],
  );
  expect(rows).toHaveLength(0);
});

test('catalog menu link, un-attributed CTA and return survive refresh', async ({
  page,
}) => {
  const original = await entry(page);
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  const catalogLink = page.getByRole('link', {
    name: 'Explore more ways to bank',
    exact: true,
  });
  await expect(catalogLink).toHaveAttribute('aria-current', 'page');
  await catalogLink.click();
  await page.getByRole('link', { name: 'Skip A Pay', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Skip A Pay', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Check My Eligibility', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText(
    'does not activate a service',
  );
  await page.reload();
  await page
    .getByRole('link', {
      name: 'Back to Explore more ways to bank',
      exact: true,
    })
    .click();
  await expect(page).toHaveURL('/explore');
  await expect(page.locator('.catalog-group a')).toHaveCount(12);
  await expect
    .poll(async () =>
      Number(
        (
          await pool.query(
            "SELECT COUNT(*) AS n FROM interaction_events WHERE run_id=? AND name='feature_cta_clicked' AND route_key='skip-pay'",
            [original.runId],
          )
        )[0].n,
      ),
    )
    .toBe(1);
  const [links] = await pool.query(
    'SELECT COUNT(*) AS n FROM discovery_feature_observations d JOIN interaction_events e ON e.id=d.interaction_id WHERE e.run_id=?',
    [original.runId],
  );
  expect(Number(links.n)).toBe(0);
  const [banner] = await pool.query(
    'SELECT COUNT(*) AS n FROM interaction_events WHERE run_id=? AND selection_id IS NOT NULL',
    [original.runId],
  );
  expect(Number(banner.n)).toBe(0);
  const current = await page.evaluate(async () =>
    (
      await fetch('/api/state', {
        headers: {
          'X-Browser-Session': sessionStorage.getItem('softek_browser')!,
        },
      })
    ).json(),
  );
  expect(current.accounts).toEqual(original.accounts);
});
