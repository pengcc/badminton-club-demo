import express from 'express';
import request from 'supertest';
import {
  canonicalAuthUserDocument,
  FIRST_PARTY_ORIGIN,
  mockAuthSessionCookie,
} from '../helpers/authSession';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  AccountOnboardingStatus,
  Language,
  MembershipStatus,
  AccountKind,
} from '@club/shared-types/core/enums';
import clubInformationRoutes from '../../routes/clubInformation';
import { errorHandler } from '../../middleware/errorHandler';
import { ClubInformationService } from '../../services/clubInformationService';
import { Player } from '../../models/Player';
import { User } from '../../models/User';

const userId = '507f1f77bcf86cd799439011';
let administratorDesignation = false;

const content = {
  officialNameGerman: 'Deutsch-Chinesischer Badminton Verein e. V.',
  nameEnglish: 'German-Chinese Badminton Club',
  nameChinese: '德中羽毛球俱乐部',
  shortName: 'DCBV',
  foundingYear: 2009,
  introduction: { de: 'Verein', en: 'Club', zh: '俱乐部' },
};

const administrationResponse = {
  content,
  completeness: {
    introduction: { complete: true, missingLanguages: [] },
    nameTranslations: { complete: true, missingLanguages: [] },
  },
  updatedAt: null,
};

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/club-information', clubInformationRoutes);
  instance.use(errorHandler);
  return instance;
}

function token() {
  return mockAuthSessionCookie(userId);
}

beforeEach(() => {
  administratorDesignation = false;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(User, 'findById').mockReturnValue({
    select: vi.fn().mockImplementation(async () =>
      canonicalAuthUserDocument({
        _id: userId,
        id: userId,
        email: 'club-information@example.test',
        firstName: 'Club',
        lastName: 'Editor',
        accountKind: AccountKind.PERSON,
        administratorDesignation,
        membershipStatus: MembershipStatus.ACTIVE,
        accountOnboardingStatus: AccountOnboardingStatus.READY,
      })
    ),
  } as never);
  vi.spyOn(Player, 'findOne').mockReturnValue({
    select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
  } as never);
  vi.spyOn(ClubInformationService, 'getPublicContent').mockResolvedValue({
    ...content,
    localizedName: content.nameEnglish,
    introduction: 'Club',
  });
  vi.spyOn(
    ClubInformationService,
    'getAdministrationContent'
  ).mockResolvedValue(administrationResponse);
  vi.spyOn(ClubInformationService, 'updateContent').mockResolvedValue({
    ...administrationResponse,
    updatedAt: '2026-08-04T12:00:00.000Z',
  });
});

afterEach(() => vi.restoreAllMocks());

describe('Club Information routes', () => {
  it('returns the locale-resolved public projection and validates locale', async () => {
    expect(
      (await request(app()).get('/api/club-information?language=zh')).status
    ).toBe(200);
    expect(ClubInformationService.getPublicContent).toHaveBeenCalledWith(
      Language.CHINESE
    );
    expect(
      (await request(app()).get('/api/club-information?language=fr')).status
    ).toBe(400);
  });

  it('protects the complete administration projection', async () => {
    expect(
      (await request(app()).get('/api/club-information/admin')).status
    ).toBe(401);
    expect(
      (
        await request(app())
          .get('/api/club-information/admin')
          .set('Cookie', token())
          .set('Origin', FIRST_PARTY_ORIGIN)
      ).status
    ).toBe(403);
    administratorDesignation = true;
    expect(
      (
        await request(app())
          .get('/api/club-information/admin')
          .set('Cookie', token())
          .set('Origin', FIRST_PARTY_ORIGIN)
      ).status
    ).toBe(200);
  });

  it('validates and submits the one canonical administration command', async () => {
    administratorDesignation = true;
    const sessionCookie = token();
    expect(
      (
        await request(app())
          .put('/api/club-information/admin')
          .set('Cookie', sessionCookie)
          .set('Origin', FIRST_PARTY_ORIGIN)
          .send({ content: { ...content, officialNameGerman: '' } })
      ).status
    ).toBe(400);
    expect(ClubInformationService.updateContent).not.toHaveBeenCalled();

    expect(
      (
        await request(app())
          .put('/api/club-information/admin')
          .set('Cookie', sessionCookie)
          .set('Origin', FIRST_PARTY_ORIGIN)
          .send({ content })
      ).status
    ).toBe(200);
    expect(ClubInformationService.updateContent).toHaveBeenCalledWith(
      content,
      userId
    );
  });
});
