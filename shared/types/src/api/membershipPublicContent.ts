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

export const membershipPublicContentValuesSchema = z.object({
  homepageSummary: requiredText(500),
  introduction: requiredText(3000),
  membershipTypes: requiredText(3000),
  membershipPath: requiredText(3000),
  applicationPreparation: optionalText(2000),
  studentProof: optionalText(2000),
});

export const updateMembershipPublicContentSchema = z.object({
  content: membershipPublicContentValuesSchema,
});

export const membershipPublicContentQuerySchema = z.object({
  language: z.enum(Language).default(Language.GERMAN),
});

export type MembershipPublicContentValues = z.infer<
  typeof membershipPublicContentValuesSchema
>;

export type MembershipPublicContentCompleteness = Record<
  keyof MembershipPublicContentValues,
  LocalizedTextCompleteness
>;

export interface MembershipPublicContentAdministrationResponse {
  content: MembershipPublicContentValues;
  completeness: MembershipPublicContentCompleteness;
  updatedAt: string | null;
}

export interface MembershipPublicContentPublicResponse {
  homepageSummary: string;
  introduction: string;
  membershipTypes: string;
  membershipPath: string;
  applicationPreparation: string;
  studentProof: string;
}

const emptyText = (): LocalizedText => ({ de: '', en: '', zh: '' });

export const EMPTY_MEMBERSHIP_PUBLIC_CONTENT: MembershipPublicContentValues = {
  homepageSummary: emptyText(),
  introduction: emptyText(),
  membershipTypes: emptyText(),
  membershipPath: emptyText(),
  applicationPreparation: emptyText(),
  studentProof: emptyText(),
};

export function getMembershipPublicContentCompleteness(
  content: MembershipPublicContentValues
): MembershipPublicContentCompleteness {
  return {
    homepageSummary: getLocalizedTextCompleteness(content.homepageSummary),
    introduction: getLocalizedTextCompleteness(content.introduction),
    membershipTypes: getLocalizedTextCompleteness(content.membershipTypes),
    membershipPath: getLocalizedTextCompleteness(content.membershipPath),
    applicationPreparation: getLocalizedTextCompleteness(
      content.applicationPreparation,
      true
    ),
    studentProof: getLocalizedTextCompleteness(content.studentProof, true),
  };
}

export function resolveMembershipPublicContent(
  content: MembershipPublicContentValues,
  language: Language
): MembershipPublicContentPublicResponse {
  return {
    homepageSummary: resolveLocalizedText(content.homepageSummary, language),
    introduction: resolveLocalizedText(content.introduction, language),
    membershipTypes: resolveLocalizedText(content.membershipTypes, language),
    membershipPath: resolveLocalizedText(content.membershipPath, language),
    applicationPreparation: resolveLocalizedText(
      content.applicationPreparation,
      language
    ),
    studentProof: resolveLocalizedText(content.studentProof, language),
  };
}
