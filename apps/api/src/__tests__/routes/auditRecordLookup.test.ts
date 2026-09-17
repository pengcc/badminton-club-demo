import express from 'express';
import request from 'supertest';
import { Types } from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccountOnboardingStatus,
  AuditEventType,
  EntityType,
  MembershipStatus,
  AccountKind,
} from '@club/shared-types/core/enums';
import auditRoutes from '../../routes/audit';
import { errorHandler } from '../../middleware/errorHandler';
import { AuditLog } from '../../models/AuditLog';
import { Player } from '../../models/Player';
import { User } from '../../models/User';
import {
  canonicalAuthUserDocument,
  mockAuthSessionCookie,
} from '../helpers/authSession';

const adminId = '507f1f77bcf86cd799439011';
const recordId = '507f1f77bcf86cd799439012';
const entityId = '507f1f77bcf86cd799439013';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/audit', auditRoutes);
  app.use(errorHandler);
  return app;
}

function record() {
  return {
    _id: new Types.ObjectId(recordId),
    eventType: AuditEventType.USER_UPDATED,
    entityType: EntityType.USER,
    entityId: new Types.ObjectId(entityId),
    actorId: new Types.ObjectId(adminId),
    actorEmail: 'legacy-admin@example.test',
    actorAccountKind: AccountKind.PERSON,
    source: 'human',
    ipAddress: '192.0.2.10',
    userAgent: 'legacy-agent',
    metadata: { raw: 'legacy detail' },
    createdAt: new Date('2026-08-09T08:00:00.000Z'),
  };
}

function mockCurrentUser(administratorDesignation = true) {
  vi.spyOn(User, 'findById').mockReturnValue({
    select: vi.fn().mockResolvedValue(
      canonicalAuthUserDocument({
        _id: adminId,
        id: adminId,
        email: 'admin@example.test',
        firstName: 'Test',
        lastName: 'Admin',
        accountKind: AccountKind.PERSON,
        administratorDesignation,
        membershipStatus: MembershipStatus.ACTIVE,
        accountOnboardingStatus: AccountOnboardingStatus.READY,
        authSessionGeneration: 0,
      })
    ),
  } as never);
  vi.spyOn(Player, 'findOne').mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    }),
  } as never);
  vi.spyOn(User, 'find').mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          _id: new Types.ObjectId(adminId),
          firstName: 'Test',
          lastName: 'Admin',
        },
      ]),
    }),
  } as never);
}

async function get(path: string) {
  return request(createApp())
    .get(path)
    .set('Cookie', mockAuthSessionCookie(adminId));
}

describe('Audit current-store record lookup', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCurrentUser();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retrieves the exact Audit document ID instead of treating it as an entity ID', async () => {
    const lean = vi.fn().mockResolvedValue(record());
    const findById = vi
      .spyOn(AuditLog, 'findById')
      .mockReturnValue({ lean } as never);

    const response = await get(`/api/audit/${recordId}`);

    expect(response.status).toBe(200);
    expect(findById).toHaveBeenCalledWith(recordId);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        id: recordId,
        entityId,
        actorDisplayName: 'Admin, Test',
      })
    );
    expect(response.body.data).not.toHaveProperty('actorEmail');
    expect(response.body.data).not.toHaveProperty('ipAddress');
    expect(response.body.data).not.toHaveProperty('userAgent');
    expect(response.body.data).not.toHaveProperty('metadata');
    expect(recordId).not.toBe(entityId);
  });

  it('does not retrieve a record merely because the route value is an entity ID', async () => {
    vi.spyOn(AuditLog, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    } as never);

    const response = await get(`/api/audit/${entityId}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: 'Audit log not found',
    });
  });

  it('returns the bounded invalid-ID response for a malformed identifier', async () => {
    const castError = Object.assign(new Error('raw cast detail'), {
      name: 'CastError',
    });
    vi.spyOn(AuditLog, 'findById').mockReturnValue({
      lean: vi.fn().mockRejectedValue(castError),
    } as never);

    const response = await get('/api/audit/not-an-object-id');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: 'Invalid ID format',
    });
    expect(JSON.stringify(response.body)).not.toContain('raw cast detail');
  });

  it('preserves the separate current-scope entity-history query', async () => {
    const lean = vi.fn().mockResolvedValue([record()]);
    const limit = vi.fn().mockReturnValue({ lean });
    const sort = vi.fn().mockReturnValue({ limit });
    const find = vi.spyOn(AuditLog, 'find').mockReturnValue({ sort } as never);

    const response = await get(
      `/api/audit/entity/${EntityType.USER}/${entityId}`
    );

    expect(response.status).toBe(200);
    expect(find).toHaveBeenCalledWith({
      entityType: EntityType.USER,
      entityId: new Types.ObjectId(entityId),
    });
    expect(response.body.data[0]).toEqual(
      expect.objectContaining({ id: recordId, entityId })
    );
  });

  it('keeps Audit reads administrator-only', async () => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCurrentUser(false);
    const findById = vi.spyOn(AuditLog, 'findById');

    const response = await get(`/api/audit/${recordId}`);

    expect(response.status).toBe(403);
    expect(findById).not.toHaveBeenCalled();
  });
});
