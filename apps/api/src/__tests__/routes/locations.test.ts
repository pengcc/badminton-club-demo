import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const locationModel = vi.hoisted(() => ({
  find: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  findByIdAndDelete: vi.fn(),
}));

vi.mock('../../models/Location', () => ({ Location: locationModel }));
vi.mock('../../middleware/auth', () => ({
  protect: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => {
    req.user = { id: '507f1f77bcf86cd799439011' } as never;
    next();
  },
  authorizeCapability:
    () =>
    (
      _req: express.Request,
      _res: express.Response,
      next: express.NextFunction
    ) =>
      next(),
}));

import routes from '../../routes/locations';
import { errorHandler } from '../../middleware/errorHandler';

const translations = {
  de: { name: 'Halle', address: 'Adresse' },
  en: { name: 'Hall', address: 'Address' },
  zh: { name: '体育馆', address: '地址' },
};
const timeSlot = {
  weekday: 'friday',
  startTime: '19:00',
  endTime: '21:30',
  active: true,
  guestPlayEnabled: true,
};

const locationDocument = (overrides: Record<string, unknown> = {}) => {
  const document = {
    _id: '507f1f77bcf86cd799439012',
    translations,
    timeSlots: [] as Array<Record<string, unknown>>,
    imageUrl: '',
    isActive: true,
    order: 0,
    createdAt: new Date('2026-08-02T10:00:00Z'),
    updatedAt: new Date('2026-08-02T10:00:00Z'),
    createdBy: { _id: '507f1f77bcf86cd799439011', name: 'Admin' } as unknown,
    updatedBy: { _id: '507f1f77bcf86cd799439011', name: 'Admin' } as unknown,
    save: vi.fn().mockResolvedValue(undefined),
    populate: vi.fn(),
    ...overrides,
  };
  document.populate.mockImplementation(async (field: string) => {
    if (field === 'updatedBy') {
      document.updatedBy = { _id: '507f1f77bcf86cd799439011', name: 'Admin' };
    }
  });
  return document;
};

const app = () => {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/locations', routes);
  instance.use(errorHandler);
  return instance;
};

beforeEach(() => {
  vi.clearAllMocks();
  locationModel.create.mockImplementation(async (input) =>
    locationDocument(input)
  );
});

describe('Location routes', () => {
  it('creates canonical slots with server-generated ids and rejects client-selected ids', async () => {
    const response = await request(app())
      .post('/api/locations')
      .send({ translations, timeSlots: [timeSlot] })
      .expect(201);

    expect(response.body.data.timeSlots[0]).toMatchObject(timeSlot);
    expect(response.body.data.timeSlots[0].id).toMatch(/^[0-9a-f-]{36}$/);

    await request(app())
      .post('/api/locations')
      .send({
        translations,
        timeSlots: [
          { ...timeSlot, id: '0a0a0a0a-0000-4000-8000-000000000001' },
        ],
      })
      .expect(400);
  });

  it('defaults omitted Guest Play availability to unrestricted and preserves explicit restrictions', async () => {
    const { guestPlayEnabled: _ignored, ...slotWithoutGuestPlaySetting } =
      timeSlot;

    const unrestrictedResponse = await request(app())
      .post('/api/locations')
      .send({
        translations,
        timeSlots: [slotWithoutGuestPlaySetting],
      })
      .expect(201);

    expect(unrestrictedResponse.body.data.timeSlots[0].guestPlayEnabled).toBe(
      true
    );

    const restrictedResponse = await request(app())
      .post('/api/locations')
      .send({
        translations,
        timeSlots: [
          {
            ...timeSlot,
            guestPlayEnabled: false,
          },
        ],
      })
      .expect(201);

    expect(restrictedResponse.body.data.timeSlots[0].guestPlayEnabled).toBe(
      false
    );
    expect(unrestrictedResponse.body.data.timeSlots[0]).toMatchObject({
      tasterSessionEnabled: true,
      tasterSessionAcceptedLevels: ['beginner', 'experienced'],
    });
  });

  it('validates Taster Session level policy independently of Guest Play', async () => {
    const response = await request(app())
      .post('/api/locations')
      .send({
        translations,
        timeSlots: [
          {
            ...timeSlot,
            guestPlayEnabled: false,
            tasterSessionEnabled: true,
            tasterSessionAcceptedLevels: ['experienced'],
          },
        ],
      })
      .expect(201);
    expect(response.body.data.timeSlots[0]).toMatchObject({
      guestPlayEnabled: false,
      tasterSessionEnabled: true,
      tasterSessionAcceptedLevels: ['experienced'],
    });
    await request(app())
      .post('/api/locations')
      .send({
        translations,
        timeSlots: [
          {
            ...timeSlot,
            tasterSessionEnabled: true,
            tasterSessionAcceptedLevels: [],
          },
        ],
      })
      .expect(400);
  });

  it('preserves existing ids during ordinary updates and generates ids for new slots', async () => {
    const existingId = '0a0a0a0a-0000-4000-8000-000000000001';
    const document = locationDocument({
      timeSlots: [{ ...timeSlot, id: existingId }],
    });
    locationModel.findById.mockResolvedValue(document);

    await request(app())
      .put('/api/locations/507f1f77bcf86cd799439012')
      .send({
        timeSlots: [
          { ...timeSlot, id: existingId, endTime: '22:00' },
          { ...timeSlot, weekday: 'sunday' },
        ],
      })
      .expect(200);

    expect(document.timeSlots[0]).toMatchObject({
      id: existingId,
      endTime: '22:00',
    });
    expect(document.timeSlots[1].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(document.save).toHaveBeenCalledOnce();
  });

  it('excludes inactive locations and slots from the normal public projection', async () => {
    const active = { ...timeSlot, id: 'active' };
    const guestPlayRestricted = {
      ...timeSlot,
      id: 'guest-play-restricted',
      guestPlayEnabled: false,
    };
    const inactive = { ...timeSlot, id: 'inactive', active: false };
    const chain = {
      sort: vi.fn(),
      populate: vi.fn(),
    };
    chain.sort.mockReturnValue(chain);
    chain.populate.mockReturnValueOnce(chain).mockResolvedValueOnce([
      locationDocument({
        timeSlots: [active, guestPlayRestricted, inactive],
      }),
    ]);
    locationModel.find.mockReturnValue(chain);

    const response = await request(app()).get('/api/locations').expect(200);

    expect(locationModel.find).toHaveBeenCalledWith({ isActive: true });
    expect(response.body.data[0].timeSlots).toEqual([
      active,
      guestPlayRestricted,
    ]);
  });
});
