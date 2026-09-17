import { z } from 'zod';
import { Language } from '../core/enums';
import {
  createLocalizedTextSchema,
  getLocalizedTextCompleteness,
  resolveLocalizedText,
  type LocalizedText,
  type LocalizedTextCompleteness,
} from './localizedContent';

const activityTranslationSchema = z.object({
  name: z.string().trim().max(200),
  description: z.string().trim().max(5000),
});

export const activityTranslationsSchema = z
  .object({
    [Language.GERMAN]: activityTranslationSchema,
    [Language.ENGLISH]: activityTranslationSchema,
    [Language.CHINESE]: activityTranslationSchema,
  })
  .superRefine((translations, context) => {
    if (!translations[Language.GERMAN].name) {
      context.addIssue({
        code: 'custom',
        path: [Language.GERMAN, 'name'],
        message: 'German activity name is required',
      });
    }
  });

export const activityMutationValuesSchema = z.object({
  translations: activityTranslationsSchema,
  retainedImages: z
    .array(z.string().trim().min(1).max(1000))
    .max(10)
    .default([]),
  videoLink: z.string().trim().max(500).default(''),
  videoDescription: createLocalizedTextSchema({
    maxLength: 200,
    germanRequired: false,
  }),
  isVisible: z.boolean().default(true),
  order: z.number().int().min(0).default(0),
});

export const activityMutationSchema = z.object({
  activity: activityMutationValuesSchema,
});

export const activityAvailabilityUpdateSchema = z.object({
  enabled: z.boolean(),
});

export type ActivityAvailability = z.infer<
  typeof activityAvailabilityUpdateSchema
>;

export type ActivityTranslation = z.infer<typeof activityTranslationSchema>;
export type ActivityTranslations = z.infer<typeof activityTranslationsSchema>;
export type ActivityMutationValues = z.infer<
  typeof activityMutationValuesSchema
>;

export interface ActivityCompleteness {
  name: LocalizedTextCompleteness;
  description: LocalizedTextCompleteness;
  videoDescription: LocalizedTextCompleteness;
}

function translationField(
  translations: ActivityTranslations,
  field: keyof ActivityTranslation
): LocalizedText {
  return {
    [Language.GERMAN]: translations[Language.GERMAN][field],
    [Language.ENGLISH]: translations[Language.ENGLISH][field],
    [Language.CHINESE]: translations[Language.CHINESE][field],
  };
}

export function getActivityCompleteness(
  translations: ActivityTranslations,
  videoDescription: LocalizedText
): ActivityCompleteness {
  return {
    name: getLocalizedTextCompleteness(translationField(translations, 'name')),
    description: getLocalizedTextCompleteness(
      translationField(translations, 'description'),
      true
    ),
    videoDescription: getLocalizedTextCompleteness(videoDescription, true),
  };
}

export function resolveActivityText(
  translations: ActivityTranslations,
  videoDescription: LocalizedText,
  language: Language
) {
  return {
    name: resolveLocalizedText(
      translationField(translations, 'name'),
      language
    ),
    description: resolveLocalizedText(
      translationField(translations, 'description'),
      language
    ),
    videoDescription: resolveLocalizedText(videoDescription, language),
  };
}
