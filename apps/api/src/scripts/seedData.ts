import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from '../models/User.js';
import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';
import { Match } from '../models/Match.js';
import { Content, HomepageContent } from '../models/Content.js';
import { ClubInformation } from '../models/ClubInformation.js';
import { ContactEntry } from '../models/ContactEntry.js';
import { PublicDocument } from '../models/PublicDocument.js';
import { TasterSessionPublicContent } from '../models/TasterSessionPublicContent.js';
import { MembershipPublicContent } from '../models/MembershipPublicContent.js';
import { RecruitmentPublicContent } from '../models/RecruitmentPublicContent.js';
import { MembershipApplication } from '../models/MembershipApplication.js';
import { MemberBankingProfile } from '../models/MemberBankingProfile.js';
import {
  RegistrationApprovalEvent,
  RegistrationApprovalStatus,
} from '../models/RegistrationApprovalEvent.js';
import { Notification } from '../models/Notification.js';
import { EmailTemplate } from '../models/EmailTemplate.js';
import { Settings } from '../models/Settings.js';
import { AccountOnboardingOperation } from '../models/AccountOnboardingOperation.js';
import { Activity } from '../models/Activity.js';
import { Announcement } from '../models/Announcement.js';
import { AuthSession } from '../models/AuthSession.js';
import { DemoEditingSession } from '../models/DemoEditingSession.js';
import { GuestPlay } from '../models/GuestPlay.js';
import { Location } from '../models/Location.js';
import { MembershipApplicantSession } from '../models/MembershipApplicantSession.js';
import { MembershipApplicationAccessToken } from '../models/MembershipApplicationAccessToken.js';
import { MembershipLifecycleEvent } from '../models/MembershipLifecycleEvent.js';
import { MembershipStudentProofOperation } from '../models/MembershipStudentProofOperation.js';
import { MembershipTermination } from '../models/MembershipTermination.js';
import { RegistrationAccess } from '../models/RegistrationAccess.js';
import { TasterSessionRequestModel } from '../models/TasterSessionRequest.js';
import { SettingsService } from '../services/settingsService.js';
import { ActivityOwnedFileStore } from '../services/activityOwnedFileStore.js';
import { ContactQrOwnedFileStore } from '../services/contactQrOwnedFileStore.js';
import { PublicDocumentOwnedFileStore } from '../services/publicDocumentOwnedFileStore.js';
import {
  CANONICAL_CLUB_INFORMATION,
  CANONICAL_CONTACT_ENTRIES,
  CANONICAL_HOMEPAGE_CONTENT,
  CANONICAL_MEMBERSHIP_PUBLIC_CONTENT,
  CANONICAL_RECRUITMENT_PUBLIC_CONTENT,
  CANONICAL_TASTER_SESSION_PUBLIC_CONTENT,
} from './canonicalContentDefaults.js';
import {
  DEVELOPMENT_ACTIVITIES,
  DEVELOPMENT_ANNOUNCEMENTS,
  DEVELOPMENT_MEMBERSHIP_PUBLIC_CONTENT,
  DEVELOPMENT_RECRUITMENT_CONTACT,
  DEVELOPMENT_TASTER_SESSION_PUBLIC_CONTENT,
  developmentRecruitmentPublicContent,
} from './developmentPublicContentFixtures.js';
import { canonicalLocations } from './bootstrapCanonicalContent.js';
import { reconcileEmailTemplates } from './seedEmailTemplates.js';
import {
  assertConnectedMongoTarget,
  assertActiveVitestTestTarget,
  assertDisposableFileTargets,
  assertDisposableMongoTarget,
  sanitizeResetDiagnostic,
  type ApprovedMongoResetTarget,
  type DestructiveResetTarget,
} from './destructiveResetSafety.js';
import {
  AccountOnboardingStatus,
  MembershipStatus,
  MatchDirection,
  PlayerType,
  AccountKind,
  TeamLevel,
} from '@club/shared-types/core/enums';
import { withMatchScheduleDuplicateKey } from '../services/matchScheduleDuplicateKey.js';
import { loadApiEnvironment } from '../config/apiEnvironment.js';
import { resolvePublicUploadsRoot } from '../config/publicUploadsConfig.js';
import { bankingCryptoService } from '../services/bankingCryptoService.js';
import {
  getBankingSummary,
  normalizeBankingInfo,
} from '@club/shared-types/domain/membershipApplication';

// Load env based on NODE_ENV
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(__dirname, '../../');
const apiEnvironment = loadApiEnvironment({ apiDirectory: apiDir });
type SeedCredentialStrategy = (email: string, localPassword: string) => string;
const localSeedPassword: SeedCredentialStrategy = (_email, password) =>
  password;

// Internal setup modes remain available only to controlled programmatic callers.
type SeedTable = 'users' | 'applications' | 'content' | 'all';

type OperatorSeedTable = Extract<SeedTable, 'all' | 'content'>;

interface SeedDataOptions {
  target: DestructiveResetTarget;
  activityUploadsRoot?: string;
  contactUploadsRoot?: string;
  publicDocumentUploadsRoot?: string;
  testFileTarget?: Extract<DestructiveResetTarget, { kind: 'test' }>;
}

// Get database URI from environment (single source of truth)
const getDatabaseUri = () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(`MONGODB_URI is required. Provide an explicit target.`);
  }
  return uri;
};

export function assertRetainedPublicUploadResetAllowed({
  resetsFiles,
  alternateDevelopmentDatabase,
}: {
  resetsFiles: boolean;
  alternateDevelopmentDatabase: boolean;
}): void {
  if (resetsFiles && alternateDevelopmentDatabase) {
    throw new Error(
      'Destructive reset refused: retained public uploads are not coherent with the alternate development database'
    );
  }
}

