/**
 * Email Template API Types
 * Shared types for email template management
 */

export interface EmailTemplate {
  id: string;
  name: string;
  subject: {
    de: string;
    en: string;
    zh: string;
  };
  body: {
    de: string;
    en: string;
    zh: string;
  };
  variables: string[];
  isActive: boolean;
  systemContract: {
    senderStatus: 'current' | 'unconsumed';
    owner: string | null;
    supportedLocales: Array<'de' | 'en' | 'zh'>;
    availableVariables: string[];
    requiredVariables: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface UpdateEmailTemplateRequest {
  subject?: {
    de?: string;
    en?: string;
    zh?: string;
  };
  body?: {
    de?: string;
    en?: string;
    zh?: string;
  };
}

export interface EmailTemplatePreviewRequest {
  templateId: string;
  locale: 'de' | 'en' | 'zh';
  variables: Record<string, string>;
}

export interface EmailTemplatePreviewResponse {
  subject: string;
  body: string;
}

/**
 * Email template names (constants)
 */
export const EMAIL_TEMPLATE_NAMES = {
  APPLICATION_RECEIVED: 'application_received',
  APPLICATION_ADMIN_ALERT: 'application_admin_alert',
  APPLICATION_APPROVED: 'application_approved',
  APPLICATION_REJECTED: 'application_rejected',
  APPLICATION_CONTACT: 'application_contact',
  MEMBER_PASSWORD_SETUP: 'member_password_setup',
  TASTER_SESSION_RECEIVED: 'taster_session_received',
  TASTER_SESSION_ADMIN_ALERT: 'taster_session_admin_alert',
  TASTER_SESSION_INVITED: 'taster_session_invited',
  TASTER_SESSION_DECLINED: 'taster_session_declined',
  GUEST_PLAY_RECEIVED: 'guest_play_received',
  GUEST_PLAY_ADMIN_ALERT: 'guest_play_admin_alert',
  GUEST_PLAY_APPROVED: 'guest_play_approved',
  GUEST_PLAY_DECLINED: 'guest_play_declined',
  EMAIL_CHANGE_VERIFICATION: 'email_change_verification',
  EMAIL_CHANGE_CONFIRMED: 'email_change_confirmed',
} as const;

export type EmailTemplateName =
  (typeof EMAIL_TEMPLATE_NAMES)[keyof typeof EMAIL_TEMPLATE_NAMES];
