import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadApiEnvironment } from '../config/apiEnvironment';
import { EmailTemplate } from '../models/EmailTemplate';
import {
  EMAIL_TEMPLATE_LOCALES,
  findEmailTemplateContractViolations,
  getSystemEmailTemplateContract,
  LEGACY_MEMBER_PASSWORD_SETUP_BODY,
  MEMBER_PASSWORD_SETUP_TEMPLATE,
  PASSWORD_RECOVERY_TEMPLATE,
  PRE_B1_MEMBER_PASSWORD_SETUP_TEMPLATE,
  PRE_B1_PASSWORD_RECOVERY_TEMPLATE,
  OBSOLETE_MEMBER_INVITATION_TEMPLATE_NAME,
  type SystemEmailTemplateDefinition,
} from '../services/emailTemplateSystemContract';

// Load env based on NODE_ENV
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const currentFilePath = fileURLToPath(import.meta.url);
const apiDir = path.resolve(__dirname, '../../');

loadApiEnvironment({ apiDirectory: apiDir });

/**
 * Seed Email Templates
 *
 * Creates default email templates for the application.
 * Run with: pnpm tsx src/scripts/seedEmailTemplates.ts
 */

const preB1Templates: SystemEmailTemplateDefinition[] = [
  PRE_B1_PASSWORD_RECOVERY_TEMPLATE,
  {
    name: 'application_documents',
    subject: {
      de: 'Ihre aktuellen Mitgliedsantragsdokumente',
      en: 'Your current membership application documents',
      zh: '您当前的会员申请文件',
    },
    body: {
      de: 'Hallo {{firstName}},\n\nim Anhang finden Sie die von Ihnen angeforderten aktuellen Dokumente: {{documents}}.',
      en: 'Hello {{firstName}},\n\nAttached are the current documents you requested: {{documents}}.',
      zh: '{{firstName}}，您好：\n\n附件是您申请的当前文件：{{documents}}。',
    },
    variables: ['firstName', 'documents'],
  },
  {
    name: 'application_verify_email',
    subject: {
      de: 'E-Mail-Adresse für den Mitgliedsantrag bestätigen',
      en: 'Verify your email for the membership application',
      zh: '验证会员申请邮箱',
    },
    body: {
      de: 'Öffnen Sie innerhalb von 30 Minuten diesen einmalig verwendbaren Link:\n\n{{accessUrl}}',
      en: 'Open this single-use link within 30 minutes:\n\n{{accessUrl}}',
      zh: '请在30分钟内打开此一次性链接：\n\n{{accessUrl}}',
    },
    variables: ['accessUrl'],
  },
  {
    name: 'application_access',
    subject: {
      de: 'Ihren Mitgliedsantrag öffnen',
      en: 'Open your membership application',
      zh: '打开您的会员申请',
    },
    body: {
      de: 'Öffnen Sie innerhalb von 30 Minuten diesen einmalig verwendbaren Link:\n\n{{accessUrl}}',
      en: 'Open this single-use link within 30 minutes:\n\n{{accessUrl}}',
      zh: '请在30分钟内打开此一次性链接：\n\n{{accessUrl}}',
    },
    variables: ['accessUrl'],
  },
  {
    name: 'application_verify_email_change',
    subject: {
      de: 'Neue E-Mail-Adresse bestätigen',
      en: 'Verify your new email address',
      zh: '验证新邮箱地址',
    },
    body: {
      de: 'Bestätigen Sie die neue Adresse innerhalb von 30 Minuten:\n\n{{accessUrl}}',
      en: 'Confirm the new address within 30 minutes:\n\n{{accessUrl}}',
      zh: '请在30分钟内确认新邮箱地址：\n\n{{accessUrl}}',
    },
    variables: ['accessUrl'],
  },
  {
    name: 'application_access_guidance',
    subject: {
      de: 'Hinweis zu Ihrem Mitgliedsantrag',
      en: 'Membership application guidance',
      zh: '会员申请提示',
    },
    body: { de: '{{message}}', en: '{{message}}', zh: '{{message}}' },
    variables: ['message'],
  },
  {
    name: 'application_received',
    subject: {
      de: 'Bestätigung Ihres Mitgliedsantrags',
      en: 'Membership Application Confirmation',
      zh: '会员申请确认',
    },
    body: {
      de: `Liebe(r) {{firstName}} {{lastName}},

vielen Dank für Ihren Mitgliedsantrag beim DCBV!

Ihre Bewerbung wurde erfolgreich eingereicht und wird in Kürze von unserem Vorstand geprüft. Sie erhalten eine weitere E-Mail, sobald Ihr Antrag bearbeitet wurde.

Antragsnummer: {{applicationId}}

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit sportlichen Grüßen,
DCBV Vorstand`,
      en: `Dear {{firstName}} {{lastName}},

Thank you for your membership application to DCBV!

Your application has been successfully submitted and will be reviewed by our board shortly. You will receive another email once your application has been processed.

Application ID: {{applicationId}}

If you have any questions, please feel free to contact us.

Best regards,
DCBV Board`,
      zh: `亲爱的 {{firstName}} {{lastName}}，

感谢您向DCBV提交会员申请！

您的申请已成功提交，我们的董事会将很快审核。一旦您的申请被处理，您将收到另一封电子邮件。

申请编号：{{applicationId}}

如有任何问题，请随时与我们联系。

此致
DCBV董事会`,
    },
    variables: ['firstName', 'lastName', 'applicationId'],
  },
  {
    name: 'application_admin_alert',
    subject: {
      de: 'Neuer Mitgliedsantrag wartet auf Prüfung',
      en: 'New Membership Application Pending Review',
      zh: '新会员申请待审核',
    },
    body: {
      de: `Hallo Admin,

ein neuer Mitgliedsantrag ist eingegangen und wartet auf Ihre Prüfung.

Antragsteller: {{applicantName}}
E-Mail: {{email}}
Mitgliedschaftstyp: {{membershipType}}

Bitte prüfen Sie den Antrag im Dashboard:
{{applicationUrl}}

Mit freundlichen Grüßen,
DCBV Vorstand`,
      en: `Hello Admin,

A new membership application has been submitted and is awaiting your review.

Applicant: {{applicantName}}
Email: {{email}}
Membership Type: {{membershipType}}

Please review the application in the dashboard:
{{applicationUrl}}

Best regards,
DCBV Vorstand`,
      zh: `管理员您好，

已提交新的会员申请，等待您的审核。

申请人：{{applicantName}}
电子邮件：{{email}}
会员类型：{{membershipType}}

请在仪表板中查看申请：
{{applicationUrl}}

此致
DCBV系统`,
    },
    variables: ['applicantName', 'email', 'membershipType', 'applicationUrl'],
  },
  {
    name: 'application_approved',
    subject: {
      de: 'Willkommen beim DCBV!',
      en: 'Welcome to DCBV!',
      zh: '欢迎加入DCBV！',
    },
    body: {
      de: `Liebe(r) {{firstName}} {{lastName}},

wir freuen uns, Ihnen mitteilen zu können, dass Ihr Mitgliedsantrag genehmigt wurde. Herzlich willkommen beim DCBV!

{{#if approvalMessage}}
Hinweis vom Vorstand: {{approvalMessage}}
{{/if}}

{{setupGuidance}}

Wir freuen uns darauf, Sie bald auf dem Platz zu sehen!

Mit sportlichen Grüßen,
DCBV Vorstand`,
      en: `Dear {{firstName}} {{lastName}},

We are pleased to inform you that your membership application has been approved. Welcome to DCBV!

{{#if approvalMessage}}
Note from the board: {{approvalMessage}}
{{/if}}

{{setupGuidance}}

We look forward to seeing you on the court soon!

Best regards,
DCBV Board`,
      zh: `亲爱的 {{firstName}} {{lastName}}，

我们很高兴地通知您，您的会员申请已获批准。欢迎加入DCBV！

{{#if approvalMessage}}
董事会备注：{{approvalMessage}}
{{/if}}

{{setupGuidance}}

我们期待很快在球场上见到您！

此致
DCBV董事会`,
    },
    variables: ['firstName', 'lastName', 'approvalMessage', 'setupGuidance'],
  },
  {
    name: 'application_rejected',
    subject: {
      de: 'Zu Ihrem Mitgliedsantrag',
      en: 'Regarding Your Membership Application',
      zh: '关于您的会员申请',
    },
    body: {
      de: `Liebe(r) {{firstName}} {{lastName}},

vielen Dank für Ihr Interesse am DCBV und Ihren Mitgliedsantrag.

Leider können wir Ihrem Antrag zum jetzigen Zeitpunkt nicht entsprechen.

Grund: {{reason}}

Bei Fragen oder für weitere Informationen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen,
DCBV Vorstand`,
      en: `Dear {{firstName}} {{lastName}},

Thank you for your interest in DCBV and your membership application.

Unfortunately, we are unable to approve your application at this time.

Reason: {{reason}}

If you have any questions or need further information, please feel free to contact us.

Best regards,
DCBV Board`,
      zh: `亲爱的 {{firstName}} {{lastName}}，

感谢您对DCBV的关注和您的会员申请。

很遗憾，我们目前无法批准您的申请。

原因：{{reason}}

如有任何问题或需要更多信息，请随时与我们联系。

此致
DCBV董事会`,
    },
    variables: ['firstName', 'lastName', 'reason'],
  },
  {
    name: 'application_contact',
    subject: {
      de: 'Nachricht zu Ihrem Mitgliedsantrag',
      en: 'Message Regarding Your Membership Application',
      zh: '关于您的会员申请的消息',
    },
    body: {
      de: `Liebe(r) {{firstName}} {{lastName}},

{{message}}

Bei weiteren Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen,
{{senderName}}
DCBV`,
      en: `Dear {{firstName}} {{lastName}},

{{message}}

If you have any further questions, please feel free to contact us.

Best regards,
{{senderName}}
DCBV`,
      zh: `亲爱的 {{firstName}} {{lastName}}，

{{message}}

如有任何其他问题，请随时与我们联系。

此致
{{senderName}}
DCBV`,
    },
    variables: ['firstName', 'lastName', 'message', 'senderName'],
  },
  PRE_B1_MEMBER_PASSWORD_SETUP_TEMPLATE,
  {
    name: 'trial_training_received',
    subject: {
      de: 'Bestätigung Ihrer Probetraining-Anfrage',
      en: 'Trial Training Request Confirmation',
      zh: '试训申请确认',
    },
    body: {
      de: `Liebe(r) {{name}},\n\nvielen Dank für Ihre Anfrage zum Probetraining beim DCBV!\n\nIhre Anfrage wurde erfolgreich eingereicht und wird in Kürze von unserem Team bearbeitet.\n\n{{#if appointmentDetails}}{{appointmentDetails}}\n\n{{/if}}Sie erhalten eine weitere E-Mail, sobald wir einen Termin für Sie gefunden haben.\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nMit sportlichen Grüßen,\nDCBV Team`,
      en: `Dear {{name}},\n\nThank you for your trial training request to DCBV!\n\nYour request has been successfully submitted and will be processed by our team shortly.\n\n{{#if appointmentDetails}}{{appointmentDetails}}\n\n{{/if}}You will receive another email once we have found a suitable date for you.\n\nIf you have any questions, please feel free to contact us.\n\nBest regards,\nDCBV Team`,
      zh: `亲爱的 {{name}}，\n\n感谢您向DCBV提交试训申请！\n\n您的申请已成功提交，我们的团队将很快处理。\n\n{{#if appointmentDetails}}{{appointmentDetails}}\n\n{{/if}}一旦我们为您找到合适的日期，您将收到另一封电子邮件。\n\n如有任何问题，请随时与我们联系。\n\n此致\nDCBV团队`,
    },
    variables: ['name', 'appointmentDetails'],
  },
  {
    name: 'trial_training_admin_alert',
    subject: {
      de: 'Neue Probetraining-Anfrage',
      en: 'New Trial Training Request',
      zh: '新试训申请',
    },
    body: {
      de: `Eine neue Probetraining-Anfrage wurde eingereicht:\n\nName: {{name}}\nE-Mail: {{email}}\nSpieler-Level: {{playerLevel}}\n\n{{appointmentDetails}}\n\nNachricht: {{message}}\n\nBitte überprüfen Sie die Anfrage im Dashboard: {{requestUrl}}`,
      en: `A new trial training request has been submitted:\n\nName: {{name}}\nEmail: {{email}}\nPlayer Level: {{playerLevel}}\n\n{{appointmentDetails}}\n\nMessage: {{message}}\n\nPlease review the request in the dashboard: {{requestUrl}}`,
      zh: `已提交新的试训申请：\n\n姓名：{{name}}\n电子邮件：{{email}}\n球员水平：{{playerLevel}}\n\n{{appointmentDetails}}\n\留言：{{message}}\n\n请在仪表板中查看申请：{{requestUrl}}`,
    },
    variables: [
      'name',
      'email',
      'playerLevel',
      'message',
      'requestUrl',
      'appointmentDetails',
    ],
  },
  {
    name: 'taster_session_received',
    subject: {
      de: 'Bestätigung Ihrer Schnuppertraining-Anfrage',
      en: 'Taster Session Request Confirmation',
      zh: '新人体验活动申请确认',
    },
    body: {
      de: `Liebe(r) {{name}},\n\nvielen Dank für Ihre Anfrage zum Schnuppertraining beim DCBV. Ihre Anfrage wurde gespeichert; die gewählte Zeit ist nur eine unverbindliche Präferenz.\n\n{{preferenceDetails}}\n\nUnser Team meldet sich zur weiteren Abstimmung.\n\nMit sportlichen Grüßen,\nDCBV Team`,
      en: `Dear {{name}},\n\nThank you for your DCBV Taster Session request. Your request has been saved; the selected time is a non-binding preference only.\n\n{{preferenceDetails}}\n\nOur team will follow up to make arrangements.\n\nBest regards,\nDCBV Team`,
      zh: `亲爱的 {{name}}：\n\n感谢您申请参加 DCBV 新人体验活动。申请已保存；所选时间仅为非约束性偏好。\n\n{{preferenceDetails}}\n\n管理员将联系您进一步安排。\n\nDCBV 团队`,
    },
    variables: ['name', 'preferenceDetails'],
  },
  {
    name: 'taster_session_admin_alert',
    subject: {
      de: 'Neue Schnuppertraining-Anfrage',
      en: 'New Taster Session Request',
      zh: '新的新人体验活动申请',
    },
    body: {
      de: `Eine neue Schnuppertraining-Anfrage wurde eingereicht:\n\nName: {{name}}\nE-Mail: {{email}}\nSelbsteinschätzung: {{playerLevel}}\nPräferenz: {{preferenceDetails}}\nNachricht: {{message}}\n\nDashboard: {{requestUrl}}`,
      en: `A new Taster Session request was submitted:\n\nName: {{name}}\nEmail: {{email}}\nSelf-identification: {{playerLevel}}\nPreference: {{preferenceDetails}}\nMessage: {{message}}\n\nDashboard: {{requestUrl}}`,
      zh: `已提交新的新人体验活动申请：\n\n姓名：{{name}}\n电子邮件：{{email}}\n自我分类：{{playerLevel}}\n偏好：{{preferenceDetails}}\n留言：{{message}}\n\n管理页面：{{requestUrl}}`,
    },
    variables: [
      'name',
      'email',
      'playerLevel',
      'message',
      'requestUrl',
      'preferenceDetails',
    ],
  },
  {
    name: 'taster_session_invited',
    subject: {
      de: 'Einladung zum Schnuppertraining',
      en: 'Taster Session Invitation',
      zh: '新人体验活动邀请',
    },
    body: {
      de: `Liebe(r) {{name}},\n\nwir laden Sie gerne zum Schnuppertraining ein.\n\nIhre unverbindliche Präferenz: {{preferenceDetails}}\n\nMit sportlichen Grüßen,\nDCBV Team`,
      en: `Dear {{name}},\n\nwe are pleased to invite you to a Taster Session.\n\nYour non-binding preference: {{preferenceDetails}}\n\nBest regards,\nDCBV Team`,
      zh: `亲爱的 {{name}}：\n\n我们很高兴邀请您参加新人体验活动。\n\n您的非约束性偏好：{{preferenceDetails}}\n\nDCBV 团队`,
    },
    variables: ['name', 'preferenceDetails'],
  },
  {
    name: 'taster_session_declined',
    subject: {
      de: 'Zu Ihrer Schnuppertraining-Anfrage',
      en: 'Regarding Your Taster Session Request',
      zh: '关于您的新人体验活动申请',
    },
    body: {
      de: `Liebe(r) {{name}},\n\nleider können wir Ihrer Schnuppertraining-Anfrage nicht entsprechen.\n\nGrund: {{declineReason}} {{declineReasonDetails}}\n\nMit sportlichen Grüßen,\nDCBV Team`,
      en: `Dear {{name}},\n\nunfortunately, we cannot proceed with your Taster Session request.\n\nReason: {{declineReason}} {{declineReasonDetails}}\n\nBest regards,\nDCBV Team`,
      zh: `亲爱的 {{name}}：\n\n很遗憾，我们无法继续安排您的新人体验活动申请。\n\n原因：{{declineReason}} {{declineReasonDetails}}\n\nDCBV 团队`,
    },
    variables: ['name', 'declineReason', 'declineReasonDetails'],
  },
  {
    name: 'trial_training_contacted',
    subject: {
      de: 'Einladung zum Probetraining',
      en: 'Trial Training Invitation',
      zh: '试训邀请',
    },
    body: {
      de: `Liebe(r) {{name}},

wir freuen uns, Sie zu einem Probetraining einzuladen!

{{#if appointmentDetails}}Bezugnehmend auf Ihren Wunschtermin: {{appointmentDetails}}{{/if}}

{{#if adminNotes}}{{adminNotes}}

{{/if}}Wir freuen uns darauf, Sie kennenzulernen!

Mit sportlichen Grüßen,
DCBV Team`,
      en: `Dear {{name}},

We are pleased to invite you to a trial training session!

{{#if appointmentDetails}}Regarding your requested date: {{appointmentDetails}}{{/if}}

{{#if adminNotes}}{{adminNotes}}

{{/if}}We look forward to meeting you!

Best regards,
DCBV Team`,
      zh: `亲爱的 {{name}}，

我们很高兴邀请您参加试训！

{{#if appointmentDetails}}关于您申请的日期：{{appointmentDetails}}{{/if}}

{{#if adminNotes}}{{adminNotes}}

{{/if}}我们期待与您见面！

此致
DCBV团队`,
    },
    variables: ['name', 'adminNotes', 'appointmentDetails'],
  },
  {
    name: 'trial_training_no_capacity',
    subject: {
      de: 'Probetraining-Anfrage - Keine Kapazität',
      en: 'Trial Training Request - No Capacity',
      zh: '试训申请 - 无名额',
    },
    body: {
      de: `Liebe(r) {{name}},

vielen Dank für Ihr Interesse an einem Probetraining beim DCBV.

{{#if appointmentDetails}}Bezugnehmend auf Ihren Wunschtermin: {{appointmentDetails}}{{/if}}

Leider haben wir derzeit keine freien Kapazitäten für neue Probetrainings.

{{#if adminNotes}}{{adminNotes}}

{{/if}}Wir bedauern, Ihnen keine bessere Nachricht übermitteln zu können.

Mit sportlichen Grüßen,
DCBV Team`,
      en: `Dear {{name}},

Thank you for your interest in a trial training session at DCBV.

{{#if appointmentDetails}}Regarding your requested date: {{appointmentDetails}}{{/if}}

Unfortunately, we currently do not have capacity for new trial sessions.

{{#if adminNotes}}{{adminNotes}}

{{/if}}We regret that we cannot provide better news.

Best regards,
DCBV Team`,
      zh: `亲爱的 {{name}}，

感谢您对DCBV试训的兴趣。

{{#if appointmentDetails}}关于您申请的日期：{{appointmentDetails}}{{/if}}

很遗憾，我们目前没有新试训的名额。

{{#if adminNotes}}{{adminNotes}}

{{/if}}我们很抱歉无法提供更好的消息。

此致
DCBV团队`,
    },
    variables: ['name', 'adminNotes', 'appointmentDetails'],
  },
  {
    name: 'guest_play_received',
    subject: {
      de: 'Bestätigung Ihrer Gästespiel-Anfrage',
      en: 'Guest Play Request Confirmation',
      zh: '客座球员申请确认',
    },
    body: {
      de: `Liebe(r) {{memberName}},

vielen Dank für Ihre Anfrage, Gäste zu einem Clubspiel mitzubringen.

Ihre Anfrage wurde erfolgreich eingereicht:
- Anzahl der Gäste: {{guestCount}}
- Termin: {{appointmentDetails}}

Unser Team prüft die Anfrage. Dies ist noch keine Buchung oder Teilnahmegarantie.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit sportlichen Grüßen,
DCBV Team`,
      en: `Dear {{memberName}},

Thank you for asking permission to bring guests to a club play session.

Your request has been successfully submitted:
- Number of guests: {{guestCount}}
- Session: {{appointmentDetails}}

Our team will review the request. This is not a booking or guarantee of playing time.

If you have any questions, please feel free to contact us.

Best regards,
DCBV Team`,
      zh: `亲爱的 {{memberName}}，

感谢您申请携带亲友参加一次俱乐部打球活动！

您的申请已成功提交：
- 客人数量：{{guestCount}}
- 时间：{{appointmentDetails}}

我们的团队将审核申请。这不是预订，也不保证上场时间。

如有任何问题，请随时与我们联系。

此致
DCBV团队`,
    },
    variables: ['memberName', 'guestCount', 'appointmentDetails'],
  },
  {
    name: 'guest_play_admin_alert',
    subject: {
      de: 'Neue Gästespiel-Anfrage',
      en: 'New Guest Play Request',
      zh: '新客座球员申请',
    },
    body: {
      de: `Eine neue Gästespiel-Anfrage wurde eingereicht:

Mitglied: {{memberName}}
E-Mail: {{memberEmail}}
Anzahl der Gäste: {{guestCount}}
Termin: {{appointmentDetails}}

Nachricht: {{message}}

Bitte überprüfen Sie die Anfrage im Dashboard: {{requestUrl}}`,
      en: `A new guest play request has been submitted:

Member: {{memberName}}
Email: {{memberEmail}}
Number of guests: {{guestCount}}
Session: {{appointmentDetails}}

Message: {{message}}

Please review the request in the dashboard: {{requestUrl}}`,
      zh: `已提交新的客座球员申请：

会员：{{memberName}}
电子邮件：{{memberEmail}}
客人数量：{{guestCount}}
时间：{{appointmentDetails}}

留言：{{message}}

请在仪表板中查看申请：{{requestUrl}}`,
    },
    variables: [
      'memberName',
      'memberEmail',
      'guestCount',
      'message',
      'requestUrl',
      'appointmentDetails',
    ],
  },
  {
    name: 'guest_play_approved',
    subject: {
      de: 'Gästespiel-Anfrage genehmigt',
      en: 'Guest Play Request Approved',
      zh: '客座球员申请已批准',
    },
    body: {
      de: `Liebe(r) {{memberName}},

Sie dürfen die angegebene Anzahl Gäste zu diesem Clubspiel mitbringen.

Details:
- Anzahl der Gäste: {{guestCount}}
- Termin: {{appointmentDetails}}

Die Genehmigung ist keine Buchung, reserviert keine Kapazität und garantiert keine Spielzeit.

Mit sportlichen Grüßen,
DCBV Team`,
      en: `Dear {{memberName}},

You may bring the stated number of guests to this club play session.

Details:
- Number of guests: {{guestCount}}
- Session: {{appointmentDetails}}

Permission is not a booking, does not reserve capacity, and does not guarantee playing time.

Best regards,
DCBV Team`,
      zh: `亲爱的 {{memberName}}，

您可以携带所申请数量的亲友参加此次俱乐部打球活动。

详情：
- 客人数量：{{guestCount}}
- 时间：{{appointmentDetails}}

此许可不是预订，不保留场地容量，也不保证上场时间。

此致
DCBV团队`,
    },
    variables: ['memberName', 'guestCount', 'appointmentDetails'],
  },
  {
    name: 'guest_play_declined',
    subject: {
      de: 'Gästespiel-Anfrage - Absage',
      en: 'Guest Play Request - Declined',
      zh: '客座球员申请 - 已拒绝',
    },
    body: {
      de: `Liebe(r) {{memberName}},

leider können wir Ihre Anfrage für {{guestCount}} Gäste für folgende Vereins-Spielzeit nicht genehmigen:

{{appointmentDetails}}

Sie können für einen anderen zukünftigen Termin eine neue Anfrage stellen.

Mit sportlichen Grüßen,
DCBV Team`,
      en: `Dear {{memberName}},

unfortunately, we cannot approve your request for {{guestCount}} guest(s) for the following club play session:

{{appointmentDetails}}

You may submit a new request for another future date.

Best regards,
DCBV Team`,
      zh: `亲爱的 {{memberName}}，

很遗憾，我们无法批准您携带 {{guestCount}} 位亲友参加以下俱乐部打球时段的申请：

{{appointmentDetails}}

您可以为其他未来日期重新提交申请。

此致
DCBV团队`,
    },
    variables: ['memberName', 'guestCount', 'appointmentDetails'],
  },
  {
    name: 'email_change_verification',
    subject: {
      de: 'E-Mail-Adresse bestätigen',
      en: 'Verify Email Address',
      zh: '验证电子邮件地址',
    },
    body: {
      de: `Hallo {{name}},

Sie haben eine Änderung Ihrer E-Mail-Adresse beantragt.

Bitte klicken Sie auf den folgenden Link, um Ihre neue E-Mail-Adresse zu bestätigen:

{{verificationUrl}}

Dieser Link ist {{expiresIn}} gültig.

Wenn Sie diese Änderung nicht beantragt haben, ignorieren Sie diese E-Mail bitte.

Mit freundlichen Grüßen,
BC Trossingen`,
      en: `Hello {{name}},

You have requested to change your email address.

Please click the following link to verify your new email address:

{{verificationUrl}}

This link is valid for {{expiresIn}}.

If you did not request this change, please ignore this email.

Best regards,
BC Trossingen`,
      zh: `您好 {{name}}，

您已请求更改您的电子邮件地址。

请点击以下链接以验证您的新电子邮件地址：

{{verificationUrl}}

此链接有效期为 {{expiresIn}}。

如果您没有请求此更改，请忽略此电子邮件。

此致
BC Trossingen`,
    },
    variables: ['name', 'verificationUrl', 'expiresIn'],
  },
  {
    name: 'email_change_confirmed',
    subject: {
      de: 'E-Mail-Adresse erfolgreich geändert',
      en: 'Email Address Successfully Changed',
      zh: '电子邮件地址已成功更改',
    },
    body: {
      de: `Hallo {{name}},

Ihre E-Mail-Adresse wurde erfolgreich geändert.

Alte E-Mail: {{oldEmail}}
Neue E-Mail: {{newEmail}}

Sie können sich jetzt mit Ihrer neuen E-Mail-Adresse anmelden.

Wenn Sie diese Änderung nicht vorgenommen haben, kontaktieren Sie uns bitte umgehend.

Mit freundlichen Grüßen,
BC Trossingen`,
      en: `Hello {{name}},

Your email address has been successfully changed.

Old Email: {{oldEmail}}
New Email: {{newEmail}}

You can now log in with your new email address.

If you did not make this change, please contact us immediately.

Best regards,
BC Trossingen`,
      zh: `您好 {{name}}，

您的电子邮件地址已成功更改。

旧电子邮件：{{oldEmail}}
新电子邮件：{{newEmail}}

您现在可以使用新的电子邮件地址登录。

如果您没有进行此更改，请立即联系我们。

此致
BC Trossingen`,
    },
    variables: ['name', 'oldEmail', 'newEmail'],
  },
];

