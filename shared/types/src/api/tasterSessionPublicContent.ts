import { z } from 'zod';
import { Language } from '../core/enums';
import {
  createLocalizedTextSchema,
  getLocalizedTextCompleteness,
  resolveLocalizedText,
  type LocalizedText,
  type LocalizedTextCompleteness,
} from './localizedContent';

const requiredText = (maxLength: number) =>
  createLocalizedTextSchema({ maxLength, germanRequired: true });
const optionalText = (maxLength: number) =>
  createLocalizedTextSchema({ maxLength, germanRequired: false });

export const tasterSessionPublicContentValuesSchema = z.object({
  homepageSummary: requiredText(500),
  introduction: requiredText(3000),
  preparation: optionalText(2000),
  participationGuidance: optionalText(2000),
  followUpGuidance: optionalText(2000),
});

export const updateTasterSessionPublicContentSchema = z.object({
  content: tasterSessionPublicContentValuesSchema,
});

export const tasterSessionPublicContentQuerySchema = z.object({
  language: z.enum(Language).default(Language.GERMAN),
});

export type TasterSessionPublicContentValues = z.infer<
  typeof tasterSessionPublicContentValuesSchema
>;

export type TasterSessionPublicContentCompleteness = Record<
  keyof TasterSessionPublicContentValues,
  LocalizedTextCompleteness
>;

export interface TasterSessionPublicContentAdministrationResponse {
  content: TasterSessionPublicContentValues;
  completeness: TasterSessionPublicContentCompleteness;
  updatedAt: string | null;
}

export interface TasterSessionPublicContentPublicResponse {
  homepageSummary: string;
  introduction: string;
  preparation: string;
  participationGuidance: string;
  followUpGuidance: string;
}

const emptyText = (): LocalizedText => ({ de: '', en: '', zh: '' });

export const EMPTY_TASTER_SESSION_PUBLIC_CONTENT: TasterSessionPublicContentValues =
  {
    homepageSummary: emptyText(),
    introduction: emptyText(),
    preparation: emptyText(),
    participationGuidance: emptyText(),
    followUpGuidance: emptyText(),
  };

export function getTasterSessionPublicContentCompleteness(
  content: TasterSessionPublicContentValues
): TasterSessionPublicContentCompleteness {
  return {
    homepageSummary: getLocalizedTextCompleteness(content.homepageSummary),
    introduction: getLocalizedTextCompleteness(content.introduction),
    preparation: getLocalizedTextCompleteness(content.preparation, true),
    participationGuidance: getLocalizedTextCompleteness(
      content.participationGuidance,
      true
    ),
    followUpGuidance: getLocalizedTextCompleteness(
      content.followUpGuidance,
      true
    ),
  };
}

export function resolveTasterSessionPublicContent(
  content: TasterSessionPublicContentValues,
  language: Language
): TasterSessionPublicContentPublicResponse {
  return {
    homepageSummary: resolveLocalizedText(content.homepageSummary, language),
    introduction: resolveLocalizedText(content.introduction, language),
    preparation: resolveLocalizedText(content.preparation, language),
    participationGuidance: resolveLocalizedText(
      content.participationGuidance,
      language
    ),
    followUpGuidance: resolveLocalizedText(content.followUpGuidance, language),
  };
}
