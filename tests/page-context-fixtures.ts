export const pageWeb = {
  version: 1 as const,
  visit: 1,
  layout: 1,
  documentWidth: 440,
  documentHeight: 2000,
  clientWidth: 440,
  clientHeight: 812,
  scrollX: 0,
  scrollY: 0,
  fontSize: 16,
  lineHeight: 24,
  layer: 'document' as const,
  top: true,
  bottom: false,
};
export const pageBounds = {
  width: 720,
  height: 1100,
  valid: { x: 0, y: 0, width: 720, height: 700 },
  excluded: [{ x: 0, y: 700, width: 720, height: 400 }],
};
