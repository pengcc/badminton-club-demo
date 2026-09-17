import type { CapabilityEmailTemplateContract } from './types';
import { EMAIL_TEMPLATE_LOCALES } from './types';

export const AUTHENTICATION_EMAIL_TEMPLATES = {
  PASSWORD_RECOVERY: 'password_recovery',
} as const;

export const AUTHENTICATION_EMAIL_CONTRACTS = [
  {
    name: AUTHENTICATION_EMAIL_TEMPLATES.PASSWORD_RECOVERY,
    owner: 'Authentication',
    supportedLocales: EMAIL_TEMPLATE_LOCALES,
    availableVariables: ['resetLink', 'expiresIn'],
    requiredVariables: ['resetLink', 'expiresIn'],
    senderStatus: 'current',
  },
] as const satisfies readonly CapabilityEmailTemplateContract[];
