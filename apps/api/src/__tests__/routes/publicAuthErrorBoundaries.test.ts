import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../middleware/errorHandler';
import { User } from '../../models/User';
import authRoutes from '../../routes/auth';
import settingsRoutes from '../../routes/settings';
import userRoutes from '../../routes/users';
import { SettingsService } from '../../services/settingsService';
import { UserService } from '../../services/userService';
import { AppError } from '../../utils/errors';
import { FIRST_PARTY_ORIGIN } from '../helpers/authSession';

const SENTINEL = 'persistence failure: private driver detail';
const INTERNAL_SERVER_ERROR = {
  success: false,
  error: 'Internal Server Error',
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/users', userRoutes);
  app.use(errorHandler);
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('public authentication error boundaries', () => {
  it('presents unknown-email and wrong-password login failures identically', async () => {
    const app = createApp();

    const missingCredentials = await request(app)
      .post('/api/auth/login')
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({});

    expect(missingCredentials.status).toBe(400);
    expect(missingCredentials.body).toEqual({
      message: 'Please provide email and password',
    });

    const findUser = vi.spyOn(User, 'findOne').mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    } as never);

    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({ email: 'member@example.test', password: 'TestPassword1!' });

    findUser.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        comparePassword: vi.fn().mockResolvedValue(false),
      }),
    } as never);

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({ email: 'member@example.test', password: 'TestPassword2!' });

    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.body).toEqual({
      message: 'Invalid credentials',
    });
    expect(wrongPassword.body).toEqual({
      message: 'Invalid credentials',
    });
  });

  it('projects unexpected login failures through the bounded server-error envelope', async () => {
    vi.spyOn(User, 'findOne').mockReturnValue({
      select: vi.fn().mockRejectedValue(new Error(SENTINEL)),
    } as never);

    const response = await request(createApp())
      .post('/api/auth/login')
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({ email: 'member@example.test', password: 'TestPassword1!' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual(INTERNAL_SERVER_ERROR);
    expect(response.text).not.toContain(SENTINEL);
  });

  it('preserves public Membership-settings success and bounds unexpected failures', async () => {
    const getMembershipConfig = vi.spyOn(
      SettingsService,
      'getMembershipConfig'
    );
    getMembershipConfig.mockResolvedValueOnce({ membershipOpen: true });

    const success = await request(createApp()).get('/api/settings/membership');

    expect(success.status).toBe(200);
    expect(success.body).toEqual({ data: { membershipOpen: true } });

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getMembershipConfig.mockRejectedValueOnce(new Error(SENTINEL));

    const failure = await request(createApp()).get('/api/settings/membership');

    expect(failure.status).toBe(500);
    expect(failure.body).toEqual(INTERNAL_SERVER_ERROR);
    expect(failure.text).not.toContain(SENTINEL);
  });

  it('preserves safe email-verification errors and bounds native or 5xx failures', async () => {
    const verifyEmailChange = vi.spyOn(UserService, 'verifyEmailChange');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    verifyEmailChange.mockRejectedValueOnce(
      AppError.badRequest('Invalid or expired verification token')
    );
    const invalidToken = await request(createApp()).get(
      '/api/users/verify-email-change/invalid-token'
    );

    expect(invalidToken.status).toBe(400);
    expect(invalidToken.body).toEqual({
      success: false,
      message: 'Invalid or expired verification token',
    });

    verifyEmailChange.mockRejectedValueOnce(
      AppError.conflict('Email is no longer available')
    );
    const unavailableEmail = await request(createApp()).get(
      '/api/users/verify-email-change/unavailable-email'
    );

    expect(unavailableEmail.status).toBe(409);
    expect(unavailableEmail.body).toEqual({
      success: false,
      message: 'Email is no longer available',
    });

    verifyEmailChange.mockRejectedValueOnce(new Error(SENTINEL));
    const nativeFailure = await request(createApp()).get(
      '/api/users/verify-email-change/native-failure'
    );

    expect(nativeFailure.status).toBe(500);
    expect(nativeFailure.body).toEqual(INTERNAL_SERVER_ERROR);
    expect(nativeFailure.text).not.toContain(SENTINEL);

    verifyEmailChange.mockRejectedValueOnce(AppError.internal(SENTINEL));
    const internalAppError = await request(createApp()).get(
      '/api/users/verify-email-change/internal-app-error'
    );

    expect(internalAppError.status).toBe(500);
    expect(internalAppError.body).toEqual(INTERNAL_SERVER_ERROR);
    expect(internalAppError.text).not.toContain(SENTINEL);
  });
});
