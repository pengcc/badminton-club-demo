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
import contentRoutes from '../../routes/content';
import { errorHandler } from '../../middleware/errorHandler';
import { HomepageContentService } from '../../services/homepageContentService';
import { Player } from '../../models/Player';
import { User } from '../../models/User';

const userId = '507f1f77bcf86cd799439011';
let administratorDesignation = false;

const localized = (de: string, en = '', zh = '') => ({ de, en, zh });
const content = {
  mainMessage: localized('Willkommen', 'Welcome', '欢迎'),
  visitUsIntroduction: localized('Besucht uns'),
  contactIntroduction: localized('Kontakt'),
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/content', contentRoutes);
  app.use(errorHandler);
  return app;
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
        email: 'homepage@example.test',
        firstName: 'Homepage',
        lastName: 'Editor',
        accountKind: AccountKind.PERSON,
        administratorDesignation,
        membershipStatus: MembershipStatus.ACTIVE,
        accountOnboardingStatus: AccountOnboardingStatus.READY,
      })
    ),
  } as never);
  vi.spyOn(Player, 'findOne').mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    }),
  } as never);
  vi.spyOn(HomepageContentService, 'getPublicContent').mockResolvedValue({
    mainMessage: 'Welcome',
    visitUsIntroduction: '',
    contactIntroduction: '',
  });
  vi.spyOn(
    HomepageContentService,
    'getAdministrationContent'
  ).mockResolvedValue({
    content,
    completeness: {
      mainMessage: { complete: true, missingLanguages: [] },
      visitUsIntroduction: {
        complete: false,
        missingLanguages: [Language.ENGLISH, Language.CHINESE],
      },
      contactIntroduction: {
        complete: false,
        missingLanguages: [Language.ENGLISH, Language.CHINESE],
      },
    },
    updatedAt: null,
  });
  vi.spyOn(HomepageContentService, 'updateContent').mockResolvedValue({
    content,
    completeness: {
      mainMessage: { complete: true, missingLanguages: [] },
      visitUsIntroduction: {
        complete: false,
        missingLanguages: [Language.ENGLISH, Language.CHINESE],
      },
      contactIntroduction: {
        complete: false,
        missingLanguages: [Language.ENGLISH, Language.CHINESE],
      },
    },
    updatedAt: '2026-08-04T12:00:00.000Z',
  });
});

afterEach(() => vi.restoreAllMocks());

describe('homepage content routes', () => {
  it('returns a locale-resolved public projection and validates locale', async () => {
    const app = createApp();
    expect((await request(app).get('/api/content?language=en')).status).toBe(
      200
    );
    expect(HomepageContentService.getPublicContent).toHaveBeenCalledWith(
      Language.ENGLISH
    );
    expect((await request(app).get('/api/content?language=fr')).status).toBe(
      400
    );
  });

  it('requires administration capability for the full projection', async () => {
    const app = createApp();
    expect((await request(app).get('/api/content/admin')).status).toBe(401);
    expect(
      (
        await request(app)
          .get('/api/content/admin')
          .set('Cookie', token())
          .set('Origin', FIRST_PARTY_ORIGIN)
      ).status
    ).toBe(403);

    administratorDesignation = true;
    expect(
      (
        await request(app)
          .get('/api/content/admin')
          .set('Cookie', token())
          .set('Origin', FIRST_PARTY_ORIGIN)
      ).status
    ).toBe(200);
  });

  it('validates and atomically submits the complete administration command', async () => {
    administratorDesignation = true;
    const app = createApp();
    const sessionCookie = token();

    expect(
      (
        await request(app)
          .put('/api/content/admin')
          .set('Cookie', sessionCookie)
          .set('Origin', FIRST_PARTY_ORIGIN)
          .send({
            content: { ...content, mainMessage: localized('', 'Only English') },
          })
      ).status
    ).toBe(400);
    expect(HomepageContentService.updateContent).not.toHaveBeenCalled();

    expect(
      (
        await request(app)
          .put('/api/content/admin')
          .set('Cookie', sessionCookie)
          .set('Origin', FIRST_PARTY_ORIGIN)
          .send({ content })
      ).status
    ).toBe(200);
    expect(HomepageContentService.updateContent).toHaveBeenCalledWith(
      content,
      userId
    );
  });
});
