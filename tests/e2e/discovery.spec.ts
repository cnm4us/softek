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
      throw new Error(
        'Routine discovery tests must not contact external services.',
      );
    }
    await route.continue();
  });
});
async function login(
  page: Page,
  user?: { username: string; password: string },
) {
  const generated = user ? null : await fixtureUser(pool);
  if (generated) ids.push(generated.id);
  const u = user ?? generated!;
  await page.goto('/');
  await page.getByLabel('Username', { exact: true }).fill(u.username);
  await page.getByLabel('Password', { exact: true }).fill(u.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Account Summary', exact: true }),
  ).toBeVisible();
  return u;
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
async function menu(page: Page, name: string) {
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('link', { name, exact: true }).click();
}
async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test('EasyCoin discovery follows explicit investing exploration and links to separately tracked feature engagement', async ({
  page,
}) => {
  await login(page);
  const original = await state(page);
  await menu(page, 'Savings & Investing');
  await expect(page.getByTestId('discovery-card')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Explore investing', exact: true })
    .click();
  const card = page.getByTestId('discovery-card');
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => {
      const [p] = await pool.query(
        'SELECT impressed_at FROM discovery_presentations WHERE visit_id=?',
        [original.visitId],
      );
      return Boolean(p?.impressed_at);
    })
    .toBe(true);
  await noOverflow(page);
  await page.screenshot({
    path: `artifacts/discovery-investing-${test.info().project.name}.png`,
    fullPage: true,
  });
  await card.getByRole('button', { name: 'Learn more', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'EasyCoin Crypto', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Explore Crypto Investing', exact: true })
    .click();
  await expect(page.getByRole('status')).toBeVisible();
  await expect
    .poll(async () => {
      const [r] = await pool.query(
        'SELECT COUNT(*) AS n FROM discovery_feature_observations d JOIN interaction_events e ON e.id=d.interaction_id WHERE e.run_id=?',
        [original.runId],
      );
      return Number(r.n);
    })
    .toBe(2);
  await expect(
    page.getByRole('link', { name: 'Back to where you were' }),
  ).toHaveAttribute('href', '/savings');
  await menu(page, 'Loans');
  await page.getByRole('button', { name: /Harbor auto loan/ }).click();
  await expect(page.getByTestId('discovery-card')).toHaveCount(0);
  expect((await state(page)).accounts).toEqual(original.accounts);
});

test('Skip A Pay requires the eligible loan context and never interrupts simulated payment review or confirmation', async ({
  page,
}) => {
  await login(page);
  const original = await state(page);
  await menu(page, 'Loans');
  await page.getByRole('button', { name: /Harbor personal loan/ }).click();
  await expect(page.getByTestId('discovery-card')).toHaveCount(0);
  await page.getByRole('button', { name: '← All demo loans' }).click();
  await page.getByRole('button', { name: /Harbor auto loan/ }).click();
  await expect(page.getByTestId('discovery-card')).toBeVisible();
  await expect(
    page.getByText('See whether you can defer an upcoming payment.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/discovery-loan-${test.info().project.name}.png`,
    fullPage: true,
  });
  await noOverflow(page);
  await page.getByRole('button', { name: 'Make a demo payment' }).click();
  await expect(page.getByTestId('discovery-card')).toHaveCount(0);
  await page.getByLabel('Payment amount').fill('0');
  await page.getByRole('button', { name: 'Review demo payment' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Payment amount').fill('12.34');
  await page.getByRole('button', { name: 'Review demo payment' }).click();
  await expect(
    page.getByRole('heading', { name: 'Review your payment' }),
  ).toBeVisible();
  await expect(page.getByTestId('discovery-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirm demo payment' }).click();
  await expect(page.getByRole('status')).toContainText('Demo payment reviewed');
  await expect(page.getByTestId('discovery-card')).toHaveCount(0);
  expect((await state(page)).accounts).toEqual(original.accounts);
  await noOverflow(page);
});

test('discovery opt-out and dismissal persist while permanent Explore remains available', async ({
  page,
}) => {
  const user = await login(page);
  await menu(page, 'Discovery preferences');
  await page
    .getByRole('radio', { name: /Don’t suggest additional services/ })
    .check();
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Your discovery preferences are saved.',
  );
  await signOut(page);
  await login(page, user);
  await menu(page, 'Discovery preferences');
  await expect(
    page.getByRole('radio', { name: /Don’t suggest additional services/ }),
  ).toBeChecked();
  await menu(page, 'Loans');
  await page.getByRole('button', { name: /Harbor auto loan/ }).click();
  await expect(page.getByTestId('discovery-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page
    .getByRole('button', { name: 'Explore Features', exact: true })
    .click();
  await page
    .getByRole('link', { name: 'EasyCoin Crypto', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'EasyCoin Crypto', exact: true }),
  ).toBeVisible();
  await menu(page, 'Discovery preferences');
  await page.getByRole('radio', { name: /Standard suggestions/ }).check();
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByRole('status')).toBeVisible();
  await menu(page, 'Loans');
  await page.getByRole('button', { name: /Harbor auto loan/ }).click();
  await expect(page.getByTestId('discovery-card')).toBeVisible();
  await page
    .getByRole('button', { name: 'Dismiss Skip A Pay suggestion' })
    .click();
  await expect(page.getByTestId('discovery-card')).toHaveCount(0);
  await signOut(page);
  await login(page, user);
  await menu(page, 'Loans');
  await page.getByRole('button', { name: /Harbor auto loan/ }).click();
  await expect(page.getByTestId('discovery-card')).toHaveCount(0);
  await noOverflow(page);
});
