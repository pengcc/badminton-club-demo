import { describe, expect, it } from 'vitest';
import {
  assertEmailTemplateRenderContract,
  assertEmailTemplateSystemContract,
  emailTemplateCatalogContract,
  findEmailTemplateContractViolations,
  MEMBER_PASSWORD_SETUP_TEMPLATE,
  PASSWORD_RECOVERY_TEMPLATE,
  SYSTEM_EMAIL_TEMPLATE_CONTRACTS,
} from '../../services/emailTemplateSystemContract';
import {
  PRE_B1_SYSTEM_EMAIL_TEMPLATE_DEFINITIONS,
  SYSTEM_EMAIL_TEMPLATE_DEFINITIONS,
} from '../../scripts/seedEmailTemplates';

const RECIPIENT_TEMPLATE_NAMES = [
  'application_verify_email',
  'application_access',
  'application_verify_email_change',
  'application_access_guidance',
  'application_documents',
  'application_received',
  'application_approved',
  'application_rejected',
  'application_contact',
  'member_password_setup',
  'taster_session_received',
  'taster_session_invited',
  'taster_session_declined',
  'guest_play_received',
  'guest_play_approved',
  'guest_play_declined',
  'password_recovery',
  'email_change_verification',
  'email_change_confirmed',
] as const;

function definition(name: string) {
  return SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.find(
    (template) => template.name === name
  )!;
}