// Mock data generators
const firstNames = {
  male: [
    'Max',
    'Thomas',
    'Michael',
    'Andreas',
    'Stefan',
    'Daniel',
    'Alexander',
    'Christian',
    'Sebastian',
    'Matthias',
    'David',
    'Florian',
    'Markus',
    'Peter',
    'Benjamin',
    'Martin',
    'Kevin',
    'Oliver',
    'Tobias',
    'Jan',
    'Pascal',
    'Felix',
    'Lukas',
    'Simon',
    'Patrick',
    'Marcel',
    'Tim',
    'Julian',
    'Philipp',
    'Nico',
  ],
  female: [
    'Anna',
    'Lisa',
    'Sarah',
    'Julia',
    'Laura',
    'Maria',
    'Sandra',
    'Nicole',
    'Stefanie',
    'Andrea',
    'Katharina',
    'Melanie',
    'Sabine',
    'Daniela',
    'Christina',
    'Nina',
    'Jessica',
    'Vanessa',
    'Jennifer',
    'Michelle',
    'Tanja',
    'Nadine',
    'Simone',
    'Claudia',
    'Susanne',
    'Jasmin',
    'Petra',
    'Manuela',
    'Silke',
    'Carmen',
  ],
};

const lastNames = [
  'Müller',
  'Schmidt',
  'Schneider',
  'Fischer',
  'Weber',
  'Meyer',
  'Wagner',
  'Becker',
  'Schulz',
  'Hoffmann',
  'Schäfer',
  'Koch',
  'Bauer',
  'Richter',
  'Klein',
  'Wolf',
  'Schröder',
  'Neumann',
  'Schwarz',
  'Zimmermann',
  'Braun',
  'Krüger',
  'Hofmann',
  'Hartmann',
  'Lange',
  'Schmitt',
  'Werner',
  'Schmitz',
  'Krause',
  'Meier',
  'Lehmann',
  'Schmid',
  'Schulze',
  'Maier',
  'Köhler',
  'Herrmann',
  'König',
  'Walter',
  'Mayer',
  'Huber',
  'Kaiser',
  'Fuchs',
  'Peters',
  'Lang',
  'Scholz',
  'Möller',
  'Weiß',
  'Jung',
  'Hahn',
  'Schubert',
];

const cities = [
  'Berlin',
  'Hamburg',
  'Munich',
  'Cologne',
  'Frankfurt',
  'Stuttgart',
  'Düsseldorf',
  'Dortmund',
  'Essen',
  'Leipzig',
  'Bremen',
  'Dresden',
  'Hannover',
  'Nuremberg',
  'Duisburg',
  'Bochum',
  'Wuppertal',
  'Bielefeld',
  'Bonn',
  'Münster',
  'Karlsruhe',
  'Mannheim',
  'Augsburg',
  'Wiesbaden',
  'Gelsenkirchen',
  'Mönchengladbach',
  'Braunschweig',
  'Chemnitz',
  'Kiel',
  'Aachen',
];

const streets = [
  'Hauptstraße',
  'Schulstraße',
  'Kirchstraße',
  'Bahnhofstraße',
  'Gartenstraße',
  'Dorfstraße',
  'Mühlenstraße',
  'Lindenstraße',
  'Marktstraße',
  'Bergstraße',
  'Feldstraße',
  'Waldstraße',
  'Parkstraße',
  'Rosenstraße',
  'Sportstraße',
  'Vereinsstraße',
  'Clubstraße',
  'Badmintonstraße',
  'Trainingsplatz',
  'Spielerweg',
];

const positions = ['singles', 'doubles', 'mixed-doubles'];
const participationEnabledMemberStatuses = new Set<MembershipStatus>([
  MembershipStatus.ACTIVE,
  MembershipStatus.PASSIVE,
]);
const accountSuspendedSeedEmail = 'account.suspended@club.invalid';

// Generate random data helpers
const getRandomElement = (array: any[]) =>
  array[Math.floor(Math.random() * array.length)];
const getRandomPhone = () => '+490000000000';
const getRandomPostalCode = () =>
  Math.floor(Math.random() * 90000 + 10000).toString();
const getRandomRanking = () => Math.floor(Math.random() * 10) + 1;

// Normalize German characters for email addresses
const normalizeForEmail = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
};

// ============================================
// MODULAR SEED FUNCTIONS
// ============================================

/**
 * Seed admin users (required by most other seeders)
 */
async function seedAdminUsers(
  passwordFor: SeedCredentialStrategy
): Promise<any[]> {
  const adminUsers = await User.create(
    [
      {
        email: 'admin@club.invalid',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'Manager',
        phone: '+490000000000',
        gender: 'female',
        dateOfBirth: '1980-06-15',
        accountKind: AccountKind.PERSON,
        administratorDesignation: true,
        membershipType: 'regular',
        membershipStatus: 'active',
        address: {
          street: 'Management Ave 15',
          city: 'Berlin',
          postalCode: '10178',
          country: 'Germany',
        },
        isPlayer: true,
      },
      {
        email: 'coach@club.invalid',
        password: 'admin123',
        firstName: 'Head',
        lastName: 'Coach',
        phone: '+490000000000',
        gender: 'male',
        dateOfBirth: '1985-03-22',
        accountKind: AccountKind.PERSON,
        administratorDesignation: true,
        membershipType: 'regular',
        membershipStatus: 'active',
        address: {
          street: 'Training Center 8',
          city: 'Berlin',
          postalCode: '10963',
          country: 'Germany',
        },
        isPlayer: true,
      },
      {
        email: 'demo.admin@club.invalid',
        password: 'demo1234',
        firstName: 'Demo',
        lastName: 'Administrator',
        phone: '+490000000000',
        gender: 'non-binary',
        dateOfBirth: '1990-01-01',
        accountKind: AccountKind.PERSON,
        administratorDesignation: true,
        membershipType: 'regular',
        membershipStatus: 'active',
        address: {
          street: 'Fictional Demo Street 1',
          city: 'Berlin',
          postalCode: '10115',
          country: 'Germany',
        },
        isPlayer: true,
      },
    ].map((user) => ({
      ...user,
      password: passwordFor(user.email, user.password),
    }))
  );
  console.log('✅ Admin users created');
  return adminUsers;
}

/**
 * Seed regular member users
 */
