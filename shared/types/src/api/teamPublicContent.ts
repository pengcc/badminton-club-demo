import { z } from 'zod';
import { Language } from '../core/enums';
import {
  createLocalizedTextSchema,
  getLocalizedTextCompleteness,
  resolveLocalizedText,
  type LocalizedText,
  type LocalizedTextCompleteness,
} from './localizedContent';

const titleSchema = createLocalizedTextSchema({
  maxLength: 200,
  germanRequired: false,
});
const descriptionSchema = createLocalizedTextSchema({
  maxLength: 2000,
  germanRequired: false,
});

export const teamPublicContentValuesSchema = z
  .object({
    enabled: z.boolean(),
    title: titleSchema,
    description: descriptionSchema,
  })
  .superRefine((content, context) => {
    if (!content.enabled) return;
    if (!content.title.de) {
      context.addIssue({
        code: 'custom',
        path: ['title', Language.GERMAN],
        message: 'German title is required when the introduction is enabled',
      });
    }
    if (!content.description.de) {
      context.addIssue({
        code: 'custom',
        path: ['description', Language.GERMAN],
        message:
          'German introduction is required when the introduction is enabled',
      });
    }
  });

export const updateTeamPublicContentSchema = z.object({
  content: teamPublicContentValuesSchema,
});

export const teamPublicContentQuerySchema = z.object({
  language: z.enum(Language).default(Language.GERMAN),
});

export type TeamPublicContentValues = z.infer<
  typeof teamPublicContentValuesSchema
>;

export interface TeamPublicContentCompleteness {
  title: LocalizedTextCompleteness;
  description: LocalizedTextCompleteness;
}

export interface TeamPublicContentAdministrationResponse {
  content: TeamPublicContentValues;
  completeness: TeamPublicContentCompleteness;
  updatedAt: string | null;
}

export interface TeamPublicContentPublicResponse {
  enabled: boolean;
  title: string;
  description: string;
}

const emptyLocalizedText: LocalizedText = { de: '', en: '', zh: '' };

export const EMPTY_TEAM_PUBLIC_CONTENT: TeamPublicContentValues = {
  enabled: false,
  title: { ...emptyLocalizedText },
  description: { ...emptyLocalizedText },
};

export function getTeamPublicContentCompleteness(
  content: TeamPublicContentValues
): TeamPublicContentCompleteness {
  return {
    title: getLocalizedTextCompleteness(content.title, !content.enabled),
    description: getLocalizedTextCompleteness(
      content.description,
      !content.enabled
    ),
  };
}

export function resolveTeamPublicContent(
  content: TeamPublicContentValues,
  language: Language
): TeamPublicContentPublicResponse {
  return {
    enabled: content.enabled,
    title: resolveLocalizedText(content.title, language),
    description: resolveLocalizedText(content.description, language),
  };
}
