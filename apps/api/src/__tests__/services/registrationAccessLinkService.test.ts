import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RegistrationAccess } from '../../models/RegistrationAccess';
import { RegistrationAccessService } from '../../services/registrationAccessService';

const TEST_REGISTRATION_ACCESS_TOKEN = ['Test', 'Link', '_123'].join('');
const MISMATCHED_REGISTRATION_ACCESS_TOKEN = 'OtherLink456';
const ACTOR_ID = '507f1f77bcf86cd799439011';

function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function currentRecord(overrides: Record<string, unknown> = {}) {
  return {
    tokenDigest: digest(TEST_REGISTRATION_ACCESS_TOKEN),
    recoverableToken: TEST_REGISTRATION_ACCESS_TOKEN,
    expiryMode: '30_days',
    expiresAt: new Date(Date.now() + 60_000),
    generation: 3,
    updatedAt: new Date('2026-08-07T10:00:00.000Z'),
    ...overrides,
  };
}

describe('RegistrationAccessService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('persists matching recoverable and digest forms while returning metadata only', async () => {
    vi.spyOn(RegistrationAccess, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    } as never);
    const update = vi
      .spyOn(RegistrationAccess, 'findOneAndUpdate')
      .mockReturnValue({
        lean: vi.fn().mockResolvedValue(currentRecord({ generation: 1 })),
      } as never);

    const result = await RegistrationAccessService.issue(
      '30_days',
      ACTOR_ID,
      true
    );

    const updateDocument = update.mock.calls[0]?.[1] as {
      $set: { recoverableToken: string; tokenDigest: string };
    };
    const token = updateDocument.$set.recoverableToken;
    expect(token).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(updateDocument.$set.tokenDigest).toBe(digest(token));
    expect(result).not.toHaveProperty('token');
    expect(result).not.toHaveProperty('path');
  });

  it.each([
    ['30_days', 30],
    ['90_days', 90],
    ['180_days', 180],
    ['none', null],
  ] as const)('supports %s expiry', async (expiryMode, days) => {
    const now = new Date('2026-09-10T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.spyOn(RegistrationAccess, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    } as never);
    const update = vi
      .spyOn(RegistrationAccess, 'findOneAndUpdate')
      .mockReturnValue({
        lean: vi
          .fn()
          .mockResolvedValue(
            currentRecord({ expiryMode, expiresAt: null, generation: 1 })
          ),
      } as never);

    await RegistrationAccessService.issue(expiryMode, ACTOR_ID, true);

    const written = (update.mock.calls[0]?.[1] as any).$set;
    expect(written.expiryMode).toBe(expiryMode);
    expect(written.expiresAt).toEqual(
      days === null ? null : new Date(now.getTime() + days * 86_400_000)
    );
  });

  it('accepts only the current unexpired digest without reading the recoverable value', async () => {
    const select = vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(currentRecord()),
    });
    vi.spyOn(RegistrationAccess, 'findById').mockReturnValue({
      select,
    } as never);

    await expect(
      RegistrationAccessService.validate(TEST_REGISTRATION_ACCESS_TOKEN)
    ).resolves.toBe(true);
    await expect(
      RegistrationAccessService.validateAndGetGeneration(
        TEST_REGISTRATION_ACCESS_TOKEN
      )
    ).resolves.toBe(3);
    await expect(
      RegistrationAccessService.validateAndGetContext(
        TEST_REGISTRATION_ACCESS_TOKEN
      )
    ).resolves.toEqual({
      generation: 3,
      issuedAt: new Date('2026-08-07T10:00:00.000Z'),
    });
    expect(select).toHaveBeenCalledWith('+tokenDigest');
    expect(select).not.toHaveBeenCalledWith(
      expect.stringContaining('recoverableToken')
    );
    await expect(
      RegistrationAccessService.validate('wrong-token!')
    ).resolves.toBe(false);
  });

  it('returns the protected path only for a matching active recoverable value', async () => {
    const select = vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(currentRecord()),
    });
    vi.spyOn(RegistrationAccess, 'findById').mockReturnValue({
      select,
    } as never);

    await expect(RegistrationAccessService.getAdminState()).resolves.toEqual({
      hasCurrentLink: true,
      isValid: true,
      expiryMode: '30_days',
      expiresAt: expect.any(String),
      generation: 3,
      updatedAt: '2026-08-07T10:00:00.000Z',
      path: `/apply?k=${TEST_REGISTRATION_ACCESS_TOKEN}`,
    });
    expect(select).toHaveBeenCalledWith('+tokenDigest +recoverableToken');
  });

  it.each([
    ['legacy', { recoverableToken: undefined }],
    ['expired', { expiresAt: new Date(Date.now() - 1) }],
  ])('keeps %s metadata without exposing a path', async (_state, overrides) => {
    vi.spyOn(RegistrationAccess, 'findById').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(currentRecord(overrides)),
      }),
    } as never);

    const result = await RegistrationAccessService.getAdminState();

    expect(result).toMatchObject({ hasCurrentLink: true, generation: 3 });
    expect(result).not.toHaveProperty('path');
  });

  it('does not expose a valid-format recoverable token when its digest does not match', async () => {
    expect(MISMATCHED_REGISTRATION_ACCESS_TOKEN).toMatch(/^[A-Za-z0-9_-]{12}$/);
    vi.spyOn(RegistrationAccess, 'findById').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(
          currentRecord({
            recoverableToken: MISMATCHED_REGISTRATION_ACCESS_TOKEN,
          })
        ),
      }),
    } as never);

    const result = await RegistrationAccessService.getAdminState();

    expect(result).toMatchObject({ hasCurrentLink: true, generation: 3 });
    expect(result).not.toHaveProperty('path');
  });

  it('uses one singleton record and an atomic generation increment', async () => {
    vi.spyOn(RegistrationAccess, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue({ expiresAt: new Date(Date.now() - 1) }),
    } as never);
    const update = vi
      .spyOn(RegistrationAccess, 'findOneAndUpdate')
      .mockReturnValue({
        lean: vi.fn().mockResolvedValue(currentRecord({ generation: 4 })),
      } as never);

    await RegistrationAccessService.issue('30_days', ACTOR_ID, true);

    expect(update).toHaveBeenCalledWith(
      { _id: 'current' },
      expect.objectContaining({ $inc: { generation: 1 } }),
      expect.objectContaining({ upsert: true, new: true })
    );
  });

  it('rejects expiry modes outside the approved set', async () => {
    await expect(
      RegistrationAccessService.issue('custom' as never, ACTOR_ID, true)
    ).rejects.toThrow('Invalid registration link expiry mode');
  });
});
