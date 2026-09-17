import * as dotenv from 'dotenv';
import { Capability, Language } from '@club/shared-types/core/enums';
import mongoose, { type Types } from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ClubInformation } from '../models/ClubInformation.js';
import { ContactEntry } from '../models/ContactEntry.js';
import { HomepageContent } from '../models/Content.js';
import { Location } from '../models/Location.js';
import { MembershipPublicContent } from '../models/MembershipPublicContent.js';
import { RecruitmentPublicContent } from '../models/RecruitmentPublicContent.js';
import { TasterSessionPublicContent } from '../models/TasterSessionPublicContent.js';
import { User } from '../models/User.js';
import { evaluateUserCapabilities } from '../services/capabilityPolicyService.js';
import {
  CANONICAL_CLUB_INFORMATION,
  CANONICAL_CONTACT_ENTRIES,
  CANONICAL_HOMEPAGE_CONTENT,
  CANONICAL_MEMBERSHIP_PUBLIC_CONTENT,
  CANONICAL_RECRUITMENT_PUBLIC_CONTENT,
  CANONICAL_TASTER_SESSION_PUBLIC_CONTENT,
} from './canonicalContentDefaults.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const apiDirectory = path.resolve(directory, '../../');
const environmentFile =
  process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: path.join(apiDirectory, environmentFile) });

export const canonicalLocations = (administratorId: Types.ObjectId) => [
  {
    translations: {
      [Language.GERMAN]: {
        name: 'Fiktive Demo-Halle A',
        address: 'Demo — no real visitor address',
      },
      [Language.ENGLISH]: {
        name: 'Fictional Demo hall A',
        address: 'Demo — no real visitor address',
      },
      [Language.CHINESE]: {
        name: '虚构 Demo 场馆 A',
        address: 'Demo — no real visitor address',
      },
    },
    timeSlots: [
      {
        id: '0a0a0a0a-0000-4000-8000-000000000001',
        weekday: 'friday',
        startTime: '19:00',
        endTime: '21:30',
        active: true,
        guestPlayEnabled: true,
        tasterSessionEnabled: true,
        tasterSessionAcceptedLevels: ['beginner', 'experienced'],
      },
      {
        id: '0a0a0a0a-0000-4000-8000-000000000002',
        weekday: 'sunday',
        startTime: '15:00',
        endTime: '20:00',
        active: true,
        guestPlayEnabled: true,
        tasterSessionEnabled: true,
        tasterSessionAcceptedLevels: ['beginner', 'experienced'],
      },
    ],
    imageUrl: '',
    order: 0,
    isActive: true,
    createdBy: administratorId,
    updatedBy: administratorId,
  },
  {
    translations: {
      [Language.GERMAN]: {
        name: 'Fiktive Demo-Halle B',
        address: 'Demo — no real visitor address',
      },
      [Language.ENGLISH]: {
        name: 'Fictional Demo hall B',
        address: 'Demo — no real visitor address',
      },
      [Language.CHINESE]: {
        name: '虚构 Demo 场馆 B',
        address: 'Demo — no real visitor address',
      },
    },
    timeSlots: [
      {
        id: '0a0a0a0a-0000-4000-8000-000000000003',
        weekday: 'tuesday',
        startTime: '19:00',
        endTime: '22:00',
        active: true,
        guestPlayEnabled: true,
        tasterSessionEnabled: true,
        tasterSessionAcceptedLevels: ['experienced'],
      },
      {
        id: '0a0a0a0a-0000-4000-8000-000000000004',
        weekday: 'friday',
        startTime: '19:00',
        endTime: '22:00',
        active: true,
        guestPlayEnabled: true,
        tasterSessionEnabled: true,
        tasterSessionAcceptedLevels: ['experienced'],
      },
      {
        id: '0a0a0a0a-0000-4000-8000-000000000005',
        weekday: 'saturday',
        startTime: '14:00',
        endTime: '20:00',
        active: true,
        guestPlayEnabled: true,
        tasterSessionEnabled: true,
        tasterSessionAcceptedLevels: ['experienced'],
      },
      {
        id: '0a0a0a0a-0000-4000-8000-000000000006',
        weekday: 'sunday',
        startTime: '14:00',
        endTime: '20:00',
        active: true,
        guestPlayEnabled: true,
        tasterSessionEnabled: true,
        tasterSessionAcceptedLevels: ['experienced'],
      },
    ],
    imageUrl: '',
    order: 1,
    isActive: true,
    createdBy: administratorId,
    updatedBy: administratorId,
  },
];

export interface CanonicalContentBootstrapSummary {
  created: string[];
  preserved: string[];
}

