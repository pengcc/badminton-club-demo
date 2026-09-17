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

export const recruitmentPublicContentValuesSchema = z.object({
  isOpen: z.boolean(),
  introduction: requiredText(3000),
  requirements: requiredText(3000),
  tryoutGuidance: requiredText(3000),
  contactEntryId: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .nullable(),
});

export const updateRecruitmentPublicContentSchema = z.object({
  content: recruitmentPublicContentValuesSchema,
});

export const recruitmentPublicContentQuerySchema = z.object({
  language: z.enum(Language).default(Language.GERMAN),
});

export type RecruitmentPublicContentValues = z.infer<
  typeof recruitmentPublicContentValuesSchema
>;

export type RecruitmentPublicContentCompleteness = Record<
  'introduction' | 'requirements' | 'tryoutGuidance',
  LocalizedTextCompleteness
>;

export interface RecruitmentPublicContentAdministrationResponse {
  content: RecruitmentPublicContentValues;
  completeness: RecruitmentPublicContentCompleteness;
  contactAvailable: boolean;
  updatedAt: string | null;
}

export interface RecruitmentPublicContentPublicResponse {
  isOpen: boolean;
  introduction: string;
  requirements: string;
  tryoutGuidance: string;
  contactEntryId: string | null;
}

const emptyText = (): LocalizedText => ({ de: '', en: '', zh: '' });

export const EMPTY_RECRUITMENT_PUBLIC_CONTENT: RecruitmentPublicContentValues =
  {
    isOpen: false,
    introduction: emptyText(),
    requirements: emptyText(),
    tryoutGuidance: emptyText(),
    contactEntryId: null,
  };

export function getRecruitmentPublicContentCompleteness(
  content: RecruitmentPublicContentValues
): RecruitmentPublicContentCompleteness {
  return {
    introduction: getLocalizedTextCompleteness(content.introduction),
    requirements: getLocalizedTextCompleteness(content.requirements),
    tryoutGuidance: getLocalizedTextCompleteness(content.tryoutGuidance),
  };
}

export function resolveRecruitmentPublicContent(
  content: RecruitmentPublicContentValues,
  language: Language
): RecruitmentPublicContentPublicResponse {
  return {
    isOpen: content.isOpen,
    introduction: resolveLocalizedText(content.introduction, language),
    requirements: resolveLocalizedText(content.requirements, language),
    tryoutGuidance: resolveLocalizedText(content.tryoutGuidance, language),
    contactEntryId: content.contactEntryId,
  };
}
