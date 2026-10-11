import { z } from 'zod';

// Scenario definitions contain public controls/timing, never login credentials.
// Plan 002's pilot will execute this contract; scheduling/UI belongs to Plan 003.
export const journeyScenario = z
  .object({
    name: z.string().min(1).max(80),
    userAlias: z.string().regex(/^[a-z0-9._-]{3,40}$/),
    viewport: z
      .object({
        width: z.number().int().min(320).max(1920),
        height: z.number().int().min(480).max(1200),
      })
      .strict(),
    steps: z
      .array(
        z.discriminatedUnion('kind', [
          z
            .object({
              kind: z.literal('wait'),
              milliseconds: z.number().int().min(0).max(120000),
            })
            .strict(),
          z
            .object({
              kind: z.literal('banner'),
              choice: z.enum(['click', 'skip']),
            })
            .strict(),
          z
            .object({
              kind: z.literal('action'),
              choice: z.enum(['click', 'skip']),
            })
            .strict(),
          z
            .object({
              kind: z.literal('menu'),
              section: z.enum([
                'summary',
                'transfers',
                'bill-pay',
                'cards',
                'goals',
                'statements',
                'support',
              ]),
            })
            .strict(),
        ]),
      )
      .min(1)
      .max(40),
  })
  .strict();
export type JourneyScenario = z.infer<typeof journeyScenario>;
