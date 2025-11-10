import { z } from 'zod';

/**
 * Base transformer class with common utility methods
 */
export class BaseTransformer {
  protected static toDate(date: Date | string | undefined): string | undefined {
    if (!date) return undefined;
    return new Date(date).toISOString();
  }

  protected static fromDate(dateStr: string | undefined): Date | undefined {
    if (!dateStr) return undefined;
    return new Date(dateStr);
  }

  protected static validate<T>(value: T, schema: z.ZodSchema<T>): T {
    return schema.parse(value);
  }
}