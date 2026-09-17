import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import authRoutes from '../../routes/auth';
import { PasswordSetupService } from '../../services/passwordSetupService';

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/auth', authRoutes);
  return instance;
}

describe('POST /auth/password-setup', () => {
  afterEach(() => vi.restoreAllMocks());

  it('consumes a valid setup request without issuing a JWT', async () => {
    vi.spyOn(PasswordSetupService, 'consume').mockResolvedValue();
    const response = await request(app())
      .post('/api/auth/password-setup')
      .send({
        token: '1.secret',
        password: 'password8',
        passwordConfirmation: 'password8',
      });
    expect(response.status).toBe(200);
    expect(response.body.token).toBeUndefined();
  });

  it('rejects confirmation mismatch before consuming', async () => {
    const consume = vi.spyOn(PasswordSetupService, 'consume');
    const response = await request(app())
      .post('/api/auth/password-setup')
      .send({
        token: '1.secret',
        password: 'password8',
        passwordConfirmation: 'different8',
      });
    expect(response.status).toBe(400);
    expect(consume).not.toHaveBeenCalled();
  });

  it('returns the same generic failure for invalid setup credentials', async () => {
    vi.spyOn(PasswordSetupService, 'consume').mockRejectedValue(
      new Error('secret detail')
    );
    const response = await request(app())
      .post('/api/auth/password-setup')
      .send({
        token: '1.secret',
        password: 'password8',
        passwordConfirmation: 'password8',
      });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      'Password setup link is invalid or expired'
    );
  });
});
