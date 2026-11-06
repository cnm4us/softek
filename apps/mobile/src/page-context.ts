export type PixelRect = { x: number; y: number; width: number; height: number };
export type ImageBounds = {
  width: number;
  height: number;
  valid: PixelRect;
  excluded: PixelRect[];
};
export type PageGeometry = {
  version: 1;
  visit: number;
  layout: number;
  documentWidth: number;
  documentHeight: number;
  clientWidth: number;
  clientHeight: number;
  scrollX: number;
  scrollY: number;
  fontSize: number;
  lineHeight: number;
  layer: 'document' | 'overlay' | 'selection';
  top: boolean;
  bottom: boolean;
};
function object(v: unknown, keys: string[]): v is Record<string, unknown> {
  return (
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.keys(v).length === keys.length &&
    Object.keys(v).every((k) => keys.includes(k))
  );
}
const finite = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
export function pageGeometry(value: unknown): PageGeometry | null {
  const keys = [
    'version',
    'visit',
    'layout',
    'documentWidth',
    'documentHeight',
    'clientWidth',
    'clientHeight',
    'scrollX',
    'scrollY',
    'fontSize',
    'lineHeight',
    'layer',
    'top',
    'bottom',
  ];
  if (
    !object(value, keys) ||
    value.version !== 1 ||
    !['document', 'overlay', 'selection'].includes(String(value.layer)) ||
    typeof value.top !== 'boolean' ||
    typeof value.bottom !== 'boolean'
  )
    return null;
  for (const key of ['visit', 'layout'])
    if (!Number.isSafeInteger(value[key]) || !finite(value[key], 1, 10000))
      return null;
  for (const key of ['documentWidth', 'documentHeight'])
    if (!finite(value[key], 1, 10_000_000)) return null;
  for (const key of ['clientWidth', 'clientHeight'])
    if (!finite(value[key], 1, 8192)) return null;
  for (const key of ['scrollX', 'scrollY'])
    if (!finite(value[key], -10_000_000, 10_000_000)) return null;
  for (const key of ['fontSize', 'lineHeight'])
    if (!finite(value[key], 1, 512)) return null;
  return value as unknown as PageGeometry;
}
export function imageBounds(value: unknown): ImageBounds | null {
  if (
    !object(value, ['width', 'height', 'valid', 'excluded']) ||
    !Number.isSafeInteger(value.width) ||
    !Number.isSafeInteger(value.height) ||
    !finite(value.width, 1, 1080) ||
    !finite(value.height, 1, 4096) ||
    Number(value.width) * Number(value.height) > 4_000_000 ||
    !Array.isArray(value.excluded) ||
    value.excluded.length > 2
  )
    return null;
  const rectangle = (r: unknown) =>
    object(r, ['x', 'y', 'width', 'height']) &&
    Object.values(r).every(
      (v) => Number.isSafeInteger(v) && finite(v, 0, 4096),
    ) &&
    Number(r.x) + Number(r.width) <= Number(value.width) &&
    Number(r.y) + Number(r.height) <= Number(value.height);
  if (!rectangle(value.valid) || !value.excluded.every(rectangle)) return null;
  const valid = value.valid as PixelRect;
  // Current native renderer has one full-width clip above a bottom keyboard mask.
  if (valid.x !== 0 || valid.y !== 0 || valid.width !== value.width)
    return null;
  if (valid.height === value.height && value.excluded.length !== 0) return null;
  if (valid.height !== value.height) {
    const e = value.excluded[0] as PixelRect;
    if (
      value.excluded.length !== 1 ||
      e.x !== 0 ||
      e.y !== valid.height ||
      e.width !== value.width ||
      e.height !== Number(value.height) - valid.height
    )
      return null;
  }
  return value as unknown as ImageBounds;
}
