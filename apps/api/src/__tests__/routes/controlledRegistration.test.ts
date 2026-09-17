import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import membershipRoutes from '../../routes/membershipApplications';
import authRoutes from '../../routes/auth';
import { MembershipApplicationService } from '../../services/membershipApplicationService';
import { MembershipApplicantAccessService } from '../../services/membershipApplicantAccessService';
import { User } from '../../models/User';

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/membership', membershipRoutes);
  instance.use('/api/auth', authRoutes);
  instance.use((error: any, _req: any, res: any, _next: any) =>
    res.status(error.statusCode ?? 500).json({ error: error.message })
  );
  return instance;
}

describe('controlled registration routes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('removes direct public application submission', async () => {
    const create = vi.spyOn(MembershipApplicationService, 'createApplication');
    const response = await request(app())
      .post('/api/membership/applications')
      .send({});
    expect(response.status).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it('turns controlled entry into a generic email-verification request without creating an account', async () => {
    const requestVerification = vi
      .spyOn(MembershipApplicantAccessService, 'requestInitialVerification')
      .mockResolvedValue();
    const userCreate = vi.spyOn(User, 'create');
    const createApplication = vi.spyOn(
      MembershipApplicationService,
      'createApplication'
    );
    const email = `controlled-${Date.now()}@example.test`;

    const response = await request(app())
      .post('/api/membership/applicant/verification-requests')
      .set('X-Registration-Key', 'Abcdefgh_123')
      .send({ email, locale: 'en' });

    expect(response.status).toBe(202);
    await vi.waitFor(() =>
      expect(requestVerification).toHaveBeenCalledWith(
        email,
        'Abcdefgh_123',
        'en'
      )
    );
    expect(createApplication).not.toHaveBeenCalled();
    expect(userCreate).not.toHaveBeenCalled();
  });

  it('does not expose direct public account registration', async () => {
    const userCreate = vi.spyOn(User, 'create');
    const response = await request(app())
      .post('/api/auth/register')
      .send({ email: 'x@example.test' });
    expect(response.status).toBe(404);
    expect(userCreate).not.toHaveBeenCalled();
  });
});