async function seedMemberUsers(
  suspendedBy: mongoose.Types.ObjectId,
  passwordFor: SeedCredentialStrategy
): Promise<any[]> {
  const lifecycleScenarioUsers = [
    {
      email: 'lifecycle.active@club.invalid',
      password: 'member123',
      firstName: 'Active',
      lastName: 'Member',
      gender: 'female',
      dateOfBirth: '1990-01-15',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipType: 'regular',
      membershipStatus: MembershipStatus.ACTIVE,
      isPlayer: true,
    },
    {
      email: 'lifecycle.passive@club.invalid',
      password: 'member123',
      firstName: 'Passive',
      lastName: 'Member',
      gender: 'male',
      dateOfBirth: '1991-02-16',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipType: 'regular',
      membershipStatus: MembershipStatus.PASSIVE,
      isPlayer: true,
    },
    {
      email: accountSuspendedSeedEmail,
      password: 'member123',
      firstName: 'Suspended',
      lastName: 'Member',
      gender: 'female',
      dateOfBirth: '1992-03-17',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipType: 'regular',
      membershipStatus: MembershipStatus.ACTIVE,
      accountSuspension: {
        reason: 'Local account access development scenario',
        suspendedAt: new Date('2026-01-15T10:00:00.000Z'),
        suspendedBy,
      },
      isPlayer: true,
    },
    {
      email: 'lifecycle.inactive@club.invalid',
      password: 'member123',
      firstName: 'Inactive',
      lastName: 'Member',
      gender: 'male',
      dateOfBirth: '1993-04-18',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipType: 'regular',
      membershipStatus: MembershipStatus.INACTIVE,
      isPlayer: true,
    },
    {
      email: 'lifecycle.external@club.invalid',
      password: 'member123',
      firstName: 'External',
      lastName: 'Player',
      gender: 'female',
      dateOfBirth: '1994-05-19',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipStatus: MembershipStatus.INACTIVE,
      isPlayer: true,
    },
  ];
  const memberData: any[] = [...lifecycleScenarioUsers];

  for (let i = 0; i < 52; i++) {
    const gender = Math.random() > 0.5 ? 'male' : 'female';
    const firstName = getRandomElement(firstNames[gender]);
    const lastName = getRandomElement(lastNames);
    const city = getRandomElement(cities);
    const street = getRandomElement(streets);
    const membershipType = getRandomElement(['regular', 'student']);
    const isPlayer = i < 23;

    const birthYear = Math.floor(Math.random() * 40) + 1970;
    const birthMonth = Math.floor(Math.random() * 12) + 1;
    const birthDay = Math.floor(Math.random() * 28) + 1;

    memberData.push({
      email: `${normalizeForEmail(firstName)}.${normalizeForEmail(lastName)}${i}@club.invalid`,
      password: 'member123',
      firstName: firstName,
      lastName: lastName,
      phone: getRandomPhone(),
      gender,
      dateOfBirth: `${birthYear}-${birthMonth.toString().padStart(2, '0')}-${birthDay.toString().padStart(2, '0')}`,
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipType,
      membershipStatus: MembershipStatus.ACTIVE,
      address: {
        street: `${street} ${Math.floor(Math.random() * 200) + 1}`,
        city,
        postalCode: getRandomPostalCode(),
        country: 'Germany',
      },
      isPlayer,
    });
  }

  const members = await User.create(
    memberData.map((user) => ({
      ...user,
      password: passwordFor(user.email, user.password),
    }))
  );
  console.log('✅ Member users created');
  return members;
}

/**
 * Seed all users (admins + members)
 */
async function seedUsers(
  clearFirst: boolean = true,
  passwordFor: SeedCredentialStrategy = localSeedPassword
): Promise<{ admins: any[]; members: any[] }> {
  if (clearFirst) {
    await User.deleteMany({});
    console.log('🗑️  Users cleared');
  }

  const admins = await seedAdminUsers(passwordFor);
  const members = await seedMemberUsers(admins[0]._id, passwordFor);

  return { admins, members };
}

/**
 * Seed players from users marked as players
 */
async function seedPlayers(clearFirst: boolean = true): Promise<any[]> {
  if (clearFirst) {
    await Player.deleteMany({});
    console.log('🗑️  Players cleared');
  }

  const playerUsers = await User.find({ isPlayer: true });

  if (playerUsers.length === 0) {
    console.log('⚠️  No users with isPlayer=true found. Seed users first.');
    return [];
  }

  const playerData = [];
  for (const user of playerUsers) {
    const userPositions: string[] = [getRandomElement(positions)];
    if (Math.random() > 0.5) {
      userPositions.push(
        getRandomElement(
          positions.filter((p: string) => p !== userPositions[0])
        )
      );
    }

    const type =
      user.email === 'lifecycle.external@club.invalid'
        ? PlayerType.EXTERNAL
        : PlayerType.MEMBER;
    const isActivePlayer =
      (type === PlayerType.MEMBER &&
        user.membershipStatus !== undefined &&
        participationEnabledMemberStatuses.has(user.membershipStatus)) ||
      (type === PlayerType.EXTERNAL &&
        user.membershipStatus === MembershipStatus.INACTIVE);

    playerData.push({
      userId: user._id,
      type,
      preferredPositions: userPositions,
      singlesRanking: getRandomRanking(),
      doublesRanking: getRandomRanking(),
      isActivePlayer,
      teamIds: [],
    });
  }

  const players = await Player.create(playerData);
  console.log(`✅ ${players.length} players created`);
  return players;
}

/**
 * Seed teams
 */
async function seedTeams(clearFirst: boolean = true): Promise<any[]> {
  if (clearFirst) {
    await Team.deleteMany({});
    console.log('🗑️  Teams cleared');
  }

  const adminUser = await User.findOne({
    accountKind: AccountKind.PERSON,
    administratorDesignation: true,
  });
  if (!adminUser) {
    console.log('⚠️  No admin user found. Seed users first.');
    return [];
  }

  const teams = await Team.create([
    {
      teamId: 't1',
      shortName: 'Demo I',
      leagueTeamName: 'Demo I',
      matchLevel: TeamLevel.B,
      createdById: adminUser._id,
    },
    {
      teamId: 't2',
      shortName: 'Demo II',
      leagueTeamName: 'Demo II',
      matchLevel: TeamLevel.D,
      createdById: adminUser._id,
    },
  ]);

  console.log(`✅ ${teams.length} teams created`);
  return teams;
}

