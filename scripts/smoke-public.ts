import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import '../apps/api/src/config.js';
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
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      if (/https?:\/\/[^/]*clarity\.ms\//.test(r.url()))
        errors.push('Unexpected Clarity request');
    });
    await page.goto('https://demo.bawebtech.com/');
    await page.getByRole('button', { name: /Alex Morgan/ }).click();
    await page.getByRole('heading', { name: /Good to see you/ }).waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `artifacts/live-banking-${viewport.width}.png`,
      fullPage: true,
    });
    const cookies = await context.cookies();
    const runCookie = cookies.find((c) => c.name === 'softek_run');
    assert.ok(
      runCookie?.secure && runCookie.httpOnly && runCookie.sameSite === 'Lax',
    );
    const state = await page.evaluate(async () => {
      const r = await fetch('/api/state', {
        headers: {
          'X-Browser-Session': sessionStorage.getItem('softek_browser')!,
        },
      });
      return r.json();
    });
    assert.equal(state.analytics.enabled, false);
    assert.equal(state.analytics.actor, 'automation');
    await page.getByTestId('promotion-banner').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await page
      .getByTestId('promotion-banner')
      .getByRole('link', { name: 'Explore savings goals' })
      .click();
    await page.getByRole('link', { name: 'Get started' }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Enable savings goals' }).click();
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
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page
      .getByRole('link', { name: 'Demo controls', exact: true })
      .click();
    await page
      .getByLabel('Admin password')
      .fill(process.env.DEMO_ADMIN_SECRET!);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Adoption report', exact: true })
      .waitFor();
    await page.getByLabel('Activity').selectOption('automation');
    await page.getByText('Eligible denominator', { exact: true }).waitFor();
    await page.screenshot({
      path: `artifacts/live-report-${viewport.width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByLabel('Admin password').waitFor();
    await page.getByRole('button', { name: 'Reset my demo' }).click();
    await page.getByRole('heading', { name: /Good to see you/ }).waitFor();
    console.log(
      `Public HTTPS journey passed at ${viewport.width}px; secure cookie, persistent goal, report, reset, no Clarity.`,
    );
    await context.close();
  }
  assert.deepEqual(
    errors,
    [],
    'No browser errors or Clarity collection during smoke checks.',
  );
} finally {
  await browser.close();
}
