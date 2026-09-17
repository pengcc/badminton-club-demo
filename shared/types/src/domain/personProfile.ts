import { z } from 'zod';

const GERMANY_COUNTRY_VALUES = new Set(['de', 'deutschland', 'germany']);

export const personNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(50, 'Name must be less than 50 characters');

export function isRealNonFutureDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return false;
  }
  const today = new Date();
  return (
    parsed.getTime() <=
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  );
}

export const personDateOfBirthSchema = z
  .string()
  .refine(isRealNonFutureDate, 'Date of birth must be a real non-future date');

const phoneTextSchema = z
  .string()
  .trim()
  .max(40)
  .regex(/^\+?[\d\s()./-]+$/, 'Invalid phone number');

export const optionalPersonPhoneSchema = z
  .union([phoneTextSchema, z.literal('')])
  .optional()
  .transform((value) => value || undefined);

export const germanAddressSchema = z
  .object({
    street: z.string().trim().min(1).max(120),
    city: z.string().trim().min(1).max(80),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{5}$/),
    country: z.string().trim().min(1).max(80).optional().default('Deutschland'),
  })
  .refine(
    (address) => GERMANY_COUNTRY_VALUES.has(address.country.toLowerCase()),
    { path: ['country'], message: 'Address must be in Germany' }
  )
  .transform((address) => ({ ...address, country: 'Deutschland' }));

export type GermanAddress = z.output<typeof germanAddressSchema>;