async function validateMembershipSeed(): Promise<void> {
  const [users, players, teams] = await Promise.all([
    User.find()
      .select(
        '_id email accountKind membershipStatus accountSuspension isPlayer'
      )
      .lean(),
    Player.find().select('userId type isActivePlayer teamIds').lean(),
    Team.find().select('_id').lean(),
  ]);
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));
  const playersByUserId = new Map(
    players.map((player) => [player.userId.toString(), player])
  );
  const teamIds = new Set(teams.map((team) => team._id.toString()));
  const issues: string[] = [];

  const accountSuspendedUser = users.find(
    (user) => user.email === accountSuspendedSeedEmail
  );
  const accountSuspendedPlayer = accountSuspendedUser
    ? playersByUserId.get(accountSuspendedUser._id.toString())
    : undefined;
  if (
    !accountSuspendedUser ||
    accountSuspendedUser.membershipStatus !== MembershipStatus.ACTIVE ||
    !accountSuspendedUser.accountSuspension ||
    !accountSuspendedPlayer ||
    accountSuspendedPlayer.type !== PlayerType.MEMBER ||
    !accountSuspendedPlayer.isActivePlayer ||
    accountSuspendedPlayer.teamIds.length === 0
  ) {
    issues.push('canonical Account-suspended lifecycle scenario is incomplete');
  }

  for (const user of users) {
    if (user.accountKind !== AccountKind.PERSON) {
      issues.push('membership seed contains a non-person account');
      continue;
    }
    const player = playersByUserId.get(user._id.toString());
    if (user.isPlayer !== Boolean(player)) {
      issues.push('User.isPlayer does not match Player identity');
    }
  }

  for (const player of players) {
    const user = usersById.get(player.userId.toString());
    if (!user) {
      issues.push('Player lacks a valid User');
      continue;
    }
    if (user.accountKind !== AccountKind.PERSON) {
      issues.push('Player references a non-person User');
      continue;
    }

    if (
      player.isActivePlayer &&
      player.type === PlayerType.MEMBER &&
      !participationEnabledMemberStatuses.has(user.membershipStatus)
    ) {
      issues.push('enabled member Player has unsupported membership');
    }

    if (
      player.type === PlayerType.EXTERNAL &&
      user.membershipStatus !== MembershipStatus.INACTIVE
    ) {
      issues.push('external Player is a current member');
    }
    if (!player.isActivePlayer && player.teamIds.length > 0) {
      issues.push('ineligible Player retains Team assignment');
    }
    if (player.teamIds.some((teamId) => !teamIds.has(teamId.toString()))) {
      issues.push('Player references a missing Team');
    }
  }

  if (issues.length > 0) {
    const counts = issues.reduce<Record<string, number>>((result, issue) => {
      result[issue] = (result[issue] ?? 0) + 1;
      return result;
    }, {});
    throw new Error(
      `Seed membership validation failed: ${JSON.stringify(counts)}`
    );
  }

  console.log('✅ Membership lifecycle seed invariants verified');
}

/**
 * Seed matches
 */
async function seedMatches(clearFirst: boolean = true): Promise<void> {
  if (clearFirst) {
    await Match.deleteMany({});
    console.log('🗑️  Matches cleared');
  }

  const teams = await Team.find();
  const adminUser = await User.findOne({
    accountKind: AccountKind.PERSON,
    administratorDesignation: true,
  });

  if (teams.length === 0 || !adminUser) {
    console.log('⚠️  No teams or admin user found. Seed teams and users first.');
    return;
  }

  const venues = [
    'Fictional Demo hall A — no visitor address',
    'Fictional Demo hall B — no visitor address',
  ];

  const matches = [];

  // Historical matches
  const historicalDates = [
    new Date('2026-05-07T10:00:00Z'),
    new Date('2026-05-14T14:00:00Z'),
    new Date('2026-05-21T16:00:00Z'),
  ];
  const opponents = [
    'Fictional Demo Opponent 1',
    'Fictional Demo Opponent 2',
    'Fictional Demo Opponent 3',
  ];

  for (let i = 0; i < 3; i++) {
    matches.push({
      startAt: historicalDates[i],
      location: getRandomElement(venues),
      teamId: teams[i % teams.length]._id,
      opponentName: opponents[i],
      direction: i % 2 === 0 ? MatchDirection.HOME : MatchDirection.AWAY,
      lineup: [],
      result: {
        homeScore: Math.floor(Math.random() * 5) + 3,
        awayScore: Math.floor(Math.random() * 5) + 2,
      },
      availability: [],
      createdById: adminUser._id,
    });
  }

  // Upcoming matches
  const upcomingDates = [
    new Date('2026-10-05T10:00:00Z'),
    new Date('2026-10-12T14:00:00Z'),
    new Date('2026-10-19T16:00:00Z'),
    new Date('2026-11-02T10:00:00Z'),
    new Date('2026-11-16T14:00:00Z'),
    new Date('2026-11-23T16:00:00Z'),
  ];
  const upcomingOpponents = [
    'Fictional Demo Opponent 4',
    'Fictional Demo Opponent 5',
    'Fictional Demo Opponent 6',
    'Fictional Demo Opponent 7',
    'Fictional Demo Opponent 8',
    'Fictional Demo Opponent 9',
  ];

  for (let i = 0; i < 6; i++) {
    matches.push({
      startAt: upcomingDates[i],
      location: getRandomElement(venues),
      teamId: teams[i % teams.length]._id,
      opponentName: upcomingOpponents[i],
      direction: i % 2 === 0 ? MatchDirection.HOME : MatchDirection.AWAY,
      lineup: [],
      availability: [],
      createdById: adminUser._id,
    });
  }

  await Match.create(matches.map(withMatchScheduleDuplicateKey));
  console.log(`✅ ${matches.length} matches created`);
}

/**
 * Seed membership applications
 */
