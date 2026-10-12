import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  request,
  expect,
  type Browser,
  type BrowserContext,
  type APIResponse,
} from '@playwright/test';
import { clientProfileSchema } from '../apps/api/src/browser-profile.js';
import { resolveBrowserProfile } from './lib/browser-profile.js';
import { installAutomationHeaders } from './lib/automation-headers.js';
import '../apps/api/src/config.js';

// Deliberate real collection, distinct from collection-free smoke/tests.
const args = process.argv.slice(2);
const flags = new Map<string, string>();
for (const arg of args) {
  const match = /^--(device|browser|customer)=(.+)$/.exec(arg);
  if (arg === '--collect' && !flags.has('collect'))
    flags.set('collect', 'true');
  else if (match && !flags.has(match[1]!)) flags.set(match[1]!, match[2]!);
  else
    throw new Error(
      'Usage: --collect [--device=ID --browser=ID | --customer=UUID]',
    );
}
if (!flags.has('collect'))
  throw new Error('Use --collect only for an authorized real Clarity pilot.');
if (flags.has('customer') && (flags.has('device') || flags.has('browser')))
  throw new Error('A selected customer uses its saved device and browser.');
const requestedProfile = flags.has('customer')
  ? null
  : clientProfileSchema.parse({
      device: flags.get('device') ?? 'desktop',
      browser: flags.get('browser') ?? 'chrome',
    });
const origin = 'https://demo.bawebtech.com';
const pilotId = `pilot-${randomUUID()}`;
const control = await request.newContext({ baseURL: origin });
let browser: Browser | undefined, context: BrowserContext | undefined;
const evidence: Record<string, unknown>[] = [];
const errors: string[] = [];
let vendorRequests = 0;
let uploads = 0;
const vendorHosts = new Set<string>();
try {
  const login = await control.post(origin + '/api/admin/login', {
    headers: { Origin: origin },
    data: { password: process.env.DEMO_ADMIN_SECRET },
  });
  assert.equal(login.status(), 200);
  const admin = await login.json();
  const status = await (
    await control.get(origin + '/api/admin/clarity')
  ).json();
  assert.equal(
    status.enabled,
    true,
    'Turn collection on in Admin Menu → Clarity Settings first.',
  );
  const selectedId = flags.get('customer');
  const selected = selectedId
    ? (await (await control.get('/api/admin/users')).json()).find(
        (user: any) => user.id === selectedId,
      )
    : null;
  if (
    selectedId &&
    (!selected || !selected.enabled || selected.actor !== 'automation')
  )
    throw new Error('Choose an enabled Automation customer.');
  if (selected && !process.env.PILOT_CUSTOMER_PASSWORD)
    throw new Error(
      'Set PILOT_CUSTOMER_PASSWORD in the private environment for this customer.',
    );
  const profile = clientProfileSchema.parse(
    selected
      ? { device: selected.device, browser: selected.browser }
      : requestedProfile,
  );
  const resolved = resolveBrowserProfile(profile);
  browser = await resolved.launcher.launch();
  context = await browser.newContext({
    ...resolved.contextOptions,
    storageState: await control.storageState(),
  });
  await installAutomationHeaders(
    context,
    origin,
    process.env.AUTOMATION_SECRET!,
    true,
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
    const startedAt = new Date().toISOString();
    const scenario = clicked
      ? 'banner-and-feature-cta-click'
      : 'banner-and-feature-cta-skip';
    const password = selected
      ? process.env.PILOT_CUSTOMER_PASSWORD!
      : randomUUID();
    const username =
      selected?.username ??
      `test.clarity-${randomUUID().slice(0, 10)}@example.com`;
    if (!selected) {
      const created: APIResponse = await context.request.post(
        origin + '/api/admin/users',
        {
          headers: { Origin: origin, 'X-CSRF-Token': admin.csrf },
          data: {
            username,
            password,
            displayName: clicked ? 'Clarity Pilot Click' : 'Clarity Pilot Skip',
            profileId: 'alex',
            variant: 'value',
            eligible: true,
            actor: 'automation',
            ...profile,
          },
        },
      );
      assert.equal(created.status(), 201);
    }
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
    assert.equal(state.analytics.actor, 'automation');
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
    await page.evaluate(
      ({ pilotId, scenario }) => {
        const clarity = (
          window as Window & {
            clarity?: (command: string, ...args: string[]) => void;
          }
        ).clarity;
        if (!clarity) throw new Error('Clarity loader is unavailable.');
        clarity('set', 'pilot_run', pilotId);
        clarity('set', 'pilot_scenario', scenario);
      },
      { pilotId, scenario },
    );
    console.log(`Capturing ${scenario}: ${state.user.id}`);
    await page.mouse.move(100, 180);
    await page.waitForTimeout(10000);
    await page.mouse.wheel(0, 450);
    await page.waitForTimeout(5000);
    await page.mouse.wheel(0, -450);
    await page.waitForTimeout(5000);
    if (clicked) {
      const href = await page
        .getByTestId('promotion-banner')
        .getAttribute('href');
      assert.ok(href, 'Enable a banner before running the pilot.');
      await page.getByTestId('promotion-banner').click();
      await page.waitForURL(origin + href);
    }
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page
      .getByRole('button', { name: 'Explore Features', exact: true })
      .click();
    await page
      .getByRole('link', { name: 'EasyCoin Crypto', exact: true })
      .click();
    await page.waitForTimeout(10000);
    await page.mouse.wheel(0, 350);
    await page.waitForTimeout(5000);
    if (clicked) {
      await page
        .getByRole('button', { name: 'Explore Crypto Investing', exact: true })
        .click();
      await expect(page.getByRole('status')).toBeVisible();
    }
    await page.waitForTimeout(10000);
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page
      .getByRole('link', { name: 'Account Summary', exact: true })
      .click();
    await page.waitForTimeout(10000);
    await expect
      .poll(() => uploads, { timeout: 20000 })
      .toBeGreaterThan(baseline);
    assert.ok(
      (await context.cookies()).some((cookie) => cookie.name === '_clck'),
    );
    evidence.push({
      at: new Date().toISOString(),
      startedAt,
      pilotId,
      scenario,
      userId: state.user.id,
      runId: state.runId,
      visitId: state.visitId,
      actor: state.analytics.actor,
      ...profile,
      preset: resolved.preset,
      engine: resolved.engine,
      viewport: resolved.contextOptions.viewport,
      screen: resolved.contextOptions.screen,
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
        pilotId,
        evidence,
        vendorHosts: [...vendorHosts],
        uploads,
        dashboardRecordingsVerified: false,
        botDetection:
          'owner-reported Off; dashboard inclusion remains unverified',
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    `Real SDK pilot passed: ${evidence.length} labeled journeys, ${uploads} acknowledged collection uploads. Clarity pilot_run: ${pilotId}. Dashboard playback remains unverified. Lookup evidence: artifacts/clarity-pilot.json`,
  );
} finally {
  await context?.close();
  await browser?.close();
  await control.dispose();
}
