export const EMAIL_TEMPLATE_LOCALES = ['de', 'en', 'zh'] as const;
export type EmailTemplateLocale = (typeof EMAIL_TEMPLATE_LOCALES)[number];

export interface CapabilityEmailTemplateContract {
  name: string;
  owner: string;
  supportedLocales: readonly EmailTemplateLocale[];
  availableVariables: readonly string[];
  requiredVariables: readonly string[];
  senderStatus: 'current';
}
