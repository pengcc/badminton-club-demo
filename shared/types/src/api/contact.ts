import { z } from 'zod';
import { Language } from '../core/enums';
import {
  createLocalizedTextSchema,
  getLocalizedTextCompleteness,
  resolveLocalizedText,
  type LocalizedText,
  type LocalizedTextCompleteness,
} from './localizedContent';

const localizedRequired = (maxLength: number) =>
  createLocalizedTextSchema({ maxLength, germanRequired: true });
const localizedOptional = (maxLength: number) =>
  createLocalizedTextSchema({ maxLength, germanRequired: false });

export const contactExternalLinkSchema = z
  .union([z.literal(''), z.httpUrl().max(1000)])
  .default('');

export const contactEntryValuesSchema = z
  .object({
    category: z.string().trim().min(1).max(100),
    title: localizedRequired(200),
    description: localizedRequired(1000),
    email: z.string().trim().email().max(320),
    retainedQrCode: z.string().trim().max(1000).default(''),
    qrExplanation: localizedOptional(300),
    externalLink: contactExternalLinkSchema,
    externalLinkLabel: localizedOptional(200),
    isActive: z.boolean().default(true),
    order: z.number().int().min(0).default(0),
  })
  .superRefine((value, context) => {
    if (value.externalLink && !value.externalLinkLabel[Language.GERMAN]) {
      context.addIssue({
        code: 'custom',
        path: ['externalLinkLabel', Language.GERMAN],
        message: 'German external-link label is required when a link is set',
      });
    }
  });

export const contactEntryMutationSchema = z.object({
  contact: contactEntryValuesSchema,
});

export type ContactEntryValues = z.infer<typeof contactEntryValuesSchema>;

export interface ContactEntryCompleteness {
  title: LocalizedTextCompleteness;
  description: LocalizedTextCompleteness;
  qrExplanation: LocalizedTextCompleteness;
  externalLinkLabel: LocalizedTextCompleteness;
}

export function getContactEntryCompleteness(
  value: Pick<
    ContactEntryValues,
    'title' | 'description' | 'qrExplanation' | 'externalLinkLabel'
  >
): ContactEntryCompleteness {
  return {
    title: getLocalizedTextCompleteness(value.title),
    description: getLocalizedTextCompleteness(value.description),
    qrExplanation: getLocalizedTextCompleteness(value.qrExplanation, true),
    externalLinkLabel: getLocalizedTextCompleteness(
      value.externalLinkLabel,
      true
    ),
  };
}

export function resolveContactEntryText(
  value: {
    title: LocalizedText;
    description: LocalizedText;
    qrExplanation: LocalizedText;
    externalLinkLabel: LocalizedText;
  },
  language: Language
) {
  return {
    title: resolveLocalizedText(value.title, language),
    description: resolveLocalizedText(value.description, language),
    qrExplanation: resolveLocalizedText(value.qrExplanation, language),
    externalLinkLabel: resolveLocalizedText(value.externalLinkLabel, language),
  };
}
