import type { ClubInformationValues } from '@club/shared-types/api/clubInformation';
import type { HomepageContentValues } from '@club/shared-types/api/homepageContent';
import type { ContactEntryValues } from '@club/shared-types/api/contact';
import type { TasterSessionPublicContentValues } from '@club/shared-types/api/tasterSessionPublicContent';
import type { MembershipPublicContentValues } from '@club/shared-types/api/membershipPublicContent';
import type { RecruitmentPublicContentValues } from '@club/shared-types/api/recruitmentPublicContent';

export const CANONICAL_HOMEPAGE_CONTENT: HomepageContentValues = {
  mainMessage: {
    de: 'Badminton Club Demo entdecken',
    en: 'Explore Badminton Club Demo',
    zh: '探索 Badminton Club Demo',
  },
  visitUsIntroduction: {
    de: 'Die Orte und Zeiten veranschaulichen die Anwendung. Sie sind keine Besuchsangebote.',
    en: 'Venues and times illustrate the application. They are not invitations to visit.',
    zh: '场地与时间仅用于展示应用功能，并非真实到访安排。',
  },
  contactIntroduction: {
    de: 'Beispielkontakte ohne Zustellung oder reale Kontaktaufnahme.',
    en: 'Example contacts without delivery or real-world contact.',
    zh: '示例联系方式，不发送消息或联系真实人员。',
  },
};

export const CANONICAL_CLUB_INFORMATION: ClubInformationValues = {
  officialNameGerman: 'Badminton Club Demo',
  nameEnglish: 'Badminton Club Demo',
  nameChinese: 'Badminton Club Demo',
  shortName: 'Demo',
  foundingYear: 2026,
  introduction: {
    de: 'Ein fiktiver Beispielverein zeigt mehrsprachige Vereinsverwaltung. Das Gründungsjahr 2026 ist ein Demonstrationswert; Personen, Mannschaften und Vereinsleben sind erfunden.',
    en: 'A fictional example club demonstrates multilingual club management. The founding year 2026 is illustrative; people, teams and club life are invented.',
    zh: '虚构示例俱乐部展示多语言俱乐部管理。2026 年为示例成立年份；人员、球队与俱乐部活动均为虚构。',
  },
};

export const CANONICAL_CONTACT_ENTRIES: readonly ContactEntryValues[] = [
  {
    category: 'general',
    title: {
      de: 'Kontakt – Beispiel',
      en: 'Contact – example',
      zh: '联系示例',
    },
    description: {
      de: 'Fiktive Beispieldaten einer Portfolio-Demo. Keine echten Vereinsangebote oder Anmeldungen.',
      en: 'Synthetic example data in a portfolio demo. No live club services or registration.',
      zh: '作品集演示中的虚构示例数据，不提供真实俱乐部服务或报名。',
    },
    email: 'demo@example.invalid',
    retainedQrCode: '',
    qrExplanation: {
      de: '',
      en: '',
      zh: '',
    },
    externalLink: '',
    externalLinkLabel: {
      de: '',
      en: '',
      zh: '',
    },
    isActive: true,
    order: 0,
  },
  {
    category: 'membership-and-taster',
    title: {
      de: 'Teilnahme – Beispiel',
      en: 'Participation – example',
      zh: '参与示例',
    },
    description: {
      de: 'Fiktive Beispieldaten einer Portfolio-Demo. Keine echten Vereinsangebote oder Anmeldungen.',
      en: 'Synthetic example data in a portfolio demo. No live club services or registration.',
      zh: '作品集演示中的虚构示例数据，不提供真实俱乐部服务或报名。',
    },
    email: 'participation@example.invalid',
    retainedQrCode: '',
    qrExplanation: {
      de: '',
      en: '',
      zh: '',
    },
    externalLink: '',
    externalLinkLabel: {
      de: '',
      en: '',
      zh: '',
    },
    isActive: true,
    order: 1,
  },
];

