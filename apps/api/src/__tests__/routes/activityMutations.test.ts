import express from 'express';
import request from 'supertest';
import {
  canonicalAuthUserDocument,
  FIRST_PARTY_ORIGIN,
  mockAuthSessionCookie,
} from '../helpers/authSession';
import {
  AccountOnboardingStatus,
  MembershipStatus,
  AccountKind,
} from '@club/shared-types/core/enums';
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

const activityOwner = vi.hoisted(() => ({
  getAvailability: vi.fn(),
  updateAvailability: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  toggle: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../services/activityService', () => ({
  activityService: activityOwner,
}));

import activityRoutes from '../../routes/activities';
import { errorHandler } from '../../middleware/errorHandler';
import { Player } from '../../models/Player';
import { User } from '../../models/User';

const userId = '507f1f77bcf86cd799439011';
let administratorDesignation = true;

const values = {
  translations: {
    de: { name: 'Sommerfest', description: '' },
    en: { name: '', description: '' },
    zh: { name: '', description: '' },
  },
  retainedImages: [],
  videoLink: '',
  videoDescription: { de: '', en: '', zh: '' },
  isVisible: true,
  order: 0,
};

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/activities', activityRoutes);
  instance.use(errorHandler);
  return instance;
}

function authorization() {
  return mockAuthSessionCookie(userId);
}

beforeEach(() => {
  administratorDesignation = true;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(User, 'findById').mockReturnValue({
    select: vi.fn().mockImplementation(async () =>
      canonicalAuthUserDocument({
        _id: userId,
        id: userId,
        email: 'activity-route@example.test',
        firstName: 'Activity',
        lastName: 'Administrator',
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
  const activity = {
    _id: '507f1f77bcf86cd799439021',
    id: '507f1f77bcf86cd799439021',
    ...values,
    images: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: { _id: userId, name: 'Administrator' },
    updatedBy: { _id: userId, name: 'Administrator' },
    populate: vi.fn().mockResolvedValue(undefined),
  };
  activityOwner.create.mockResolvedValue(activity);
  activityOwner.getAvailability.mockResolvedValue({ enabled: false });
  activityOwner.updateAvailability.mockImplementation(async (enabled) => ({
    enabled,
  }));
  activityOwner.update.mockResolvedValue({
    activity,
    mediaCleanupWarning: null,
  });
  activityOwner.delete.mockResolvedValue({
    deleted: true,
    mediaCleanupWarning: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Activity mutation routes', () => {
  it('exposes public availability and lets only an administrator update it', async () => {
    const publicResponse = await request(app()).get(
      '/api/activities/availability'
    );
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.data).toEqual({ enabled: false });

    const updateResponse = await request(app())
      .put('/api/activities/availability')
      .set('Cookie', authorization())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({ enabled: true });

    expect(updateResponse.status).toBe(200);
    expect(activityOwner.updateAvailability).toHaveBeenCalledWith(true, userId);
    expect(updateResponse.body.data).toEqual({ enabled: true });
  });

  it('rejects invalid or unauthorized availability updates', async () => {
    const invalid = await request(app())
      .put('/api/activities/availability')
      .set('Cookie', authorization())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({ enabled: 'true' });
    expect(invalid.status).toBe(400);

    administratorDesignation = false;
    const forbidden = await request(app())
      .put('/api/activities/availability')
      .set('Cookie', authorization())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({ enabled: true });
    expect(forbidden.status).toBe(403);
    expect(activityOwner.updateAvailability).not.toHaveBeenCalled();
  });

  it('accepts one validated multipart Activity command for an administrator', async () => {
    const response = await request(app())
      .post('/api/activities')
      .set('Cookie', authorization())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .field('payload', JSON.stringify({ activity: values }))
      .attach('images', Buffer.from([0x89, 0x50]), {
        filename: 'activity.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(201);
    expect(activityOwner.create).toHaveBeenCalledWith(
      values,
      [expect.objectContaining({ mimetype: 'image/png' })],
      userId
    );
  });

  it('rejects an invalid localized command before the Activity owner', async () => {
    const response = await request(app())
      .post('/api/activities')
      .set('Cookie', authorization())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .field(
        'payload',
        JSON.stringify({
          activity: {
            ...values,
            translations: {
              ...values.translations,
              de: { name: '', description: '' },
            },
          },
        })
      );

    expect(response.status).toBe(400);
    expect(activityOwner.create).not.toHaveBeenCalled();
  });

  it('keeps the multipart mutation protected by Administration capability', async () => {
    administratorDesignation = false;
    const response = await request(app())
      .post('/api/activities')
      .set('Cookie', authorization())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .field('payload', JSON.stringify({ activity: values }));

    expect(response.status).toBe(403);
    expect(activityOwner.create).not.toHaveBeenCalled();
  });

  it('returns a committed update with an Activity cleanup warning', async () => {
    activityOwner.update.mockImplementationOnce(async () => ({
      activity: await activityOwner.create(),
      mediaCleanupWarning: {
        code: 'ACTIVITY_MEDIA_CLEANUP_FAILED',
        message: 'Activity saved; previous media cleanup failed',
      },
    }));

    const response = await request(app())
      .put('/api/activities/507f1f77bcf86cd799439021')
      .set('Cookie', authorization())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .field('payload', JSON.stringify({ activity: values }));

    expect(response.status).toBe(200);
    expect(activityOwner.update).toHaveBeenCalledTimes(1);
    expect(response.body.data).toMatchObject({
      activity: { id: '507f1f77bcf86cd799439021' },
      mediaCleanupWarning: {
        code: 'ACTIVITY_MEDIA_CLEANUP_FAILED',
      },
    });
  });

  it('returns a committed deletion with an Activity cleanup warning', async () => {
    activityOwner.delete.mockResolvedValueOnce({
      deleted: true,
      mediaCleanupWarning: {
        code: 'ACTIVITY_MEDIA_CLEANUP_FAILED',
        message: 'Activity deleted; media cleanup failed',
      },
    });

    const response = await request(app())
      .delete('/api/activities/507f1f77bcf86cd799439021')
      .set('Cookie', authorization())
      .set('Origin', FIRST_PARTY_ORIGIN);

    expect(response.status).toBe(200);
    expect(activityOwner.delete).toHaveBeenCalledTimes(1);
    expect(response.body.data).toEqual({
      deleted: true,
      mediaCleanupWarning: {
        code: 'ACTIVITY_MEDIA_CLEANUP_FAILED',
        message: 'Activity deleted; media cleanup failed',
      },
    });
  });
});
