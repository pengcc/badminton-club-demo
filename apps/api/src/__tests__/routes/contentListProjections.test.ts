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
  MembershipStatus,
  AccountKind,
} from '@club/shared-types/core/enums';

const activityModel = vi.hoisted(() => ({
  find: vi.fn(),
  countDocuments: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  findByIdAndDelete: vi.fn(),
}));
const activityOwner = vi.hoisted(() => ({
  getAvailability: vi.fn(),
}));
const announcementModel = vi.hoisted(() => ({
  find: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  findByIdAndDelete: vi.fn(),
}));
const locationModel = vi.hoisted(() => ({
  find: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  findByIdAndDelete: vi.fn(),
}));

vi.mock('../../models/Activity', () => ({ Activity: activityModel }));
vi.mock('../../services/activityService', () => ({
  activityService: activityOwner,
}));
vi.mock('../../models/Announcement', () => ({
  Announcement: announcementModel,
}));
vi.mock('../../models/Location', () => ({ Location: locationModel }));

import activityRoutes from '../../routes/activities';
import announcementRoutes from '../../routes/announcements';
import locationRoutes from '../../routes/locations';
import { errorHandler } from '../../middleware/errorHandler';
import { Player } from '../../models/Player';
import { User } from '../../models/User';

const userId = '507f1f77bcf86cd799439011';
let administratorDesignation = false;

const translations = {
  de: { name: 'Deutsch', description: 'Beschreibung', address: 'Adresse' },
  en: { name: 'English', description: 'Description', address: 'Address' },
  zh: { name: '中文', description: '说明', address: '地址' },
};
const activityTranslations = {
  de: { name: 'Deutsch', description: 'Beschreibung' },
  en: { name: '', description: '' },
  zh: { name: '中文', description: '说明' },
};
const announcementTranslations = {
  de: { title: 'Deutsch', content: 'Inhalt' },
  en: { title: '', content: '' },
  zh: { title: '中文', content: '内容' },
};
const updatedBy = {
  _id: userId,
  firstName: 'Projection',
  lastName: 'Administrator',
};

const visibleActivity = {
  _id: '507f1f77bcf86cd799439021',
  translations: activityTranslations,
  images: [],
  videoLink: '',
  videoDescription: { de: '', en: '', zh: '' },
  isVisible: true,
  order: 1,
  createdAt: new Date('2026-08-04T10:00:00Z'),
  updatedAt: new Date('2026-08-04T10:00:00Z'),
  updatedBy,
};
const hiddenActivity = {
  ...visibleActivity,
  _id: '507f1f77bcf86cd799439022',
  isVisible: false,
};
const activeAnnouncement = {
  _id: '507f1f77bcf86cd799439031',
  translations: announcementTranslations,
  type: 'info',
  displayDate: '2026.08.04',
  externalLink: 'https://example.test/update',
  isActive: true,
  order: 1,
  createdAt: new Date('2026-08-04T10:00:00Z'),
  updatedAt: new Date('2026-08-04T10:00:00Z'),
  updatedBy,
};
const inactiveAnnouncement = {
  ...activeAnnouncement,
  _id: '507f1f77bcf86cd799439032',
  isActive: false,
};
const activeSlot = {
  id: 'active-slot',
  weekday: 'friday',
  startTime: '19:00',
  endTime: '21:00',
  active: true,
  guestPlayEnabled: true,
  tasterSessionEnabled: true,
  tasterSessionAcceptedLevels: ['beginner', 'experienced'],
};
const inactiveSlot = { ...activeSlot, id: 'inactive-slot', active: false };
const activeLocation = {
  _id: '507f1f77bcf86cd799439041',
  translations,
  timeSlots: [activeSlot, inactiveSlot],
  imageUrl: '',
  isActive: true,
  order: 1,
  createdAt: new Date('2026-08-04T10:00:00Z'),
  updatedAt: new Date('2026-08-04T10:00:00Z'),
  updatedBy,
};
const inactiveLocation = {
  ...activeLocation,
  _id: '507f1f77bcf86cd799439042',
  isActive: false,
};

