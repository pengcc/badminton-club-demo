import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MembershipTerminationSource,
  MembershipTerminationStatus,
  AccountKind,
  Capability,
} from '@club/shared-types/core/enums';

const mocks = vi.hoisted(() => ({
  requestOnline: vi.fn(),
  getRelevantForUser: vi.fn(),
  listOpen: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  recordOffline: vi.fn(),
  recordBatch: vi.fn(),
  authorizeCapability: vi.fn(),
}));

vi.mock('../../middleware/auth', () => ({
  protect: (req: any, _res: any, next: any) => {
    req.user = {
      id: '507f1f77bcf86cd799439011',
      email: 'member@example.test',
      accountKind: AccountKind.PERSON,
      displayName: 'Member',
      capabilities: req.get('x-test-capabilities')?.split(',') ?? [
        'membership_self_service',
        'administration',
      ],
    };
    next();
  },
  authorizeCapability: (capability: string) => {
    mocks.authorizeCapability(capability);
    return (req: any, _res: any, next: any) => {
      if (!req.user.capabilities.includes(capability)) {
        const error: any = new Error('Forbidden');
        error.statusCode = 403;
        next(error);
        return;
      }
      next();
    };
  },
}));
vi.mock('../../services/membershipTerminationService', () => ({
  MembershipTerminationService: mocks,
}));

import routes from '../../routes/membershipTerminations';

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/membership-terminations', routes);
  instance.use((error: any, _req: any, res: any, _next: any) =>
    res.status(error.statusCode ?? 500).json({ error: error.message })
  );
  return instance;
}

function sensitiveTermination(
  status = MembershipTerminationStatus.PENDING_REVIEW
) {
  return {
    id: 'termination-1',
    userId: '507f1f77bcf86cd799439011',
    memberName: 'Test Member',
    memberEmail: 'member@example.test',
    status,
    source: MembershipTerminationSource.ONLINE,
    requestedAt: '2026-07-16T10:00:00.000Z',
    requestedBy: {
      id: '507f1f77bcf86cd799439011',
      email: 'member@example.test',
      accountKind: AccountKind.PERSON,
      displayName: 'Test Member',
    },
    requestedEffectiveDate: '2026-09-30',
    requestNote: 'Private request note',
    createdAt: '2026-07-16T10:00:00.000Z',
    updatedAt: '2026-07-16T10:00:00.000Z',
  };
}

