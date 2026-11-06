import { test, expect, type Page } from '@playwright/test';
import mariadb from 'mariadb';
import sharp from 'sharp';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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

test('change observer is idle between changes, excludes input text and stops collecting on Stop', async ({
  page,
}) => {
  const messages: Record<string, any>[] = [];
  await page.exposeFunction('changeCaptureTest', (m: Record<string, any>) =>
    messages.push(m),
  );
  await page.addInitScript(() => {
    const w = window as any,
      id = crypto.randomUUID();
    let session: any = null;
    const deliver = (message: any) =>
      window.dispatchEvent(
        new CustomEvent('softek-capture-native', {
          detail: { ...message, documentId: id },
        }),
      );
    w.__softekCapture = {
      version: 1,
      capabilities: ['changes-v2'],
      documentId: id,
      send: (m: any) => {
        void w.changeCaptureTest({
          type: m.type,
          kind: m.kind,
          capture: m.capture,
          geometry: m.geometry,
          webNow: m.webNow,
          recordingId: m.recordingId,
        });
        if (m.type === 'start') {
          session = m;
          deliver({ type: 'clock', requestId: 'fixture-clock' });
          deliver({ type: 'observe', active: true });
          deliver({ type: 'status', phase: 'recording', uploaded: 0 });
        } else if (m.type === 'stop') {
          deliver({ type: 'observe', active: false });
          if (session)
            void fetch(`/api/recordings/${session.recordingId}/stop`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.credential}`,
              },
              body: JSON.stringify({
                phase: 'finish',
                elapsedMs: 10000,
                slots: 0,
                reason: 'Stopped',
                events: 0,
              }),
            }).then(() =>
              deliver({ type: 'status', phase: 'stopped', uploaded: 0 }),
            );
        }
      },
    };
  });
  await login(page);
  await page
    .getByRole('button', { name: 'Recording controls: Stopped' })
    .click();
  await expect(page.getByText(/when the page changes/)).toBeVisible();
  await page.getByRole('button', { name: 'Record', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Stop', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Close recording controls' }).click();
  await page.waitForTimeout(600);
  const captures = () =>
    messages.filter((m) => m.type === 'interaction' && m.capture === true)
      .length;
  const idle = captures();
  await page.waitForTimeout(1100);
  expect(captures()).toBe(idle);
  expect(messages.some((m) => m.type === 'clock-reply' && m.webNow > 0)).toBe(
    true,
  );
  expect(
    messages.find((m) => m.type === 'clock-reply')?.geometry.container,
  ).not.toBe('document');
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await expect.poll(captures).toBeGreaterThan(idle);
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect
    .poll(() => messages.some((m) => m.kind === 'scroll' && m.capture === true))
    .toBe(true);
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'capture-test-input';
    document.getElementById('main')!.append(input);
    input.value = 'fictional-private-form-value';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(600);
  expect(
    JSON.stringify(messages.filter((m) => m.type === 'interaction')),
  ).not.toContain('fictional-private-form-value');
  await page
    .getByRole('button', { name: 'Recording controls: Recording' })
    .click();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Record', exact: true }),
  ).toBeEnabled();
  const stopped = messages.filter((m) => m.type === 'interaction').length;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  expect(messages.filter((m) => m.type === 'interaction').length).toBe(stopped);
  await fits(page);
});

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
  const replayFolder = join(
    new RecordingStore(pool, true).directory,
    session.id,
    'replay',
  );
  await mkdir(replayFolder, { mode: 0o750 });
  execFileSync('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'color=c=0x205747:s=720x1100:r=12',
    '-frames:v',
    '12',
    '-c:v',
    'libx264',
    '-threads',
    '2',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    join(replayFolder, 'sample.mp4'),
  ]);
  const video = await readFile(join(replayFolder, 'sample.mp4'));
  for (const name of ['sample.mp4', 'full.mp4'])
    await writeFile(join(replayFolder, name), video, { mode: 0o640 });
  await writeFile(
    join(replayFolder, 'canvas-preview.png'),
    await sharp({
      create: { width: 720, height: 1600, channels: 3, background: '#f5f6f1' },
    })
      .png()
      .toBuffer(),
    { mode: 0o640 },
  );
  for (let i = 1; i <= 2; i++) {
    const folder = join(replayFolder, 'canvas', `page-${i}`);
    await mkdir(folder, { recursive: true, mode: 0o750 });
    await writeFile(
      join(folder, 'preview.png'),
      await sharp({
        create: {
          width: i === 1 ? 720 : 600,
          height: 1600,
          channels: 3,
          background: '#f5f6f1',
        },
      })
        .png()
        .toBuffer(),
      { mode: 0o640 },
    );
  }
  await pool.query(
    "UPDATE screenshot_replay_jobs SET state='failed',attempts=3 WHERE recording_id=?",
    [session.id],
  );
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
    page.getByRole('heading', { name: 'Animated replay experiment' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Video generation failed. Your screenshots are still available below.',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry video', exact: true }).click();
  await expect(
    page.getByText(
      'Video queued. It will appear here automatically when ready.',
    ),
  ).toBeVisible();
  await pool.query(
    "UPDATE screenshot_replay_jobs SET state='rendering' WHERE recording_id=?",
    [session.id],
  );
  await expect(
    page.getByText('Generating video… This page updates automatically.'),
  ).toBeVisible({ timeout: 10000 });
  await writeFile(
    join(replayFolder, 'report.json'),
    JSON.stringify({
      version: 1,
      sample: { durationMs: 1000 },
      full: { durationMs: 1000, fps: 30 },
      reconstructedIntervals: 1,
      sessionReference: {
        enabled: true,
        preview: { page: 0, route: '/goals', truncated: false },
        references: [
          { page: 0, route: '/goals', truncated: false },
          { page: 1, route: '/', truncated: false },
        ],
        pages: 1,
        patchCount: 4,
        storedBytes: 1000,
      },
    }),
    { mode: 0o640 },
  );
  await pool.query(
    "UPDATE screenshot_replay_jobs SET state='ready' WHERE recording_id=?",
    [session.id],
  );
  await expect(page.locator('#replay-sample')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Video output: 30 fps/)).toBeVisible();
  await page.getByText('Page reference (partial)', { exact: true }).click();
  const referenceImage = page.getByRole('img', {
    name: 'Partial session page reference for /goals',
    exact: true,
  });
  await expect(referenceImage).toBeVisible();
  await expect
    .poll(() =>
      referenceImage.evaluate((el: HTMLImageElement) => el.naturalWidth),
    )
    .toBe(720);
  await page.getByLabel('Page reference', { exact: true }).selectOption('1');
  const otherReference = page.getByRole('img', {
    name: 'Partial session page reference for /',
    exact: true,
  });
  await expect
    .poll(() =>
      otherReference.evaluate((el: HTMLImageElement) => el.naturalWidth),
    )
    .toBe(600);
  await page.getByLabel('Page reference', { exact: true }).selectOption('0');
  await fits(page);
  const sampleVideo = page.locator('#replay-sample');
  await expect
    .poll(() => sampleVideo.evaluate((el: HTMLVideoElement) => el.readyState))
    .toBeGreaterThanOrEqual(1);
  expect(
    await sampleVideo.evaluate((el: HTMLVideoElement) => el.videoWidth),
  ).toBe(720);
  await sampleVideo.evaluate((el: HTMLVideoElement) => {
    el.currentTime = 0.5;
  });
  await expect
    .poll(() => sampleVideo.evaluate((el: HTMLVideoElement) => el.currentTime))
    .toBeCloseTo(0.5, 1);
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
  expect(
    (
      await context.request.get(
        `/api/admin/recordings/${session.id}/replay/sample.mp4`,
      )
    ).status(),
  ).toBe(404);
});

for (const canvas of [false, true])
  test(`native tooltip coverage is opt-in${canvas ? ' with page context' : ''}, approval is explicit and selection locks during recording`, async ({
    page,
    context,
  }) => {
    await page.addInitScript((canvas) => {
      const w = window as any,
        id = crypto.randomUUID();
      w.__chosenMethod = null;
      w.__softekCapture = {
        version: 1,
        capabilities: [
          'changes-v2',
          'window-crop-v1',
          ...(canvas ? ['page-context-v1'] : []),
        ],
        documentId: id,
        send: (m: any) => {
          if (m.type === 'clock-reply') w.__pageGeometry = m.page;
          if (m.type === 'start' || m.type === 'stop') {
            if (m.type === 'start') w.__chosenMethod = m.captureMethod;
            window.dispatchEvent(
              new CustomEvent('softek-capture-native', {
                detail: {
                  type: 'status',
                  documentId: id,
                  phase: m.type === 'start' ? 'recording' : 'stopped',
                  uploaded: 0,
                  error: '',
                },
              }),
            );
          }
        },
      };
    }, canvas);
    await login(page);
    if (canvas) {
      const read = () =>
        page.evaluate(() => {
          const w = window as any;
          window.dispatchEvent(
            new CustomEvent('softek-capture-native', {
              detail: {
                type: 'clock',
                requestId: 'fixture',
                documentId: w.__softekCapture.documentId,
              },
            }),
          );
          return w.__pageGeometry;
        });
      const top = await read();
      expect(top.version).toBe(1);
      expect(top.top).toBe(true);
      expect(top.layer).toBe('document');
      await page.evaluate(() => {
        const first = document.querySelector('#main > *') as HTMLElement;
        first.style.position = 'relative';
        first.style.top = '1px';
      });
      const moved = await read();
      expect(moved.layout).toBeGreaterThan(top.layout);
      await page.evaluate(() => {
        const first = document.querySelector('#main > *') as HTMLElement;
        first.style.position = '';
        first.style.top = '';
      });

      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      const bottom = await read();
      expect(bottom.bottom).toBe(true);
      expect(bottom.documentHeight).toBeGreaterThanOrEqual(bottom.clientHeight);
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.body.style.fontSize = '20px';
      });
      const changed = await read();
      expect(changed.fontSize).toBe(20);
      expect(changed.layout).toBeGreaterThan(top.layout);
      await page.evaluate(() => (document.body.style.fontSize = ''));
    }
    await page
      .getByRole('button', { name: 'Recording controls: Stopped' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Screen recording' }),
      coverage = dialog.getByLabel('Capture coverage');
    await expect(coverage).toHaveValue('view-v1');
    await coverage.selectOption('window-crop-v1');
    await expect(dialog).toContainText('keyboard area is left blank');
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/recordings') && r.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Record', exact: true }).click();
    const created = await response;
    expect(created.request().postDataJSON().approvalVersion).toBe(
      canvas ? 'screenshots-window-canvas-v1' : 'screenshots-window-v1',
    );
    const session = await created.json();
    if (canvas) expect(session.pageContextVersion).toBe(1);
    await expect(coverage).toBeDisabled();
    expect(await page.evaluate(() => (window as any).__chosenMethod)).toBe(
      'window-crop-v1',
    );
    await fits(page);
    await dialog.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(coverage).toBeEnabled();
    await context.request.post(`/api/recordings/${session.id}/stop`, {
      headers: { Authorization: `Bearer ${session.credential}` },
      data: { phase: 'finish', elapsedMs: 0, slots: 0, reason: 'Stopped' },
    });
  });