async function seedApplications(clearFirst: boolean = true): Promise<void> {
  if (clearFirst) {
    const applicationIds = await MembershipApplication.distinct('_id');
    await Promise.all([
      MemberBankingProfile.deleteMany({
        sourceApplicationId: { $in: applicationIds },
      }),
      RegistrationApprovalEvent.deleteMany({
        applicationId: { $in: applicationIds },
      }),
      MembershipApplicationAccessToken.deleteMany({
        applicationId: { $in: applicationIds },
      }),
      MembershipApplicantSession.deleteMany({
        applicationId: { $in: applicationIds },
      }),
      MembershipStudentProofOperation.deleteMany({
        applicationId: { $in: applicationIds },
      }),
    ]);
    await MembershipApplication.deleteMany({});
    console.log('🗑️  Applications cleared');
  }

  // Get admin users for reviewer assignment
  const adminUsers = await User.find({
    accountKind: AccountKind.PERSON,
    administratorDesignation: true,
  });
  const approvedMemberUsers = await User.find({
    accountKind: AccountKind.PERSON,
    administratorDesignation: false,
    membershipStatus: MembershipStatus.ACTIVE,
    accountOnboardingStatus: AccountOnboardingStatus.READY,
    membershipType: { $exists: true },
    phone: { $exists: true },
    address: { $exists: true },
  })
    .sort({ email: 1 })
    .limit(2);
  if (adminUsers.length === 0) {
    console.log('⚠️  No admin users found. Creating pending applications only.');
  } else if (approvedMemberUsers.length < 2) {
    console.log(
      '⚠️  Fewer than two ready active Member users found. Creating pending applications in place of approved applications.'
    );
  }

  const applications = [];
  const approvedApplicationStates = [];
  let approvedMemberIndex = 0;

  // Application data with different scenarios
  const applicationConfigs = [
    // 4 Pending applications (no reviewer)
    { status: 'pending', accountHolderType: 'same' as const },
    { status: 'pending', accountHolderType: 'same' as const },
    { status: 'pending', accountHolderType: 'different' as const }, // Parent pays for child
    { status: 'pending', accountHolderType: 'same' as const },
    // 2 Approved applications (with reviewer)
    { status: 'approved', accountHolderType: 'same' as const },
    { status: 'approved', accountHolderType: 'different' as const }, // Spouse pays
    // 2 Rejected applications (with reviewer)
    { status: 'rejected', accountHolderType: 'same' as const },
    { status: 'rejected', accountHolderType: 'same' as const },
  ];

  for (let i = 0; i < applicationConfigs.length; i++) {
    const config = applicationConfigs[i];
    const status =
      adminUsers.length === 0 ||
      (config.status === 'approved' && approvedMemberUsers.length < 2)
        ? 'pending'
        : config.status;
    const approvedMember =
      status === 'approved'
        ? approvedMemberUsers[approvedMemberIndex++]
        : undefined;
    const gender = Math.random() > 0.5 ? 'male' : 'female';
    const firstName =
      approvedMember?.firstName ?? getRandomElement(firstNames[gender]);
    const lastName = approvedMember?.lastName ?? getRandomElement(lastNames);
    const city = approvedMember?.address?.city ?? getRandomElement(cities);

    // For 'different' account holder, generate different person's info
    const isAccountHolderDifferent = config.accountHolderType === 'different';
    const holderFirstName = isAccountHolderDifferent
      ? getRandomElement(firstNames[gender === 'male' ? 'female' : 'male'])
      : firstName;
    const holderLastName = isAccountHolderDifferent ? lastName : lastName; // Same family name
    const holderAddress = isAccountHolderDifferent
      ? `${getRandomElement(streets)} ${Math.floor(Math.random() * 100) + 1}, ${getRandomPostalCode()} ${city}`
      : '';

    // Assign reviewer for non-pending applications
    const needsReviewer = status !== 'pending';
    const reviewer = needsReviewer
      ? adminUsers[i % adminUsers.length]._id
      : undefined;
    const reviewDate = needsReviewer
      ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      : undefined;
    const reviewNotes =
      status === 'approved'
        ? 'Welcome to the club!'
        : status === 'rejected'
          ? 'Capacity currently full, please apply again next season.'
          : undefined;

    const applicationId = new mongoose.Types.ObjectId();
    const verifiedEmail =
      approvedMember?.email ??
      `${normalizeForEmail(firstName)}.${normalizeForEmail(lastName)}.applicant${i}@example.invalid`;
    const bankingInfo = normalizeBankingInfo({
      accountHolderType: config.accountHolderType,
      ...(config.accountHolderType === 'different'
        ? {
            accountHolderFirstName: holderFirstName,
            accountHolderLastName: holderLastName,
            accountHolderAddress: holderAddress,
          }
        : {}),
      iban: 'DE00000000000000000000',
      bic: 'DEMODE00XXX',
      bankName: 'Fictional Demo Bank',
      debitFrequency: getRandomElement(['quarterly', 'annually']),
    });
    const application = {
      _id: applicationId,
      verifiedEmail,
      personalInfo: {
        firstName,
        lastName,
        email: verifiedEmail,
        phone: approvedMember?.phone ?? getRandomPhone(),
        dateOfBirth:
          approvedMember?.dateOfBirth ??
          `${Math.floor(Math.random() * 30) + 1980}-${(Math.floor(Math.random() * 12) + 1).toString().padStart(2, '0')}-${(Math.floor(Math.random() * 28) + 1).toString().padStart(2, '0')}`,
        gender: approvedMember?.gender ?? gender,
        address: {
          street:
            approvedMember?.address?.street ??
            `${getRandomElement(streets)} ${Math.floor(Math.random() * 100) + 1}`,
          city,
          postalCode:
            approvedMember?.address?.postalCode ?? getRandomPostalCode(),
          country: approvedMember?.address?.country ?? 'Germany',
        },
      },
      membershipType:
        approvedMember?.membershipType ??
        getRandomElement(['regular', 'student']),
      encryptedBanking: bankingCryptoService.encrypt(
        bankingInfo,
        'membership-application',
        applicationId.toString()
      ),
      bankingSummary: getBankingSummary(bankingInfo),
      motivation:
        'I am passionate about badminton and would like to join your club.',
      status,
      reviewer,
      reviewDate,
      reviewNote: reviewNotes,
      ...(status === 'approved'
        ? {
            approvedAt: reviewDate,
            approvedUserId: approvedMember?._id,
            submittedAt: reviewDate,
            signedApplicationReceipt: {
              receivedAt: reviewDate,
              receivedBy: reviewer,
            },
            signedSepaReceipt: {
              receivedAt: reviewDate,
              receivedBy: reviewer,
            },
            decisionNotificationKind: 'approval' as const,
            decisionNotificationStatus: 'pending' as const,
          }
        : {}),
      applicantDataUpdatedAt: new Date(),
    };
    applications.push(application);

    if (status === 'approved' && approvedMember && reviewer) {
      approvedApplicationStates.push({
        applicationId,
        approvedMember,
        bankingInfo,
        bankingSummary: application.bankingSummary,
        reviewer,
      });
    }
  }

  await MembershipApplication.create(applications);
  if (approvedApplicationStates.length > 0) {
    const bankingProfiles = [];
    const approvalEvents = [];
    for (const state of approvedApplicationStates) {
      const userId = state.approvedMember._id.toString();
      const player = await Player.findOne({ userId: state.approvedMember._id })
        .select('_id')
        .lean();
      const idempotencyKey = `seed-membership-approval-${state.applicationId.toString()}`;
      bankingProfiles.push({
        userId: state.approvedMember._id,
        encryptedBanking: bankingCryptoService.encrypt(
          state.bankingInfo,
          'member-banking-profile',
          userId
        ),
        bankingSummary: state.bankingSummary,
        sourceApplicationId: state.applicationId,
      });
      approvalEvents.push({
        applicationId: state.applicationId,
        idempotencyKey,
        intentFingerprint: createHash('sha256')
          .update(
            JSON.stringify({
              applicationId: state.applicationId.toString(),
              reviewerId: state.reviewer.toString(),
              reviewNote: 'Welcome to the club!',
              approvalMessage: '',
            })
          )
          .digest('hex'),
        status: RegistrationApprovalStatus.COMPLETED,
        result: {
          applicationId: state.applicationId.toString(),
          userId,
          ...(player ? { playerId: player._id.toString() } : {}),
          setupGeneration: state.approvedMember.passwordSetupGeneration ?? 0,
          setupRequired: false,
        },
      });
    }
    await MemberBankingProfile.create(bankingProfiles);
    await RegistrationApprovalEvent.create(approvalEvents);
  }

  const pending = applications.filter((a) => a.status === 'pending').length;
  const approved = applications.filter((a) => a.status === 'approved').length;
  const rejected = applications.filter((a) => a.status === 'rejected').length;

  console.log(`✅ ${applications.length} applications created:`);
  console.log(
    `   - ${pending} pending, ${approved} approved, ${rejected} rejected`
  );
}