const b1TemplateDefaults: SystemEmailTemplateDefinition[] = [
  PASSWORD_RECOVERY_TEMPLATE,
  {
    name: 'application_documents',
    subject: {
      de: 'Deine aktuellen Mitgliedsantragsdokumente',
      en: 'Your current membership application documents',
      zh: '你的最新会员申请文件',
    },
    body: {
      de: 'Hallo {{firstName}},\n\nim Anhang findest du die angeforderten aktuellen Dokumente: {{documents}}.',
      en: 'Hello {{firstName}},\n\nAttached are the current documents you requested: {{documents}}.',
      zh: '{{firstName}}，你好：\n\n附件中是你申请的最新文件：{{documents}}。',
    },
    variables: ['firstName', 'documents'],
  },
  {
    name: 'application_verify_email',
    subject: {
      de: 'E-Mail-Adresse für deinen Mitgliedsantrag bestätigen',
      en: 'Verify your email for the membership application',
      zh: '验证会员申请邮箱',
    },
    body: {
      de: 'Öffne innerhalb von 30 Minuten diesen einmal verwendbaren Link, um deine E-Mail-Adresse zu bestätigen:\n\n{{accessUrl}}',
      en: 'Open this single-use link within 30 minutes to verify your email address:\n\n{{accessUrl}}',
      zh: '请在 30 分钟内打开此一次性链接，验证你的电子邮箱：\n\n{{accessUrl}}',
    },
    variables: ['accessUrl'],
  },
  {
    name: 'application_access',
    subject: {
      de: 'Deinen Mitgliedsantrag öffnen',
      en: 'Open your membership application',
      zh: '打开你的会员申请',
    },
    body: {
      de: 'Öffne innerhalb von 30 Minuten diesen einmal verwendbaren Link, um deinen Mitgliedsantrag aufzurufen:\n\n{{accessUrl}}',
      en: 'Open this single-use link within 30 minutes to access your membership application:\n\n{{accessUrl}}',
      zh: '请在 30 分钟内打开此一次性链接，进入你的会员申请：\n\n{{accessUrl}}',
    },
    variables: ['accessUrl'],
  },
  {
    name: 'application_verify_email_change',
    subject: {
      de: 'Deine neue E-Mail-Adresse bestätigen',
      en: 'Verify your new email address',
      zh: '验证你的新邮箱地址',
    },
    body: {
      de: 'Bestätige innerhalb von 30 Minuten deine neue E-Mail-Adresse:\n\n{{accessUrl}}',
      en: 'Confirm your new email address within 30 minutes:\n\n{{accessUrl}}',
      zh: '请在 30 分钟内确认你的新电子邮箱：\n\n{{accessUrl}}',
    },
    variables: ['accessUrl'],
  },
  {
    name: 'application_access_guidance',
    subject: {
      de: 'Hinweis zu deinem Mitgliedsantrag',
      en: 'Membership application guidance',
      zh: '会员申请提示',
    },
    body: { de: '{{message}}', en: '{{message}}', zh: '{{message}}' },
    variables: ['message'],
  },
  {
    name: 'application_received',
    subject: {
      de: 'Dein Mitgliedsantrag ist eingegangen',
      en: 'We received your membership application',
      zh: '我们已收到你的会员申请',
    },
    body: {
      de: `Hallo {{firstName}} {{lastName}},

danke für deinen Mitgliedsantrag beim DCBV. Dein Antrag ist eingegangen und wird vom Vorstand geprüft.

Wir informieren dich per E-Mail, sobald eine Entscheidung vorliegt.

Sportliche Grüße
dein DCBV-Team`,
      en: `Hello {{firstName}} {{lastName}},

thank you for applying to join DCBV. We received your application, and our board will review it.

We will email you when a decision has been made.

Best regards,
your DCBV team`,
      zh: `{{firstName}} {{lastName}}，你好：

感谢你申请加入 DCBV。我们已经收到申请，俱乐部理事会将进行审核。

有结果后，我们会通过邮件通知你。

DCBV 团队`,
    },
    variables: ['firstName', 'lastName'],
  },
  {
    name: 'application_approved',
    subject: {
      de: 'Willkommen beim DCBV!',
      en: 'Welcome to DCBV!',
      zh: '欢迎加入 DCBV！',
    },
    body: {
      de: `Hallo {{firstName}} {{lastName}},

dein Mitgliedsantrag wurde genehmigt. Herzlich willkommen beim DCBV!

{{#if approvalMessage}}Hinweis vom Vorstand: {{approvalMessage}}

{{/if}}{{setupGuidance}}

Wir freuen uns, dich bald auf dem Platz zu sehen.

Sportliche Grüße
dein DCBV-Team`,
      en: `Hello {{firstName}} {{lastName}},

your membership application has been approved. Welcome to DCBV!

{{#if approvalMessage}}Note from the board: {{approvalMessage}}

{{/if}}{{setupGuidance}}

We look forward to seeing you on court.

Best regards,
your DCBV team`,
      zh: `{{firstName}} {{lastName}}，你好：

你的会员申请已获批准。欢迎加入 DCBV！

{{#if approvalMessage}}理事会留言：{{approvalMessage}}

{{/if}}{{setupGuidance}}

期待在球场上见到你。

DCBV 团队`,
    },
    variables: ['firstName', 'lastName', 'approvalMessage', 'setupGuidance'],
  },
  {
    name: 'application_rejected',
    subject: {
      de: 'Entscheidung zu deinem Mitgliedsantrag',
      en: 'Decision on your membership application',
      zh: '你的会员申请结果',
    },
    body: {
      de: `Hallo {{firstName}} {{lastName}},

danke für dein Interesse am DCBV. Leider können wir deinen Mitgliedsantrag derzeit nicht annehmen.

Grund: {{reason}}

Wenn du Fragen hast, erreichst du uns unter info@club.invalid.

Sportliche Grüße
dein DCBV-Team`,
      en: `Hello {{firstName}} {{lastName}},

thank you for your interest in DCBV. Unfortunately, we cannot accept your membership application at this time.

Reason: {{reason}}

If you have questions, contact us at info@club.invalid.

Best regards,
your DCBV team`,
      zh: `{{firstName}} {{lastName}}，你好：

感谢你关注 DCBV。很遗憾，我们目前无法接受你的会员申请。

原因：{{reason}}

如有疑问，请通过 info@club.invalid 联系我们。

DCBV 团队`,
    },
    variables: ['firstName', 'lastName', 'reason'],
  },
  {
    name: 'application_contact',
    subject: {
      de: 'Nachricht zu deinem Mitgliedsantrag',
      en: 'Message about your membership application',
      zh: '关于你的会员申请',
    },
    body: {
      de: `Hallo {{firstName}} {{lastName}},

{{message}}

Sportliche Grüße
{{senderName}}
DCBV`,
      en: `Hello {{firstName}} {{lastName}},

{{message}}

Best regards,
{{senderName}}
DCBV`,
      zh: `{{firstName}} {{lastName}}，你好：

{{message}}

{{senderName}}
DCBV`,
    },
    variables: ['firstName', 'lastName', 'message', 'senderName'],
  },
  MEMBER_PASSWORD_SETUP_TEMPLATE,
  {
    name: 'taster_session_received',
    subject: {
      de: 'Deine Schnuppertraining-Anfrage ist eingegangen',
      en: 'We received your Taster Session request',
      zh: '我们已收到你的新人体验活动申请',
    },
    body: {
      de: `Hallo {{name}},

danke für deine Schnuppertraining-Anfrage beim DCBV. Wir haben deine Anfrage erhalten. Die gewählte Zeit ist dein Wunschtermin und noch nicht bestätigt.

{{preferenceDetails}}

Wir melden uns, um deinen Besuch abzustimmen.

Sportliche Grüße
dein DCBV-Team`,
      en: `Hello {{name}},

thank you for your DCBV Taster Session request. We received it. The time you selected is your preferred time and has not been confirmed yet.

{{preferenceDetails}}

We will get in touch to arrange your visit.

Best regards,
your DCBV team`,
      zh: `{{name}}，你好：

感谢你申请参加 DCBV 新人体验活动。我们已经收到申请。你选择的是希望到访的时间，具体时间还需要俱乐部确认。

{{preferenceDetails}}

我们会联系你，进一步商定到访安排。

DCBV 团队`,
    },
    variables: ['name', 'preferenceDetails'],
  },
  {
    name: 'taster_session_invited',
    subject: {
      de: 'Einladung zum Schnuppertraining',
      en: 'Invitation to a DCBV Taster Session',
      zh: 'DCBV 新人体验活动邀请',
    },
    body: {
      de: `Hallo {{name}},

wir laden dich gerne zum Schnuppertraining beim DCBV ein.

Dein gewünschter Termin: {{preferenceDetails}}

Die Zeit ist noch keine Buchung oder bestätigte Teilnahme. Wir stimmen deinen konkreten Besuch mit dir ab.

Sportliche Grüße
dein DCBV-Team`,
      en: `Hello {{name}},

we would be happy to welcome you to a DCBV Taster Session.

Your preferred time: {{preferenceDetails}}

This time is not a booking or confirmed attendance. We will coordinate the details of your visit with you.

Best regards,
your DCBV team`,
      zh: `{{name}}，你好：

我们很高兴邀请你参加 DCBV 新人体验活动。

你希望到访的时间：{{preferenceDetails}}

该时间并非预约或出席确认。我们会与你联系，商定具体到访安排。

DCBV 团队`,
    },
    variables: ['name', 'preferenceDetails'],
  },
  {
    name: 'taster_session_declined',
    subject: {
      de: 'Entscheidung zu deiner Schnuppertraining-Anfrage',
      en: 'Decision on your Taster Session request',
      zh: '你的新人体验活动申请结果',
    },
    body: {
      de: `Hallo {{name}},

leider können wir deine Schnuppertraining-Anfrage derzeit nicht annehmen.

Grund: {{declineReason}} {{declineReasonDetails}}

Sportliche Grüße
dein DCBV-Team`,
      en: `Hello {{name}},

unfortunately, we cannot accept your Taster Session request at this time.

Reason: {{declineReason}} {{declineReasonDetails}}

Best regards,
your DCBV team`,
      zh: `{{name}}，你好：

很遗憾，我们目前无法接受你的新人体验活动申请。

原因：{{declineReason}} {{declineReasonDetails}}

DCBV 团队`,
    },
    variables: ['name', 'declineReason', 'declineReasonDetails'],
  },
  {
    name: 'guest_play_received',
    subject: {
      de: 'Deine Gästespiel-Anfrage ist eingegangen',
      en: 'We received your Guest Play request',
      zh: '我们已收到你的亲友同行申请',
    },
    body: {
      de: `Hallo {{memberName}},

danke für deine Anfrage, Gäste zu einer Club-Spielzeit mitzubringen.

- Gäste: {{guestCount}}
- Termin: {{appointmentDetails}}

Wir prüfen deine Anfrage. Das ist noch keine Buchung und garantiert keine Spielzeit.

Sportliche Grüße
dein DCBV-Team`,
      en: `Hello {{memberName}},

thank you for asking to bring guests to a club play session.

- Guests: {{guestCount}}
- Session: {{appointmentDetails}}

We will review your request. It is not a booking and does not guarantee playing time.

Best regards,
your DCBV team`,
      zh: `{{memberName}}，你好：

感谢你申请携带亲友参加俱乐部打球活动。

- 亲友人数：{{guestCount}}
- 时间：{{appointmentDetails}}

我们会审核你的申请。该申请不是预订，也不保证上场时间。

DCBV 团队`,
    },
    variables: ['memberName', 'guestCount', 'appointmentDetails'],
  },
  {
    name: 'guest_play_approved',
    subject: {
      de: 'Deine Gästespiel-Anfrage wurde genehmigt',
      en: 'Your Guest Play request was approved',
      zh: '你的亲友同行申请已获批准',
    },
    body: {
      de: `Hallo {{memberName}},

du darfst die angegebene Anzahl Gäste zu dieser Club-Spielzeit mitbringen.

- Gäste: {{guestCount}}
- Termin: {{appointmentDetails}}

Die Genehmigung ist keine Buchung, hält keinen Platz frei und garantiert keine Spielzeit.

Sportliche Grüße
dein DCBV-Team`,
      en: `Hello {{memberName}},

you may bring the stated number of guests to this club play session.

- Guests: {{guestCount}}
- Session: {{appointmentDetails}}

This permission is not a booking, does not hold a place, and does not guarantee playing time.

Best regards,
your DCBV team`,
      zh: `{{memberName}}，你好：

你可以携带所申请数量的亲友参加此次俱乐部打球活动。

- 亲友人数：{{guestCount}}
- 时间：{{appointmentDetails}}

这项许可不是预订，不会为你预留名额，也不保证上场时间。

DCBV 团队`,
    },
    variables: ['memberName', 'guestCount', 'appointmentDetails'],
  },
  {
    name: 'guest_play_declined',
    subject: {
      de: 'Deine Gästespiel-Anfrage wurde abgelehnt',
      en: 'Your Guest Play request was declined',
      zh: '你的亲友同行申请未获批准',
    },
    body: {
      de: `Hallo {{memberName}},

leider können wir deine Anfrage für {{guestCount}} Gäste zu dieser Club-Spielzeit nicht genehmigen:

{{appointmentDetails}}

Für einen anderen zukünftigen Termin kannst du eine neue Anfrage stellen.

Sportliche Grüße
dein DCBV-Team`,
      en: `Hello {{memberName}},

unfortunately, we cannot approve your request for {{guestCount}} guest(s) at this club play session:

{{appointmentDetails}}

You can submit a new request for another future date.

Best regards,
your DCBV team`,
      zh: `{{memberName}}，你好：

很遗憾，我们无法批准你携带 {{guestCount}} 位亲友参加以下俱乐部打球活动的申请：

{{appointmentDetails}}

你可以选择其他未来日期重新申请。

DCBV 团队`,
    },
    variables: ['memberName', 'guestCount', 'appointmentDetails'],
  },
  {
    name: 'email_change_verification',
    subject: {
      de: 'Deine neue E-Mail-Adresse bestätigen',
      en: 'Verify your new email address',
      zh: '验证你的新电子邮箱',
    },
    body: {
      de: `Hallo {{name}},

für dein DCBV-Konto wurde eine Änderung der E-Mail-Adresse angefordert.

Bestätige die neue Adresse über diesen Link:
{{verificationUrl}}

Der Link ist {{expiresIn}} gültig. Wenn du die Änderung nicht angefordert hast, kannst du diese E-Mail ignorieren.

Sportliche Grüße
dein DCBV-Team`,
      en: `Hello {{name}},

an email address change was requested for your DCBV account.

Confirm the new address using this link:
{{verificationUrl}}

The link is valid for {{expiresIn}}. If you did not request this change, you can ignore this email.

Best regards,
your DCBV team`,
      zh: `{{name}}，你好：

有人请求更改你的 DCBV 账户电子邮箱。

请通过以下链接确认新地址：
{{verificationUrl}}

链接有效期为 {{expiresIn}}。如果这不是你发起的请求，可以忽略此邮件。

DCBV 团队`,
    },
    variables: ['name', 'verificationUrl', 'expiresIn'],
  },
  {
    name: 'email_change_confirmed',
    subject: {
      de: 'Deine E-Mail-Adresse wurde geändert',
      en: 'Your email address was changed',
      zh: '你的电子邮箱已更改',
    },
    body: {
      de: `Hallo {{name}},

die E-Mail-Adresse für dein DCBV-Konto wurde geändert.

Alte E-Mail: {{oldEmail}}
Neue E-Mail: {{newEmail}}

Du kannst dich jetzt mit der neuen Adresse anmelden. Wenn du diese Änderung nicht vorgenommen hast, kontaktiere uns sofort unter info@club.invalid.

Sportliche Grüße
dein DCBV-Team`,
      en: `Hello {{name}},

the email address for your DCBV account was changed.

Old email: {{oldEmail}}
New email: {{newEmail}}

You can now sign in with the new address. If you did not make this change, contact us immediately at info@club.invalid.

Best regards,
your DCBV team`,
      zh: `{{name}}，你好：

你的 DCBV 账户电子邮箱已更改。

旧邮箱：{{oldEmail}}
新邮箱：{{newEmail}}

你现在可以使用新地址登录。如果这不是你进行的更改，请立即通过 info@club.invalid 联系我们。

DCBV 团队`,
    },
    variables: ['name', 'oldEmail', 'newEmail'],
  },
];

