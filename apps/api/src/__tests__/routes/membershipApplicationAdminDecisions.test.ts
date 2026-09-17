import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountKind, Capability } from '@club/shared-types/core/enums';

const authState = vi.hoisted(() => ({ allowed: true }));
vi.mock('../../middleware/auth', () => ({
  protect: (req: any, res: any, next: any) => {
    if (!authState.allowed)
      return res.status(401).json({ error: 'Unauthorized' });
    req.user = {
      id: '507f1f77bcf86cd799439011',
      email: 'admin@example.test',
      accountKind: AccountKind.PERSON,
      displayName: 'Administrator',
      capabilities: ['administration'],
    };
    next();
  },
  authorizeCapability: () => (_req: any, _res: any, next: any) => next(),
}));

import routes from '../../routes/membershipApplications';
import { MembershipApplicationService } from '../../services/membershipApplicationService';
import { MembershipApplicationApiTransformer } from '../../transformers/membershipApplication';
import { AuditService } from '../../services/auditService';

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/membership', routes);
  instance.use((error: any, _req: any, res: any, _next: any) =>
    res.status(error.statusCode ?? 400).json({ error: error.message })
  );
  return instance;
}

describe('Membership Application administrator decision routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authState.allowed = true;
    vi.spyOn(AuditService, 'writeBestEffort').mockReturnValue();
    vi.spyOn(MembershipApplicationApiTransformer, 'toApi').mockReturnValue({
      id: 'application-1',
    } as never);
  });

  it('removes broad applicant-data PATCH and hard-delete routes while retaining explicit review note', async () => {
    const update = vi
      .spyOn(MembershipApplicationService, 'updateApplication')
      .mockResolvedValue({ id: 'application-1' } as never);
    expect(
      (
        await request(app())
          .patch('/api/membership/applications/application-1')
          .send({ personalInfo: { firstName: 'Changed' } })
      ).status
    ).toBe(404);
    expect(
      (
        await request(app()).delete(
          '/api/membership/applications/application-1'
        )
      ).status
    ).toBe(404);
    const review = await request(app())
      .patch('/api/membership/applications/application-1/review-note')
      .send({ reviewNote: 'Internal only' });
    expect(review.status).toBe(200);
    expect(update).toHaveBeenCalledWith('application-1', {
      reviewNote: 'Internal only',
    });
  });

  it('requires applicant-visible rejection reason and keeps internal notes out of Audit', async () => {
    const reject = vi
      .spyOn(MembershipApplicationService, 'rejectApplication')
      .mockResolvedValue({
        id: 'application-1',
        decisionNotificationStatus: 'sent',
      } as never);
    expect(
      (
        await request(app())
          .post('/api/membership/applications/application-1/reject')
          .send({ reviewNote: 'Only internal' })
      ).status
    ).toBe(400);
    const response = await request(app())
      .post('/api/membership/applications/application-1/reject')
      .send({
        reason: 'Applicant-visible reason',
        reviewNote: 'Internal only',
      });
    expect(response.status).toBe(200);
    expect(reject).toHaveBeenCalledWith(
      'application-1',
      '507f1f77bcf86cd799439011',
      'Applicant-visible reason',
      'Internal only'
    );
    expect(AuditService.writeBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Applicant-visible reason' })
    );
    expect(
      JSON.stringify(vi.mocked(AuditService.writeBestEffort).mock.calls)
    ).not.toContain('Internal only');
  });

  it('keeps all explicit administrator mutations behind authentication', async () => {
    authState.allowed = false;
    const paths = [
      request(app())
        .patch('/api/membership/applications/application-1/review-note')
        .send({ reviewNote: 'x' }),
      request(app())
        .post('/api/membership/applications/application-1/approve')
        .send({}),
      request(app())
        .post('/api/membership/applications/application-1/reject')
        .send({ reason: 'x' }),
      request(app())
        .post('/api/membership/applications/application-1/contact')
        .send({ message: 'x' }),
      request(app()).post(
        '/api/membership/applications/application-1/decision-notification/retry'
      ),
    ];
    expect(
      (await Promise.all(paths)).map((response) => response.status)
    ).toEqual([401, 401, 401, 401, 401]);
  });
});
