import { z } from 'zod';
import { Language } from '../core/enums';
import {
  createLocalizedTextSchema,
  getLocalizedTextCompleteness,
  resolveLocalizedText,
  type LocalizedText,
} from './localizedContent';

export const publicDocumentIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid Public Document ID');

const publicDocumentContentSchema = z.object({
  displayName: createLocalizedTextSchema({
    maxLength: 200,
    germanRequired: true,
  }),
  documentDate: z.iso.date(),
  isVisible: z.boolean().default(true),
});

export const publicDocumentCreateValuesSchema =
  publicDocumentContentSchema.strict();
export const publicDocumentUpdateValuesSchema =
  publicDocumentContentSchema.extend({
    retainedFile: z.string().trim().max(1000).default(''),
  });
export const publicDocumentCreateMutationSchema = z.object({
  document: publicDocumentCreateValuesSchema,
});
export const publicDocumentUpdateMutationSchema = z.object({
  document: publicDocumentUpdateValuesSchema,
});
export const publicDocumentReorderSchema = z.object({
  ids: z.array(publicDocumentIdSchema),
});

export type PublicDocumentCreateValues = z.infer<
  typeof publicDocumentCreateValuesSchema
>;
export type PublicDocumentUpdateValues = z.infer<
  typeof publicDocumentUpdateValuesSchema
>;

export function resolvePublicDocumentName(
  displayName: LocalizedText,
  language: Language
) {
  return resolveLocalizedText(displayName, language);
}

export function getPublicDocumentCompleteness(displayName: LocalizedText) {
  return getLocalizedTextCompleteness(displayName);
}
