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
      throw new Error('Account tests must not contact external services.');
    }
    await route.continue();
  });
});
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
async function login(
  page: Page,
  user: { username: string; password: string },
  path = '/',
) {
  await page.goto(path);
  await page.getByLabel('Username', { exact: true }).fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(path);
  await expect(
    page
      .getByTestId('promotion-banner')
      .or(page.getByTestId('account-detail-balance')),
  ).toBeVisible();
}
const paths = {
  checking: '/accounts/checking',
  savings: '/accounts/savings',
  credit: '/accounts/credit-card',
};
const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    n / 100,
  );
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test('Summary widgets open masked read-only account details with stable sample history', async ({
  page,
}) => {
  const user = await fixtureUser(pool);
  ids.push(user.id);
  await login(page, user);
  const original = await state(page);
  const banner = await page
    .getByTestId('promotion-banner')
    .getAttribute('href');
  await expect(
    page.getByRole('link', { name: 'View savings options', exact: true }),
  ).toHaveCount(0);
  const [before] = await pool.query(
    'SELECT COUNT(*) AS n FROM transactions WHERE run_id=?',
    [original.runId],
  );
  for (const kind of ['checking', 'savings', 'credit'] as const) {
    const account = original.accounts.find((a: any) => a.kind === kind);
    const widget = page.getByRole('link', {
      name: `Open ${account.name}`,
      exact: true,
    });
    await widget.focus();
    await widget.press('Enter');
    await expect(page).toHaveURL(paths[kind]);
    await expect(
      page.getByRole('heading', { name: account.name, exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('account-detail-balance')).toHaveText(
      money(kind === 'credit' ? -account.balanceMinor : account.balanceMinor),
    );
    await expect(
      page.getByTestId('account-detail-balance').locator('..'),
    ).toHaveAttribute('data-clarity-mask', 'true');
    const saved = original.transactions.filter(
      (t: any) => t.accountId === account.id,
    );
    await expect(page.getByTestId('saved-account-activity')).toHaveCount(
      saved.length,
    );
    for (const t of saved)
      await expect(
        page
          .getByTestId('saved-account-activity')
          .filter({ hasText: t.description }),
      ).toBeVisible();
    if (kind !== 'checking')
      await expect(
        page
          .getByTestId('saved-account-activity')
          .filter({ hasText: 'Cove Coffee' }),
      ).toHaveCount(0);
    await expect(page.getByTestId('sample-account-activity')).toHaveCount(
      kind === 'credit' ? 6 : 4,
    );
    await expect(page.getByTestId('promotion-banner')).toHaveCount(0);
    await expect(page.getByTestId('discovery-card')).toHaveCount(0);
    await expect(page.locator('a[href^="/features/"]')).toHaveCount(0);
    const examples = await page
      .getByTestId('sample-account-activity')
      .allTextContents();
    await noOverflow(page);
    await page.screenshot({
      path: `artifacts/account-${kind}-${test.info().project.name}.png`,
      fullPage: true,
    });
    await page.reload();
    await expect(page.getByTestId('sample-account-activity')).toHaveText(
      examples,
    );
    await page
      .getByRole('link', { name: 'Back to Account Summary', exact: true })
      .click();
    await expect(page.getByTestId('promotion-banner')).toHaveAttribute(
      'href',
      banner!,
    );
  }
  const current = await state(page);
  expect(current.accounts).toEqual(original.accounts);
  expect(current.transactions).toEqual(original.transactions);
  expect(current.goals).toEqual(original.goals);
  const [after] = await pool.query(
    'SELECT COUNT(*) AS n FROM transactions WHERE run_id=?',
    [original.runId],
  );
  expect(Number(after.n)).toBe(Number(before.n));
  for (const route of [
    'account-checking',
    'account-savings',
    'account-credit',
  ]) {
    await expect
      .poll(async () =>
        Number(
          (
            await pool.query(
              "SELECT COUNT(*) AS n FROM interaction_events WHERE run_id=? AND name='page_view' AND route_key=?",
              [original.runId, route],
            )
          )[0].n,
        ),
      )
      .toBeGreaterThan(0);
  }
  const observations = await pool.query(
    "SELECT id FROM interaction_events WHERE run_id=? AND name IN ('feature_viewed','feature_cta_clicked')",
    [original.runId],
  );
  expect(observations).toHaveLength(0);
});

test('account direct login and changed balances/activity persist without crossing customers', async ({
  page,
}) => {
  const user = await fixtureUser(pool);
  ids.push(user.id);
  await login(page, user, '/accounts/savings');
  const original = await state(page);
  const post = async (path: string, body: object) =>
    page.evaluate(
      async ({ path, body }) => {
        const s = await (
          await fetch('/api/state', {
            headers: {
              'X-Browser-Session': sessionStorage.getItem('softek_browser')!,
            },
          })
        ).json();
        const response = await fetch('/api' + path, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': s.csrf,
            'X-Browser-Session': sessionStorage.getItem('softek_browser')!,
          },
          body: JSON.stringify(body),
        });
        return { status: response.status, data: await response.json() };
      },
      { path, body },
    );
  expect(
    (await post('/enroll', { requestId: crypto.randomUUID(), accepted: true }))
      .status,
  ).toBe(200);
  const goal = await post('/goals', {
    requestId: crypto.randomUUID(),
    title: 'Owned account test goal',
    targetMinor: 50000,
  });
  expect(goal.status).toBe(201);
  expect(
    (
      await post(`/goals/${goal.data.goalId}/contributions`, {
        requestId: crypto.randomUUID(),
        amountMinor: 10000,
      })
    ).status,
  ).toBe(200);
  for (const kind of ['savings', 'checking'] as const) {
    await page.goto(paths[kind]);
    const account = original.accounts.find((a: any) => a.kind === kind);
    await expect(page.getByTestId('account-detail-balance')).toHaveText(
      money(account.balanceMinor + (kind === 'savings' ? 10000 : -10000)),
    );
    await expect(
      page
        .getByTestId('saved-account-activity')
        .filter({ hasText: 'Savings goal contribution' }),
    ).toHaveCount(1);
  }
  const saved = await state(page);
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await login(page, user, '/accounts/checking');
  expect((await state(page)).accounts).toEqual(saved.accounts);
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  const other = await fixtureUser(pool);
  ids.push(other.id);
  await login(page, other, '/accounts/checking');
  const second = await state(page);
  expect(second.runId).not.toBe(saved.runId);
  expect(
    second.accounts.find((a: any) => a.kind === 'checking').balanceMinor,
  ).toBe(
    original.accounts.find((a: any) => a.kind === 'checking').balanceMinor,
  );
  await expect(
    page
      .getByTestId('saved-account-activity')
      .filter({ hasText: 'Savings goal contribution' }),
  ).toHaveCount(0);
  await page.goto('/accounts/not-an-account');
  await expect(
    page.getByRole('heading', { name: 'Page not found', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Back to Account Summary', exact: true })
    .click();
  await noOverflow(page);
});
