import { AppError } from '../utils/errors';
import { ACCOUNT_ONBOARDING_EMAIL_CONTRACTS } from './emailContracts/accountOnboarding';
import { AUTHENTICATION_EMAIL_CONTRACTS } from './emailContracts/authentication';
import { EMAIL_CHANGE_EMAIL_CONTRACTS } from './emailContracts/emailChange';
import { GUEST_PLAY_EMAIL_CONTRACTS } from './emailContracts/guestPlay';
import { MEMBERSHIP_APPLICATION_EMAIL_CONTRACTS } from './emailContracts/membershipApplication';
import { TASTER_SESSION_EMAIL_CONTRACTS } from './emailContracts/tasterSession';
import {
  EMAIL_TEMPLATE_LOCALES,
  type CapabilityEmailTemplateContract,
  type EmailTemplateLocale,
} from './emailContracts/types';

export { EMAIL_TEMPLATE_LOCALES };
export type { EmailTemplateLocale };

export interface LocalizedTemplateContent {
  de: string;
  en: string;
  zh: string;
}

export interface SystemEmailTemplateDefinition {
  name: string;
  subject: LocalizedTemplateContent;
  body: LocalizedTemplateContent;
  variables: string[];
}

export const PRE_B1_MEMBER_PASSWORD_SETUP_TEMPLATE: SystemEmailTemplateDefinition =
  {
    name: 'member_password_setup',
    subject: {
      de: 'Ihr Zugang zum DCBV',
      en: 'Your DCBV Account Access',
      zh: '您的DCBV账户访问',
    },
    body: {
      de: `Liebe(r) {{firstName}} {{lastName}},

ein Administrator hat für Sie ein Konto beim DCBV erstellt.

E-Mail: {{email}}

Bitte klicken Sie auf den folgenden Link, um Ihr Passwort zu setzen:
{{resetLink}}

Dieser Link ist {{expiresIn}} gültig.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit sportlichen Grüßen,
DCBV Vorstand`,
      en: `Dear {{firstName}} {{lastName}},

An administrator has created an account for you at DCBV.

Email: {{email}}

Please click the following link to set your password:
{{resetLink}}

This link is valid for {{expiresIn}}.

If you have any questions, please feel free to contact us.

Best regards,
DCBV Board`,
      zh: `亲爱的 {{firstName}} {{lastName}}，

管理员已为您在DCBV创建了一个账户。

电子邮件：{{email}}

请点击以下链接设置您的密码：
{{resetLink}}

此链接有效期为{{expiresIn}}。

如有任何问题，请随时与我们联系。

此致
DCBV董事会`,
    },
    variables: ['firstName', 'lastName', 'email', 'resetLink', 'expiresIn'],
  };

export const MEMBER_PASSWORD_SETUP_TEMPLATE: SystemEmailTemplateDefinition = {
  name: 'member_password_setup',
  subject: {
    de: 'Dein Zugang zum DCBV',
    en: 'Your DCBV account access',
    zh: '你的 DCBV 账户访问',
  },
  body: {
    de: `Hallo {{firstName}} {{lastName}},

für dich steht ein DCBV-Konto bereit.

E-Mail: {{email}}

Lege über diesen Link dein Passwort fest:
{{resetLink}}

Der Link ist {{expiresIn}} gültig.

Sportliche Grüße
dein DCBV-Team`,
    en: `Hello {{firstName}} {{lastName}},

your DCBV account is ready.

Email: {{email}}

Use this link to set your password.
{{resetLink}}

The link is valid for {{expiresIn}}.

Best regards,
your DCBV team`,
    zh: `{{firstName}} {{lastName}}，你好：

你的 DCBV 账户已经准备好。

电子邮箱：{{email}}

请通过以下链接设置密码：
{{resetLink}}

链接有效期为 {{expiresIn}}。

DCBV 团队`,
  },
  variables: ['firstName', 'lastName', 'email', 'resetLink', 'expiresIn'],
};

export const PRE_B1_PASSWORD_RECOVERY_TEMPLATE: SystemEmailTemplateDefinition =
  {
    name: 'password_recovery',
    subject: {
      de: 'Passwort für Ihr DCBV-Konto zurücksetzen',
      en: 'Reset your DCBV account password',
      zh: '重置您的DCBV账户密码',
    },
    body: {
      de: `Sie haben eine Passwort-Wiederherstellung angefordert.\n\nÖffnen Sie diesen Link, um ein neues Passwort festzulegen:\n{{resetLink}}\n\nDer Link ist {{expiresIn}} gültig. Wenn Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.`,
      en: `A password recovery was requested for your account.\n\nOpen this link to choose a new password.\n{{resetLink}}\n\nThe link is valid for {{expiresIn}}. If you did not request this, you can ignore this email.`,
      zh: `有人请求恢复您账户的密码。\n\n请打开此链接设置新密码：\n{{resetLink}}\n\n此链接有效期为{{expiresIn}}。如果您没有提出此请求，可以忽略此邮件。`,
    },
    variables: ['resetLink', 'expiresIn'],
  };

