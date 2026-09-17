import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { config, resolveDevelopmentEmailTransport } from '../../config';
import EmailService from '../../services/emailService';

const serviceState = EmailService as unknown as {
  transporter: unknown;
  isInitialized: boolean;
};

const original = {
  nodeEnv: config.nodeEnv,
  developmentEmailTransport: config.developmentEmailTransport,
  smtp: { ...config.smtp },
};

beforeEach(() => {
  vi.restoreAllMocks();
  serviceState.transporter = null;
  serviceState.isInitialized = false;
  Object.assign(config.smtp, {
    host: 'smtp.example.test',
    port: 587,
    secure: false,
    user: 'smtp-user',
    pass: 'smtp-pass',
    from: 'sender@example.test',
  });
});

afterEach(() => {
  config.nodeEnv = original.nodeEnv;
  config.developmentEmailTransport = original.developmentEmailTransport;
  Object.assign(config.smtp, original.smtp);
  serviceState.transporter = null;
  serviceState.isInitialized = false;
});

describe('EmailService transport selection', () => {
  it('defaults development to Ethereal and rejects invalid selectors', () => {
    expect(resolveDevelopmentEmailTransport('development', undefined)).toBe(
      'ethereal'
    );
    expect(resolveDevelopmentEmailTransport('development', ' smtp ')).toBe(
      'smtp'
    );
    expect(() =>
      resolveDevelopmentEmailTransport('development', 'automatic')
    ).toThrow(/DEV_EMAIL_TRANSPORT/);
    expect(resolveDevelopmentEmailTransport('production', 'invalid')).toBe(
      undefined
    );
  });

  it('uses Ethereal in development even when SMTP configuration is present', async () => {
    config.nodeEnv = 'development';
    config.developmentEmailTransport = 'ethereal';
    vi.spyOn(nodemailer, 'createTestAccount').mockResolvedValue({
      user: 'ethereal-user',
      pass: 'ethereal-pass',
    } as never);
    const createTransport = vi
      .spyOn(nodemailer, 'createTransport')
      .mockReturnValue({} as never);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    await EmailService.initialize();

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.ethereal.email',
        auth: { user: 'ethereal-user', pass: 'ethereal-pass' },
      })
    );
    expect(JSON.stringify(consoleLog.mock.calls)).toContain(
      'Development mode (Ethereal)'
    );
    expect(JSON.stringify(createTransport.mock.calls)).not.toContain(
      'smtp-user'
    );
  });

  it('uses configured SMTP in development only after explicit selection', async () => {
    config.nodeEnv = 'development';
    config.developmentEmailTransport = 'smtp';
    const createTransport = vi
      .spyOn(nodemailer, 'createTransport')
      .mockReturnValue({} as never);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    await EmailService.initialize();

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.example.test' })
    );
    expect(JSON.stringify(consoleLog.mock.calls)).toContain(
      'Development mode (explicit SMTP)'
    );
  });

  it('fails closed when explicitly selected development SMTP is incomplete', async () => {
    config.nodeEnv = 'development';
    config.developmentEmailTransport = 'smtp';
    config.smtp.pass = undefined;
    const createTransport = vi.spyOn(nodemailer, 'createTransport');

    await expect(EmailService.initialize()).rejects.toMatchObject({
      statusCode: 500,
    });
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('preserves test mock and production SMTP modes', async () => {
    const createTransport = vi
      .spyOn(nodemailer, 'createTransport')
      .mockReturnValue({} as never);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    config.nodeEnv = 'test';
    config.developmentEmailTransport = undefined;
    await EmailService.initialize();
    expect(createTransport).toHaveBeenLastCalledWith({ jsonTransport: true });

    serviceState.transporter = null;
    serviceState.isInitialized = false;
    config.nodeEnv = 'production';
    await EmailService.initialize();
    expect(createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({ host: 'smtp.example.test' })
    );
    expect(JSON.stringify(consoleLog.mock.calls)).toContain(
      'Production mode (SMTP)'
    );
  });
});
