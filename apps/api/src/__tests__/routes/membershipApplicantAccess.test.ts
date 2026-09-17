import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requestInitialVerification: vi.fn(),
  requestApplicationAccess: vi.fn(),
  consume: vi.fn(),
  setSessionCookie: vi.fn(),
  clearSessionCookies: vi.fn(),
  resolveSessionCookies: vi.fn(),
  hashRateLimitEmail: vi.fn(
    (email: unknown) => `email:${String(email).toLowerCase()}`
  ),
}));

vi.mock('../../middleware/auth', () => ({
  protect: (_req: any, _res: any, next: any) => next(),
  authorizeCapability: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../services/membershipApplicantAccessService', () => ({
  MembershipApplicantAccessService: {
    ...mocks,
  },
}));

import membershipRoutes, {
  APPLICANT_EMAIL_RATE_LIMITS,
} from '../../routes/membershipApplications';
import { requireTrustedApplicantOrigin } from '../../middleware/membershipApplicant';

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/membership', membershipRoutes);
  instance.post('/origin-check', requireTrustedApplicantOrigin, (_req, res) =>
    res.sendStatus(204)
  );
  instance.use((error: any, _req: any, res: any, _next: any) =>
    res
      .status(error.statusCode ?? 500)
      .json({ success: false, error: error.message })
  );
  return instance;
}

describe('Membership Application public applicant boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requestInitialVerification.mockResolvedValue(undefined);
    mocks.requestApplicationAccess.mockResolvedValue(undefined);
    mocks.resolveSessionCookies.mockResolvedValue({
      applicationId: undefined,
      observedCookieNames: [],
      clearCookieNames: [],
    });
  });

  it('pins every approved normalized-email and IP rate-limit window', () => {
    expect(APPLICANT_EMAIL_RATE_LIMITS).toEqual({
      perMinute: 1,
      perHour: 5,
      perDay: 10,
      perIpHour: 20,
    });
  });

  it('returns one generic response and enforces the one-per-minute normalized-email limit', async () => {
    const email = `rate-${Date.now()}@example.test`;
    const first = await request(app())
      .post('/api/membership/applicant/access-requests')
      .send({ email, locale: 'en' });
    const second = await request(app())
      .post('/api/membership/applicant/access-requests')
      .send({ email: email.toUpperCase(), locale: 'en' });
    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(first.body).toEqual(second.body);
    await vi.waitFor(() =>
      expect(mocks.requestApplicationAccess).toHaveBeenCalledTimes(1)
    );
  });

  it('does not disclose malformed or ineligible requests', async () => {
    mocks.requestApplicationAccess.mockRejectedValue(new Error('not eligible'));
    const malformed = await request(app())
      .post('/api/membership/applicant/access-requests')
      .send({ email: 'not-an-email' });
    const valid = await request(app())
      .post('/api/membership/applicant/access-requests')
      .send({ email: `missing-${Date.now()}@example.test` });
    expect(malformed.status).toBe(202);
    expect(valid.status).toBe(202);
    expect(malformed.body).toEqual(valid.body);
  });

  it('sets a consumed session in its opaque cookie slot', async () => {
    mocks.consume.mockResolvedValue({
      applicationId: '507f1f77bcf86cd799439012',
      cookieSlotId: 'a'.repeat(22),
      sessionToken: 'raw-session',
    });
    const response = await request(app())
      .post('/api/membership/applicant/access/consume')
      .set('Origin', process.env.FRONTEND_URL!)
      .send({ token: 'a'.repeat(32) });
    expect(response.status).toBe(200);
    expect(mocks.setSessionCookie).toHaveBeenCalledWith(
      expect.anything(),
      'a'.repeat(22),
      'raw-session'
    );
  });

  it('rejects missing or untrusted Origin on cookie-authenticated mutations', async () => {
    expect((await request(app()).post('/origin-check')).status).toBe(403);
    expect(
      (
        await request(app())
          .post('/origin-check')
          .set('Origin', 'https://attacker.example')
      ).status
    ).toBe(403);
    expect(
      (
        await request(app())
          .post('/origin-check')
          .set('Origin', process.env.FRONTEND_URL!)
      ).status
    ).toBe(204);
  });
});
