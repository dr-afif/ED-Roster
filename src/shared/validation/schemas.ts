import { z } from 'zod';

export const operationIdSchema = z.uuid({
  message: 'Operation ID must be a valid UUID.',
});

export const entityRevisionSchema = z
  .number()
  .int('Revision must be an integer.')
  .nonnegative('Revision cannot be negative.');

export const isoCalendarDateSchema = z.iso.date({
  message: 'Date must use YYYY-MM-DD calendar format.',
});

export const rosterRouteParamsSchema = z.object({
  yyyy: z.string().regex(/^\d{4}$/, 'Year must be four digits (YYYY).'),
  mm: z.string().regex(/^(0[1-9]|1[0-2])$/, 'Month must be two digits between 01 and 12.'),
});
