import type { CapabilityEmailTemplateContract } from './types';
import { EMAIL_TEMPLATE_LOCALES } from './types';

export const GUEST_PLAY_EMAIL_TEMPLATES = {
  RECEIVED: 'guest_play_received',
  ADMIN_ALERT: 'guest_play_admin_alert',
  APPROVED: 'guest_play_approved',
  DECLINED: 'guest_play_declined',
} as const;

export const GUEST_PLAY_EMAIL_CONTRACTS = [
  {
    name: GUEST_PLAY_EMAIL_TEMPLATES.RECEIVED,
    owner: 'Guest Play',
    supportedLocales: EMAIL_TEMPLATE_LOCALES,
    availableVariables: ['memberName', 'guestCount', 'appointmentDetails'],
    requiredVariables: ['guestCount', 'appointmentDetails'],
    senderStatus: 'current',
  },
  {
    name: GUEST_PLAY_EMAIL_TEMPLATES.ADMIN_ALERT,
    owner: 'Guest Play',
    supportedLocales: EMAIL_TEMPLATE_LOCALES,
    availableVariables: [
      'memberName',
      'memberEmail',
      'guestCount',
      'message',
      'requestUrl',
      'appointmentDetails',
    ],
    requiredVariables: [
      'memberName',
      'memberEmail',
      'guestCount',
      'message',
      'requestUrl',
      'appointmentDetails',
    ],
    senderStatus: 'current',
  },
  {
    name: GUEST_PLAY_EMAIL_TEMPLATES.APPROVED,
    owner: 'Guest Play',
    supportedLocales: EMAIL_TEMPLATE_LOCALES,
    availableVariables: ['memberName', 'guestCount', 'appointmentDetails'],
    requiredVariables: ['guestCount', 'appointmentDetails'],
    senderStatus: 'current',
  },
  {
    name: GUEST_PLAY_EMAIL_TEMPLATES.DECLINED,
    owner: 'Guest Play',
    supportedLocales: EMAIL_TEMPLATE_LOCALES,
    availableVariables: ['memberName', 'guestCount', 'appointmentDetails'],
    requiredVariables: ['guestCount', 'appointmentDetails'],
    senderStatus: 'current',
  },
] as const satisfies readonly CapabilityEmailTemplateContract[];
