import { beforeEach, describe, expect, it, vi } from 'vitest';
import nodemailer, { type Transport } from 'nodemailer';
import type MailMessage from 'nodemailer/lib/mailer/mail-message';
import type MimeNode from 'nodemailer/lib/mime-node';
import { config } from '../../config';
import { EmailTemplate } from '../../models/EmailTemplate';
import EmailService from '../../services/emailService';
import {
  MEMBER_PASSWORD_SETUP_TEMPLATE,
  SYSTEM_EMAIL_TEMPLATE_CONTRACTS,
} from '../../services/emailTemplateSystemContract';

function templateWithBody(body = MEMBER_PASSWORD_SETUP_TEMPLATE.body) {
  return {
    ...structuredClone(MEMBER_PASSWORD_SETUP_TEMPLATE),
    body,
    isActive: true,
  };
}

interface GeneratedEmail {
  envelope: MimeNode.Envelope;
  message: Buffer;
}

function createCaptureTransport(
  messages: GeneratedEmail[]
): Transport<GeneratedEmail> {
  return {
    name: 'capture',
    version: '1.0.0',
    send(
      mail: MailMessage<GeneratedEmail>,
      callback: (error: Error | null, info: GeneratedEmail) => void
    ) {
      const chunks: Buffer[] = [];
      const stream = mail.message.createReadStream();
      stream.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.once('error', (error: Error) =>
        callback(error, undefined as never)
      );
      stream.once('end', () => {
        const message = {
          envelope: mail.message.getEnvelope(),
          message: Buffer.concat(chunks),
        };
        messages.push(message);
        callback(null, message);
      });
    },
  };
}

beforeEach(() => vi.restoreAllMocks());

