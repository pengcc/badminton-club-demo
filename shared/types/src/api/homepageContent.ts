import { z } from 'zod';
import { Language } from '../core/enums';
import {
  createLocalizedTextSchema,
  getLocalizedTextCompleteness,
  resolveLocalizedText,
  type LocalizedText,
  type LocalizedTextCompleteness,
} from './localizedContent';

export const homepageContentValuesSchema = z.object({
  mainMessage: createLocalizedTextSchema({
    maxLength: 500,
    germanRequired: true,
  }),
  visitUsIntroduction: createLocalizedTextSchema({
    maxLength: 2000,
    germanRequired: false,
  }),
  contactIntroduction: createLocalizedTextSchema({
    maxLength: 2000,
    germanRequired: false,
  }),
});

export const updateHomepageContentSchema = z.object({
  content: homepageContentValuesSchema,
});

export const homepageContentQuerySchema = z.object({
  language: z.enum(Language).default(Language.GERMAN),
});

export type HomepageContentValues = z.infer<typeof homepageContentValuesSchema>;
export type UpdateHomepageContent = z.infer<typeof updateHomepageContentSchema>;

export type HomepageContentField = keyof HomepageContentValues;

export type HomepageContentCompleteness = Record<
  HomepageContentField,
  LocalizedTextCompleteness
>;

export interface HomepageContentAdministrationResponse {
  content: HomepageContentValues;
  completeness: HomepageContentCompleteness;
  updatedAt: string | null;
}

export interface HomepageContentPublicResponse {
  mainMessage: string;
  visitUsIntroduction: string;
  contactIntroduction: string;
}

export const EMPTY_LOCALIZED_TEXT: LocalizedText = {
  [Language.GERMAN]: '',
  [Language.ENGLISH]: '',
  [Language.CHINESE]: '',
};

export const EMPTY_HOMEPAGE_CONTENT: HomepageContentValues = {
  mainMessage: { ...EMPTY_LOCALIZED_TEXT },
  visitUsIntroduction: { ...EMPTY_LOCALIZED_TEXT },
  contactIntroduction: { ...EMPTY_LOCALIZED_TEXT },
};

export function getHomepageContentCompleteness(
  content: HomepageContentValues
): HomepageContentCompleteness {
  return {
    mainMessage: getLocalizedTextCompleteness(content.mainMessage),
    visitUsIntroduction: getLocalizedTextCompleteness(
      content.visitUsIntroduction,
      true
    ),
    contactIntroduction: getLocalizedTextCompleteness(
      content.contactIntroduction,
      true
    ),
  };
}

export function resolveHomepageContent(
  content: HomepageContentValues,
  language: Language
): HomepageContentPublicResponse {
  return {
    mainMessage: resolveLocalizedText(content.mainMessage, language),
    visitUsIntroduction: resolveLocalizedText(
      content.visitUsIntroduction,
      language
    ),
    contactIntroduction: resolveLocalizedText(
      content.contactIntroduction,
      language
    ),
  };
}
