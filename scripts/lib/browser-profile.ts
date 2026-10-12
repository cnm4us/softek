import {
  chromium,
  firefox,
  webkit,
  devices,
  type BrowserContextOptions,
} from '@playwright/test';
import {
  presetName,
  type ClientProfile,
} from '../../apps/api/src/client-profiles.js';
export function resolveBrowserProfile(profile: ClientProfile) {
  const name = presetName(profile);
  const preset = devices[name];
  if (!preset) throw new Error(`Playwright device preset unavailable: ${name}`);
  const { defaultBrowserType, ...rawOptions } = preset;
  const options: BrowserContextOptions = rawOptions;
  // Always set a physical-screen size as well as a viewport, including tablets.
  const contextOptions: BrowserContextOptions = {
    ...options,
    screen: options.screen ?? options.viewport ?? undefined,
  };
  return {
    preset: name,
    engine: defaultBrowserType,
    launcher: { chromium, firefox, webkit }[defaultBrowserType],
    contextOptions,
  };
}