/**
 * Seed content entries
 */
async function seedContent(clearFirst: boolean = true): Promise<void> {
  if (clearFirst) {
    await Content.deleteMany({});
    await HomepageContent.deleteMany({});
    await ClubInformation.deleteMany({});
    console.log('🗑️  Legacy and canonical content cleared');
  }

  const adminUser = await User.findOne({
    accountKind: AccountKind.PERSON,
    administratorDesignation: true,
  });
  if (!adminUser) {
    console.log('⚠️  No admin user found. Seed users first.');
    return;
  }

  await HomepageContent.create({
    singletonKey: 'homepage',
    content: CANONICAL_HOMEPAGE_CONTENT,
    updatedBy: adminUser._id,
  });

  await ClubInformation.create({
    singletonKey: 'club',
    content: CANONICAL_CLUB_INFORMATION,
    updatedBy: adminUser._id,
  });
  console.log('✅ Canonical Homepage and Club Information created');
}

type SeedPublicContent = 'development' | 'canonical';

async function seedParticipationContent(
  publicContent: SeedPublicContent = 'development'
): Promise<void> {
  const adminUser = await User.findOne({
    accountKind: AccountKind.PERSON,
    administratorDesignation: true,
  });
  if (!adminUser) {
    console.log('⚠️  No admin user found. Seed users first.');
    return;
  }
  const contacts = await ContactEntry.create(
    (publicContent === 'canonical'
      ? CANONICAL_CONTACT_ENTRIES
      : [...CANONICAL_CONTACT_ENTRIES, DEVELOPMENT_RECRUITMENT_CONTACT]
    ).map(({ retainedQrCode: _unused, ...entry }) => ({
      ...entry,
      qrCode: '',
      createdBy: adminUser._id,
      updatedBy: adminUser._id,
    }))
  );
  await TasterSessionPublicContent.create({
    singletonKey: 'taster-session',
    content:
      publicContent === 'canonical'
        ? CANONICAL_TASTER_SESSION_PUBLIC_CONTENT
        : DEVELOPMENT_TASTER_SESSION_PUBLIC_CONTENT,
    updatedBy: adminUser._id,
  });
  await MembershipPublicContent.create({
    singletonKey: 'membership',
    content:
      publicContent === 'canonical'
        ? CANONICAL_MEMBERSHIP_PUBLIC_CONTENT
        : DEVELOPMENT_MEMBERSHIP_PUBLIC_CONTENT,
    updatedBy: adminUser._id,
  });
  await RecruitmentPublicContent.create({
    singletonKey: 'recruitment',
    content:
      publicContent === 'canonical'
        ? CANONICAL_RECRUITMENT_PUBLIC_CONTENT
        : developmentRecruitmentPublicContent(
            String(contacts[CANONICAL_CONTACT_ENTRIES.length]._id)
          ),
    updatedBy: adminUser._id,
  });
  console.log('✅ Participation content created');
}

async function seedDevelopmentDiscoveryContent(): Promise<void> {
  const adminUser = await User.findOne({
    accountKind: AccountKind.PERSON,
    administratorDesignation: true,
  });
  if (!adminUser) {
    console.log('⚠️  No admin user found. Seed users first.');
    return;
  }

  await Location.create(canonicalLocations(adminUser._id));
  await Announcement.create(
    DEVELOPMENT_ANNOUNCEMENTS.map((announcement) => ({
      ...announcement,
      createdBy: adminUser._id,
      updatedBy: adminUser._id,
    }))
  );
  await Activity.create(
    DEVELOPMENT_ACTIVITIES.map((activity) => ({
      ...activity,
      createdBy: adminUser._id,
      updatedBy: adminUser._id,
    }))
  );
  console.log(
    '✅ Development Locations, Announcements, and Activities created'
  );
}

async function clearResetDependentState(): Promise<void> {
  await Promise.all([
    AuthSession.deleteMany({}),
    DemoEditingSession.deleteMany({}),
    GuestPlay.deleteMany({}),
    TasterSessionRequestModel.deleteMany({}),
    RegistrationAccess.deleteMany({}),
    AccountOnboardingOperation.deleteMany({}),
    MembershipLifecycleEvent.deleteMany({}),
    MembershipTermination.deleteMany({}),
    MembershipApplicationAccessToken.deleteMany({}),
    MembershipApplicantSession.deleteMany({}),
    MembershipStudentProofOperation.deleteMany({}),
  ]);
}

// ============================================
// MAIN SEED FUNCTION
// ============================================

/**
 * Main seeder with modular table support
 */
type PreparedOwnerReset = () => Promise<void>;