export const PASSWORD_RECOVERY_TEMPLATE: SystemEmailTemplateDefinition = {
  name: 'password_recovery',
  subject: {
    de: 'Passwort für dein DCBV-Konto zurücksetzen',
    en: 'Reset your DCBV account password',
    zh: '重置你的 DCBV 账户密码',
  },
  body: {
    de: `Für dein DCBV-Konto wurde eine Passwort-Wiederherstellung angefordert.\n\nÖffne diesen Link, um ein neues Passwort festzulegen:\n{{resetLink}}\n\nDer Link ist {{expiresIn}} gültig und kann einmal verwendet werden. Wenn du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.`,
    en: `A password reset was requested for your DCBV account.\n\nOpen this link to choose a new password.\n{{resetLink}}\n\nThe link is valid for {{expiresIn}} and can be used once. If you did not request this, you can ignore this email.`,
    zh: `有人请求重置你的 DCBV 账户密码。\n\n请打开以下链接设置新密码：\n{{resetLink}}\n\n链接有效期为 {{expiresIn}}，且只能使用一次。如果这不是你发起的请求，可以忽略此邮件。`,
  },
  variables: ['resetLink', 'expiresIn'],
};

export const LEGACY_MEMBER_PASSWORD_SETUP_BODY: LocalizedTemplateContent = {
  de: PRE_B1_MEMBER_PASSWORD_SETUP_TEMPLATE.body.de.replace(
    '{{expiresIn}}',
    '24 Stunden'
  ),
  en: PRE_B1_MEMBER_PASSWORD_SETUP_TEMPLATE.body.en.replace(
    '{{expiresIn}}',
    '24 hours'
  ),
  zh: PRE_B1_MEMBER_PASSWORD_SETUP_TEMPLATE.body.zh.replace(
    '{{expiresIn}}',
    '24小时'
  ),
};

export const OBSOLETE_MEMBER_INVITATION_TEMPLATE_NAME = 'member_invitation';

export const SYSTEM_EMAIL_TEMPLATE_CONTRACTS = [
  ...AUTHENTICATION_EMAIL_CONTRACTS,
  ...MEMBERSHIP_APPLICATION_EMAIL_CONTRACTS,
  ...ACCOUNT_ONBOARDING_EMAIL_CONTRACTS,
  ...TASTER_SESSION_EMAIL_CONTRACTS,
  ...GUEST_PLAY_EMAIL_CONTRACTS,
  ...EMAIL_CHANGE_EMAIL_CONTRACTS,
] as const satisfies readonly CapabilityEmailTemplateContract[];

const CONTRACTS_BY_NAME = new Map<string, CapabilityEmailTemplateContract>(
  SYSTEM_EMAIL_TEMPLATE_CONTRACTS.map((contract) => [contract.name, contract])
);

export function getSystemEmailTemplateContract(name: string) {
  return CONTRACTS_BY_NAME.get(name) ?? null;
}

function containsVariable(content: string, variable: string): boolean {
  return new RegExp(`{{\\s*${variable}\\s*}}`).test(content);
}

export interface EmailTemplateContractViolation {
  locale: EmailTemplateLocale;
  missingVariables: string[];
}

export function findEmailTemplateContractViolations(
  name: string,
  body: LocalizedTemplateContent
): EmailTemplateContractViolation[] {
  const contract = getSystemEmailTemplateContract(name);
  if (!contract) return [];
  return contract.supportedLocales.flatMap((locale) => {
    const missingVariables = contract.requiredVariables.filter(
      (variable) => !containsVariable(body[locale], variable)
    );
    return missingVariables.length > 0
      ? [{ locale, missingVariables: [...missingVariables] }]
      : [];
  });
}

export function assertEmailTemplateSystemContract(
  name: string,
  body: LocalizedTemplateContent
): void {
  const violations = findEmailTemplateContractViolations(name, body);
  if (violations.length === 0) return;
  const details = violations
    .map(
      ({ locale, missingVariables }) =>
        `${locale}: ${missingVariables.map((value) => `{{${value}}}`).join(', ')}`
    )
    .join('; ');
  throw AppError.validation(
    `Template ${name} is missing required body variables (${details})`,
    { violations }
  );
}

export function assertEmailTemplateRenderContract(
  name: string,
  locale: string,
  variables: Record<string, unknown>
) {
  if (!(EMAIL_TEMPLATE_LOCALES as readonly string[]).includes(locale)) {
    throw AppError.validation(`Unsupported email template locale: ${locale}`);
  }
  const supportedLocale = locale as EmailTemplateLocale;
  const contract = getSystemEmailTemplateContract(name);
  if (!contract) return;
  if (!contract.supportedLocales.includes(supportedLocale)) {
    throw AppError.validation(
      `Template ${name} does not support locale ${supportedLocale}`
    );
  }
  const missingVariables = contract.requiredVariables.filter(
    (variable) => !(variable in variables)
  );
  if (missingVariables.length > 0) {
    throw AppError.validation(
      `Template ${name} is missing render variables for ${supportedLocale}: ${missingVariables
        .map((variable) => `{{${variable}}}`)
        .join(', ')}`,
      { locale: supportedLocale, missingVariables }
    );
  }
}

export function emailTemplateCatalogContract(name: string) {
  const contract = getSystemEmailTemplateContract(name);
  return contract
    ? {
        senderStatus: contract.senderStatus,
        owner: contract.owner,
        supportedLocales: [...contract.supportedLocales],
        availableVariables: [...contract.availableVariables],
        requiredVariables: [...contract.requiredVariables],
      }
    : {
        senderStatus: 'unconsumed' as const,
        owner: null,
        supportedLocales: [] as EmailTemplateLocale[],
        availableVariables: [] as string[],
        requiredVariables: [] as string[],
      };
}
