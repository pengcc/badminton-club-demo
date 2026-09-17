import type { CapabilityEmailTemplateContract } from './types';
import { EMAIL_TEMPLATE_LOCALES } from './types';

export const TASTER_SESSION_EMAIL_TEMPLATES = {
  RECEIVED: 'taster_session_received',
  ADMIN_ALERT: 'taster_session_admin_alert',
  INVITED: 'taster_session_invited',
  DECLINED: 'taster_session_declined',
} as const;

export const TASTER_SESSION_EMAIL_CONTRACTS = [
  {
    name: TASTER_SESSION_EMAIL_TEMPLATES.RECEIVED,
    owner: 'Taster Session',
    supportedLocales: EMAIL_TEMPLATE_LOCALES,
    availableVariables: ['name', 'preferenceDetails'],
    requiredVariables: ['preferenceDetails'],
    senderStatus: 'current',
  },
  {
    name: TASTER_SESSION_EMAIL_TEMPLATES.ADMIN_ALERT,
    owner: 'Taster Session',
    supportedLocales: EMAIL_TEMPLATE_LOCALES,
    availableVariables: [
      'name',
      'email',
      'playerLevel',
      'message',
      'requestUrl',
      'preferenceDetails',
    ],
    requiredVariables: [
      'name',
      'email',
      'playerLevel',
      'message',
      'requestUrl',
      'preferenceDetails',
    ],
    senderStatus: 'current',
  },
  {
    name: TASTER_SESSION_EMAIL_TEMPLATES.INVITED,
    owner: 'Taster Session',
    supportedLocales: EMAIL_TEMPLATE_LOCALES,
    availableVariables: ['name', 'preferenceDetails'],
    requiredVariables: ['preferenceDetails'],
    senderStatus: 'current',
  },
  {
    name: TASTER_SESSION_EMAIL_TEMPLATES.DECLINED,
    owner: 'Taster Session',
    supportedLocales: EMAIL_TEMPLATE_LOCALES,
    availableVariables: ['name', 'declineReason', 'declineReasonDetails'],
    requiredVariables: ['declineReason', 'declineReasonDetails'],
    senderStatus: 'current',
  },
] as const satisfies readonly CapabilityEmailTemplateContract[];