async function prepareActivityReset(
  activityUploadsRoot: string
): Promise<PreparedOwnerReset> {
  const activities = await Activity.collection
    .find({}, { projection: { _id: 1, images: 1 } })
    .toArray();
  const files = new ActivityOwnedFileStore(activityUploadsRoot);
  const owners = activities.map((activity) => ({
    id: activity._id.toString(),
    images: Array.isArray(activity.images)
      ? activity.images.filter(
          (image): image is string => typeof image === 'string'
        )
      : [],
  }));

  for (const owner of owners) {
    files.assertCleanupOwnership(owner.id, owner.images);
  }

  return async () => {
    await Activity.collection.deleteMany({});
    await files.resetOwnedNamespaces();
  };
}

async function prepareContactReset(
  contactUploadsRoot: string
): Promise<PreparedOwnerReset> {
  const contacts = await ContactEntry.find({}).select('_id qrCode').lean();
  const files = new ContactQrOwnedFileStore(contactUploadsRoot);
  for (const contact of contacts) {
    files.assertCleanupOwnership(
      contact._id.toString(),
      contact.qrCode ? [contact.qrCode] : []
    );
  }
  return async () => {
    await ContactEntry.deleteMany({});
    await files.resetOwnedNamespaces();
  };
}

const LEGACY_PUBLIC_DOCUMENT_COLLECTION = 'publicdocuments';

async function preparePublicDocumentReset(
  publicDocumentUploadsRoot: string
): Promise<PreparedOwnerReset> {
  const database = mongoose.connection.db;
  if (!database) {
    throw new Error(
      'Destructive reset refused: Public Documents database is unavailable'
    );
  }

  const currentDocuments = await PublicDocument.collection
    .find({}, { projection: { _id: 1, fileUrl: 1 } })
    .toArray();
  const legacyCollection = database.collection(
    LEGACY_PUBLIC_DOCUMENT_COLLECTION
  );
  const legacyDocuments = await legacyCollection
    .find({}, { projection: { _id: 1, fileUrl: 1 } })
    .toArray();
  const files = new PublicDocumentOwnedFileStore(publicDocumentUploadsRoot);

  for (const document of [...currentDocuments, ...legacyDocuments]) {
    const fileUrl =
      typeof document.fileUrl === 'string' ? document.fileUrl : '';
    if (fileUrl.startsWith('/uploads/public-documents/')) {
      files.assertCleanupOwnership(document._id.toString(), [fileUrl]);
    }
  }

  return async () => {
    await PublicDocument.collection.deleteMany({});
    try {
      await legacyCollection.drop();
    } catch (error: unknown) {
      if ((error as { code?: number }).code !== 26) throw error;
    }
    await files.resetOwnedNamespaces();
  };
}

async function assertConnectedResetTarget(
  approvedTarget: ApprovedMongoResetTarget
): Promise<void> {
  let hello: unknown;
  let replicaSetConfiguration: unknown;

  const admin = mongoose.connection.db?.admin();
  try {
    hello = await admin?.command({ hello: 1 });
  } catch {
    throw new Error(
      'Destructive reset refused: live MongoDB topology verification failed'
    );
  }

  if (approvedTarget.topology.kind === 'replica-set') {
    try {
      replicaSetConfiguration = await admin?.command({ replSetGetConfig: 1 });
    } catch {
      throw new Error(
        'Destructive reset refused: replica-set configuration verification failed'
      );
    }
  }

  assertConnectedMongoTarget({
    connectedDatabaseName: mongoose.connection.name,
    approvedTarget,
    hello,
    replicaSetConfiguration,
  });
}

// Creation only: the local reset and fresh hosted wrapper own target admission.
// No reset or file cleanup is reachable from this phase.
export async function createSyntheticSeed(
  passwordFor: SeedCredentialStrategy = localSeedPassword,
  publicContent: SeedPublicContent = 'development'
): Promise<void> {
  // Seed in order (users first, as other entities depend on them)
  await seedUsers(false, passwordFor);
  await seedPlayers(false);
  const teams = await seedTeams(false);
  await seedMatches(false);
  await seedApplications(false);
  await seedContent(false);
  await seedParticipationContent(publicContent);
  await seedDevelopmentDiscoveryContent();
  await SettingsService.getSettings();
  const templateSummary = await reconcileEmailTemplates();
  if (templateSummary.reviewRequired.length > 0) {
    throw new Error(
      'Email-template reconciliation requires review before reset can complete'
    );
  }

  // Assign players to teams
  const players = await Player.find({ isActivePlayer: true });
  for (let i = 0; i < teams.length; i++) {
    const teamSize = Math.min(
      Math.floor(Math.random() * 7) + 6,
      players.length
    );
    for (let j = 0; j < teamSize; j++) {
      const player = players[j];
      if (!player.teamIds.includes(teams[i]._id as any)) {
        player.teamIds.push(teams[i]._id as any);
        await player.save();
      }
    }
  }
  const accountSuspendedUser = await User.findOne({
    email: accountSuspendedSeedEmail,
  });
  if (!accountSuspendedUser || !teams[0]) {
    throw new Error(
      'Canonical Account-suspended seed prerequisites are unavailable'
    );
  }
  const accountSuspendedTeamAssignment = await Player.updateOne(
    {
      userId: accountSuspendedUser._id,
      type: PlayerType.MEMBER,
      isActivePlayer: true,
    },
    { $addToSet: { teamIds: teams[0]._id } }
  );
  if (accountSuspendedTeamAssignment.matchedCount !== 1) {
    throw new Error('Canonical Account-suspended Player seed is unavailable');
  }
  await validateMembershipSeed();
}

