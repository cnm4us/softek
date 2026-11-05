import { test, expect, type Page } from '@playwright/test';
import mariadb from 'mariadb';
import sharp from 'sharp';
import { randomUUID, createHash } from 'node:crypto';
import { fixtureUser, cleanUsers } from '../fixtures.js';
import { databaseConfig } from '../../apps/api/src/config.js';
import { RecordingStore } from '../../apps/api/src/recordings.js';

test.use({
  extraHTTPHeaders: { 'X-Demo-Automation': process.env.AUTOMATION_SECRET! },
});
const pool = mariadb.createPool({
  ...databaseConfig('runtime', true),
  connectionLimit: 2,
  timezone: 'Z',
  bigIntAsNumber: true,
});
const users: string[] = [];
test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin !== 'http://127.0.0.1:5173') {
      await route.abort();
      throw new Error('Recording checks must not contact vendors.');
    }
    await route.continue();
  });
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
test.afterAll(async () => {
  await cleanUsers(pool, users);
  await new RecordingStore(pool, true).cleanup(false);
  await pool.end();
});
async function login(page: Page) {
  const user = await fixtureUser(pool);
  users.push(user.id);
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/');
}
async function fits(page: Page) {
  const width = await page.evaluate(() => ({
    page: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(width.content).toBeLessThanOrEqual(width.page);
}

test('recording capability, accessible overlay and logout boundary preserve website banking', async ({
  page,
  context,
}, info) => {
  await login(page);
  await expect(
    page.getByRole('button', { name: /Recording controls:/ }),
  ).toHaveCount(0);
  const messages: { type: string; allowed?: boolean }[] = [];
  await page.exposeFunction(
    'captureTestMessage',
    (message: { type: string; allowed?: boolean }) => messages.push(message),
  );
  await page.addInitScript(() => {
    const w = window as any;
    const documentId = crypto.randomUUID();
    w.__softekCapture = {
      version: 1,
      documentId,
      send: (message: any) => {
        void w.captureTestMessage({
          type: message.type,
          allowed: message.allowed,
        });
        if (message.type === 'start' || message.type === 'stop')
          window.dispatchEvent(
            new CustomEvent('softek-capture-native', {
              detail: {
                type: 'status',
                documentId,
                phase: message.type === 'start' ? 'recording' : 'stopped',
                uploaded: 0,
                error: '',
              },
            }),
          );
      },
    };
  });
  await page.reload();
  const control = page.getByRole('button', {
    name: 'Recording controls: Stopped',
  });
  await expect(control).toBeVisible();
  const bounds = await control.boundingBox(),
    menu = await page
      .getByRole('button', { name: 'Open menu', exact: true })
      .boundingBox();
  expect(bounds!.width).toBe(menu!.width);
  expect(bounds!.height).toBe(menu!.height);
  expect(bounds!.x + bounds!.width).toBeLessThan(menu!.x);
  await fits(page);
  await control.click();
  const dialog = page.getByRole('dialog', { name: 'Screen recording' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  expect(
    await dialog.evaluate((node) => node.contains(document.activeElement)),
  ).toBe(true);
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/recordings') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Record', exact: true }).click();
  const session = await (await response).json();
  await expect(dialog.getByRole('status')).toContainText('Recording');
  await page.screenshot({
    path: `artifacts/recording-controls-${info.project.name}.png`,
  });
  await page.getByRole('button', { name: 'Close recording controls' }).click();
  await expect(
    page.getByRole('button', { name: 'Recording controls: Recording' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Recording controls: Recording' })
    .click();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Stopped');
  await page.keyboard.press('Escape');
  await expect(control).toBeFocused();
  await context.request.post(`/api/recordings/${session.id}/stop`, {
    headers: { Authorization: `Bearer ${session.credential}` },
    data: { phase: 'finish', elapsedMs: 0, slots: 0, reason: 'Stopped' },
  });
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL('/login');
  await expect(
    page.getByRole('button', { name: /Recording controls:/ }),
  ).toHaveCount(0);
  expect(
    messages.some((m) => m.type === 'eligibility' && m.allowed === false),
  ).toBe(true);
  expect(messages.some((m) => m.type === 'stop')).toBe(true);
});

test('admin review shows protected frames, separate timestamps, gaps, playback and deletion', async ({
  page,
  context,
}, info) => {
  await login(page);
  const browser = await page.evaluate(() =>
    sessionStorage.getItem('softek_browser')!,
  );
  const headers = {
    Origin: 'http://127.0.0.1:5173',
    'X-Browser-Session': browser,
  };
  const state = await (
    await context.request.get('/api/state', { headers })
  ).json();
  const started = await context.request.post('/api/recordings', {
    headers: { ...headers, 'X-CSRF-Token': state.csrf },
    data: {
      requestId: randomUUID(),
      documentId: randomUUID(),
      approvalVersion: 'screenshots-v1',
    },
  });
  expect(started.status()).toBe(201);
  const session = await started.json();
  await pool.query(
    'UPDATE screenshot_recordings SET started_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 5 SECOND) WHERE id=?',
    [session.id],
  );
  for (const sequence of [1, 3]) {
    const image = await sharp({
      create: {
        width: 720,
        height: 1000,
        channels: 3,
        background: sequence === 1 ? '#205747' : '#a84d31',
      },
    })
      .jpeg()
      .toBuffer();
    const upload = await context.request.post(
      `/api/recordings/${session.id}/frames`,
      {
        headers: { Authorization: `Bearer ${session.credential}` },
        multipart: {
          image: { name: 'frame.jpg', mimeType: 'image/jpeg', buffer: image },
          metadata: JSON.stringify({
            sequence,
            capturedAt: new Date().toISOString(),
            elapsedMs: sequence * 1000,
            captureMs: 25,
          }),
        },
      },
    );
    expect(upload.status()).toBe(201);
  }
  await context.request.post(`/api/recordings/${session.id}/stop`, {
    headers: { Authorization: `Bearer ${session.credential}` },
    data: { phase: 'finish', elapsedMs: 3500, slots: 3, reason: 'Stopped' },
  });
  expect(
    (
      await context.request.get(`/api/admin/recordings/${session.id}/frames/1`)
    ).status(),
  ).toBe(401);
  await page.goto('/controls');
  await page.getByLabel('Admin password').fill(process.env.DEMO_ADMIN_SECRET!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Admin Home', exact: true }),
  ).toBeVisible();
  await page.goto(`/controls/recordings/${session.id}`);
  await expect(
    page.getByRole('heading', { name: 'Screenshot review' }),
  ).toBeVisible();
  await expect(
    page.getByText('2 received / 3 scheduled slots observed'),
  ).toBeVisible();
  await expect(page.getByText('3.5 s', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Captured on phone', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Received by server', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Captured app screen at 1.0 s' }),
  ).toBeVisible();
  await page
    .getByLabel('Recording timeline', { exact: true })
    .evaluate((node) => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(node, '2000');
      node.dispatchEvent(new Event('input', { bubbles: true }));
    });
  await expect(page.locator('.recording-gap')).toBeVisible();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(
    page.getByRole('img', { name: 'Captured app screen at 3.0 s' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await fits(page);
  await page.screenshot({
    path: `artifacts/recording-review-${info.project.name}.png`,
  });
  await pool.query(
    "UPDATE screenshot_recordings SET state='interrupted',stop_elapsed_ms=NULL,stop_reason='Fixture interruption' WHERE id=?",
    [session.id],
  );
  await page
    .getByRole('button', { name: 'Refresh recording', exact: true })
    .click();
  await expect(
    page.getByText(
      'Capture end time was not confirmed. Additional screenshots may be missing.',
    ),
  ).toBeVisible();
  page.once('dialog', (d) => void d.accept());
  await page
    .getByRole('button', { name: 'Delete recording', exact: true })
    .click();
  await expect(page).toHaveURL('/controls/recordings');
  expect(
    (
      await context.request.get(`/api/admin/recordings/${session.id}/frames/1`)
    ).status(),
  ).toBe(404);
});
