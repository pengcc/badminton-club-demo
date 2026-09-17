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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const owner = vi.hoisted(() => ({
  listPublic: vi.fn(),
  listAdministration: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  reorder: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('../../services/publicDocumentService', () => ({
  publicDocumentService: owner,
}));

import routes from '../../routes/publicDocuments';
import { errorHandler } from '../../middleware/errorHandler';
import { Player } from '../../models/Player';
import { User } from '../../models/User';

const userId = '507f1f77bcf86cd799439011';
const documentId = '507f1f77bcf86cd799439021';
let administratorDesignation = true;
const document = {
  _id: documentId,
  id: documentId,
  displayName: { de: 'Satzung', en: '', zh: '章程' },
  documentDate: '2012-06-09',
  fileUrl: '/documents/Satzung.pdf',
  isVisible: true,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/public-documents', routes);
  instance.use(errorHandler);
  return instance;
}

function authorized(requestBuilder: request.Test) {
  return requestBuilder
    .set('Cookie', mockAuthSessionCookie(userId))
    .set('Origin', FIRST_PARTY_ORIGIN);
}

beforeEach(() => {
  administratorDesignation = true;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(User, 'findById').mockReturnValue({
    select: vi.fn().mockImplementation(async () =>
      canonicalAuthUserDocument({
        _id: userId,
        id: userId,
        email: 'documents@example.test',
        firstName: 'Document',
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
  owner.listPublic.mockResolvedValue([document]);
  owner.listAdministration.mockResolvedValue([document]);
  owner.create.mockResolvedValue({ document, mediaCleanupWarning: null });
  owner.update.mockResolvedValue({ document, mediaCleanupWarning: null });
  owner.reorder.mockResolvedValue([document]);
  owner.delete.mockResolvedValue({ deleted: true, mediaCleanupWarning: null });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Public Document routes', () => {
  it('returns the localized ID-addressed public projection and validates locale', async () => {
    const response = await request(app()).get(
      '/api/public-documents?language=en'
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      {
        id: documentId,
        displayName: 'Satzung',
        documentDate: document.documentDate,
        fileUrl: document.fileUrl,
      },
    ]);
    expect(
      (await request(app()).get('/api/public-documents?language=fr')).status
    ).toBe(400);
  });

  it('protects every administration route', async () => {
    const instance = app();
    const attempts = [
      request(instance)
        .get('/api/public-documents/admin')
        .set('Origin', FIRST_PARTY_ORIGIN),
      request(instance)
        .post('/api/public-documents/admin')
        .set('Origin', FIRST_PARTY_ORIGIN),
      request(instance)
        .put('/api/public-documents/admin/order')
        .set('Origin', FIRST_PARTY_ORIGIN)
        .send({ ids: [] }),
      request(instance)
        .put(`/api/public-documents/admin/${documentId}`)
        .set('Origin', FIRST_PARTY_ORIGIN),
      request(instance)
        .delete(`/api/public-documents/admin/${documentId}`)
        .set('Origin', FIRST_PARTY_ORIGIN),
    ];
    for (const attempt of attempts) expect((await attempt).status).toBe(401);

    administratorDesignation = false;
    expect(
      (await authorized(request(app()).get('/api/public-documents/admin')))
        .status
    ).toBe(403);
  });

  it('creates and updates through distinct validated multipart commands', async () => {
    const createValues = {
      displayName: document.displayName,
      documentDate: document.documentDate,
      isVisible: true,
    };
    const createResponse = await authorized(
      request(app())
        .post('/api/public-documents/admin')
        .field('payload', JSON.stringify({ document: createValues }))
        .attach('document', Buffer.from('%PDF-1.7\nmock'), {
          filename: 'document.pdf',
          contentType: 'application/pdf',
        })
    );
    expect(createResponse.status, JSON.stringify(createResponse.body)).toBe(
      201
    );
    expect(owner.create).toHaveBeenCalledWith(
      createValues,
      expect.objectContaining({ mimetype: 'application/pdf' }),
      userId
    );

    const extraPartResponse = await authorized(
      request(app())
        .post('/api/public-documents/admin')
        .field('payload', JSON.stringify({ document: createValues }))
        .attach('document', Buffer.from('%PDF-1.7\nmock'), {
          filename: 'document.pdf',
          contentType: 'application/pdf',
        })
        .field('unexpected', 'third-part')
    );
    expect(extraPartResponse.status).toBe(400);
    expect(extraPartResponse.body).toMatchObject({
      success: false,
      code: 'INVALID_PUBLIC_DOCUMENT_UPLOAD',
    });

    const updateValues = { ...createValues, retainedFile: document.fileUrl };
    const updateResponse = await authorized(
      request(app())
        .put(`/api/public-documents/admin/${documentId}`)
        .field('payload', JSON.stringify({ document: updateValues }))
    );
    expect(updateResponse.status).toBe(200);
    expect(owner.update).toHaveBeenCalledWith(
      documentId,
      updateValues,
      undefined,
      userId
    );
  });

  it('routes complete ordering before ID updates and supports deletion', async () => {
    const orderResponse = await authorized(
      request(app())
        .put('/api/public-documents/admin/order')
        .send({ ids: [documentId] })
    );
    expect(orderResponse.status).toBe(200);
    expect(owner.reorder).toHaveBeenCalledWith([documentId], userId);

    const deleteResponse = await authorized(
      request(app()).delete(`/api/public-documents/admin/${documentId}`)
    );
    expect(deleteResponse.status).toBe(200);
    expect(owner.delete).toHaveBeenCalledWith(documentId);
  });
});
