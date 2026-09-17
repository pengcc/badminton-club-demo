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

const contactModel = vi.hoisted(() => ({
  find: vi.fn(),
  findById: vi.fn(),
}));
const contactOwner = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../models/ContactEntry', () => ({ ContactEntry: contactModel }));
vi.mock('../../services/contactEntryService', () => ({
  contactEntryService: contactOwner,
}));

import contactRoutes from '../../routes/contactEntries';
import { errorHandler } from '../../middleware/errorHandler';
import { Player } from '../../models/Player';
import { User } from '../../models/User';

const userId = '507f1f77bcf86cd799439011';
let administratorDesignation = true;
const values = {
  category: 'General inquiries',
  title: { de: 'Kontakt', en: '', zh: '联系' },
  description: { de: 'Schreib uns.', en: '', zh: '请联系我们。' },
  email: 'info@example.test',
  retainedQrCode: '',
  qrExplanation: { de: 'QR', en: '', zh: '' },
  externalLink: '',
  externalLinkLabel: { de: '', en: '', zh: '' },
  isActive: true,
  order: 1,
};
const entry = {
  _id: '507f1f77bcf86cd799439021',
  ...values,
  qrCode: '',
  qrCodeOriginalFilename: '',
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: { _id: userId, name: 'Administrator' },
  updatedBy: { _id: userId, name: 'Administrator' },
  populate: vi.fn().mockResolvedValue(undefined),
};
const validPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9C4+gAAAAASUVORK5CYII=',
  'base64'
);

function app() {
  const instance = express();
  instance.use('/api/contact-entries', contactRoutes);
  instance.use(errorHandler);
  return instance;
}

function authorization() {
  return mockAuthSessionCookie(userId);
}

function publicList(items: unknown[]) {
  return { sort: vi.fn().mockResolvedValue(items) };
}

function adminList(items: unknown[]) {
  const query = { sort: vi.fn(), populate: vi.fn() };
  query.sort.mockReturnValue(query);
  query.populate.mockReturnValueOnce(query).mockResolvedValueOnce(items);
  return query;
}

beforeEach(() => {
  administratorDesignation = true;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(User, 'findById').mockReturnValue({
    select: vi.fn().mockImplementation(async () =>
      canonicalAuthUserDocument({
        _id: userId,
        id: userId,
        email: 'contact-admin@example.test',
        firstName: 'Contact',
        lastName: 'Admin',
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
  contactOwner.create.mockResolvedValue(entry);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Contact entry routes', () => {
  it('returns only the active ordered public projection with German fallback', async () => {
    contactModel.find.mockReturnValue(publicList([entry]));
    const response = await request(app()).get(
      '/api/contact-entries?language=en'
    );

    expect(response.status).toBe(200);
    expect(contactModel.find).toHaveBeenCalledWith({ isActive: true });
    expect(contactModel.find.mock.results[0]?.value.sort).toHaveBeenCalledWith({
      order: 1,
      createdAt: 1,
    });
    expect(response.body.data).toEqual([
      expect.objectContaining({
        id: entry._id,
        title: 'Kontakt',
        description: 'Schreib uns.',
        email: values.email,
      }),
    ]);
    expect(response.body.data[0]).not.toHaveProperty('qrCodeOriginalFilename');
    expect(
      (await request(app()).get('/api/contact-entries?language=fr')).status
    ).toBe(400);
  });

  it('omits an unsafe retained external link from the public projection', async () => {
    contactModel.find.mockReturnValue(
      publicList([
        {
          ...entry,
          externalLink: 'javascript:alert(1)',
          externalLinkLabel: { de: 'Unsicher', en: '', zh: '' },
        },
      ])
    );

    const response = await request(app()).get('/api/contact-entries');

    expect(response.status).toBe(200);
    expect(response.body.data[0].externalLink).toBe('');
    expect(console.warn).toHaveBeenCalledWith(
      '[contact-public-external-link-omitted]',
      { contactEntryId: entry._id }
    );
    expect(
      JSON.stringify((console.warn as ReturnType<typeof vi.fn>).mock.calls)
    ).not.toContain('javascript:');
  });

  it('protects the complete administration projection', async () => {
    contactModel.find.mockReturnValue(adminList([entry]));
    expect(
      (await request(app()).get('/api/contact-entries/admin')).status
    ).toBe(401);
    administratorDesignation = false;
    expect(
      (
        await request(app())
          .get('/api/contact-entries/admin')
          .set('Cookie', authorization())
          .set('Origin', FIRST_PARTY_ORIGIN)
      ).status
    ).toBe(403);
  });

  it('exposes the retained original QR filename only in the protected administration projection', async () => {
    contactModel.find.mockReturnValue(
      adminList([
        { ...entry, qrCodeOriginalFilename: 'club-wechat.png' },
        {
          ...entry,
          _id: '507f1f77bcf86cd799439022',
          qrCodeOriginalFilename: undefined,
        },
      ])
    );

    const response = await request(app())
      .get('/api/contact-entries/admin')
      .set('Cookie', authorization())
      .set('Origin', FIRST_PARTY_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.body.data[0].qrCodeOriginalFilename).toBe(
      'club-wechat.png'
    );
    expect(response.body.data[1].qrCodeOriginalFilename).toBe('');
  });

  it('validates one multipart administration command before its owner', async () => {
    const response = await request(app())
      .post('/api/contact-entries')
      .set('Cookie', authorization())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .field('payload', JSON.stringify({ contact: values }));

    expect(response.status).toBe(201);
    expect(contactOwner.create).toHaveBeenCalledWith(values, undefined, userId);
  });

  it('returns bounded QR type and size errors before reaching the Contact owner', async () => {
    const invalidType = await request(app())
      .post('/api/contact-entries')
      .set('Cookie', authorization())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .field('payload', JSON.stringify({ contact: values }))
      .attach('qrCode', Buffer.from('not-an-image'), {
        filename: 'qr.gif',
        contentType: 'image/gif',
      });

    expect(invalidType.status).toBe(400);
    expect(invalidType.body).toMatchObject({
      code: 'INVALID_CONTACT_QR_TYPE',
      error: 'Only PNG and JPEG Contact QR images are allowed',
    });

    const oversized = await request(app())
      .post('/api/contact-entries')
      .set('Cookie', authorization())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .field('payload', JSON.stringify({ contact: values }))
      .attach('qrCode', Buffer.alloc(2 * 1024 * 1024 + 1), {
        filename: 'qr.png',
        contentType: 'image/png',
      });

    expect(oversized.status).toBe(400);
    expect(oversized.body).toMatchObject({
      code: 'INVALID_CONTACT_QR_SIZE',
      error: 'A Contact QR image must be no larger than 2 MB',
    });
    expect(contactOwner.create).not.toHaveBeenCalled();
  });

  it('accepts a valid PNG with an undetermined browser MIME type', async () => {
    const response = await request(app())
      .post('/api/contact-entries')
      .set('Cookie', authorization())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .field('payload', JSON.stringify({ contact: values }))
      .attach('qrCode', validPng, {
        filename: 'wechat-yu',
        contentType: 'application/octet-stream',
      });

    expect(response.status).toBe(201);
    expect(contactOwner.create).toHaveBeenCalledWith(
      values,
      expect.objectContaining({
        buffer: validPng,
        mimetype: 'application/octet-stream',
        originalname: 'wechat-yu',
      }),
      userId
    );
  });
});