const b1DefaultsByName = new Map(
  b1TemplateDefaults.map((template) => [template.name, template])
);

const IMMEDIATE_PREDECESSOR_BODY_PHRASES: Partial<
  Record<
    string,
    Record<
      (typeof EMAIL_TEMPLATE_LOCALES)[number],
      { current: string; predecessor: string }
    >
  >
> = {
  taster_session_received: {
    de: {
      current:
        'Wir haben deine Anfrage erhalten. Die gewählte Zeit ist dein Wunschtermin und noch nicht bestätigt.',
      predecessor:
        'Deine Anfrage ist eingegangen; die gewählte Zeit ist nur eine unverbindliche Präferenz.',
    },
    en: {
      current:
        'We received it. The time you selected is your preferred time and has not been confirmed yet.',
      predecessor:
        'We received it; the selected time is only a non-binding preference.',
    },
    zh: {
      current:
        '我们已经收到申请。你选择的是希望到访的时间，具体时间还需要俱乐部确认。',
      predecessor: '我们已经收到申请；所选时间仅为非约束性偏好。',
    },
  },
  taster_session_invited: {
    de: {
      current: 'Dein gewünschter Termin:',
      predecessor: 'Deine unverbindliche Zeitpräferenz:',
    },
    en: {
      current: 'Your preferred time:',
      predecessor: 'Your non-binding time preference:',
    },
    zh: {
      current: '你希望到访的时间：',
      predecessor: '你的非约束性时间偏好：',
    },
  },
  guest_play_approved: {
    de: {
      current:
        'Die Genehmigung ist keine Buchung, hält keinen Platz frei und garantiert keine Spielzeit.',
      predecessor:
        'Die Genehmigung ist keine Buchung, reserviert keine Kapazität und garantiert keine Spielzeit.',
    },
    en: {
      current:
        'This permission is not a booking, does not hold a place, and does not guarantee playing time.',
      predecessor:
        'This permission is not a booking, does not reserve capacity, and does not guarantee playing time.',
    },
    zh: {
      current: '这项许可不是预订，不会为你预留名额，也不保证上场时间。',
      predecessor: '该许可不是预订，不保留容量，也不保证上场时间。',
    },
  },
};