describe('capability-owned email template contracts', () => {
  it('aggregates every verified current sender with exact owner metadata', () => {
    expect(
      SYSTEM_EMAIL_TEMPLATE_CONTRACTS.map(({ name, owner }) => ({
        name,
        owner,
      }))
    ).toEqual([
      { name: 'password_recovery', owner: 'Authentication' },
      { name: 'application_verify_email', owner: 'Membership Application' },
      { name: 'application_access', owner: 'Membership Application' },
      {
        name: 'application_verify_email_change',
        owner: 'Membership Application',
      },
      { name: 'application_access_guidance', owner: 'Membership Application' },
      { name: 'application_documents', owner: 'Membership Application' },
      { name: 'application_received', owner: 'Membership Application' },
      { name: 'application_admin_alert', owner: 'Membership Application' },
      { name: 'application_approved', owner: 'Membership Application' },
      { name: 'application_rejected', owner: 'Membership Application' },
      { name: 'application_contact', owner: 'Membership Application' },
      { name: 'member_password_setup', owner: 'Account Onboarding' },
      { name: 'taster_session_received', owner: 'Taster Session' },
      { name: 'taster_session_admin_alert', owner: 'Taster Session' },
      { name: 'taster_session_invited', owner: 'Taster Session' },
      { name: 'taster_session_declined', owner: 'Taster Session' },
      { name: 'guest_play_received', owner: 'Guest Play' },
      { name: 'guest_play_admin_alert', owner: 'Guest Play' },
      { name: 'guest_play_approved', owner: 'Guest Play' },
      { name: 'guest_play_declined', owner: 'Guest Play' },
      { name: 'email_change_verification', owner: 'Email Change' },
      { name: 'email_change_confirmed', owner: 'Email Change' },
    ]);
  });

  it('keeps each capability-required variable set explicit and exact', () => {
    expect(
      Object.fromEntries(
        SYSTEM_EMAIL_TEMPLATE_CONTRACTS.map(({ name, requiredVariables }) => [
          name,
          requiredVariables,
        ])
      )
    ).toEqual({
      password_recovery: ['resetLink', 'expiresIn'],
      application_verify_email: ['accessUrl'],
      application_access: ['accessUrl'],
      application_verify_email_change: ['accessUrl'],
      application_access_guidance: ['message'],
      application_documents: ['documents'],
      application_received: [],
      application_admin_alert: [
        'applicantName',
        'email',
        'membershipType',
        'applicationUrl',
      ],
      application_approved: ['setupGuidance'],
      application_rejected: ['reason'],
      application_contact: ['message', 'senderName'],
      member_password_setup: ['resetLink', 'expiresIn'],
      taster_session_received: ['preferenceDetails'],
      taster_session_admin_alert: [
        'name',
        'email',
        'playerLevel',
        'message',
        'requestUrl',
        'preferenceDetails',
      ],
      taster_session_invited: ['preferenceDetails'],
      taster_session_declined: ['declineReason', 'declineReasonDetails'],
      guest_play_received: ['guestCount', 'appointmentDetails'],
      guest_play_admin_alert: [
        'memberName',
        'memberEmail',
        'guestCount',
        'message',
        'requestUrl',
        'appointmentDetails',
      ],
      guest_play_approved: ['guestCount', 'appointmentDetails'],
      guest_play_declined: ['guestCount', 'appointmentDetails'],
      email_change_verification: ['verificationUrl', 'expiresIn'],
      email_change_confirmed: ['oldEmail', 'newEmail'],
    });
  });

  it.each(
    SYSTEM_EMAIL_TEMPLATE_CONTRACTS.filter(
      (contract) => contract.requiredVariables.length > 0
    ).flatMap((contract) =>
      contract.supportedLocales.map((locale) => [contract, locale] as const)
    )
  )('rejects missing required placeholders for $name in $locale', (contract, locale) => {
    const complete = contract.requiredVariables
      .map((variable) => `{{${variable}}}`)
      .join(' ');
    const removed = contract.requiredVariables[0];
    const body = { de: complete, en: complete, zh: complete };
    body[locale] = body[locale].replace(`{{${removed}}}`, '');

    expect(
      findEmailTemplateContractViolations(contract.name, body)
    ).toContainEqual({
      locale,
      missingVariables: [removed],
    });
    expect(() =>
      assertEmailTemplateSystemContract(contract.name, body)
    ).toThrow(`${locale}: {{${removed}}}`);
  });

  it('enforces the exact runtime variables before preview or delivery', () => {
    expect(() =>
      assertEmailTemplateRenderContract('email_change_verification', 'en', {
        name: 'Member',
        verificationUrl: 'https://example.test/verify',
      })
    ).toThrow('en: {{expiresIn}}');
  });

  it('rejects unsupported preview locales', () => {
    expect(() =>
      assertEmailTemplateRenderContract('application_approved', 'fr', {})
    ).toThrow('Unsupported email template locale: fr');
  });

  it('reports the active approval sender contract', () => {
    expect(emailTemplateCatalogContract('application_approved')).toEqual({
      senderStatus: 'current',
      owner: 'Membership Application',
      supportedLocales: ['de', 'en', 'zh'],
      availableVariables: [
        'firstName',
        'lastName',
        'approvalMessage',
        'setupGuidance',
      ],
      requiredVariables: ['setupGuidance'],
    });
  });

  it('keeps the applicant receipt contract free of internal application identity', () => {
    expect(emailTemplateCatalogContract('application_received')).toEqual({
      senderStatus: 'current',
      owner: 'Membership Application',
      supportedLocales: ['de', 'en', 'zh'],
      availableVariables: ['firstName', 'lastName'],
      requiredVariables: [],
    });
  });

  it('accepts the maintained password-setup defaults in every locale', () => {
    expect(() =>
      assertEmailTemplateSystemContract(
        MEMBER_PASSWORD_SETUP_TEMPLATE.name,
        MEMBER_PASSWORD_SETUP_TEMPLATE.body
      )
    ).not.toThrow();
  });

  it('accepts the maintained password-recovery defaults in every locale', () => {
    expect(() =>
      assertEmailTemplateSystemContract(
        PASSWORD_RECOVERY_TEMPLATE.name,
        PASSWORD_RECOVERY_TEMPLATE.body
      )
    ).not.toThrow();
  });

  it('uses informal German address across all 19 recipient-facing defaults', () => {
    const formalAddress = /\b(?:Sie|Ihnen|Ihr(?:e|er|em|en|es)?)\b/;

    expect(RECIPIENT_TEMPLATE_NAMES).toHaveLength(19);
    for (const name of RECIPIENT_TEMPLATE_NAMES) {
      const template = definition(name);
      expect(template.subject.de, `${name} subject`).not.toMatch(formalAddress);
      expect(template.body.de, `${name} body`).not.toMatch(formalAddress);
    }
  });

  it('leaves the three internal administrator alert defaults outside the voice rewrite', () => {
    for (const name of [
      'application_admin_alert',
      'taster_session_admin_alert',
      'guest_play_admin_alert',
    ]) {
      expect(definition(name)).toEqual(
        PRE_B1_SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.find(
          (template) => template.name === name
        )
      );
    }
  });

  it('preserves the established capability semantics in the new recipient defaults', () => {
    for (const locale of ['de', 'en', 'zh'] as const) {
      const guestCopy = [
        definition('guest_play_received').body[locale],
        definition('guest_play_approved').body[locale],
      ].join('\n');
      const tasterInvite = definition('taster_session_invited').body[locale];
      const passwordRecovery = definition('password_recovery').body[locale];
      const passwordSetup = definition('member_password_setup').body[locale];
      const emailChange = [
        definition('email_change_verification').body[locale],
        definition('email_change_confirmed').body[locale],
      ].join('\n');

      expect(guestCopy).toMatch(
        locale === 'de'
          ? /keine Buchung[\s\S]*garantiert keine Spielzeit/
          : locale === 'en'
            ? /not a booking[\s\S]*does not guarantee playing time/
            : /不是预订[\s\S]*不保证上场时间/
      );
      expect(tasterInvite).toMatch(
        locale === 'de'
          ? /keine Buchung oder bestätigte Teilnahme/
          : locale === 'en'
            ? /not a booking or confirmed attendance/
            : /并非预约或出席确认/
      );
      expect(passwordRecovery).toContain('{{resetLink}}');
      expect(passwordRecovery).toContain('{{expiresIn}}');
      expect(passwordRecovery).toMatch(
        locale === 'de'
          ? /einmal verwendet[\s\S]*ignorieren/
          : locale === 'en'
            ? /used once[\s\S]*ignore/
            : /只能使用一次[\s\S]*忽略/
      );
      expect(passwordSetup.toLowerCase()).not.toMatch(/administrator|管理员/);
      expect(emailChange).toContain('DCBV');
      expect(emailChange).not.toContain('BC Trossingen');
    }
  });

  it('uses ordinary club language for Taster preferences and Guest Play places', () => {
    const tasterCopy = [
      definition('taster_session_received').body.de,
      definition('taster_session_received').body.zh,
      definition('taster_session_invited').body.de,
      definition('taster_session_invited').body.zh,
    ].join('\n');
    const guestApproval = definition('guest_play_approved').body;

    expect(tasterCopy).not.toMatch(
      /unverbindliche (?:Zeit)?Präferenz|非约束性(?:时间)?偏好/
    );
    expect(definition('taster_session_received').body.zh).toContain(
      '具体时间还需要俱乐部确认'
    );
    expect(guestApproval.de).toContain('hält keinen Platz frei');
    expect(guestApproval.en).toContain('does not hold a place');
    expect(guestApproval.zh).toContain('不会为你预留名额');
    expect(guestApproval.zh).not.toContain('不保留容量');
  });
});