async function seedData(
  table: SeedTable = 'all',
  options: SeedDataOptions
): Promise<void> {
  try {
    const dbUri = getDatabaseUri();
    if (!options?.target) {
      throw new Error(
        'Destructive reset refused: explicit target context is required'
      );
    }
    const approvedMongoTarget = assertDisposableMongoTarget(
      dbUri,
      options.target,
      process.env.NODE_ENV,
      process.env.VITEST
    );
    if (options.testFileTarget) {
      if (options.target.kind !== 'operator') {
        throw new Error(
          'Destructive reset refused: temporary test file targets require operator reset mode'
        );
      }
      assertActiveVitestTestTarget(options.testFileTarget, process.env.VITEST);
    }
    const resetsFiles = table === 'all' || table === 'content';
    assertRetainedPublicUploadResetAllowed({
      resetsFiles,
      alternateDevelopmentDatabase: apiEnvironment.alternateDevelopmentDatabase,
    });
    const fileTarget = options.testFileTarget ?? options.target;
    const defaultUploadsRoot = resolvePublicUploadsRoot({
      nodeEnv: process.env.NODE_ENV || 'development',
      workingDirectory: apiDir,
      configuredRoot: process.env.DEVELOPMENT_PUBLIC_UPLOADS_ROOT,
    });
    const activityUploadsRoot =
      options.activityUploadsRoot ??
      (options.target.kind === 'operator' ? defaultUploadsRoot : undefined);
    const contactUploadsRoot =
      options.contactUploadsRoot ??
      (options.target.kind === 'operator' ? defaultUploadsRoot : undefined);
    const publicDocumentUploadsRoot =
      options.publicDocumentUploadsRoot ??
      (options.target.kind === 'operator' ? defaultUploadsRoot : undefined);
    if (resetsFiles) {
      if (
        !activityUploadsRoot ||
        !contactUploadsRoot ||
        !publicDocumentUploadsRoot
      ) {
        throw new Error(
          'Destructive reset refused: test file targets must be explicit'
        );
      }
      await assertDisposableFileTargets({
        target: fileTarget,
        apiDirectory: apiDir,
        activityUploadsRoot,
        contactUploadsRoot,
        publicDocumentUploadsRoot,
      });
    }
    await mongoose.connect(dbUri);
    await assertConnectedResetTarget(approvedMongoTarget);
    const preparedFileResets = resetsFiles
      ? await Promise.all([
          prepareActivityReset(activityUploadsRoot!),
          prepareContactReset(contactUploadsRoot!),
          preparePublicDocumentReset(publicDocumentUploadsRoot!),
        ])
      : undefined;
    console.log(`\n🔗 Connected to database: ${mongoose.connection.name}`);
    console.log(`📋 Seeding: ${table}\n`);

    if (table === 'all') {
      // Clear all
      await clearResetDependentState();
      await preparedFileResets![0]();
      await preparedFileResets![1]();
      await preparedFileResets![2]();
      await User.deleteMany({});
      await Player.deleteMany({});
      await Team.deleteMany({});
      await Match.deleteMany({});
      await Content.deleteMany({});
      await HomepageContent.deleteMany({});
      await ClubInformation.deleteMany({});
      await Announcement.deleteMany({});
      await Location.deleteMany({});
      await TasterSessionPublicContent.deleteMany({});
      await MembershipPublicContent.deleteMany({});
      await RecruitmentPublicContent.deleteMany({});
      await MembershipApplication.deleteMany({});
      await MemberBankingProfile.deleteMany({});
      await RegistrationApprovalEvent.deleteMany({});
      await Notification.deleteMany({});
      await EmailTemplate.deleteMany({});
      await Settings.deleteMany({});
      console.log('🗑️  All collections cleared\n');

      await createSyntheticSeed();
    } else {
      // Seed specific table
      switch (table) {
        case 'users':
          await seedUsers(true);
          break;
        case 'applications':
          await seedApplications(true);
          break;
        case 'content':
          await preparedFileResets![0]();
          await preparedFileResets![1]();
          await preparedFileResets![2]();
          await Announcement.deleteMany({});
          await Location.deleteMany({});
          await TasterSessionPublicContent.deleteMany({});
          await MembershipPublicContent.deleteMany({});
          await RecruitmentPublicContent.deleteMany({});
          await seedContent(true);
          await seedParticipationContent();
          await seedDevelopmentDiscoveryContent();
          break;
      }
    }

    // Print summary
    const stats = {
      activities: await Activity.countDocuments(),
      announcements: await Announcement.countDocuments(),
      locations: await Location.countDocuments(),
      users: await User.countDocuments(),
      players: await Player.countDocuments(),
      teams: await Team.countDocuments(),
      matches: await Match.countDocuments(),
      applications: await MembershipApplication.countDocuments(),
      homepageContent: await HomepageContent.countDocuments(),
      clubInformation: await ClubInformation.countDocuments(),
      contactEntries: await ContactEntry.countDocuments(),
      tasterContent: await TasterSessionPublicContent.countDocuments(),
      membershipContent: await MembershipPublicContent.countDocuments(),
      recruitmentContent: await RecruitmentPublicContent.countDocuments(),
      notifications: await Notification.countDocuments(),
      templates: await EmailTemplate.countDocuments(),
    };

    console.log('\n=== DATABASE STATUS ===');
    console.log(
      `Activities: ${stats.activities} | Users: ${stats.users} | Players: ${stats.players} | Teams: ${stats.teams}`
    );
    console.log(
      `Matches: ${stats.matches} | Applications: ${stats.applications}`
    );
    console.log(
      `Homepage: ${stats.homepageContent} | Club: ${stats.clubInformation} | Notifications: ${stats.notifications}`
    );
    console.log(
      `Announcements: ${stats.announcements} | Locations: ${stats.locations}`
    );
    console.log(
      `Contact: ${stats.contactEntries} | Taster content: ${stats.tasterContent} | Membership content: ${stats.membershipContent} | Recruitment content: ${stats.recruitmentContent}`
    );
    console.log(`Templates: ${stats.templates}`);

    if (table === 'all') {
      console.log('\n🎯 Test Accounts:');
      console.log('Admin: admin@club.invalid');
      console.log('Coach: coach@club.invalid');
      console.log('Demo Admin: demo.admin@club.invalid');
    }

    console.log('\n✅ Seeding completed!');
  } catch (error) {
    console.error(
      `❌ Error seeding database: ${sanitizeResetDiagnostic(error)}`
    );
    throw error;
  }
}

// ============================================
// CLI ENTRY POINT
// ============================================

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const tableArg = process.argv[2] as OperatorSeedTable | undefined;
  if (tableArg && !['content', 'all'].includes(tableArg)) {
    console.error('Usage: seed:data [all|content]');
    process.exitCode = 1;
  } else {
    seedData(tableArg || 'all', { target: { kind: 'operator' } })
      .then(() => mongoose.disconnect())
      .catch(async () => {
        await mongoose.disconnect();
        process.exitCode = 1;
      });
  }
}

export { seedData };