const templates = preB1Templates.map(
  (template) => b1DefaultsByName.get(template.name) ?? template
);

export const LEGACY_GUEST_PLAY_DEFAULTS: Partial<
  Record<string, Pick<SystemEmailTemplateDefinition, 'body' | 'variables'>>
> = {
  guest_play_received: {
    body: {
      de: `Liebe(r) {{memberName}},

vielen Dank für Ihre Gästespiel-Anfrage beim DCBV!

Ihre Anfrage wurde erfolgreich eingereicht:
- Anzahl der Gäste: {{guestCount}}
- Termin: {{appointmentDetails}}

Unser Team wird Ihre Anfrage prüfen und Sie in Kürze über die Genehmigung informieren.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit sportlichen Grüßen,
DCBV Team`,
      en: `Dear {{memberName}},

Thank you for your guest play request to DCBV!

Your request has been successfully submitted:
- Number of guests: {{guestCount}}
- Session: {{appointmentDetails}}

Our team will review your request and inform you about the approval shortly.

If you have any questions, please feel free to contact us.

Best regards,
DCBV Team`,
      zh: `亲爱的 {{memberName}}，

感谢您向DCBV提交客座球员申请！

您的申请已成功提交：
- 客人数量：{{guestCount}}
- 时间：{{appointmentDetails}}

我们的团队将审核您的申请，并很快通知您批准情况。

如有任何问题，请随时与我们联系。

此致
DCBV团队`,
    },
    variables: ['memberName', 'guestCount', 'appointmentDetails'],
  },
  guest_play_approved: {
    body: {
      de: `Liebe(r) {{memberName}},

wir freuen uns, Ihnen mitteilen zu können, dass Ihre Gästespiel-Anfrage genehmigt wurde!

Details:
- Anzahl der Gäste: {{guestCount}}
- Termin: {{appointmentDetails}}

{{#if adminNotes}}Hinweis vom Team: {{adminNotes}}

{{/if}}Wir freuen uns darauf, Sie und Ihre Gäste auf dem Platz zu sehen!

Mit sportlichen Grüßen,
DCBV Team`,
      en: `Dear {{memberName}},

We are pleased to inform you that your guest play request has been approved!

Details:
- Number of guests: {{guestCount}}
- Session: {{appointmentDetails}}

{{#if adminNotes}}Note from the team: {{adminNotes}}

{{/if}}We look forward to seeing you and your guests on the court!

Best regards,
DCBV Team`,
      zh: `亲爱的 {{memberName}}，

我们很高兴地通知您，您的客座球员申请已获批准！

详情：
- 客人数量：{{guestCount}}
- 时间：{{appointmentDetails}}

{{#if adminNotes}}团队备注：{{adminNotes}}

{{/if}}我们期待在球场上见到您和您的客人！

此致
DCBV团队`,
    },
    variables: ['memberName', 'guestCount', 'appointmentDetails', 'adminNotes'],
  },
  guest_play_declined: {
    body: {
      de: `Liebe(r) {{memberName}},

vielen Dank für Ihre Gästespiel-Anfrage.

Leider können wir Ihrer Anfrage für diesen Termin nicht entsprechen.

{{#if adminNotes}}Grund: {{adminNotes}}

{{/if}}Bei Fragen oder für alternative Termine stehen wir Ihnen gerne zur Verfügung.

Mit sportlichen Grüßen,
DCBV Team`,
      en: `Dear {{memberName}},

Thank you for your guest play request.

Unfortunately, we are unable to accommodate your request for this session.

{{#if adminNotes}}Reason: {{adminNotes}}

{{/if}}If you have any questions or would like to discuss alternative dates, please feel free to contact us.

Best regards,
DCBV Team`,
      zh: `亲爱的 {{memberName}}，

感谢您的客座球员申请。

很遗憾，我们无法满足您对此时间段的申请。

{{#if adminNotes}}原因：{{adminNotes}}

{{/if}}如有任何问题或想讨论其他日期，请随时与我们联系。

此致
DCBV团队`,
    },
    variables: ['memberName', 'adminNotes'],
  },
};

