import { z } from 'zod';
import {
  deviceIds,
  browserIds,
  compatibleProfile,
  type ClientProfile,
} from './client-profiles.js';
export const clientFields = {
  device: z.enum(deviceIds),
  browser: z.enum(browserIds),
};
export const defaultClientFields = {
  device: clientFields.device.default('desktop'),
  browser: clientFields.browser.default('chrome'),
};
export function validateClientProfile(
  value: ClientProfile,
  ctx: z.RefinementCtx,
) {
  if (!compatibleProfile(value))
    ctx.addIssue({
      code: 'custom',
      path: ['browser'],
      message: 'Choose a browser supported by this device.',
    });
}
export const clientProfileSchema = z
  .object(clientFields)
  .strict()
  .superRefine(validateClientProfile);
