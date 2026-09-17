import { beforeEach, describe, expect, it, vi } from 'vitest';
import { User } from '../../models/User';
import EmailService from '../../services/emailService';
import { PasswordSetupDeliveryService } from '../../services/passwordSetupDeliveryService';

const user = {
  email: 'member@example.test',
  firstName: 'Test',
  lastName: 'Member',
  passwordSetupLocale: 'en' as const,
};

describe('PasswordSetupDeliveryService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.FRONTEND_URL = 'https://club.example.test';
  });

  it('atomically claims and sends one generation once', async () => {
    vi.spyOn(User, 'findOneAndUpdate').mockResolvedValue(user as never);
    vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
    vi.spyOn(User, 'updateOne').mockResolvedValue({ matchedCount: 1 } as never);
    await expect(
      PasswordSetupDeliveryService.deliver('user-1', 3, '3.secret')
    ).resolves.toBe('sent');
    expect(EmailService.sendFromTemplate).toHaveBeenCalledOnce();
    expect(EmailService.sendFromTemplate).toHaveBeenCalledWith(
      'member_password_setup',
      user.email,
      'en',
      expect.objectContaining({
        expiresIn: '7 days',
        resetLink: 'https://club.example.test/en/set-password?token=3.secret',
      })
    );
    expect(User.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordSetupGeneration: 3,
        passwordSetupDeliveryGeneration: 3,
        passwordSetupDeliveryStatus: 'claimed',
      }),
      expect.anything()
    );
  });

  it('does not send a generation that is already claimed', async () => {
    vi.spyOn(User, 'findOneAndUpdate').mockResolvedValue(null);
    vi.spyOn(User, 'findById').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi
          .fn()
          .mockResolvedValue({ passwordSetupDeliveryStatus: 'claimed' }),
      }),
    } as never);
    const send = vi.spyOn(EmailService, 'sendFromTemplate');
    await expect(
      PasswordSetupDeliveryService.deliver('user-1', 3, '3.secret')
    ).resolves.toBe('uncertain');
    expect(send).not.toHaveBeenCalled();
  });

  it('falls back to German for retained setup state without a locale', async () => {
    vi.spyOn(User, 'findOneAndUpdate').mockResolvedValue({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    } as never);
    vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
    vi.spyOn(User, 'updateOne').mockResolvedValue({ matchedCount: 1 } as never);

    await expect(
      PasswordSetupDeliveryService.deliver('user-1', 3, '3.secret')
    ).resolves.toBe('sent');

    expect(EmailService.sendFromTemplate).toHaveBeenCalledWith(
      'member_password_setup',
      user.email,
      'de',
      expect.objectContaining({
        expiresIn: '7 Tage',
        resetLink: 'https://club.example.test/de/set-password?token=3.secret',
      })
    );
  });

  it('never reports a newer generation outcome for an older setup operation', async () => {
    vi.spyOn(User, 'findById').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          passwordSetupGeneration: 4,
          passwordSetupDeliveryGeneration: 4,
          passwordSetupDeliveryStatus: 'sent',
        }),
      }),
    } as never);

    await expect(
      PasswordSetupDeliveryService.statusForGeneration('user-1', 3)
    ).resolves.toBe('uncertain');
    await expect(
      PasswordSetupDeliveryService.statusForGeneration('user-1', 4)
    ).resolves.toBe('sent');
  });

  it('distinguishes definite rejection from ambiguous provider failure', async () => {
    vi.spyOn(User, 'findOneAndUpdate').mockResolvedValue(user as never);
    vi.spyOn(User, 'updateOne').mockResolvedValue({ matchedCount: 1 } as never);
    vi.spyOn(EmailService, 'sendFromTemplate').mockRejectedValueOnce(
      Object.assign(new Error('auth rejected'), { code: 'EAUTH' })
    );
    await expect(
      PasswordSetupDeliveryService.deliver('user-1', 4, '4.secret')
    ).resolves.toBe('failed');
    vi.mocked(EmailService.sendFromTemplate).mockRejectedValueOnce(
      new Error('provider outcome unknown')
    );
    await expect(
      PasswordSetupDeliveryService.deliver('user-1', 5, '5.secret')
    ).resolves.toBe('uncertain');
  });
});