describe('EmailService password-setup template delivery', () => {
  it('fails before SMTP when the active runtime template omits the setup link', async () => {
    const invalid = {
      ...MEMBER_PASSWORD_SETUP_TEMPLATE.body,
      de: MEMBER_PASSWORD_SETUP_TEMPLATE.body.de.replace('{{resetLink}}', ''),
    };
    vi.spyOn(EmailTemplate, 'findOne').mockResolvedValue(
      templateWithBody(invalid) as never
    );
    const sendEmail = vi.spyOn(EmailService, 'sendEmail').mockResolvedValue();

    await expect(
      EmailService.sendFromTemplate(
        'member_password_setup',
        'member@example.test',
        'de',
        {
          firstName: 'Test',
          lastName: 'Member',
          email: 'member@example.test',
          resetLink: 'https://club.example.test/setup/token',
          expiresIn: '7 Tage',
        }
      )
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('renders current administrator content with the setup link and actual expiry', async () => {
    const customBody = {
      ...MEMBER_PASSWORD_SETUP_TEMPLATE.body,
      de: 'Willkommen {{firstName}} {{lastName}} ({{email}}): {{resetLink}} (gültig {{expiresIn}})',
    };
    vi.spyOn(EmailTemplate, 'findOne').mockResolvedValue(
      templateWithBody(customBody) as never
    );
    const sendEmail = vi.spyOn(EmailService, 'sendEmail').mockResolvedValue();

    await EmailService.sendFromTemplate(
      'member_password_setup',
      'member@example.test',
      'de',
      {
        firstName: 'Test',
        lastName: 'Member',
        email: 'member@example.test',
        resetLink: 'https://club.example.test/setup/token',
        expiresIn: '7 Tage',
      }
    );

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'member@example.test',
        text: 'Willkommen Test Member (member@example.test): https://club.example.test/setup/token (gültig 7 Tage)',
      })
    );
  });

  it.each([
    'de',
    'en',
    'zh',
  ] as const)('keeps dynamic values inert and HTML-safe for %s delivery', async (locale) => {
    const body = {
      de: '{{#if firstName}}<strong>{{firstName}}</strong>{{/if}} {{lastName}} {{email}} {{resetLink}} {{expiresIn}}',
      en: '{{#if firstName}}<strong>{{firstName}}</strong>{{/if}} {{lastName}} {{email}} {{resetLink}} {{expiresIn}}',
      zh: '{{#if firstName}}<strong>{{firstName}}</strong>{{/if}} {{lastName}} {{email}} {{resetLink}} {{expiresIn}}',
    };
    vi.spyOn(EmailTemplate, 'findOne').mockResolvedValue(
      templateWithBody(body) as never
    );
    const sendEmail = vi.spyOn(EmailService, 'sendEmail').mockResolvedValue();
    const injectedValue =
      '<img src=x onerror="alert(1)"> & {{lastName}} {{#if email}}changed{{/if}}';

    await EmailService.sendFromTemplate(
      'member_password_setup',
      'member@example.test',
      locale,
      {
        firstName: injectedValue,
        lastName: 'Member',
        email: 'member@example.test',
        resetLink: 'https://club.example.test/setup?one=1&two=2',
        expiresIn: '7 days',
      }
    );

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: `${injectedValue} Member member@example.test https://club.example.test/setup?one=1&two=2 7 days`,
        html: expect.stringContaining(`<html lang="${locale}">`),
      })
    );
    const html = vi.mocked(sendEmail).mock.calls[0]?.[0].html;
    expect(html).toContain(
      '<strong>&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; {{lastName}} {{#if email}}changed{{/if}}</strong>'
    );
    expect(html).toContain('https://club.example.test/setup?one=1&amp;two=2');
    expect(html).not.toContain('<img src=x');
  });

  it.each([
    [
      'de',
      'noreply@dcbev.de',
      'Diese E-Mail wurde automatisch über das DCBV-System versendet. Bitte nicht direkt auf diese E-Mail antworten. Kontakt: info@club.invalid.',
    ],
    [
      'en',
      'DCBV <noreply@dcbev.de>',
      'This email was sent automatically via the DCBV system. Please do not reply directly to this email. Contact: info@club.invalid.',
    ],
    [
      'zh',
      'DCBV Team <NOREPLY@DCBEV.DE>',
      '此邮件由 DCBV 系统自动发送，请勿直接回复此邮件。如需联系，请使用 info@club.invalid。',
    ],
  ] as const)('adds the localized noreply envelope for %s template delivery', async (locale, from, notice) => {
    vi.spyOn(EmailTemplate, 'findOne').mockResolvedValue(
      templateWithBody() as never
    );
    const sendEmail = vi.spyOn(EmailService, 'sendEmail').mockResolvedValue();
    const originalFrom = config.smtp.from;
    config.smtp.from = from;

    try {
      await EmailService.sendFromTemplate(
        'member_password_setup',
        'member@example.test',
        locale,
        {
          firstName: 'Test',
          lastName: 'Member',
          email: 'member@example.test',
          resetLink: 'https://club.example.test/setup/token',
          expiresIn: '7 days',
        }
      );

      const sent = vi.mocked(sendEmail).mock.calls[0]?.[0];
      expect(sent?.text).toContain(`\n\n${notice}`);
      expect(sent?.html).toContain(`<p>${notice}</p>`);
    } finally {
      config.smtp.from = originalFrom;
    }
  });

  it('does not add a noreply notice for a different configured sender', async () => {
    vi.spyOn(EmailTemplate, 'findOne').mockResolvedValue(
      templateWithBody() as never
    );
    const sendEmail = vi.spyOn(EmailService, 'sendEmail').mockResolvedValue();
    const originalFrom = config.smtp.from;
    config.smtp.from = 'club-office@dcbev.de';

    try {
      await EmailService.sendFromTemplate(
        'member_password_setup',
        'member@example.test',
        'en',
        {
          firstName: 'Test',
          lastName: 'Member',
          email: 'member@example.test',
          resetLink: 'https://club.example.test/setup/token',
          expiresIn: '7 days',
        }
      );

      const sent = vi.mocked(sendEmail).mock.calls[0]?.[0];
      expect(sent?.text).not.toContain('Please do not reply');
      expect(sent?.html).not.toContain('Please do not reply');
    } finally {
      config.smtp.from = originalFrom;
    }
  });

  it.each(
    SYSTEM_EMAIL_TEMPLATE_CONTRACTS.filter(
      (contract) => contract.requiredVariables.length > 0
    )
  )('blocks $name before transport when a required runtime value is absent', async (contract) => {
    const bodyText = contract.requiredVariables
      .map((variable) => `{{${variable}}}`)
      .join(' ');
    vi.spyOn(EmailTemplate, 'findOne').mockResolvedValue({
      name: contract.name,
      subject: { de: 'Subject', en: 'Subject', zh: 'Subject' },
      body: { de: bodyText, en: bodyText, zh: bodyText },
      isActive: true,
    } as never);
    const sendEmail = vi.spyOn(EmailService, 'sendEmail').mockResolvedValue();
    const variables = Object.fromEntries(
      contract.requiredVariables
        .slice(1)
        .map((variable) => [variable, variable])
    );

    await expect(
      EmailService.sendFromTemplate(
        contract.name,
        'recipient@example.test',
        'de',
        variables
      )
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it.each([
    'oldEmail',
    'newEmail',
  ] as const)('blocks email_change_confirmed when %s is absent', async (missingVariable) => {
    const variables = {
      oldEmail: 'old@example.test',
      newEmail: 'new@example.test',
    };
    delete variables[missingVariable];
    vi.spyOn(EmailTemplate, 'findOne').mockResolvedValue({
      name: 'email_change_confirmed',
      subject: { de: 'Bestätigung', en: 'Confirmation', zh: '确认' },
      body: {
        de: '{{oldEmail}} -> {{newEmail}}',
        en: '{{oldEmail}} -> {{newEmail}}',
        zh: '{{oldEmail}} -> {{newEmail}}',
      },
      isActive: true,
    } as never);
    const sendEmail = vi.spyOn(EmailService, 'sendEmail').mockResolvedValue();

    await expect(
      EmailService.sendFromTemplate(
        'email_change_confirmed',
        'new@example.test',
        'de',
        variables
      )
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('renders distinct old and new addresses in email_change_confirmed', async () => {
    vi.spyOn(EmailTemplate, 'findOne').mockResolvedValue({
      name: 'email_change_confirmed',
      subject: { de: 'Geändert', en: 'Changed', zh: '已更改' },
      body: {
        de: '{{oldEmail}} -> {{newEmail}}',
        en: '{{oldEmail}} -> {{newEmail}}',
        zh: '{{oldEmail}} -> {{newEmail}}',
      },
      isActive: true,
    } as never);
    const sendEmail = vi.spyOn(EmailService, 'sendEmail').mockResolvedValue();

    await EmailService.sendFromTemplate(
      'email_change_confirmed',
      'new@example.test',
      'de',
      { oldEmail: 'old@example.test', newEmail: 'new@example.test' }
    );

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'old@example.test -> new@example.test' })
    );
  });

  it('keeps normal delivery diagnostics free of message and recipient data', async () => {
    const serviceState = EmailService as unknown as {
      transporter: { sendMail: ReturnType<typeof vi.fn> } | null;
      isInitialized: boolean;
    };
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const originalFrom = config.smtp.from;
    config.smtp.from = 'sender@example.test';
    serviceState.transporter = { sendMail: vi.fn().mockResolvedValue({}) };
    serviceState.isInitialized = true;

    try {
      await EmailService.sendEmail({
        to: 'private-recipient@example.test',
        subject: 'Private subject',
        html: '<p>Credential https://example.test/?token=secret</p>',
      });
      const diagnostics = JSON.stringify(consoleLog.mock.calls);
      expect(diagnostics).not.toContain('private-recipient@example.test');
      expect(diagnostics).not.toContain('Private subject');
      expect(diagnostics).not.toContain('token=secret');
    } finally {
      config.smtp.from = originalFrom;
      serviceState.transporter = null;
      serviceState.isInitialized = false;
    }
  });

  it('delivers hidden recipients only through the envelope while retaining the visible-recipient default', async () => {
    const messages: GeneratedEmail[] = [];
    const captureTransport = nodemailer.createTransport(
      createCaptureTransport(messages)
    );
    const serviceState = EmailService as unknown as {
      transporter: typeof captureTransport | null;
      isInitialized: boolean;
    };
    const originalFrom = config.smtp.from;
    config.smtp.from = 'sender@example.test';
    serviceState.transporter = captureTransport;
    serviceState.isInitialized = true;

    try {
      await EmailService.sendEmail({
        bcc: ['first-alert@example.test', 'second-alert@example.test'],
        subject: 'Guest Play alert',
        html: '<p>Private alert</p>',
      });
      await EmailService.sendEmail({
        to: 'visible-recipient@example.test',
        subject: 'Member receipt',
        html: '<p>Visible receipt</p>',
      });

      const hidden = messages[0];
      const visible = messages[1];
      expect(hidden?.envelope.to).toEqual([
        'first-alert@example.test',
        'second-alert@example.test',
      ]);
      if (!hidden || !visible) {
        throw new Error('Expected buffered generated email messages');
      }

      const hiddenHeaders = hidden.message
        .toString('utf8')
        .split(/\r?\n\r?\n/, 1)[0];
      const visibleHeaders = visible.message
        .toString('utf8')
        .split(/\r?\n\r?\n/, 1)[0];

      expect(hiddenHeaders).not.toContain('first-alert@example.test');
      expect(hiddenHeaders).not.toContain('second-alert@example.test');
      expect(hiddenHeaders).not.toMatch(/^To:/m);
      expect(hiddenHeaders).not.toMatch(/^Bcc:/m);
      expect(visibleHeaders).toContain('To: visible-recipient@example.test');
    } finally {
      config.smtp.from = originalFrom;
      serviceState.transporter = null;
      serviceState.isInitialized = false;
    }
  });

  it('requires the sender from the shared SMTP configuration without a fallback', async () => {
    const serviceState = EmailService as unknown as {
      transporter: { sendMail: ReturnType<typeof vi.fn> } | null;
      isInitialized: boolean;
    };
    const originalFrom = config.smtp.from;
    const sendMail = vi.fn();
    config.smtp.from = undefined;
    serviceState.transporter = { sendMail };
    serviceState.isInitialized = true;

    try {
      await expect(
        EmailService.sendEmail({
          to: 'recipient@example.test',
          subject: 'Subject',
          html: '<p>Body</p>',
        })
      ).rejects.toMatchObject({ statusCode: 500 });
      expect(sendMail).not.toHaveBeenCalled();
    } finally {
      config.smtp.from = originalFrom;
      serviceState.transporter = null;
      serviceState.isInitialized = false;
    }
  });

  it('does not log raw SMTP verification errors', async () => {
    const serviceState = EmailService as unknown as {
      transporter: { verify: ReturnType<typeof vi.fn> } | null;
      isInitialized: boolean;
    };
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    serviceState.transporter = {
      verify: vi.fn().mockRejectedValue(new Error('raw-secret-marker')),
    };
    serviceState.isInitialized = true;

    try {
      await expect(EmailService.verifyConnection()).resolves.toBe(false);
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
        'raw-secret-marker'
      );
    } finally {
      serviceState.transporter = null;
      serviceState.isInitialized = false;
    }
  });
});
