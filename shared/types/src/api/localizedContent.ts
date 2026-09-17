import { z } from 'zod';
import { Language } from '../core/enums';

export const CONTENT_LANGUAGES = [
  Language.GERMAN,
  Language.ENGLISH,
  Language.CHINESE,
] as const;

export function isContentLanguage(value: unknown): value is Language {
  return (
    typeof value === 'string' &&
    CONTENT_LANGUAGES.some((language) => language === value)
  );
}

export type LocalizedText = Record<Language, string>;

export interface LocalizedTextCompleteness {
  complete: boolean;
  missingLanguages: Language[];
}

export function createLocalizedTextSchema({
  maxLength,
  germanRequired,
}: {
  maxLength: number;
  germanRequired: boolean;
}) {
  const schema = z.object({
    [Language.GERMAN]: z.string().trim().max(maxLength),
    [Language.ENGLISH]: z.string().trim().max(maxLength),
    [Language.CHINESE]: z.string().trim().max(maxLength),
  });

  if (!germanRequired) return schema;

  return schema.superRefine((value, context) => {
    if (!value[Language.GERMAN]) {
      context.addIssue({
        code: 'custom',
        path: [Language.GERMAN],
        message: 'German content is required',
      });
    }
  });
}

export function getLocalizedTextCompleteness(
  value: LocalizedText,
  optional = false
): LocalizedTextCompleteness {
  const hasAnyValue = CONTENT_LANGUAGES.some((language) =>
    value[language].trim()
  );
  if (optional && !hasAnyValue) {
    return { complete: true, missingLanguages: [] };
  }

  const missingLanguages = CONTENT_LANGUAGES.filter(
    (language) => !value[language].trim()
  );
  return { complete: missingLanguages.length === 0, missingLanguages };
}

export function resolveLocalizedText(
  value: LocalizedText,
  requestedLanguage: Language
): string {
  return value[requestedLanguage].trim() || value[Language.GERMAN].trim();
}