export const CANONICAL_TASTER_SESSION_PUBLIC_CONTENT: TasterSessionPublicContentValues =
  {
    homepageSummary: {
      de: 'Entdecke einen beispielhaften Ablauf für ein Schnuppertraining.',
      en: 'Explore an illustrative Taster Session workflow.',
      zh: '了解新人体验活动的示例流程。',
    },
    introduction: {
      de: 'Der fiktive Beispielverein zeigt, wie Informationen zu einem ersten Training dargestellt werden. Die Demo vereinbart keine echten Besuche.',
      en: 'The fictional example club shows how a first training visit can be presented. The Demo does not arrange real visits.',
      zh: '虚构示例俱乐部展示首次训练的信息呈现方式。Demo 演示不安排真实到访。',
    },
    preparation: {
      de: 'Im Beispiel gehören Hallenschuhe und Sportkleidung zur Vorbereitung. Dies ist keine Einladung zu einem Training.',
      en: 'The example preparation includes indoor shoes and sportswear. This is not an invitation to a training session.',
      zh: '示例准备内容包括室内运动鞋和运动服，并非真实训练邀请。',
    },
    participationGuidance: {
      de: 'Spielstärke und Zeitwunsch veranschaulichen die Auswahl im Ablauf. Die angezeigten Termine sind fiktiv.',
      en: 'Playing level and preferred time illustrate the workflow choices. The displayed sessions are fictional.',
      zh: '球技水平与偏好时间用于展示流程选项。显示的活动时间均为虚构。',
    },
    followUpGuidance: {
      de: 'In dieser Demo erfolgt keine Kontaktaufnahme oder Terminbestätigung.',
      en: 'This demo does not contact visitors or confirm appointments.',
      zh: '本演示不会联系访客或确认预约。',
    },
  };

export const CANONICAL_MEMBERSHIP_PUBLIC_CONTENT: MembershipPublicContentValues =
  {
    homepageSummary: {
      de: 'Entdecke die Mitgliedschaftsverwaltung anhand eines fiktiven Beispielvereins.',
      en: 'Explore membership management through a fictional example club.',
      zh: '通过虚构示例俱乐部了解会员管理。',
    },
    introduction: {
      de: 'Die Demo zeigt den Lebenszyklus einer Mitgliedschaft mit erfundenen Daten. Sie bietet keine echte Vereinsmitgliedschaft an.',
      en: 'The demo illustrates a membership lifecycle using invented data. It does not offer real club membership.',
      zh: '本演示使用虚构数据展示会员生命周期，不提供真实俱乐部会员资格。',
    },
    membershipTypes: {
      de: 'Aktive und passive Mitgliedschaft dienen hier als fiktive Beispiele. Es gelten keine realen Beiträge oder Vereinsregeln.',
      en: 'Active and passive membership are fictional examples here. No real fees or club rules apply.',
      zh: '活跃与非活跃会员仅为虚构示例，不涉及真实会费或俱乐部规则。',
    },
    membershipPath: {
      de: 'Der Beispielablauf führt vom Erstkontakt über die Prüfung zur Aufnahme. Eine echte Bewerbung ist in der Demo nicht möglich.',
      en: 'The example flow moves from initial contact through review to admission. Real applications are not available in the Demo.',
      zh: '示例流程从初次联系经过审核直至入会。Demo 演示不接受真实申请。',
    },
    applicationPreparation: {
      de: 'Die Beispieldatensätze sind erfunden. Bitte keine echten persönlichen Daten eingeben.',
      en: 'The example records are invented. Please do not enter real personal information.',
      zh: '示例记录均为虚构，请勿输入真实个人信息。',
    },
    studentProof: {
      de: '',
      en: '',
      zh: '',
    },
  };

export const CANONICAL_RECRUITMENT_PUBLIC_CONTENT: RecruitmentPublicContentValues =
  {
    isOpen: false,
    introduction: {
      de: 'Fiktive Mannschaften zeigen die Teamdarstellung. Die Mannschaftssuche bleibt in dieser Demo pausiert.',
      en: 'Fictional teams demonstrate the team presentation. Recruitment remains paused in this demo.',
      zh: '虚构球队用于展示球队信息。本演示中的招募保持暂停状态。',
    },
    requirements: {
      de: 'Beispielprofil: Badminton-Grundlagen, Teamgeist und Fairplay. Keine echte Ausschreibung.',
      en: 'Example profile: badminton fundamentals, teamwork and fair play. This is not a real recruitment notice.',
      zh: '示例要求：羽毛球基础、团队合作与公平竞赛。并非真实招募公告。',
    },
    tryoutGuidance: {
      de: 'Es werden keine echten Probetrainings vereinbart.',
      en: 'No real team tryouts are arranged.',
      zh: '不安排真实球队试训。',
    },
    contactEntryId: null,
  };
