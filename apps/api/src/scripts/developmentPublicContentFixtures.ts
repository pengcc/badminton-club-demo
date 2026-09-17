import { Language } from '@club/shared-types/core/enums';
import type { MembershipPublicContentValues } from '@club/shared-types/api/membershipPublicContent';
import type { TasterSessionPublicContentValues } from '@club/shared-types/api/tasterSessionPublicContent';
import type { RecruitmentPublicContentValues } from '@club/shared-types/api/recruitmentPublicContent';
import type { ContactEntryValues } from '@club/shared-types/api/contact';
import { AnnouncementType } from '../models/Announcement.js';
import {
  CANONICAL_MEMBERSHIP_PUBLIC_CONTENT,
  CANONICAL_TASTER_SESSION_PUBLIC_CONTENT,
  CANONICAL_RECRUITMENT_PUBLIC_CONTENT,
} from './canonicalContentDefaults.js';

export const DEVELOPMENT_TASTER_SESSION_PUBLIC_CONTENT: TasterSessionPublicContentValues =
  {
    ...CANONICAL_TASTER_SESSION_PUBLIC_CONTENT,
    preparation: {
      de: 'Demo-Beispiel: Bringe Hallenschuhe, Sportkleidung und etwas zu trinken mit. Schläger und Federbälle können nach Absprache bereitgestellt werden.',
      en: 'Demo example: Bring indoor court shoes, sportswear, and something to drink. Rackets and shuttlecocks can be provided by arrangement.',
      zh: '虚构演示：请携带室内运动鞋、运动服和饮用水。球拍和羽毛球可提前沟通后由俱乐部提供。',
    },
    participationGuidance: {
      de: 'Demo-Beispiel: Wähle bei der Anfrage eine passende Spielstärke und einen bevorzugten Termin. Die Auswahl ist noch keine Buchung.',
      en: 'Demo example: Choose the playing level and preferred time that fit you when requesting a visit. Your selection is not a booking.',
      zh: '虚构演示：提交申请时请选择适合自己的水平和偏好时间。该选择不代表已经预约成功。',
    },
  };

export const DEVELOPMENT_MEMBERSHIP_PUBLIC_CONTENT: MembershipPublicContentValues =
  {
    ...CANONICAL_MEMBERSHIP_PUBLIC_CONTENT,
    applicationPreparation: {
      de: 'Demo-Beispiel: Halte deine Kontaktdaten und die für deinen Mitgliedschaftstyp benötigten Angaben bereit. Den persönlichen Antragszugang erhältst du nach Abstimmung mit dem Verein.',
      en: 'Demo example: Have your contact details and the information required for your membership type ready. The club provides your personal application access after speaking with you.',
      zh: '虚构演示：请准备好联系方式以及会员类型所需的信息。与俱乐部沟通后，你将收到个人申请入口。',
    },
    studentProof: {
      de: 'Demo-Beispiel: Wenn du den Studierendenbeitrag beantragst, benoetigst du einen aktuellen Nachweis.',
      en: 'Demo example: If you apply for the student rate, you will need current proof of student status.',
      zh: '虚构演示：如申请学生会费，请准备有效的在读证明。',
    },
  };

export const DEVELOPMENT_RECRUITMENT_CONTACT: ContactEntryValues = {
  category: 'recruitment',
  title: {
    de: 'Demo-Beispiel: Mannschaftssuche',
    en: 'Demo example: Team Recruitment',
    zh: '虚构演示：球队招募',
  },
  description: {
    de: 'Demo-Beispiel: Entwicklungs-Kontakt für die Abstimmung von Mannschafts-Probetrainings.',
    en: 'Demo example: Development contact for coordinating competitive-team tryouts.',
    zh: '虚构演示：用于协调竞技球队试训的开发环境联系渠道。',
  },
  email: 'recruitment@example.invalid',
  retainedQrCode: '',
  qrExplanation: { de: '', en: '', zh: '' },
  externalLink: '',
  externalLinkLabel: { de: '', en: '', zh: '' },
  isActive: true,
  order: 2,
};

export const developmentRecruitmentPublicContent = (
  contactEntryId: string
): RecruitmentPublicContentValues => ({
  ...CANONICAL_RECRUITMENT_PUBLIC_CONTENT,
  isOpen: true,
  contactEntryId,
});

export const DEVELOPMENT_ANNOUNCEMENTS = [
  {
    translations: {
      [Language.GERMAN]: {
        title: 'Willkommen beim Badminton Club Demo',
        content:
          'Demo / 示例: Auf unserer Website findest du Trainingszeiten, Aktivitäten und Informationen für deinen ersten Besuch.',
      },
      [Language.ENGLISH]: {
        title: 'Welcome to Badminton Club Demo',
        content:
          'Demo / 示例: Explore our website for training times, activities, and information for your first visit.',
      },
      [Language.CHINESE]: {
        title: '欢迎来到Badminton Club Demo',
        content:
          'Demo / 示例: 你可以在网站上查看训练时间、俱乐部活动以及首次来访的信息。',
      },
    },
    type: AnnouncementType.INFO,
    displayDate: '2026.01.15',
    externalLink: '',
    isActive: true,
    order: 0,
  },
  {
    translations: {
      [Language.GERMAN]: {
        title: 'Fiktives Teilnahmebeispiel',
        content:
          'Demo / 示例: Dieses fiktive Beispiel zeigt die Teilnahmeinformationen. Es werden keine Besuche vereinbart.',
      },
      [Language.ENGLISH]: {
        title: '',
        content: '',
      },
      [Language.CHINESE]: {
        title: '首次来访前',
        content: 'Demo / 示例: 此虚构示例展示参与信息，不安排真实到访。',
      },
    },
    type: AnnouncementType.IMPORTANT,
    displayDate: '2026.01.10',
    externalLink: '',
    isActive: true,
    order: 1,
  },
] as const;

export const DEVELOPMENT_ACTIVITIES = [
  {
    translations: {
      [Language.GERMAN]: {
        name: 'Gemeinsamer Trainingsabend',
        description:
          'Demo / 示例: Ein offener Vereinsabend mit freien Spielen, Technikübungen und Zeit zum Kennenlernen.',
      },
      [Language.ENGLISH]: {
        name: 'Club training evening',
        description:
          'Demo / 示例: An open club evening with casual games, technique practice, and time to meet other players.',
      },
      [Language.CHINESE]: {
        name: '俱乐部训练之夜',
        description:
          'Demo / 示例: 包含自由对打、技术练习以及认识其他球友的开放俱乐部活动。',
      },
    },
    images: [],
    videoLink: '',
    videoDescription: { de: '', en: '', zh: '' },
    isVisible: true,
    order: 0,
  },
  {
    translations: {
      [Language.GERMAN]: {
        name: 'Vereinsinternes Doppelturnier',
        description:
          'Demo / 示例: Mitglieder spielen in wechselnden Paarungen und verbringen gemeinsam einen sportlichen Nachmittag.',
      },
      [Language.ENGLISH]: {
        name: 'Club doubles tournament',
        description:
          'Demo / 示例: Members play in changing pairs and enjoy an afternoon of badminton together.',
      },
      [Language.CHINESE]: {
        name: '俱乐部双打赛',
        description:
          'Demo / 示例: 会员以不同组合参加双打，共度一个充满羽毛球乐趣的下午。',
      },
    },
    images: [],
    videoLink: '',
    videoDescription: { de: '', en: '', zh: '' },
    isVisible: true,
    order: 1,
  },
] as const;
