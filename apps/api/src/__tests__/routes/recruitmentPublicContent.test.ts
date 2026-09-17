import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccountKind,
  AccountOnboardingStatus,
  Language,
  MembershipStatus,
} from '@club/shared-types/core/enums';
import recruitmentRoutes from '../../routes/recruitmentPublicContent';
import { RecruitmentPublicContentService } from '../../services/recruitmentPublicContentService';
import { errorHandler } from '../../middleware/errorHandler';
import { Player } from '../../models/Player';
import { User } from '../../models/User';
import {
  canonicalAuthUserDocument,
  FIRST_PARTY_ORIGIN,
  mockAuthSessionCookie,
} from '../helpers/authSession';

const userId = '507f1f77bcf86cd799439011';
let administratorDesignation = false;
const content = {
  isOpen: false,
  introduction: { de: 'Einführung', en: '', zh: '' },
  requirements: { de: 'Erfahrung', en: '', zh: '' },
  tryoutGuidance: { de: 'Kontakt', en: '', zh: '' },
  contactEntryId: null,
};

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/recruitment-content', recruitmentRoutes);
  instance.use(errorHandler);
  return instance;
}

beforeEach(() => {
  administratorDesignation = false;
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(User, 'findById').mockReturnValue({
    select: vi.fn().mockImplementation(async () =>
      canonicalAuthUserDocument({
        _id: userId,
        id: userId,
        email: 'editor@example.test',
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
    RecruitmentPublicContentService,
    'getPublicContent'
  ).mockResolvedValue({
    isOpen: false,
    introduction: 'Einführung',
    requirements: 'Erfahrung',
    tryoutGuidance: 'Kontakt',
    contactEntryId: null,
  });
  vi.spyOn(
    RecruitmentPublicContentService,
    'getAdministrationContent'
  ).mockResolvedValue({
    content,
    completeness: {} as never,
    contactAvailable: false,
    updatedAt: null,
  });
  vi.spyOn(RecruitmentPublicContentService, 'updateContent').mockResolvedValue({
    content,
    completeness: {} as never,
    contactAvailable: false,
    updatedAt: null,
  });
});

afterEach(() => vi.restoreAllMocks());

describe('Recruitment public-content routes', () => {
  it('validates locale and exposes the public projection', async () => {
    expect(
      (await request(app()).get('/api/recruitment-content?language=zh')).status
    ).toBe(200);
    expect(
      RecruitmentPublicContentService.getPublicContent
    ).toHaveBeenCalledWith(Language.CHINESE);
    expect(
      (await request(app()).get('/api/recruitment-content?language=fr')).status
    ).toBe(400);
  });

  it('protects administration with the Administration capability', async () => {
    const path = '/api/recruitment-content/admin';
    expect((await request(app()).get(path)).status).toBe(401);
    expect(
      (
        await request(app())
          .get(path)
          .set('Cookie', mockAuthSessionCookie(userId))
          .set('Origin', FIRST_PARTY_ORIGIN)
      ).status
    ).toBe(403);
    administratorDesignation = true;
    expect(
      (
        await request(app())
          .get(path)
          .set('Cookie', mockAuthSessionCookie(userId))
          .set('Origin', FIRST_PARTY_ORIGIN)
      ).status
    ).toBe(200);
  });

  it('rejects missing required German content before the service', async () => {
    administratorDesignation = true;
    const response = await request(app())
      .put('/api/recruitment-content/admin')
      .set('Cookie', mockAuthSessionCookie(userId))
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({
        content: { ...content, requirements: { de: '', en: '', zh: '' } },
      });

    expect(response.status).toBe(400);
    expect(
      RecruitmentPublicContentService.updateContent
    ).not.toHaveBeenCalled();
  });
});
