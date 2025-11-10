import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import membershipApplicationRoutes from '../../routes/membershipApplications';
import { MembershipApplicationService } from '../../services/membershipApplicationService';

// Bypass auth for these route tests
jest.mock('../../middleware/auth', () => ({
  protect: (_req: any, _res: any, next: any) => next(),
  authorize: () => (_req: any, _res: any, next: any) => next()
}));
import { MemberApplicationStatus } from '@club/shared-types/core/enums';

// Create a lightweight express app mounting only the membership routes
const app = express();
app.use(express.json());
app.use('/api/membership', membershipApplicationRoutes as any);

jest.mock('../../services/membershipApplicationService');
const Service = jest.mocked(MembershipApplicationService);

describe('MembershipApplication routes - date handling (integration-lite)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('POST /api/membership/applications accepts YYYY-MM-DD and returns 201', async () => {
    Service.createApplication.mockResolvedValue({
      id: 'uuid-1',
      personalInfo: {
        firstName: 'Test', lastName: 'User', email: 't@example.com', phone: '+49',
        dateOfBirth: '1990-01-15', gender: 'male',
        address: { street: 'A', city: 'B', postalCode: '12345', country: 'DE' }
      },
      membershipType: 'regular',
      bankingInfo: undefined,
      canParticipate: true,
      motivation: undefined,
      hasConditions: false,
      conditions: undefined,
      status: MemberApplicationStatus.PENDING_REVIEW as any,
      documents: {},
      reviewer: undefined,
      reviewDate: undefined,
      reviewNotes: undefined,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-02T00:00:00Z')
    } as any);

    const res = await request(app)
      .post('/api/membership/applications')
      .send({
        personalInfo: {
          firstName: 'Test', lastName: 'User', email: 't@example.com', phone: '+49',
          dateOfBirth: '1990-01-15', gender: 'male',
          address: { street: 'A', city: 'B', postalCode: '12345', country: 'DE' }
        },
        membershipType: 'regular',
        hasConditions: false,
        canParticipate: true
      });

    expect(res.status).toBe(201);
    expect(res.body?.data?.personalInfo?.dateOfBirth).toBe('1990-01-15');
  });

  it('GET /api/membership/applications/:id returns dateOfBirth as YYYY-MM-DD', async () => {
    Service.getApplicationById.mockResolvedValue({
      id: 'uuid-2',
      personalInfo: {
        firstName: 'Test', lastName: 'User', email: 't@example.com', phone: '+49',
        dateOfBirth: '1980-05-20', gender: 'female',
        address: { street: 'A', city: 'B', postalCode: '12345', country: 'DE' }
      },
      membershipType: 'student',
      bankingInfo: undefined,
      canParticipate: true,
      motivation: undefined,
      hasConditions: false,
      conditions: undefined,
      status: MemberApplicationStatus.PENDING_REVIEW as any,
      documents: {},
      reviewer: undefined,
      reviewDate: undefined,
      reviewNotes: undefined,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-02T00:00:00Z')
    } as any);

    const res = await request(app).get('/api/membership/applications/uuid-2');
    expect(res.status).toBe(200);
    expect(res.body?.data?.personalInfo?.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body?.data?.personalInfo?.dateOfBirth).toBe('1980-05-20');
  });
});
