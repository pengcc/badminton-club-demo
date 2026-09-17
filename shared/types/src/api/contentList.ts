import { z } from 'zod';

export const contentListLanguageSchema = z.enum(['de', 'en', 'zh']);

const localizedListQueryShape = {
  language: contentListLanguageSchema.default('en'),
};

export const publicActivityListQuerySchema = z
  .object({
    ...localizedListQueryShape,
    visibleOnly: z.literal('true').default('true'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(6),
  })
  .strict();

export const publicActiveContentListQuerySchema = z
  .object({
    ...localizedListQueryShape,
    activeOnly: z.literal('true').default('true'),
  })
  .strict();

export const administrationContentListQuerySchema = z
  .object(localizedListQueryShape)
  .strict();

export type PublicActivityListQuery = z.output<
  typeof publicActivityListQuerySchema
>;
export type PublicActiveContentListQuery = z.output<
  typeof publicActiveContentListQuerySchema
>;
export type AdministrationContentListQuery = z.output<
  typeof administrationContentListQuerySchema
>;
