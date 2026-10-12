import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import '../apps/api/src/config.js';
import { features } from '../apps/api/src/features.js';
const browser = await chromium.launch();
const errors: string[] = [];
try {
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({
      viewport,
      extraHTTPHeaders: { 'X-Demo-Automation': process.env.AUTOMATION_SECRET! },
    });
    const origin = 'https://demo.bawebtech.com';
    const adminLogin = await context.request.post(origin + '/api/admin/login', {
      headers: { Origin: origin },
      data: { password: process.env.DEMO_ADMIN_SECRET },
    });
    assert.equal(adminLogin.status(), 200);
    const admin = await adminLogin.json();
    const username = `test.public-${randomUUID().slice(0, 10)}@example.com`,
      password = randomUUID();
    const created = await context.request.post(origin + '/api/admin/users', {
      headers: { Origin: origin, 'X-CSRF-Token': admin.csrf },
      data: {
        username,
        password,
        displayName: 'Deployment Check',
        profileId: 'alex',
        variant: 'value',
        eligible: true,
        actor: 'automation',
      },
    });
    assert.equal(created.status(), 201);
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (dialog) => void dialog.accept());
    page.on('request', (r) => {
      if (/https?:\/\/[^/]*clarity\.ms\//.test(r.url()))
        errors.push('Unexpected Clarity request');
    });
    await page.goto(origin + '/');
    await page.screenshot({
      path: `artifacts/live-login-${viewport.width}.png`,
      fullPage: true,
    });
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Account Summary', exact: true })
      .waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `artifacts/live-banking-${viewport.width}.png`,
      fullPage: true,
    });
    const cookies = await context.cookies(),
      userCookie = cookies.find((c) => c.name === 'softek_user');
    assert.ok(
      userCookie?.secure &&
        userCookie.httpOnly &&
        userCookie.sameSite === 'Lax',
    );
    const state = async () =>
      page.evaluate(async () =>
        (
          await fetch('/api/state', {
            headers: {
              'X-Browser-Session': sessionStorage.getItem('softek_browser')!,
            },
          })
        ).json(),
      );
    const initial = await state();
    assert.equal(initial.analytics.enabled, false);
    assert.equal(initial.analytics.actor, 'automation');
    const menu = async (label: string) => {
      await page
        .getByRole('button', { name: 'Open menu', exact: true })
        .click();
      await page.getByRole('link', { name: label, exact: true }).click();
    };
    const banner = page.getByTestId('promotion-banner');
    assert.equal(await banner.getAttribute('href'), '/savings-goals');
    await page.waitForTimeout(1200);
    await banner.click();
    await page.getByRole('link', { name: 'Get started' }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Enable savings goals' }).click();
    await page.waitForURL(origin + '/goals');
    // Enrollment briefly renders Goals before the final route mounts it again.
    // Wait for the destination's acknowledgement so input cannot hit that form.
    await page
      .getByText('Savings goals is ready. Create your first goal below.')
      .waitFor();
    await page.getByLabel('Goal name').fill('Deployment check');
    await page.getByLabel('Target amount ($)').fill('100');
    await page
      .getByRole('button', { name: 'Create goal', exact: true })
      .click();
    await page.getByRole('heading', { name: 'Deployment check' }).waitFor();
    await page.getByLabel('Contribution from checking ($)').fill('10');
    await page.getByRole('button', { name: 'Add contribution' }).click();
    await page.getByText('$10.00 added to your goal.').waitFor();
    await page.reload();
    await page.getByRole('heading', { name: 'Deployment check' }).waitFor();
    await menu('Account Summary');
    assert.equal(await banner.getAttribute('href'), '/savings-goals');
    await page.reload();
    await banner.waitFor();
    assert.equal(await banner.getAttribute('href'), '/bill-pay');
    await banner.click();
    await page.getByRole('button', { name: 'Try bill pay' }).click();
    await page.getByText('Demo action completed.').waitFor();
    await menu('Account Summary');
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await banner.waitFor();
    assert.equal(await banner.getAttribute('href'), '/cards');
    const saved = await state();
    assert.equal(saved.runId, initial.runId);
    assert.equal(saved.user.id, initial.user.id);
    assert.equal(saved.goals[0].currentMinor, 1000);
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page
      .getByRole('button', { name: 'Explore Features', exact: true })
      .click();
    await page
      .getByRole('link', { name: features[0].label, exact: true })
      .click();
    await page
      .getByRole('heading', { name: features[0].headline, exact: true })
      .waitFor();
    assert.equal(await page.getByTestId('promotion-banner').count(), 0);
    await page
      .getByRole('button', { name: features[0].cta, exact: true })
      .click();
    await page
      .getByText(
        `Thanks for exploring ${features[0].name}. This demo does not activate a service or submit an application.`,
      )
      .waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `artifacts/live-feature-${viewport.width}.png`,
      fullPage: true,
    });
    await page.reload();
    await page
      .getByRole('heading', { name: features[0].headline, exact: true })
      .waitFor();
    await menu('Account Summary');
    await banner.waitFor();
    assert.equal(await banner.getAttribute('href'), '/cards');
    const afterFeature = await state();
    assert.equal(afterFeature.runId, saved.runId);
    assert.deepEqual(afterFeature.accounts, saved.accounts);
    assert.deepEqual(afterFeature.goals, saved.goals);
    await expect
      .poll(async () => {
        const response = await context.request.get(
          origin + '/api/admin/interactions?userId=' + saved.user.id,
        );
        assert.equal(response.status(), 200);
        const rows = await response.json();
        return rows.filter(
          (r: { name: string; routeKey: string; runId: string }) =>
            r.name === 'feature_viewed' &&
            r.routeKey === features[0].id &&
            r.runId === saved.runId,
        ).length;
      })
      .toBe(2);
    const observed = await context.request.get(
      origin + '/api/admin/interactions?userId=' + saved.user.id,
    );
    const activity = await observed.json();
    assert.equal(
      activity.filter(
        (r: { name: string; runId: string }) =>
          r.name === 'feature_cta_clicked' && r.runId === saved.runId,
      ).length,
      1,
    );
    await page.goto(origin + '/controls/report');
    await page
      .getByRole('heading', { name: 'Adoption Report', exact: true })
      .waitFor();
    await page
      .locator('.report-filters')
      .getByLabel('Activity')
      .selectOption('automation');
    await page.getByText('Eligible denominator', { exact: true }).waitFor();
    await page
      .getByRole('heading', { name: 'Feature Activity', exact: true })
      .waitFor();
    await menu('Manage Customers');
    await page.getByLabel('Search customers').fill(username);
    await page.locator('.customer-details-link').click();
    await page
      .getByRole('heading', { name: 'Customer Details', exact: true })
      .waitFor();
    await menu('Manage Banners');
    await page
      .getByRole('heading', { name: 'Banner images', exact: true })
      .waitFor();
    await page.screenshot({
      path: `artifacts/live-admin-${viewport.width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByLabel('Admin password').waitFor();
    await page.reload();
    await page.getByLabel('Admin password').waitFor();
    await page.goto(origin + '/');
    await page
      .getByRole('heading', { name: 'Account Summary', exact: true })
      .waitFor();
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page
      .getByRole('button', { name: 'Reset my demo', exact: true })
      .click();
    await page
      .getByRole('heading', { name: 'Account Summary', exact: true })
      .waitFor();
    const reset = await state();
    assert.notEqual(reset.runId, initial.runId);
    assert.equal(reset.user.id, initial.user.id);
    assert.equal(reset.goals.length, 0);
    console.log(
      `Public HTTPS journey passed at ${viewport.width}px: login, persistent user state, rotation, submenu/feature/CTA, separate reporting, reset, no Clarity.`,
    );
    await context.close();
  }
  assert.deepEqual(
    errors,
    [],
    'No browser errors or Clarity requests during smoke checks.',
  );
} finally {
  await browser.close();
}
