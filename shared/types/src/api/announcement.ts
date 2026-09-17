import { z } from 'zod';
import { Language } from '../core/enums';
import {
  getLocalizedTextCompleteness,
  resolveLocalizedText,
  type LocalizedText,
  type LocalizedTextCompleteness,
} from './localizedContent';

export enum AnnouncementType {
  INFO = 'info',
  IMPORTANT = 'important',
  WARNING = 'warning',
}

const announcementTranslationSchema = z.object({
  title: z.string().trim().max(200),
  content: z.string().trim().max(2000),
});

export const announcementTranslationsSchema = z
  .object({
    [Language.GERMAN]: announcementTranslationSchema,
    [Language.ENGLISH]: announcementTranslationSchema,
    [Language.CHINESE]: announcementTranslationSchema,
  })
  .superRefine((translations, context) => {
    if (!translations[Language.GERMAN].title) {
      context.addIssue({
        code: 'custom',
        path: [Language.GERMAN, 'title'],
        message: 'German announcement title is required',
      });
    }
    if (!translations[Language.GERMAN].content) {
      context.addIssue({
        code: 'custom',
        path: [Language.GERMAN, 'content'],
        message: 'German announcement content is required',
      });
    }
  });

export const announcementDisplayDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}\.\d{2}\.\d{2}$/, 'Display date must use YYYY.MM.DD')
  .refine((value) => {
    const [year, month, day] = value.split('.').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, 'Display date must be a valid calendar date');

export const announcementExternalLinkSchema = z
  .union([z.literal(''), z.httpUrl().max(1000)])
  .default('');

export const announcementMutationSchema = z.object({
  translations: announcementTranslationsSchema,
  type: z.enum(AnnouncementType),
  displayDate: announcementDisplayDateSchema,
  externalLink: announcementExternalLinkSchema,
  isActive: z.boolean().default(true),
  order: z.number().int().min(0).default(0),
});

export type AnnouncementTranslation = z.infer<
  typeof announcementTranslationSchema
>;
export type AnnouncementTranslations = z.infer<
  typeof announcementTranslationsSchema
>;
export type AnnouncementMutation = z.infer<typeof announcementMutationSchema>;

export interface AnnouncementUserReference {
  id: string;
  name: string;
}

export interface AnnouncementPublicResponse {
  id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  displayDate: string;
  externalLink?: string;
}

export interface AnnouncementAdministrationListItem
  extends AnnouncementPublicResponse {
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: AnnouncementUserReference;
  completeness: AnnouncementCompleteness;
  isDemoScratch?: boolean;
}

export interface AnnouncementAdministrationDetail {
  id: string;
  translations: AnnouncementTranslations;
  type: AnnouncementType;
  displayDate: string;
  externalLink: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  createdBy: AnnouncementUserReference;
  updatedBy: AnnouncementUserReference;
  completeness: AnnouncementCompleteness;
  isDemoScratch?: boolean;
}

export interface AnnouncementCompleteness {
  title: LocalizedTextCompleteness;
  content: LocalizedTextCompleteness;
}

function translationField(
  translations: AnnouncementTranslations,
  field: keyof AnnouncementTranslation
): LocalizedText {
  return {
    [Language.GERMAN]: translations[Language.GERMAN][field],
    [Language.ENGLISH]: translations[Language.ENGLISH][field],
    [Language.CHINESE]: translations[Language.CHINESE][field],
  };
}

export function resolveAnnouncementText(
  translations: AnnouncementTranslations,
  language: Language
) {
  return {
    title: resolveLocalizedText(
      translationField(translations, 'title'),
      language
    ),
    content: resolveLocalizedText(
      translationField(translations, 'content'),
      language
    ),
  };
}

export function getAnnouncementCompleteness(
  translations: AnnouncementTranslations
): AnnouncementCompleteness {
  return {
    title: getLocalizedTextCompleteness(
      translationField(translations, 'title')
    ),
    content: getLocalizedTextCompleteness(
      translationField(translations, 'content')
    ),
  };
}
