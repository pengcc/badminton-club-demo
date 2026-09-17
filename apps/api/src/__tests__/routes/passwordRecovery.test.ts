import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import authRoutes from '../../routes/auth';
import { config } from '../../config';
import { PasswordRecoveryService } from '../../services/passwordRecoveryService';
import { PasswordSetupService } from '../../services/passwordSetupService';

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/auth', authRoutes);
  return instance;
}

const generic = {
  success: true,
  message: 'If the request is eligible, an email will arrive shortly.',
};

describe('password recovery routes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns the same immediate 202 body without awaiting eligible delivery work', async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const requestRecovery = vi
      .spyOn(PasswordRecoveryService, 'requestByEmail')
      .mockReturnValue(pending);

    const response = await request(app())
      .post('/api/auth/password-recovery/request')
      .set('Origin', config.frontendUrl)
      .send({ email: 'member@example.test', locale: 'en' });

    expect(response.status).toBe(202);
    expect(response.body).toEqual(generic);
    expect(requestRecovery).toHaveBeenCalledWith('member@example.test', 'en');
    finish();
  });

  it('keeps malformed and unknown requests on the same public response', async () => {
    vi.spyOn(PasswordRecoveryService, 'requestByEmail').mockResolvedValue();
    const malformed = await request(app())
      .post('/api/auth/password-recovery/request')
      .set('Origin', config.frontendUrl)
      .send({ email: 'not-an-email', locale: 'en' });
    const unknown = await request(app())
      .post('/api/auth/password-recovery/request')
      .set('Origin', config.frontendUrl)
      .send({ email: 'unknown@example.test', locale: 'de' });
    expect(malformed.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(malformed.body).toEqual(generic);
    expect(unknown.body).toEqual(generic);
  });

  it('returns only credential usability from recovery and setup status checks', async () => {
    vi.spyOn(PasswordRecoveryService, 'status').mockResolvedValue(true);
    vi.spyOn(PasswordSetupService, 'status').mockResolvedValue(false);
    const recovery = await request(app())
      .post('/api/auth/password-recovery/status')
      .set('Origin', config.frontendUrl)
      .send({ token: 'test-token' });
    const setup = await request(app())
      .post('/api/auth/password-setup/status')
      .set('Origin', config.frontendUrl)
      .send({ token: 'test-token' });
    expect(recovery.body).toEqual({ success: true, data: { usable: true } });
    expect(setup.body).toEqual({ success: true, data: { usable: false } });
    expect(JSON.stringify(recovery.body)).not.toContain('secret');
  });

  it('keeps all reset credential failures generic', async () => {
    vi.spyOn(PasswordRecoveryService, 'consume').mockRejectedValue(
      new Error('sensitive reason')
    );
    const response = await request(app())
      .post('/api/auth/password-recovery/reset')
      .set('Origin', config.frontendUrl)
      .send({
        token: 'test-token',
        password: 'Password1!',
        passwordConfirmation: 'Password1!',
      });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: 'Password recovery link is invalid or expired',
    });
  });
});