export interface EmailTemplateReconciliationSummary {
  created: string[];
  gate5Skipped: string[];
  skipped: string[];
  contractUpdated: string[];
  defaultsUpdated: string[];
  customContentPreserved: string[];
  obsoleteDisabled: string[];
  reviewRequired: string[];
}

export interface TasterSessionTemplatePreflight {
  ready: boolean;
  customContentPreserved: string[];
  resolvedCustomizations: string[];
  reviewRequired: string[];
}

function sameVariables(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function isKnownImmediateB1BodyDefault(
  existing: {
    body: SystemEmailTemplateDefinition['body'];
    variables: string[];
  },
  definition: SystemEmailTemplateDefinition
): boolean {
  const phrases = IMMEDIATE_PREDECESSOR_BODY_PHRASES[definition.name];
  return Boolean(
    phrases &&
      sameVariables(existing.variables, definition.variables) &&
      EMAIL_TEMPLATE_LOCALES.every(
        (locale) =>
          existing.body[locale] ===
          definition.body[locale].replace(
            phrases[locale].current,
            phrases[locale].predecessor
          )
      )
  );
}

function isKnownImmediateB1Default(
  existing: {
    subject: SystemEmailTemplateDefinition['subject'];
    body: SystemEmailTemplateDefinition['body'];
    variables: string[];
  },
  definition: SystemEmailTemplateDefinition
): boolean {
  return (
    isKnownImmediateB1BodyDefault(existing, definition) &&
    EMAIL_TEMPLATE_LOCALES.every(
      (locale) => existing.subject[locale] === definition.subject[locale]
    )
  );
}

const TASTER_TEMPLATE_MIGRATIONS = [
  {
    legacyName: 'trial_training_received',
    canonicalName: 'taster_session_received',
  },
  {
    legacyName: 'trial_training_admin_alert',
    canonicalName: 'taster_session_admin_alert',
  },
  {
    legacyName: 'trial_training_contacted',
    canonicalName: 'taster_session_invited',
  },
  {
    legacyName: 'trial_training_no_capacity',
    canonicalName: 'taster_session_declined',
  },
] as const;

function isKnownSystemDefault(
  existing: {
    subject: SystemEmailTemplateDefinition['subject'];
    body: SystemEmailTemplateDefinition['body'];
    variables: string[];
  },
  definition: SystemEmailTemplateDefinition
): boolean {
  return (
    sameVariables(existing.variables, definition.variables) &&
    EMAIL_TEMPLATE_LOCALES.every(
      (locale) =>
        existing.subject[locale] === definition.subject[locale] &&
        existing.body[locale] === definition.body[locale]
    )
  );
}

function isKnownLegacyGuestPlayDefault(
  existing: {
    body: SystemEmailTemplateDefinition['body'];
    variables: string[];
  },
  name: string
): boolean {
  const legacy = LEGACY_GUEST_PLAY_DEFAULTS[name];
  return Boolean(
    legacy &&
      sameVariables(existing.variables, legacy.variables) &&
      EMAIL_TEMPLATE_LOCALES.every(
        (locale) => existing.body[locale] === legacy.body[locale]
      )
  );
}

function definitionContainsDeclaredVariables(
  definition: SystemEmailTemplateDefinition
): boolean {
  return EMAIL_TEMPLATE_LOCALES.every((locale) =>
    definition.variables.every((variable) =>
      new RegExp(`{{(?:#if\\s+)?${variable}(?:\\s*)}}`).test(
        definition.body[locale]
      )
    )
  );
}

function templateSatisfiesCanonicalContract(
  existing: {
    subject: SystemEmailTemplateDefinition['subject'];
    body: SystemEmailTemplateDefinition['body'];
    variables: string[];
    isActive: boolean;
  },
  definition: SystemEmailTemplateDefinition
): boolean {
  return (
    existing.isActive &&
    sameVariables(existing.variables, definition.variables) &&
    EMAIL_TEMPLATE_LOCALES.every(
      (locale) =>
        existing.subject[locale].trim().length > 0 &&
        existing.body[locale].trim().length > 0 &&
        definition.variables.every((variable) =>
          new RegExp(`{{(?:#if\\s+)?${variable}(?:\\s*)}}`).test(
            existing.body[locale]
          )
        )
    )
  );
}

function pushUnique(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

function templateDefinition(name: string): SystemEmailTemplateDefinition {
  const definition = templates.find((template) => template.name === name);
  if (!definition)
    throw new Error(`Missing system template definition: ${name}`);
  return definition;
}

function preB1TemplateDefinition(
  name: string
): SystemEmailTemplateDefinition | null {
  return preB1Templates.find((template) => template.name === name) ?? null;
}

function isKnownPreB1Default(
  existing: {
    subject: SystemEmailTemplateDefinition['subject'];
    body: SystemEmailTemplateDefinition['body'];
    variables: string[];
  },
  name: string
): boolean {
  if (!b1DefaultsByName.has(name)) return false;
  const predecessor = preB1TemplateDefinition(name);
  return predecessor ? isKnownSystemDefault(existing, predecessor) : false;
}

function isKnownPreB1BodyDefault(
  existing: {
    body: SystemEmailTemplateDefinition['body'];
    variables: string[];
  },
  name: string
): boolean {
  if (!b1DefaultsByName.has(name)) return false;
  const predecessor = preB1TemplateDefinition(name);
  return Boolean(
    predecessor &&
      sameVariables(existing.variables, predecessor.variables) &&
      EMAIL_TEMPLATE_LOCALES.every(
        (locale) => existing.body[locale] === predecessor.body[locale]
      )
  );
}

export async function preflightTasterSessionEmailTemplates(): Promise<TasterSessionTemplatePreflight> {
  const result: TasterSessionTemplatePreflight = {
    ready: false,
    customContentPreserved: [],
    resolvedCustomizations: [],
    reviewRequired: [],
  };

  for (const migration of TASTER_TEMPLATE_MIGRATIONS) {
    const legacyDefinition = templateDefinition(migration.legacyName);
    const canonicalDefinition = templateDefinition(migration.canonicalName);
    const [legacy, canonical] = await Promise.all([
      EmailTemplate.findOne({ name: migration.legacyName }).lean(),
      EmailTemplate.findOne({ name: migration.canonicalName }).lean(),
    ]);
    const canonicalValid = canonical
      ? templateSatisfiesCanonicalContract(canonical, canonicalDefinition)
      : false;

    if (canonical && !canonicalValid) {
      result.reviewRequired.push(
        `${migration.canonicalName}: canonical replacement must be active and satisfy its variables/locale contract`
      );
    } else if (
      canonical &&
      !isKnownSystemDefault(canonical, canonicalDefinition) &&
      !isKnownPreB1Default(canonical, migration.canonicalName) &&
      !isKnownImmediateB1Default(canonical, canonicalDefinition)
    ) {
      pushUnique(result.customContentPreserved, migration.canonicalName);
      result.reviewRequired.push(
        `${migration.canonicalName}: retained content differs from the recognized system defaults; review without automatic replacement`
      );
    }

    if (!legacy || isKnownSystemDefault(legacy, legacyDefinition)) continue;

    pushUnique(result.customContentPreserved, migration.legacyName);
    if (!legacy.isActive && canonicalValid) {
      result.resolvedCustomizations.push(migration.legacyName);
      continue;
    }

    result.reviewRequired.push(
      `${migration.legacyName} -> ${migration.canonicalName}: customized legacy template must be preserved but inactive after a verified canonical replacement is active`
    );
  }

  result.ready = result.reviewRequired.length === 0;
  return result;
}

async function applyTasterSessionEmailTemplateReconciliation(
  summary: EmailTemplateReconciliationSummary
): Promise<void> {
  // Create every required replacement before disabling any recognized legacy default.
  for (const migration of TASTER_TEMPLATE_MIGRATIONS) {
    const canonicalDefinition = templateDefinition(migration.canonicalName);
    const canonical = await EmailTemplate.findOne({
      name: migration.canonicalName,
    });
    if (canonical) {
      if (
        isKnownPreB1Default(canonical, migration.canonicalName) ||
        isKnownImmediateB1Default(canonical, canonicalDefinition)
      ) {
        canonical.subject = { ...canonicalDefinition.subject };
        canonical.body = { ...canonicalDefinition.body };
        canonical.variables = [...canonicalDefinition.variables];
        canonical.markModified('subject');
        canonical.markModified('body');
        await canonical.save();
        pushUnique(summary.defaultsUpdated, migration.canonicalName);
      } else {
        pushUnique(summary.skipped, migration.canonicalName);
      }
      continue;
    }
    if (!definitionContainsDeclaredVariables(canonicalDefinition)) {
      throw new Error(
        `${migration.canonicalName}: canonical template definition omits a declared variable`
      );
    }
    await EmailTemplate.create(canonicalDefinition);
    summary.created.push(migration.canonicalName);
  }

  for (const migration of TASTER_TEMPLATE_MIGRATIONS) {
    const legacyDefinition = templateDefinition(migration.legacyName);
    const legacy = await EmailTemplate.findOne({ name: migration.legacyName });
    if (!legacy) continue;

    if (!isKnownSystemDefault(legacy, legacyDefinition)) {
      pushUnique(summary.customContentPreserved, migration.legacyName);
      continue;
    }
    if (!legacy.isActive) continue;

    legacy.isActive = false;
    await legacy.save();
    summary.obsoleteDisabled.push(migration.legacyName);
  }
}

function emptyReconciliationSummary(): EmailTemplateReconciliationSummary {
  return {
    created: [],
    gate5Skipped: [],
    skipped: [],
    contractUpdated: [],
    defaultsUpdated: [],
    customContentPreserved: [],
    obsoleteDisabled: [],
    reviewRequired: [],
  };
}

export async function reconcileTasterSessionEmailTemplates(): Promise<EmailTemplateReconciliationSummary> {
  const summary = emptyReconciliationSummary();
  const preflight = await preflightTasterSessionEmailTemplates();
  summary.customContentPreserved.push(...preflight.customContentPreserved);
  summary.reviewRequired.push(...preflight.reviewRequired);
  if (!preflight.ready) return summary;

  await applyTasterSessionEmailTemplateReconciliation(summary);
  return summary;
}

export async function reconcileEmailTemplates(): Promise<EmailTemplateReconciliationSummary> {
  const summary = emptyReconciliationSummary();
  const legacyTasterNames = new Set<string>(
    TASTER_TEMPLATE_MIGRATIONS.map(({ legacyName }) => legacyName)
  );
  const canonicalTasterNames = new Set<string>(
    TASTER_TEMPLATE_MIGRATIONS.map(({ canonicalName }) => canonicalName)
  );
  const guestPlayNames = new Set([
    'guest_play_received',
    'guest_play_admin_alert',
    'guest_play_approved',
    'guest_play_declined',
  ]);
  const preflight = await preflightTasterSessionEmailTemplates();
  summary.customContentPreserved.push(...preflight.customContentPreserved);
  summary.reviewRequired.push(...preflight.reviewRequired);
  if (!preflight.ready) return summary;

  await applyTasterSessionEmailTemplateReconciliation(summary);

  for (const template of templates) {
    if (
      legacyTasterNames.has(template.name) ||
      canonicalTasterNames.has(template.name)
    )
      continue;
    const contract = getSystemEmailTemplateContract(template.name);
    const existing = await EmailTemplate.findOne({ name: template.name });

    if (!contract) {
      pushUnique(summary.gate5Skipped, template.name);
      continue;
    }

    if (!existing) {
      await EmailTemplate.create(template);
      summary.created.push(template.name);
      continue;
    }

    const knownPreB1Default = isKnownPreB1Default(existing, template.name);

    const knownLegacyGuestPlayDefault =
      guestPlayNames.has(template.name) &&
      isKnownLegacyGuestPlayDefault(existing, template.name);
    const knownPreB1BodyDefault = isKnownPreB1BodyDefault(
      existing,
      template.name
    );
    const knownImmediateB1BodyDefault = isKnownImmediateB1BodyDefault(
      existing,
      template
    );
    let contractMetadataModified = false;
    if (
      contract &&
      !sameVariables(existing.variables, contract.availableVariables)
    ) {
      existing.variables = [...contract.availableVariables];
      pushUnique(summary.contractUpdated, template.name);
      contractMetadataModified = true;
    }

    if (guestPlayNames.has(template.name)) {
      const predecessor = preB1TemplateDefinition(template.name);
      const recognizedBodyDefault =
        knownLegacyGuestPlayDefault ||
        knownPreB1BodyDefault ||
        knownImmediateB1BodyDefault;
      let contentModified = false;
      let preservedCustomContent = false;

      for (const locale of EMAIL_TEMPLATE_LOCALES) {
        if (existing.subject[locale] === template.subject[locale]) continue;
        if (existing.subject[locale] === predecessor?.subject[locale]) {
          existing.subject[locale] = template.subject[locale];
          contentModified = true;
        } else {
          preservedCustomContent = true;
        }
      }

      if (recognizedBodyDefault) {
        existing.body = { ...template.body };
        existing.markModified('body');
        contentModified = true;
      } else if (
        EMAIL_TEMPLATE_LOCALES.some(
          (locale) => existing.body[locale] !== template.body[locale]
        )
      ) {
        preservedCustomContent = true;
      }

      if (contentModified) {
        existing.markModified('subject');
        pushUnique(summary.defaultsUpdated, template.name);
      }
      if (preservedCustomContent) {
        pushUnique(summary.customContentPreserved, template.name);
        summary.reviewRequired.push(
          `${template.name}: retained content differs from the current Guest Play default; review without automatic replacement`
        );
      }
      if (contractMetadataModified || contentModified) await existing.save();
      else summary.skipped.push(template.name);
      for (const violation of findEmailTemplateContractViolations(
        template.name,
        existing.body
      )) {
        summary.reviewRequired.push(
          `${template.name}.${violation.locale}: missing ${violation.missingVariables
            .map((variable) => `{{${variable}}}`)
            .join(', ')}`
        );
      }
      continue;
    }

    if (template.name !== MEMBER_PASSWORD_SETUP_TEMPLATE.name) {
      if (knownPreB1Default) {
        existing.subject = { ...template.subject };
        existing.body = { ...template.body };
        existing.markModified('subject');
        existing.markModified('body');
        await existing.save();
        pushUnique(summary.defaultsUpdated, template.name);
      } else if (contract && !isKnownSystemDefault(existing, template)) {
        pushUnique(summary.customContentPreserved, template.name);
        if (b1DefaultsByName.has(template.name)) {
          summary.reviewRequired.push(
            `${template.name}: retained content differs from the recognized system defaults; review without automatic replacement`
          );
        }
      }
      for (const violation of findEmailTemplateContractViolations(
        template.name,
        existing.body
      )) {
        summary.reviewRequired.push(
          `${template.name}.${violation.locale}: missing ${violation.missingVariables
            .map((variable) => `{{${variable}}}`)
            .join(', ')}`
        );
      }
      if (
        template.name === 'application_received' &&
        EMAIL_TEMPLATE_LOCALES.some((locale) =>
          /{{\s*applicationId\s*}}/.test(existing.body[locale])
        )
      ) {
        pushUnique(summary.customContentPreserved, template.name);
        summary.reviewRequired.push(
          'application_received: retained custom content uses retired {{applicationId}}; review before delivery'
        );
      }
      if (!knownPreB1Default) {
        if (contractMetadataModified) await existing.save();
        else summary.skipped.push(template.name);
      }
      continue;
    }

    let modified = contractMetadataModified;
    let preservedCustomContent = false;
    let subjectModified = false;

    for (const locale of EMAIL_TEMPLATE_LOCALES) {
      if (existing.subject[locale] === template.subject[locale]) continue;
      if (
        existing.subject[locale] ===
        PRE_B1_MEMBER_PASSWORD_SETUP_TEMPLATE.subject[locale]
      ) {
        existing.subject[locale] = template.subject[locale];
        subjectModified = true;
        modified = true;
      } else {
        preservedCustomContent = true;
      }
    }

    for (const locale of EMAIL_TEMPLATE_LOCALES) {
      if (
        existing.body[locale] ===
          PRE_B1_MEMBER_PASSWORD_SETUP_TEMPLATE.body[locale] ||
        existing.body[locale] === LEGACY_MEMBER_PASSWORD_SETUP_BODY[locale]
      ) {
        existing.body[locale] = template.body[locale];
        summary.defaultsUpdated.push(`${template.name}.${locale}`);
        modified = true;
      } else if (existing.body[locale] !== template.body[locale]) {
        preservedCustomContent = true;
      }
    }

    const violations = findEmailTemplateContractViolations(
      template.name,
      existing.body
    );
    for (const violation of violations) {
      const variables = violation.missingVariables
        .map((variable) => `{{${variable}}}`)
        .join(', ');
      summary.reviewRequired.push(
        `${template.name}.${violation.locale}: missing ${variables}`
      );
    }

    if (preservedCustomContent)
      summary.customContentPreserved.push(template.name);
    if (preservedCustomContent) {
      summary.reviewRequired.push(
        `${template.name}: retained content differs from the recognized system defaults; review without automatic replacement`
      );
    }
    if (modified) {
      if (subjectModified) existing.markModified('subject');
      existing.markModified('body');
      await existing.save();
    } else {
      summary.skipped.push(template.name);
    }
  }

  const obsolete = await EmailTemplate.findOne({
    name: OBSOLETE_MEMBER_INVITATION_TEMPLATE_NAME,
  });
  if (obsolete?.isActive) {
    obsolete.isActive = false;
    await obsolete.save();
    summary.obsoleteDisabled.push(obsolete.name);
  }

  return summary;
}

async function seedTemplates() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is required. Check your .env.local file.');
    }
    await mongoose.connect(mongoUri, { autoIndex: false });
    console.log('✅ Connected to MongoDB');

    if (process.argv.includes('--taster-session-preflight')) {
      const preflight = await preflightTasterSessionEmailTemplates();
      console.log('\n📊 Taster Session template preflight:');
      console.log(
        `   Customized legacy templates preserved: ${preflight.customContentPreserved.length}`
      );
      console.log(
        `   Resolved manual migrations: ${preflight.resolvedCustomizations.length}`
      );
      if (!preflight.ready) {
        for (const warning of preflight.reviewRequired)
          console.warn(`   - ${warning}`);
        throw new Error(
          'Taster Session email-template preflight requires manual review'
        );
      }
      console.log('\n🎉 Taster Session template preflight completed safely.');
      return;
    }

    const tasterSessionOnly = process.argv.includes('--taster-session-apply');
    const summary = tasterSessionOnly
      ? await reconcileTasterSessionEmailTemplates()
      : await reconcileEmailTemplates();

    console.log('\n📊 Summary:');
    console.log(`   Created: ${summary.created.length}`);
    console.log(
      `   Gate 5 unconsumed templates left unchanged: ${summary.gate5Skipped.length}`
    );
    console.log(`   Skipped unchanged: ${summary.skipped.length}`);
    console.log(
      `   System contracts updated: ${summary.contractUpdated.length}`
    );
    console.log(
      `   Legacy defaults updated: ${summary.defaultsUpdated.length}`
    );
    console.log(
      `   Custom templates preserved: ${summary.customContentPreserved.length}`
    );
    console.log(
      `   Obsolete templates disabled: ${summary.obsoleteDisabled.length}`
    );
    if (summary.reviewRequired.length > 0) {
      console.warn(
        '\n⚠️  REVIEW REQUIRED before affected email-template behavior is changed:'
      );
      for (const warning of summary.reviewRequired)
        console.warn(`   - ${warning}`);
      throw new Error('Email-template reconciliation requires manual review');
    }
    console.log('\n🎉 Seed completed successfully!');
  } catch (error) {
    console.error('Email template reconciliation failed', {
      operation: 'reconcile_email_templates',
      reasonCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
    });
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run only when called directly so tests can import the reconciliation safely.
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  void seedTemplates();
}

export {
  preB1Templates as PRE_B1_SYSTEM_EMAIL_TEMPLATE_DEFINITIONS,
  seedTemplates,
  templates as SYSTEM_EMAIL_TEMPLATE_DEFINITIONS,
};
