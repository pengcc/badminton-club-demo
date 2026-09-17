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
import tasterRoutes from '../../routes/tasterSessionPublicContent';
import membershipRoutes from '../../routes/membershipPublicContent';
import { TasterSessionPublicContentService } from '../../services/tasterSessionPublicContentService';
import { MembershipPublicContentService } from '../../services/membershipPublicContentService';
import { errorHandler } from '../../middleware/errorHandler';
import { Player } from '../../models/Player';
import { User } from '../../models/User';
import { AppError } from '../../utils/errors';

const userId = '507f1f77bcf86cd799439011';
let administratorDesignation = false;
const localized = (de: string, en = '', zh = '') => ({ de, en, zh });
const taster = {
  homepageSummary: localized('Kurz'),
  introduction: localized('Einführung'),
  preparation: localized(''),
  participationGuidance: localized(''),
  followUpGuidance: localized(''),
};
const membership = {
  homepageSummary: localized('Kurz'),
  introduction: localized('Einführung'),
  membershipTypes: localized('Arten'),
  membershipPath: localized('Weg'),
  applicationPreparation: localized(''),
  studentProof: localized(''),
};

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/taster-session-content', tasterRoutes);
  instance.use('/api/membership-content', membershipRoutes);
  instance.use(errorHandler);
  return instance;
}

function authorization() {
  return mockAuthSessionCookie(userId);
}

beforeEach(() => {
  administratorDesignation = false;
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(User, 'findById').mockReturnValue({
    select: vi.fn().mockImplementation(async () =>
      canonicalAuthUserDocument({
        _id: userId,
        id: userId,
        email: 'content-editor@example.test',
        firstName: 'Content',
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
  vi.spyOn(
    TasterSessionPublicContentService,
    'getPublicContent'
  ).mockResolvedValue({
    homepageSummary: 'Kurz',
    introduction: 'Einführung',
    preparation: '',
    participationGuidance: '',
    followUpGuidance: '',
  });
  vi.spyOn(
    MembershipPublicContentService,
    'getPublicContent'
  ).mockResolvedValue({
    homepageSummary: 'Kurz',
    introduction: 'Einführung',
    membershipTypes: 'Arten',
    membershipPath: 'Weg',
    applicationPreparation: '',
    studentProof: '',
  });
  vi.spyOn(
    TasterSessionPublicContentService,
    'getAdministrationContent'
  ).mockResolvedValue({
    content: taster,
    completeness: {} as never,
    updatedAt: null,
  });
  vi.spyOn(
    MembershipPublicContentService,
    'getAdministrationContent'
  ).mockResolvedValue({
    content: membership,
    completeness: {} as never,
    updatedAt: null,
  });
  vi.spyOn(
    TasterSessionPublicContentService,
    'updateContent'
  ).mockResolvedValue({
    content: taster,
    completeness: {} as never,
    updatedAt: null,
  });
  vi.spyOn(MembershipPublicContentService, 'updateContent').mockResolvedValue({
    content: membership,
    completeness: {} as never,
    updatedAt: null,
  });
});

afterEach(() => vi.restoreAllMocks());

describe('Taster and Membership public-content routes', () => {
  it.each([
    [
      '/api/taster-session-content',
      TasterSessionPublicContentService,
      'TASTER_SESSION_PUBLIC_CONTENT_UNAVAILABLE',
    ],
    [
      '/api/membership-content',
      MembershipPublicContentService,
      'MEMBERSHIP_PUBLIC_CONTENT_UNAVAILABLE',
    ],
  ] as const)('returns a bounded unavailable response from %s', async (path, service, code) => {
    vi.mocked(service.getPublicContent).mockRejectedValueOnce(
      new AppError('Public content is unavailable', 503, code)
    );

    const response = await request(app()).get(path);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: 'Public content is unavailable',
      code,
    });
  });

  it.each([
    ['/api/taster-session-content', 'taster'],
    ['/api/membership-content', 'membership'],
  ] as const)('validates locale on %s', async (path, ownerName) => {
    expect((await request(app()).get(`${path}?language=zh`)).status).toBe(200);
    const owner =
      ownerName === 'taster'
        ? TasterSessionPublicContentService.getPublicContent
        : MembershipPublicContentService.getPublicContent;
    expect(owner).toHaveBeenCalledWith(Language.CHINESE);
    expect((await request(app()).get(`${path}?language=fr`)).status).toBe(400);
  });

  it.each([
    '/api/taster-session-content/admin',
    '/api/membership-content/admin',
  ])('protects %s with Administration capability', async (path) => {
    expect((await request(app()).get(path)).status).toBe(401);
    expect(
      (
        await request(app())
          .get(path)
          .set('Cookie', authorization())
          .set('Origin', FIRST_PARTY_ORIGIN)
      ).status
    ).toBe(403);
    administratorDesignation = true;
    expect(
      (
        await request(app())
          .get(path)
          .set('Cookie', authorization())
          .set('Origin', FIRST_PARTY_ORIGIN)
      ).status
    ).toBe(200);
  });

  it('validates the exact required Taster fields before the owner', async () => {
    administratorDesignation = true;
    expect(
      (
        await request(app())
          .put('/api/taster-session-content/admin')
          .set('Cookie', authorization())
          .set('Origin', FIRST_PARTY_ORIGIN)
          .send({ content: { ...taster, homepageSummary: localized('') } })
      ).status
    ).toBe(400);
    expect(
      TasterSessionPublicContentService.updateContent
    ).not.toHaveBeenCalled();
    expect(
      (
        await request(app())
          .put('/api/taster-session-content/admin')
          .set('Cookie', authorization())
          .set('Origin', FIRST_PARTY_ORIGIN)
          .send({ content: taster })
      ).status
    ).toBe(200);
  });

  it('forwards protected Taster update rejections to the bounded error response', async () => {
    const sentinel = 'private Taster update failure detail';
    administratorDesignation = true;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(
      TasterSessionPublicContentService.updateContent
    ).mockRejectedValueOnce(new Error(sentinel));

    const response = await request(app())
      .put('/api/taster-session-content/admin')
      .set('Cookie', authorization())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({ content: taster });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: 'Internal Server Error',
    });
    expect(response.text).not.toContain(sentinel);
  });

  it('validates the exact required Membership fields before the owner', async () => {
    administratorDesignation = true;
    expect(
      (
        await request(app())
          .put('/api/membership-content/admin')
          .set('Cookie', authorization())
          .set('Origin', FIRST_PARTY_ORIGIN)
          .send({ content: { ...membership, membershipPath: localized('') } })
      ).status
    ).toBe(400);
    expect(MembershipPublicContentService.updateContent).not.toHaveBeenCalled();
    expect(
      (
        await request(app())
          .put('/api/membership-content/admin')
          .set('Cookie', authorization())
          .set('Origin', FIRST_PARTY_ORIGIN)
          .send({ content: membership })
      ).status
    ).toBe(200);
  });
});
