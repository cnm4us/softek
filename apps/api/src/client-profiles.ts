// Pure shared catalog: safe to import in the frontend and the journey runner.
export const deviceIds = ['desktop', 'android', 'iphone', 'ipad'] as const;
export const browserIds = ['chrome', 'edge', 'firefox', 'safari'] as const;
export type Device = (typeof deviceIds)[number];
export type Browser = (typeof browserIds)[number];
export type ClientProfile = { device: Device; browser: Browser };
export const deviceLabels: Record<Device, string> = {
  desktop: 'Desktop',
  android: 'Android phone',
  iphone: 'iPhone',
  ipad: 'iPad',
};
export const browserLabels: Record<Browser, string> = {
  chrome: 'Chrome',
  edge: 'Edge',
  firefox: 'Firefox',
  safari: 'Safari',
};
export function browsersFor(device: Device): readonly Browser[] {
  return device === 'desktop'
    ? browserIds
    : device === 'android'
      ? ['chrome']
      : ['safari'];
}
export function compatibleProfile(profile: ClientProfile) {
  return browsersFor(profile.device).includes(profile.browser);
}
export function presetName(profile: ClientProfile) {
  if (!compatibleProfile(profile))
    throw new Error('Unsupported device/browser combination.');
  return profile.device === 'desktop'
    ? `Desktop ${browserLabels[profile.browser]}`
    : profile.device === 'android'
      ? 'Pixel 9'
      : profile.device === 'iphone'
        ? 'iPhone 17'
        : 'iPad Pro 11';
}
