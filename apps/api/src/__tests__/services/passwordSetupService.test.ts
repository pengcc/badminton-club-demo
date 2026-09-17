import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { User } from '../../models/User';
import { PasswordSetupService } from '../../services/passwordSetupService';
import { AccountOnboardingStatus } from '@club/shared-types/core/enums';

describe('PasswordSetupService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('persists only a digest and advances generation when issuing', async () => {
    vi.spyOn(User, 'findById').mockReturnValue({
      select: vi.fn().mockResolvedValue({
        passwordSetupGeneration: 2,
        passwordSetupLocale: 'zh',
        accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
      }),
    } as never);
    const update = vi
      .spyOn(User, 'findOneAndUpdate')
      .mockResolvedValue({ passwordSetupGeneration: 3 } as never);

    const issued = await PasswordSetupService.issue('507f1f77bcf86cd799439011');

    expect(issued.generation).toBe(3);
    expect(issued.token).toMatch(/^3\.[A-Za-z0-9_-]{43}$/);
    const persisted = update.mock.calls[0][1] as any;
    expect(persisted.$set.passwordSetupTokenDigest).toBe(
      PasswordSetupService.digest(issued.token)
    );
    expect(JSON.stringify(persisted)).not.toContain(issued.token);
    expect(persisted.$set.passwordSetupLocale).toBe('zh');
  });

  it('persists an explicit setup locale for first issuance', async () => {
    vi.spyOn(User, 'findById').mockReturnValue({
      select: vi.fn().mockResolvedValue({
        passwordSetupGeneration: 0,
        accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
      }),
    } as never);
    const update = vi
      .spyOn(User, 'findOneAndUpdate')
      .mockResolvedValue({ passwordSetupGeneration: 1 } as never);

    await PasswordSetupService.issue('507f1f77bcf86cd799439011', undefined, {
      locale: 'en',
    });

    expect((update.mock.calls[0][1] as any).$set.passwordSetupLocale).toBe(
      'en'
    );
  });

  it('atomically binds recovery issuance to the evaluated delivery state', async () => {
    const claimedAt = new Date('2026-07-19T08:00:00.000Z');
    const expiresAt = new Date('2026-07-26T08:00:00.000Z');
    vi.spyOn(User, 'findById').mockReturnValue({
      select: vi.fn().mockResolvedValue({
        passwordSetupGeneration: 2,
        accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
      }),
    } as never);
    const update = vi
      .spyOn(User, 'findOneAndUpdate')
      .mockResolvedValue({ passwordSetupGeneration: 3 } as never);

    await PasswordSetupService.issue('507f1f77bcf86cd799439011', undefined, {
      expectedGeneration: 2,
      expectedDeliveryState: {
        status: 'claimed',
        generation: 2,
        claimedAt,
        expiresAt,
      },
    });

    expect(update.mock.calls[0][0]).toMatchObject({
      passwordSetupGeneration: 2,
      passwordSetupDeliveryStatus: 'claimed',
      passwordSetupDeliveryGeneration: 2,
      passwordSetupDeliveryClaimedAt: claimedAt,
      passwordSetupExpiresAt: expiresAt,
    });
  });

  it('requires absent optional delivery fields to remain absent during recovery issuance', async () => {
    vi.spyOn(User, 'findById').mockReturnValue({
      select: vi.fn().mockResolvedValue({
        passwordSetupGeneration: 2,
        accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
      }),
    } as never);
    const update = vi
      .spyOn(User, 'findOneAndUpdate')
      .mockResolvedValue({ passwordSetupGeneration: 3 } as never);

    await PasswordSetupService.issue('507f1f77bcf86cd799439011', undefined, {
      expectedGeneration: 2,
      expectedDeliveryState: {},
    });

    expect(update.mock.calls[0][0]).toMatchObject({
      passwordSetupDeliveryStatus: { $exists: false },
      passwordSetupDeliveryGeneration: { $exists: false },
      passwordSetupDeliveryClaimedAt: { $exists: false },
      passwordSetupExpiresAt: { $exists: false },
    });
  });

  it('atomically consumes the matching generation and never stores plaintext', async () => {
    const update = vi
      .spyOn(User, 'findOneAndUpdate')
      .mockResolvedValue({} as never);
    await PasswordSetupService.consume(
      '4.abcdefghijklmnopqrstuvwxyzABCDEFGHijklmno',
      'password8'
    );
    expect(update.mock.calls[0][0]).toMatchObject({
      passwordSetupGeneration: 4,
    });
    const passwordHash = (update.mock.calls[0][1] as any).$set.password;
    expect(passwordHash).not.toBe('password8');
    await expect(bcrypt.compare('password8', passwordHash)).resolves.toBe(true);
  });

  it('fails generically when a token is already consumed, expired, or superseded', async () => {
    vi.spyOn(User, 'findOneAndUpdate').mockResolvedValue(null);
    await expect(
      PasswordSetupService.consume(
        '1.abcdefghijklmnopqrstuvwxyzABCDEFGHijklmno',
        'password8'
      )
    ).rejects.toThrow('invalid or expired');
  });
});
