import type { CapabilityEmailTemplateContract } from './types';
import { EMAIL_TEMPLATE_LOCALES } from './types';

export const ACCOUNT_ONBOARDING_EMAIL_TEMPLATES = {
  PASSWORD_SETUP: 'member_password_setup',
} as const;

export const ACCOUNT_ONBOARDING_EMAIL_CONTRACTS = [
  {
    name: ACCOUNT_ONBOARDING_EMAIL_TEMPLATES.PASSWORD_SETUP,
    owner: 'Account Onboarding',
    supportedLocales: EMAIL_TEMPLATE_LOCALES,
    availableVariables: [
      'firstName',
      'lastName',
      'email',
      'resetLink',
      'expiresIn',
    ],
    requiredVariables: ['resetLink', 'expiresIn'],
    senderStatus: 'current',
  },
] as const satisfies readonly CapabilityEmailTemplateContract[];
