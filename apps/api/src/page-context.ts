import { z } from 'zod';
const positive = z.number().finite().min(1).max(10_000_000);
const coordinate = z.number().finite().min(-10_000_000).max(10_000_000);
export const pageGeometrySchema = z
  .object({
    version: z.literal(1),
    visit: z.number().int().min(1).max(10000),
    layout: z.number().int().min(1).max(10000),
    documentWidth: positive,
    documentHeight: positive,
    clientWidth: z.number().min(1).max(8192),
    clientHeight: z.number().min(1).max(8192),
    scrollX: coordinate,
    scrollY: coordinate,
    fontSize: z.number().min(1).max(512),
    lineHeight: z.number().min(1).max(512),
    layer: z.enum(['document', 'overlay', 'selection']),
    top: z.boolean(),
    bottom: z.boolean(),
  })
  .strict();
const rect = z
  .object({
    x: z.number().int().min(0).max(4096),
    y: z.number().int().min(0).max(4096),
    width: z.number().int().min(0).max(4096),
    height: z.number().int().min(0).max(4096),
  })
  .strict();
export const imageBoundsSchema = z
  .object({
    width: z.number().int().min(1).max(1080),
    height: z.number().int().min(1).max(4096),
    valid: rect,
    excluded: z.array(rect).max(2),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      v.width * v.height > 4_000_000 ||
      v.valid.x !== 0 ||
      v.valid.y !== 0 ||
      v.valid.width !== v.width ||
      v.valid.height > v.height ||
      v.excluded.some(
        (r) => r.x + r.width > v.width || r.y + r.height > v.height,
      )
    )
      c.addIssue({ code: 'custom', message: 'Invalid image content bounds' });
    if (v.valid.height === v.height) {
      if (v.excluded.length)
        c.addIssue({ code: 'custom', message: 'Unexpected exclusion' });
    } else {
      const e = v.excluded[0];
      if (
        v.excluded.length !== 1 ||
        e.x !== 0 ||
        e.y !== v.valid.height ||
        e.width !== v.width ||
        e.height !== v.height - v.valid.height
      )
        c.addIssue({ code: 'custom', message: 'Invalid keyboard exclusion' });
    }
  });
