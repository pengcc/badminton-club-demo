import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from '../config';
import { EmailTemplate } from '../models/EmailTemplate';
import { AppError } from '../utils/errors';
import {
  renderEmailTemplateText,
  renderLocalizedEmailTemplate,
} from './emailTemplateRenderer';

/**
 * Email Service
 *
 * Handles email sending with template support.
 * - Production: Uses IONOS SMTP
 * - Development: Auto-generates Ethereal test account
 * - Test: Uses mock transporter
 */

interface EmailAttachment {
  filename: string;
  content: Buffer;
}

type EmailRecipient =
  | { to: string; bcc?: never }
  | { to?: never; bcc: string[] };

type EmailOptions = EmailRecipient & {
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
};

type TemplateRecipient = string | { bcc: string[]; to?: never };

interface TemplateVariables {
  [key: string]: string | number | boolean | undefined;
}

type EmailLocale = 'de' | 'en' | 'zh';

const NOREPLY_NOTICES: Record<EmailLocale, string> = {
  de: 'Diese E-Mail wurde automatisch über das DCBV-System versendet. Bitte nicht direkt auf diese E-Mail antworten. Kontakt: info@club.invalid.',
  en: 'This email was sent automatically via the DCBV system. Please do not reply directly to this email. Contact: info@club.invalid.',
  zh: '此邮件由 DCBV 系统自动发送，请勿直接回复此邮件。如需联系，请使用 info@club.invalid。',
};

function configuredSenderAddress(from: string | undefined): string | null {
  if (!from) return null;
  const angleAddress = from.match(/<\s*([^<>]+)\s*>\s*$/)?.[1];
  return (angleAddress ?? from).trim().toLowerCase();
}

class EmailService {
  private static transporter: Transporter | null = null;
  private static isInitialized = false;

  /**
   * Initialize email transporter
   * Selects the environment-owned transport explicitly.
   */
  static async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const isDevelopment = config.nodeEnv === 'development';
    const isTest = config.nodeEnv === 'test';

    if (isTest) {
      // Test environment: Use mock transporter
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      console.log('📧 Email Service: Test mode (mock transporter)');
    } else if (
      isDevelopment &&
      config.developmentEmailTransport === 'ethereal'
    ) {
      // Development defaults to Ethereal even when real SMTP values exist.
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        console.log('📧 Email Service: Development mode (Ethereal)');
        console.log(`   Preview URL: https://ethereal.email/messages`);
      } catch (error) {
        console.error('Email transporter initialization failed');
        throw error;
      }
    } else {
      // Production SMTP, or development SMTP after explicit opt-in.
      const transportOptions = {
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
      };

      if (
        !transportOptions.host ||
        !transportOptions.auth.user ||
        !transportOptions.auth.pass ||
        (isDevelopment && !config.smtp.from)
      ) {
        throw new AppError(
          'SMTP configuration missing. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env',
          500
        );
      }

      this.transporter = nodemailer.createTransport(transportOptions);
      console.log(
        isDevelopment
          ? '📧 Email Service: Development mode (explicit SMTP)'
          : '📧 Email Service: Production mode (SMTP)'
      );
    }

    this.isInitialized = true;
  }

  /**
   * Send email with raw HTML content
   */
  static async sendEmail(options: EmailOptions): Promise<void> {
    const from = config.smtp.from;
    if (!from) {
      throw new AppError(
        'SMTP sender missing. Set SMTP_FROM in the API environment.',
        500
      );
    }

    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.transporter) {
      throw new AppError('Email transporter not initialized', 500);
    }

    const recipients =
      options.to !== undefined ? { to: options.to } : { bcc: options.bcc };

    await this.transporter.sendMail({
      from,
      ...recipients,
      subject: options.subject,
      html: options.html,
      text: options.text || this.stripHtml(options.html),
      attachments: options.attachments,
    });

    console.log('📧 Email delivery completed');
  }

  /**
   * Render template with variable substitution
   * Supports simple {{variable}} syntax
   */
  static renderTemplate(
    template: string,
    variables: TemplateVariables
  ): string {
    return renderEmailTemplateText(template, variables);
  }

  /**
   * Send email using database template
   */
  static async sendFromTemplate(
    templateName: string,
    recipient: TemplateRecipient,
    locale: 'de' | 'en' | 'zh',
    variables: TemplateVariables,
    options?: { attachments?: EmailAttachment[] }
  ): Promise<void> {
    // Fetch template from database
    const template = await EmailTemplate.findOne({
      name: templateName,
      isActive: true,
    });

    if (!template) {
      throw new AppError(`Email template not found: ${templateName}`, 404);
    }

    const rendered = renderLocalizedEmailTemplate({
      name: template.name,
      subject: template.subject,
      body: template.body,
      locale,
      variables,
    });
    const noreplyNotice =
      configuredSenderAddress(config.smtp.from) === 'noreply@dcbev.de'
        ? NOREPLY_NOTICES[locale]
        : null;

    // Send email
    await this.sendEmail({
      ...(typeof recipient === 'string' ? { to: recipient } : recipient),
      subject: rendered.subject,
      html: this.wrapInHtmlTemplate(rendered.htmlBody, locale, noreplyNotice),
      text: noreplyNotice
        ? `${rendered.body}\n\n${noreplyNotice}`
        : rendered.body,
      attachments: options?.attachments,
    });
  }

  /**
   * Preview rendered template without sending
   */
  static async previewTemplate(
    templateName: string,
    locale: 'de' | 'en' | 'zh',
    variables: TemplateVariables
  ): Promise<{ subject: string; body: string }> {
    const template = await EmailTemplate.findOne({
      name: templateName,
      isActive: true,
    });

    if (!template) {
      throw new AppError(`Email template not found: ${templateName}`, 404);
    }

    return renderLocalizedEmailTemplate({
      name: template.name,
      subject: template.subject,
      body: template.body,
      locale,
      variables,
    });
  }

  /**
   * Wrap plain text in basic HTML template
   */
  private static wrapInHtmlTemplate(
    content: string,
    locale: EmailLocale,
    noreplyNotice: string | null
  ): string {
    return `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #1e40af;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 5px 5px 0 0;
    }
    .content {
      background-color: #f9fafb;
      padding: 30px;
      border-radius: 0 0 5px 5px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Deutsch-Chinesischer Badminton Verein</h1>
  </div>
  <div class="content">
    ${content.replace(/\n/g, '<br>')}
  </div>
  <div class="footer">
    ${noreplyNotice ? `<p>${noreplyNotice}</p>` : ''}
    <p>DCBV e.V.<br>
    Deutsch-Chinesischer Badminton Verein<br>
    <a href="mailto:info@club.invalid">info@club.invalid</a></p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Strip HTML tags for plain text version
   */
  private static stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  /**
   * Verify SMTP connection
   */
  static async verifyConnection(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch {
      console.error('SMTP connection verification failed');
      return false;
    }
  }
}

export default EmailService;