describe('membership termination route contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const mock of Object.values(mocks)) mock.mockResolvedValue(null);
  });

  it('requires an Idempotency-Key for online requests', async () => {
    const response = await request(app())
      .post('/api/membership-terminations/requests')
      .send({ effectiveDate: '2026-09-30' });
    expect(response.status).toBe(400);
    expect(mocks.requestOnline).not.toHaveBeenCalled();
  });

  it('keeps self-service and rejection on their distinct capabilities', async () => {
    const selfServiceDenied = await request(app())
      .get('/api/membership-terminations/me')
      .set('x-test-capabilities', Capability.ADMINISTRATION);
    expect(selfServiceDenied.status).toBe(403);

    const rejectionDenied = await request(app())
      .post('/api/membership-terminations/507f1f77bcf86cd799439099/rejection')
      .set('x-test-capabilities', Capability.MEMBERSHIP_SELF_SERVICE)
      .set('Idempotency-Key', 'route-rejection-key')
      .send({ reason: 'Not approved' });
    expect(rejectionDenied.status).toBe(403);
    expect(mocks.reject).not.toHaveBeenCalled();
  });

  it('passes validated online intent and retained key to the service', async () => {
    mocks.requestOnline.mockResolvedValue(sensitiveTermination());
    const response = await request(app())
      .post('/api/membership-terminations/requests')
      .set('Idempotency-Key', 'route-request-key')
      .send({ effectiveDate: '2026-09-30', note: 'Moving' });
    expect(response.status).toBe(201);
    expect(mocks.requestOnline).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '507f1f77bcf86cd799439011',
        effectiveDate: '2026-09-30',
        note: 'Moving',
        idempotencyKey: 'route-request-key',
      })
    );
    expect(response.body.data).toEqual({
      status: MembershipTerminationStatus.PENDING_REVIEW,
      endDate: '2026-09-30',
    });
  });

  it('rejects stale continuation intent for member self-service requests', async () => {
    const response = await request(app())
      .post('/api/membership-terminations/requests')
      .set('Idempotency-Key', 'route-request-key')
      .send({
        effectiveDate: '2026-09-30',
        continueAsExternalPlayer: true,
      });

    expect(response.status).toBe(400);
    expect(mocks.requestOnline).not.toHaveBeenCalled();
  });

  it('projects replayed approved online results to the member-safe shape', async () => {
    mocks.requestOnline.mockResolvedValue({
      ...sensitiveTermination(MembershipTerminationStatus.APPROVED),
      approvedAt: '2026-07-17T10:00:00.000Z',
      approvedBy: {
        id: '507f1f77bcf86cd799439099',
        email: 'admin@example.test',
        accountKind: AccountKind.PERSON,
        displayName: 'Administrator',
      },
      confirmedEffectiveDate: '2026-12-31',
      approvalNote: 'Private approval note',
    });

    const response = await request(app())
      .post('/api/membership-terminations/requests')
      .set('Idempotency-Key', 'route-replay-key')
      .send({ effectiveDate: '2026-09-30', note: 'Moving' });

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({
      status: MembershipTerminationStatus.APPROVED,
      endDate: '2026-12-31',
    });
  });

  it('projects administrator-recorded readback to the member-safe shape', async () => {
    mocks.getRelevantForUser.mockResolvedValue({
      ...sensitiveTermination(MembershipTerminationStatus.APPROVED),
      source: MembershipTerminationSource.EMAIL,
      requestedBy: {
        id: '507f1f77bcf86cd799439099',
        email: 'admin@example.test',
        accountKind: AccountKind.PERSON,
        displayName: 'Administrator',
      },
      approvedAt: '2026-07-17T10:00:00.000Z',
      approvedBy: {
        id: '507f1f77bcf86cd799439099',
        email: 'admin@example.test',
        accountKind: AccountKind.PERSON,
        displayName: 'Administrator',
      },
      confirmedEffectiveDate: '2026-12-31',
      approvalNote: 'Private approval note',
    });

    const response = await request(app()).get(
      '/api/membership-terminations/me'
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      status: MembershipTerminationStatus.APPROVED,
      endDate: '2026-12-31',
    });
  });

  it('preserves null member readback', async () => {
    const response = await request(app()).get(
      '/api/membership-terminations/me'
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toBeNull();
  });

  it('rejects non-offline sources at the administrator-recorded boundary', async () => {
    const response = await request(app())
      .post('/api/membership-terminations/admin-recorded')
      .set('Idempotency-Key', 'route-record-key')
      .send({
        userId: '507f1f77bcf86cd799439012',
        source: MembershipTerminationSource.ONLINE,
        requestReceivedAt: '2026-07-01T00:00:00.000Z',
        effectiveTiming: 'scheduled',
        effectiveDate: '2026-09-30',
      });
    expect(response.status).toBe(400);
    expect(mocks.recordOffline).not.toHaveBeenCalled();
  });

  it('rejects stale continuation intent at approval', async () => {
    const response = await request(app())
      .post('/api/membership-terminations/termination-1/approval')
      .set('Idempotency-Key', 'route-approval-key')
      .send({
        effectiveTiming: 'scheduled',
        effectiveDate: '2026-09-30',
        continueAsExternalPlayer: true,
      });
    expect(response.status).toBe(400);
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it('rejects a client-selected date at scheduled approval', async () => {
    const response = await request(app())
      .post('/api/membership-terminations/507f1f77bcf86cd799439099/approval')
      .set('Idempotency-Key', 'route-approval-key')
      .send({
        effectiveTiming: 'scheduled',
        effectiveDate: '2026-12-31',
      });
    expect(response.status).toBe(400);
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it('requires an idempotency key and reason for rejection', async () => {
    const missingKey = await request(app())
      .post('/api/membership-terminations/507f1f77bcf86cd799439099/rejection')
      .send({ reason: 'Not approved' });
    expect(missingKey.status).toBe(400);
    expect(mocks.reject).not.toHaveBeenCalled();

    const missingReason = await request(app())
      .post('/api/membership-terminations/507f1f77bcf86cd799439099/rejection')
      .set('Idempotency-Key', 'route-rejection-key')
      .send({ reason: '   ' });
    expect(missingReason.status).toBe(400);
    expect(mocks.reject).not.toHaveBeenCalled();
  });

  it('passes a validated rejection intent to the service', async () => {
    mocks.reject.mockResolvedValue(
      sensitiveTermination(MembershipTerminationStatus.REJECTED)
    );
    const response = await request(app())
      .post('/api/membership-terminations/507f1f77bcf86cd799439099/rejection')
      .set('Idempotency-Key', 'route-rejection-key')
      .send({ reason: 'Not approved' });
    expect(response.status).toBe(200);
    expect(mocks.reject).toHaveBeenCalledWith(
      expect.objectContaining({
        terminationId: '507f1f77bcf86cd799439099',
        reason: 'Not approved',
        idempotencyKey: 'route-rejection-key',
      })
    );
  });

  it('rejects stale continuation intent for administrator-recorded requests', async () => {
    const response = await request(app())
      .post('/api/membership-terminations/admin-recorded')
      .set('Idempotency-Key', 'route-record-key')
      .send({
        userId: '507f1f77bcf86cd799439012',
        source: MembershipTerminationSource.EMAIL,
        requestReceivedAt: '2026-07-01T00:00:00.000Z',
        effectiveTiming: 'scheduled',
        effectiveDate: '2026-09-30',
        continueAsExternalPlayer: false,
      });
    expect(response.status).toBe(400);
    expect(mocks.recordOffline).not.toHaveBeenCalled();
  });

  it('accepts administrator Today timing without a client date', async () => {
    mocks.recordOffline.mockResolvedValue(
      sensitiveTermination(MembershipTerminationStatus.EFFECTIVE)
    );
    const response = await request(app())
      .post('/api/membership-terminations/admin-recorded')
      .set('Idempotency-Key', 'route-today-key')
      .send({
        userId: '507f1f77bcf86cd799439012',
        source: MembershipTerminationSource.EMAIL,
        requestReceivedAt: '2026-07-01T00:00:00.000Z',
        effectiveTiming: 'today',
        note: 'Exceptional immediate exit',
      });

    expect(response.status).toBe(201);
    expect(mocks.recordOffline).toHaveBeenCalledWith(
      expect.objectContaining({
        effectiveTiming: 'today',
        effectiveDate: undefined,
        note: 'Exceptional immediate exit',
      })
    );
  });

  it('rejects administrator Today timing without a reason', async () => {
    const response = await request(app())
      .post('/api/membership-terminations/admin-recorded')
      .set('Idempotency-Key', 'route-today-key')
      .send({
        userId: '507f1f77bcf86cd799439012',
        source: MembershipTerminationSource.EMAIL,
        requestReceivedAt: '2026-07-01T00:00:00.000Z',
        effectiveTiming: 'today',
        note: '   ',
      });

    expect(response.status).toBe(400);
    expect(mocks.recordOffline).not.toHaveBeenCalled();
  });

  it('uses the validated query channel for administrator work queues', async () => {
    const administratorTermination = {
      ...sensitiveTermination(MembershipTerminationStatus.APPROVED),
      lastProcessingFailure: {
        code: 'CONFLICT',
        message: 'Current Membership state needs administrator review.',
        failedAt: '2026-09-30T02:15:00.000Z',
      },
    };
    mocks.listOpen.mockResolvedValue([administratorTermination]);
    const response = await request(app()).get(
      '/api/membership-terminations?status=approved'
    );
    expect(response.status).toBe(200);
    expect(mocks.listOpen).toHaveBeenCalledWith('approved');
    expect(response.body.data.items).toEqual([administratorTermination]);
  });
});
