import { describe, expect, it, vi } from 'vitest';
import { inspectConfiguredSmtp } from '../../services/runtimeReadinessSmtpService';

const smtp = {
  host: 'smtp.example.test',
  port: 587,
  secure: false,
  user: 'configured-user',
  pass: 'configured-password',
  from: 'sender@example.test',
};

describe('runtime readiness SMTP inspection', () => {
  it('does not create a transport unless verification is explicitly requested', async () => {
    const createTransport = vi.fn();

    await expect(
      inspectConfiguredSmtp(smtp, false, createTransport)
    ).resolves.toEqual({
      configured: true,
      verified: false,
    });
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('verifies configured transport without sending mail or creating Ethereal', async () => {
    const verify = vi.fn(async () => true as const);
    const close = vi.fn();
    const createTransport = vi.fn(() => ({ verify, close }));

    await expect(
      inspectConfiguredSmtp(smtp, true, createTransport)
    ).resolves.toEqual({
      configured: true,
      verified: true,
    });
    expect(createTransport).toHaveBeenCalledWith({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    expect(verify).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it('reports SMTP as unconfigured when the explicit sender is missing', async () => {
    const createTransport = vi.fn();

    await expect(
      inspectConfiguredSmtp({ ...smtp, from: undefined }, true, createTransport)
    ).resolves.toEqual({ configured: false, verified: false });
    expect(createTransport).not.toHaveBeenCalled();
  });
});
