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
import teamPublicContentRoutes from '../../routes/teamPublicContent';
import { errorHandler } from '../../middleware/errorHandler';
import { TeamPublicContentService } from '../../services/teamPublicContentService';
import { Player } from '../../models/Player';
import { User } from '../../models/User';

const userId = '507f1f77bcf86cd799439011';
let administratorDesignation = false;

const content = {
  enabled: true,
  title: { de: 'Mannschaften', en: 'Teams', zh: '球队' },
  description: {
    de: 'Unsere Mannschaften',
    en: 'Our teams',
    zh: '我们的球队',
  },
};

const administrationResponse = {
  content,
  completeness: {
    title: { complete: true, missingLanguages: [] },
    description: { complete: true, missingLanguages: [] },
  },
  updatedAt: null,
};

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/team-public-content', teamPublicContentRoutes);
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
        email: 'team-content@example.test',
        firstName: 'Team',
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
  vi.spyOn(TeamPublicContentService, 'getPublicContent').mockResolvedValue({
    enabled: true,
    title: 'Teams',
    description: 'Our teams',
  });
  vi.spyOn(
    TeamPublicContentService,
    'getAdministrationContent'
  ).mockResolvedValue(administrationResponse);
  vi.spyOn(TeamPublicContentService, 'updateContent').mockResolvedValue({
    ...administrationResponse,
    updatedAt: '2026-08-04T12:00:00.000Z',
  });
});

afterEach(() => vi.restoreAllMocks());

describe('Team public content routes', () => {
  it('returns a locale-resolved public projection and validates locale', async () => {
    expect(
      (await request(app()).get('/api/team-public-content?language=zh')).status
    ).toBe(200);
    expect(TeamPublicContentService.getPublicContent).toHaveBeenCalledWith(
      Language.CHINESE
    );
    expect(
      (await request(app()).get('/api/team-public-content?language=fr')).status
    ).toBe(400);
  });

  it('protects the complete administration projection', async () => {
    expect(
      (await request(app()).get('/api/team-public-content/admin')).status
    ).toBe(401);
    expect(
      (
        await request(app())
          .get('/api/team-public-content/admin')
          .set('Cookie', token())
          .set('Origin', FIRST_PARTY_ORIGIN)
      ).status
    ).toBe(403);
    administratorDesignation = true;
    expect(
      (
        await request(app())
          .get('/api/team-public-content/admin')
          .set('Cookie', token())
          .set('Origin', FIRST_PARTY_ORIGIN)
      ).status
    ).toBe(200);
  });

  it('validates and submits one localized administration command', async () => {
    administratorDesignation = true;
    const sessionCookie = token();
    expect(
      (
        await request(app())
          .put('/api/team-public-content/admin')
          .set('Cookie', sessionCookie)
          .set('Origin', FIRST_PARTY_ORIGIN)
          .send({
            content: {
              ...content,
              title: { de: '', en: 'Teams', zh: '' },
            },
          })
      ).status
    ).toBe(400);
    expect(TeamPublicContentService.updateContent).not.toHaveBeenCalled();

    expect(
      (
        await request(app())
          .put('/api/team-public-content/admin')
          .set('Cookie', sessionCookie)
          .set('Origin', FIRST_PARTY_ORIGIN)
          .send({ content })
      ).status
    ).toBe(200);
    expect(TeamPublicContentService.updateContent).toHaveBeenCalledWith(
      content,
      userId
    );
  });
});