function listQuery(items: unknown[]) {
  let populateCalls = 0;
  const query = {
    sort: vi.fn(),
    skip: vi.fn(),
    limit: vi.fn(),
    select: vi.fn(),
    populate: vi.fn(),
  };
  query.sort.mockReturnValue(query);
  query.skip.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.populate.mockImplementation(() => {
    populateCalls += 1;
    return populateCalls === 2 ? Promise.resolve(items) : query;
  });
  return query;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/activities', activityRoutes);
  app.use('/api/announcements', announcementRoutes);
  app.use('/api/locations', locationRoutes);
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
        email: 'projection@example.test',
        firstName: 'Projection',
        lastName: 'Tester',
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

  activityModel.find.mockImplementation((filter) =>
    listQuery(
      filter.isVisible ? [visibleActivity] : [visibleActivity, hiddenActivity]
    )
  );
  activityModel.countDocuments.mockImplementation(async (filter) =>
    filter.isVisible ? 1 : 2
  );
  activityOwner.getAvailability.mockResolvedValue({ enabled: true });
  announcementModel.find.mockImplementation((filter) =>
    listQuery(
      filter.isActive
        ? [activeAnnouncement]
        : [activeAnnouncement, inactiveAnnouncement]
    )
  );
  locationModel.find.mockImplementation((filter) =>
    listQuery(
      filter.isActive ? [activeLocation] : [activeLocation, inactiveLocation]
    )
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('public content list projections', () => {
  it('returns a successful empty result when no Announcements are active', async () => {
    announcementModel.find.mockImplementationOnce(() => listQuery([]));
    const app = createApp();

    const announcements = await request(app).get(
      '/api/announcements?language=en'
    );

    expect(announcements.status).toBe(200);
    expect(announcements.body).toEqual({ success: true, data: [] });
    expect(announcementModel.find).toHaveBeenCalledWith({
      isActive: true,
      demoScratchLeaseId: { $exists: false },
    });
  });

  it('always returns the public visibility projection and active Location slots', async () => {
    const app = createApp();
    const activities = await request(app).get('/api/activities?language=en');
    const announcements = await request(app).get(
      '/api/announcements?language=en'
    );
    const locations = await request(app).get('/api/locations?language=en');

    expect(activities.status).toBe(200);
    expect(activities.body.availability).toEqual({ enabled: true });
    expect(activities.body.data.map((item: { id: string }) => item.id)).toEqual(
      [visibleActivity._id]
    );
    expect(activityModel.find).toHaveBeenCalledWith({ isVisible: true });
    expect(activities.body.data[0]).toMatchObject({
      name: 'Deutsch',
      description: 'Beschreibung',
    });

    expect(announcements.status).toBe(200);
    expect(
      announcements.body.data.map((item: { id: string }) => item.id)
    ).toEqual([activeAnnouncement._id]);
    expect(announcementModel.find).toHaveBeenCalledWith({
      isActive: true,
      demoScratchLeaseId: { $exists: false },
    });
    expect(announcements.body.data[0]).toEqual({
      id: activeAnnouncement._id,
      title: 'Deutsch',
      content: 'Inhalt',
      type: 'info',
      displayDate: '2026.08.04',
      externalLink: 'https://example.test/update',
    });

    expect(locations.status).toBe(200);
    expect(locations.body.data.map((item: { id: string }) => item.id)).toEqual([
      activeLocation._id,
    ]);
    expect(locations.body.data[0].timeSlots).toEqual([activeSlot]);
    expect(locationModel.find).toHaveBeenCalledWith({ isActive: true });
  });

  it('returns an explicit disabled projection without reading Activity records', async () => {
    activityOwner.getAvailability.mockResolvedValueOnce({ enabled: false });
    const activities = await request(createApp()).get(
      '/api/activities?language=en'
    );

    expect(activities.status).toBe(200);
    expect(activities.body).toEqual({
      success: true,
      availability: { enabled: false },
      data: [],
      pagination: { page: 1, limit: 6, total: 0, totalPages: 0 },
    });
    expect(activityModel.countDocuments).not.toHaveBeenCalled();
    expect(activityModel.find).not.toHaveBeenCalled();
  });

  it('validates Announcement create and update payloads before persistence', async () => {
    administratorDesignation = true;
    const app = createApp();
    const sessionCookie = token();
    const base = {
      translations: announcementTranslations,
      type: 'info',
      displayDate: '2026.08.13',
      externalLink: '',
      isActive: true,
      order: 0,
    };

    const create = await request(app)
      .post('/api/announcements')
      .set('Cookie', sessionCookie)
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({
        ...base,
        translations: {
          ...announcementTranslations,
          de: { title: '', content: 'Inhalt' },
        },
      });
    const update = await request(app)
      .put(`/api/announcements/${activeAnnouncement._id}`)
      .set('Cookie', sessionCookie)
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({ ...base, externalLink: 'ftp://example.test/update' });

    expect(create.status).toBe(400);
    expect(create.body.error).toContain(
      'German announcement title is required'
    );
    expect(update.status).toBe(400);
    expect(announcementModel.create).not.toHaveBeenCalled();
    expect(announcementModel.findById).not.toHaveBeenCalled();
  });

  it('rejects attempts to select an administrative projection publicly', async () => {
    const app = createApp();

    expect(
      (await request(app).get('/api/activities?visibleOnly=false')).status
    ).toBe(400);
    expect(
      (await request(app).get('/api/announcements?activeOnly=false')).status
    ).toBe(400);
    expect(
      (await request(app).get('/api/locations?activeOnly=false')).status
    ).toBe(400);
  });

  it('allows a current administrator to list all states through protected endpoints', async () => {
    administratorDesignation = true;
    const app = createApp();
    const sessionCookie = token();

    const activities = await request(app)
      .get('/api/activities/admin?language=en')
      .set('Cookie', sessionCookie);
    const announcements = await request(app)
      .get('/api/announcements/admin?language=en')
      .set('Cookie', sessionCookie);
    const locations = await request(app)
      .get('/api/locations/admin?language=en')
      .set('Cookie', sessionCookie);

    expect(activities.status).toBe(200);
    expect(activities.body.data).toHaveLength(2);
    expect(activityModel.find).toHaveBeenCalledWith({});
    expect(announcements.status).toBe(200);
    expect(announcements.body.data).toHaveLength(2);
    expect(announcementModel.find).toHaveBeenCalledWith({
      demoScratchLeaseId: { $exists: false },
    });
    expect(announcements.body.data[0].updatedBy).toEqual({
      id: userId,
      name: 'Projection Administrator',
    });
    expect(locations.status).toBe(200);
    expect(locations.body.data).toHaveLength(2);
    expect(locations.body.data[0].timeSlots).toEqual([
      activeSlot,
      inactiveSlot,
    ]);
    expect(locationModel.find).toHaveBeenCalledWith({});
  });

  it('denies administration projections to an authenticated non-admin', async () => {
    const app = createApp();
    const sessionCookie = token();

    expect(
      (
        await request(app)
          .get('/api/activities/admin')
          .set('Cookie', sessionCookie)
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .get('/api/announcements/admin')
          .set('Cookie', sessionCookie)
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .get('/api/locations/admin')
          .set('Cookie', sessionCookie)
      ).status
    ).toBe(403);
  });
});
