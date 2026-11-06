import { z } from 'zod';
import { pageGeometrySchema, imageBoundsSchema } from './page-context.js';

const coordinate = z.number().finite().min(-10_000_000).max(10_000_000);
export const captureGeometry = z
  .object({
    route: z
      .string()
      .max(120)
      .regex(/^\/[a-z0-9/-]*$/i),
    width: z.number().positive().max(8192),
    height: z.number().positive().max(8192),
    scale: z.number().min(0.25).max(5),
    offsetX: coordinate,
    offsetY: coordinate,
    scrollX: coordinate,
    scrollY: coordinate,
    container: z.string().regex(/^(document|s[1-9][0-9]{0,2})$/),
    containerX: coordinate,
    containerY: coordinate,
  })
  .strict();
export const captureReasons = [
  'start',
  'route',
  'ui',
  'error',
  'scroll',
  'viewport',
  'content',
] as const;
export const frameContext = z
  .object({
    reason: z.enum(captureReasons),
    geometry: captureGeometry,
    uncertaintyMs: z.number().int().min(0).max(1000),
    unstable: z.boolean(),
    page: z
      .object({
        version: z.literal(1),
        web: pageGeometrySchema,
        image: imageBoundsSchema,
      })
      .strict()
      .optional(),
    surface: z
      .object({
        method: z.literal('window-crop-v1'),
        maskedKeyboard: z.boolean(),
        anchoredPopover: z.boolean(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const interaction = z
  .object({
    sequence: z.number().int().min(1).max(12000),
    elapsedMs: z.number().int().min(0).max(901000),
    kind: z.enum([
      'tap',
      'swipe',
      'scroll',
      'viewport',
      'route',
      'ui',
      'error',
      'content',
    ]),
    geometry: captureGeometry,
    uncertaintyMs: z.number().int().min(0).max(1000),
    x: z.number().min(0).max(1).optional(),
    y: z.number().min(0).max(1).optional(),
    endX: z.number().min(0).max(1).optional(),
    endY: z.number().min(0).max(1).optional(),
    durationMs: z.number().int().min(0).max(60000).optional(),
  })
  .strict()
  .superRefine((e, c) => {
    if (
      ['tap', 'swipe'].includes(e.kind) &&
      (e.x === undefined || e.y === undefined)
    )
      c.addIssue({ code: 'custom', message: 'Gesture coordinates required.' });
    if (
      e.kind === 'swipe' &&
      (e.endX === undefined ||
        e.endY === undefined ||
        e.durationMs === undefined)
    )
      c.addIssue({
        code: 'custom',
        message: 'Swipe endpoint/timing required.',
      });
  });
export const interactionBatch = z
  .object({
    requestId: z.string().uuid(),
    events: z.array(interaction).min(1).max(30),
  })
  .strict();
