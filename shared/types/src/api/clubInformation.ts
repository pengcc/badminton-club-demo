import { z } from 'zod';
import { Language } from '../core/enums';
import {
  createLocalizedTextSchema,
  getLocalizedTextCompleteness,
  resolveLocalizedText,
  type LocalizedText,
  type LocalizedTextCompleteness,
} from './localizedContent';

export const clubInformationValuesSchema = z.object({
  officialNameGerman: z.string().trim().min(1).max(200),
  nameEnglish: z.string().trim().max(200),
  nameChinese: z.string().trim().max(200),
  shortName: z.string().trim().min(1).max(40),
  foundingYear: z.number().int().min(1800).max(2200),
  introduction: createLocalizedTextSchema({
    maxLength: 3000,
    germanRequired: true,
  }),
});

export const updateClubInformationSchema = z.object({
  content: clubInformationValuesSchema,
});

export const clubInformationQuerySchema = z.object({
  language: z.enum(Language).default(Language.GERMAN),
});

export type ClubInformationValues = z.infer<typeof clubInformationValuesSchema>;

export interface ClubInformationAdministrationResponse {
  content: ClubInformationValues;
  completeness: {
    introduction: LocalizedTextCompleteness;
    nameTranslations: LocalizedTextCompleteness;
  };
  updatedAt: string | null;
}

export interface ClubInformationPublicResponse {
  officialNameGerman: string;
  nameEnglish: string;
  nameChinese: string;
  localizedName: string;
  shortName: string;
  foundingYear: number | null;
  introduction: string;
}

const emptyLocalizedText: LocalizedText = { de: '', en: '', zh: '' };

export const EMPTY_CLUB_INFORMATION: ClubInformationValues = {
  officialNameGerman: '',
  nameEnglish: '',
  nameChinese: '',
  shortName: '',
  foundingYear: 0,
  introduction: { ...emptyLocalizedText },
};

export function getClubInformationCompleteness(
  content: ClubInformationValues
): ClubInformationAdministrationResponse['completeness'] {
  return {
    introduction: getLocalizedTextCompleteness(content.introduction),
    nameTranslations: getLocalizedTextCompleteness({
      [Language.GERMAN]: content.officialNameGerman,
      [Language.ENGLISH]: content.nameEnglish,
      [Language.CHINESE]: content.nameChinese,
    }),
  };
}

export function resolveClubInformation(
  content: ClubInformationValues,
  language: Language
): ClubInformationPublicResponse {
  const localizedNames: Record<Language, string> = {
    [Language.GERMAN]: content.officialNameGerman,
    [Language.ENGLISH]: content.nameEnglish,
    [Language.CHINESE]: content.nameChinese,
  };

  return {
    officialNameGerman: content.officialNameGerman,
    nameEnglish: content.nameEnglish,
    nameChinese: content.nameChinese,
    localizedName:
      localizedNames[language].trim() || content.officialNameGerman.trim(),
    shortName: content.shortName,
    foundingYear: content.foundingYear || null,
    introduction: resolveLocalizedText(content.introduction, language),
  };
}
