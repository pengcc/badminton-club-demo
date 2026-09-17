import type { CapabilityEmailTemplateContract } from './types';
import { EMAIL_TEMPLATE_LOCALES } from './types';

export const EMAIL_CHANGE_EMAIL_TEMPLATES = {
  VERIFICATION: 'email_change_verification',
  CONFIRMED: 'email_change_confirmed',
} as const;

export const EMAIL_CHANGE_EMAIL_CONTRACTS = [
  {
    name: EMAIL_CHANGE_EMAIL_TEMPLATES.VERIFICATION,
    owner: 'Email Change',
    supportedLocales: EMAIL_TEMPLATE_LOCALES,
    availableVariables: ['name', 'verificationUrl', 'expiresIn'],
    requiredVariables: ['verificationUrl', 'expiresIn'],
    senderStatus: 'current',
  },
  {
    name: EMAIL_CHANGE_EMAIL_TEMPLATES.CONFIRMED,
    owner: 'Email Change',
    supportedLocales: EMAIL_TEMPLATE_LOCALES,
    availableVariables: ['name', 'oldEmail', 'newEmail'],
    requiredVariables: ['oldEmail', 'newEmail'],
    senderStatus: 'current',
  },
] as const satisfies readonly CapabilityEmailTemplateContract[];
