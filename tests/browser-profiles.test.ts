import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deviceIds, browsersFor } from '../apps/api/src/client-profiles.js';
import { resolveBrowserProfile } from '../scripts/lib/browser-profile.js';
import { installAutomationHeaders } from '../scripts/lib/automation-headers.js';

test('all supported profiles launch matching engines and emulate identity, screen and input without network collection', async (t) => {
  for (const device of deviceIds)
    for (const browser of browsersFor(device))
      await t.test(`${device}/${browser}`, async () => {
        const resolved = resolveBrowserProfile({ device, browser });
        assert.equal(
          resolved.engine,
          browser === 'firefox'
            ? 'firefox'
            : browser === 'safari'
              ? 'webkit'
              : 'chromium',
        );
        const instance = await resolved.launcher.launch();
        try {
          const context = await instance.newContext(resolved.contextOptions);
          await context.route('**/*', (route) =>
            route.request().url() === 'https://profile.test/'
              ? route.fulfill({
                  contentType: 'text/html',
                  body: '<meta name="viewport" content="width=device-width,initial-scale=1"><button ontouchstart="this.dataset.touched=\'yes\'" onclick="this.textContent=\'done\'">Run</button>',
                })
              : route.abort(),
          );
          const page = await context.newPage();
          await page.goto('https://profile.test/');
          const actual = await page.evaluate(() => ({
            ua: navigator.userAgent,
            width: innerWidth,
            screenWidth: screen.width,
            density: devicePixelRatio,
            touch: navigator.maxTouchPoints,
          }));
          assert.equal(actual.ua, resolved.contextOptions.userAgent);
          assert.equal(actual.width, resolved.contextOptions.viewport!.width);
          assert.equal(
            actual.screenWidth,
            resolved.contextOptions.screen!.width,
          );
          assert.equal(
            actual.density,
            resolved.contextOptions.deviceScaleFactor,
          );
          if (resolved.contextOptions.hasTouch) {
            await page.getByRole('button').tap();
            assert.equal(
              await page.getByRole('button').getAttribute('data-touched'),
              'yes',
            );
          } else await page.getByRole('button').click();
          assert.equal(await page.getByRole('button').innerText(), 'done');
          await context.close();
        } finally {
          await instance.close();
        }
      });
});

test('private automation and capture headers reach only the application origin', async () => {
  const instance = await resolveBrowserProfile({
    device: 'desktop',
    browser: 'chrome',
  }).launcher.launch();
  try {
    const context = await instance.newContext();
    const seen: { url: string; headers: Record<string, string> }[] = [];
    await context.route('**/*', async (route) => {
      seen.push({
        url: route.request().url(),
        headers: route.request().headers(),
      });
      await route.fulfill({
        contentType: 'text/html',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: '<html></html>',
      });
    });
    await installAutomationHeaders(
      context,
      'https://demo.test',
      'fixture-only-secret',
      true,
    );
    const page = await context.newPage();
    await page.goto('https://demo.test/');
    await page.evaluate(async () => {
      await fetch('/api/state');
      await fetch('https://vendor.test/sdk');
    });
    const own = seen.find((r) => r.url === 'https://demo.test/api/state')!;
    const vendor = seen.find((r) => r.url === 'https://vendor.test/sdk')!;
    assert.equal(own.headers['x-demo-automation'], 'fixture-only-secret');
    assert.equal(own.headers['x-demo-capture'], 'fixture-only-secret');
    assert.equal(vendor.headers['x-demo-automation'], undefined);
    assert.equal(vendor.headers['x-demo-capture'], undefined);
    await context.close();
  } finally {
    await instance.close();
  }
});