export async function bootstrapCanonicalContent(
  administratorId: Types.ObjectId
): Promise<CanonicalContentBootstrapSummary> {
  const summary: CanonicalContentBootstrapSummary = {
    created: [],
    preserved: [],
  };

  if (!(await HomepageContent.exists({ singletonKey: 'homepage' }))) {
    await HomepageContent.create({
      singletonKey: 'homepage',
      content: CANONICAL_HOMEPAGE_CONTENT,
      updatedBy: administratorId,
    });
    summary.created.push('homepage');
  } else summary.preserved.push('homepage');

  if (!(await ClubInformation.exists({ singletonKey: 'club' }))) {
    await ClubInformation.create({
      singletonKey: 'club',
      content: CANONICAL_CLUB_INFORMATION,
      updatedBy: administratorId,
    });
    summary.created.push('club');
  } else summary.preserved.push('club');

  if ((await Location.countDocuments()) === 0) {
    await Location.create(canonicalLocations(administratorId));
    summary.created.push('locations');
  } else summary.preserved.push('locations');

  if ((await ContactEntry.countDocuments()) === 0) {
    await ContactEntry.create(
      CANONICAL_CONTACT_ENTRIES.map(
        ({ retainedQrCode: _unused, ...entry }) => ({
          ...entry,
          qrCode: '',
          createdBy: administratorId,
          updatedBy: administratorId,
        })
      )
    );
    summary.created.push('contact');
  } else summary.preserved.push('contact');

  if (
    !(await TasterSessionPublicContent.exists({
      singletonKey: 'taster-session',
    }))
  ) {
    await TasterSessionPublicContent.create({
      singletonKey: 'taster-session',
      content: CANONICAL_TASTER_SESSION_PUBLIC_CONTENT,
      updatedBy: administratorId,
    });
    summary.created.push('taster-session');
  } else summary.preserved.push('taster-session');

  if (!(await MembershipPublicContent.exists({ singletonKey: 'membership' }))) {
    await MembershipPublicContent.create({
      singletonKey: 'membership',
      content: CANONICAL_MEMBERSHIP_PUBLIC_CONTENT,
      updatedBy: administratorId,
    });
    summary.created.push('membership');
  } else summary.preserved.push('membership');

  if (
    !(await RecruitmentPublicContent.exists({ singletonKey: 'recruitment' }))
  ) {
    await RecruitmentPublicContent.create({
      singletonKey: 'recruitment',
      content: CANONICAL_RECRUITMENT_PUBLIC_CONTENT,
      updatedBy: administratorId,
    });
    summary.created.push('recruitment');
  } else summary.preserved.push('recruitment');

  return summary;
}

export async function bootstrapCanonicalContentForAdministrator(
  administratorEmail: string
): Promise<CanonicalContentBootstrapSummary> {
  const normalizedEmail = administratorEmail.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('An explicit existing administrator email is required');
  }

  const administrator = await User.findOne({
    email: normalizedEmail,
  });
  if (
    !administrator ||
    !(await evaluateUserCapabilities(administrator)).capabilities.includes(
      Capability.ADMINISTRATION
    )
  ) {
    throw new Error(
      'The selected existing administrator could not be verified'
    );
  }

  return bootstrapCanonicalContent(administrator._id as Types.ObjectId);
}

function readAdministratorEmail(args: string[]): string {
  const inline = args.find((argument) => argument.startsWith('--admin-email='));
  if (inline) return inline.slice('--admin-email='.length);
  const index = args.indexOf('--admin-email');
  if (index >= 0 && args[index + 1]) return args[index + 1];
  throw new Error(
    'Usage: bootstrap:production-content -- --admin-email <email>'
  );
}

function sanitizeBootstrapDiagnostic(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown failure';
  return message.replace(
    /mongodb(?:\+srv)?:\/\/\S+/gi,
    '[redacted MongoDB target]'
  );
}

async function runProductionContentBootstrap(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error(
      'Production content bootstrap requires NODE_ENV=production'
    );
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error(`MONGODB_URI is required in ${environmentFile}`);

  const administratorEmail = readAdministratorEmail(process.argv.slice(2));
  await mongoose.connect(uri, { autoIndex: false });
  try {
    const summary =
      await bootstrapCanonicalContentForAdministrator(administratorEmail);
    console.log(
      `Canonical content bootstrap completed: ${summary.created.length} created, ${summary.preserved.length} preserved`
    );
  } finally {
    await mongoose.disconnect();
  }
}

const isMainModule = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMainModule) {
  runProductionContentBootstrap().catch((error: unknown) => {
    console.error(
      `Canonical content bootstrap failed: ${sanitizeBootstrapDiagnostic(error)}`
    );
    process.exitCode = 1;
  });
}
