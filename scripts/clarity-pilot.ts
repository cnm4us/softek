import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import '../apps/api/src/config.js';

// Deliberate real collection, distinct from collection-free smoke/tests.
if (process.argv.slice(2).join(' ') !== '--collect')
  throw new Error('Use --collect only for an authorized real Clarity pilot.');
const origin = 'https://demo.bawebtech.com';
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 360, height: 800 },
  extraHTTPHeaders: {
    'X-Demo-Automation': process.env.AUTOMATION_SECRET!,
    'X-Demo-Capture': process.env.AUTOMATION_SECRET!,
  },
});
const evidence: Record<string, unknown>[] = [];
const errors: string[] = [];
let vendorRequests = 0;
let uploads = 0;
const vendorHosts = new Set<string>();
try {
  const login = await context.request.post(origin + '/api/admin/login', {
    headers: { Origin: origin },
    data: { password: process.env.DEMO_ADMIN_SECRET },
  });
  assert.equal(login.status(), 200);
  const admin = await login.json();
  const status = await (
    await context.request.get(origin + '/api/admin/clarity')
  ).json();
  assert.equal(
    status.enabled,
    true,
    'Turn collection on in Admin Menu → Clarity Settings first.',
  );
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /content security policy|violates.*directive/i.test(message.text())
    )
      errors.push('Browser reported a CSP violation.');
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.hostname.endsWith('.clarity.ms') || url.hostname === 'c.bing.com') {
      vendorRequests++;
      vendorHosts.add(url.hostname);
    }
  });
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (
      url.hostname.endsWith('.clarity.ms') &&
      url.pathname === '/collect' &&
      response.ok()
    )
      uploads++;
  });
  for (const clicked of [true, false]) {
    const password = randomUUID();
    const username = `test.clarity-${randomUUID().slice(0, 10)}@example.com`;
    const created = await context.request.post(origin + '/api/admin/users', {
      headers: { Origin: origin, 'X-CSRF-Token': admin.csrf },
      data: {
        username,
        password,
        displayName: 'Clarity Pilot',
        profileId: 'alex',
        variant: 'value',
        eligible: true,
        actor: 'automation',
      },
    });
    assert.equal(created.status(), 201);
    await page.goto(origin + '/');
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Account Summary', exact: true }),
    ).toBeVisible();
    const state = await page.evaluate(async () =>
      (
        await fetch('/api/state', {
          headers: {
            'X-Browser-Session': sessionStorage.getItem('softek_browser')!,
          },
        })
      ).json(),
    );
    assert.equal(state.analytics.enabled, true);
    const before = vendorRequests;
    await page
      .getByRole('button', { name: 'Keep analytics off', exact: true })
      .click();
    await page.waitForTimeout(1200);
    assert.equal(vendorRequests, before, 'Decline must not contact Clarity.');
    const baseline = uploads;
    await page
      .getByRole('button', { name: 'Allow analytics', exact: true })
      .click();
    await expect
      .poll(() => vendorRequests, { timeout: 15000 })
      .toBeGreaterThan(before);
    await page.waitForTimeout(1500);
    if (clicked) {
      await page.getByTestId('promotion-banner').click();
      await page
        .getByRole('heading', { name: 'Savings Goals', exact: true })
        .waitFor();
    }
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page
      .getByRole('button', { name: 'Explore Features', exact: true })
      .click();
    await page
      .getByRole('link', { name: 'EasyCoin Crypto', exact: true })
      .click();
    if (clicked) {
      await page
        .getByRole('button', { name: 'Explore Crypto Investing', exact: true })
        .click();
      await expect(page.getByRole('status')).toBeVisible();
    }
    await page.waitForTimeout(3000);
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page
      .getByRole('link', { name: 'Account Summary', exact: true })
      .click();
    await expect
      .poll(() => uploads, { timeout: 20000 })
      .toBeGreaterThan(baseline);
    assert.ok(
      (await context.cookies()).some((cookie) => cookie.name === '_clck'),
    );
    evidence.push({
      at: new Date().toISOString(),
      scenario: clicked
        ? 'banner-and-feature-cta-click'
        : 'banner-and-feature-cta-skip',
      userId: state.user.id,
      runId: state.runId,
      visitId: state.visitId,
      actor: state.analytics.actor,
      acknowledgedUploads: uploads - baseline,
    });
    await page
      .getByRole('button', { name: 'Turn off analytics', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Allow analytics', exact: true }),
    ).toBeVisible();
    assert.equal(
      (await context.cookies()).filter((cookie) =>
        ['_clck', '_clsk'].includes(cookie.name),
      ).length,
      0,
    );
    const stopped = vendorRequests;
    await page.waitForTimeout(1500);
    assert.equal(
      vendorRequests,
      stopped,
      'Withdrawal must stop vendor traffic.',
    );
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  }
  await page.goto(origin + '/controls/clarity');
  await expect(
    page.getByRole('heading', { name: 'Clarity Settings', exact: true }),
  ).toBeVisible();
  const stopped = vendorRequests;
  await page.waitForTimeout(1500);
  assert.equal(vendorRequests, stopped, 'Admin pages must not collect.');
  await page.screenshot({
    path: 'artifacts/live-clarity-settings.png',
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  mkdirSync('artifacts', { recursive: true });
  writeFileSync(
    'artifacts/clarity-pilot.json',
    JSON.stringify(
      {
        projectId: status.projectId,
        evidence,
        vendorHosts: [...vendorHosts],
        uploads,
        dashboardRecordingsVerified: false,
        botDetection: 'owner-reported On; synthetic activity may be filtered',
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    `Real SDK pilot passed: ${evidence.length} labeled journeys, ${uploads} acknowledged collection uploads. Dashboard playback remains unverified. Lookup evidence: artifacts/clarity-pilot.json`,
  );
} finally {
  await context.close();
  await browser.close();
}
