import { Types } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AccountOnboardingStatus,
  MembershipStatus,
  AccountKind,
  Capability,
} from '@club/shared-types/core/enums';
import {
  PASSWORD_SETUP_DELIVERY_STALE_MS,
  PasswordSetupDeliveryService,
  projectAccountSetupSummary,
} from '../../services/passwordSetupDeliveryService';
import { AccountOnboardingOperation } from '../../models/AccountOnboardingOperation';
import { RegistrationApprovalEvent } from '../../models/RegistrationApprovalEvent';
import { Player } from '../../models/Player';
import { PlayerService } from '../../services/playerService';

function setupUser(
  overrides: Record<string, unknown> = {}
): Parameters<typeof projectAccountSetupSummary>[0] {
  return {
    _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
    accountKind: AccountKind.PERSON,
    membershipStatus: MembershipStatus.ACTIVE,
    accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
    passwordSetupExpiresAt: new Date('2026-07-26T00:00:00.000Z'),
    passwordSetupGeneration: 2,
    passwordSetupDeliveryGeneration: 2,
    passwordSetupDeliveryStatus: 'sent',
    passwordSetupDeliveryClaimedAt: new Date('2026-07-19T00:00:00.000Z'),
    ...overrides,
  };
}

describe('administrator password-setup projection', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns no delivery or reissue action for a ready account', () => {
    expect(
      projectAccountSetupSummary(
        setupUser({ accountOnboardingStatus: AccountOnboardingStatus.READY }),
        true
      )
    ).toEqual({
      userId: '507f1f77bcf86cd799439011',
      accountOnboardingStatus: AccountOnboardingStatus.READY,
      deliveryStatus: 'none',
      reissueAvailable: false,
    });
  });

  it.each([
    'sent',
    'failed',
    'uncertain',
  ] as const)('exposes the current generation %s outcome', (deliveryStatus) => {
    expect(
      projectAccountSetupSummary(
        setupUser({ passwordSetupDeliveryStatus: deliveryStatus }),
        true,
        new Date('2026-07-19T00:00:00.000Z')
      )
    ).toMatchObject({ deliveryStatus, reissueAvailable: true });
  });

  it.each([
    { passwordSetupDeliveryGeneration: 1, passwordSetupDeliveryStatus: 'sent' },
    {
      passwordSetupDeliveryGeneration: undefined,
      passwordSetupDeliveryStatus: undefined,
    },
  ])('does not expose stale or missing delivery state: %j', (overrides) => {
    expect(
      projectAccountSetupSummary(
        setupUser(overrides),
        true,
        new Date('2026-07-19T00:00:00.000Z')
      ).deliveryStatus
    ).toBe('not_attempted');
  });

  it.each([
    {
      passwordSetupDeliveryGeneration: undefined,
      passwordSetupDeliveryStatus: 'pending',
    },
    {
      passwordSetupDeliveryGeneration: 2,
      passwordSetupDeliveryStatus: 'claimed',
    },
    {
      passwordSetupDeliveryGeneration: 1,
      passwordSetupDeliveryStatus: 'claimed',
    },
    {
      passwordSetupDeliveryGeneration: 2,
      passwordSetupDeliveryStatus: 'claimed',
      passwordSetupDeliveryClaimedAt: undefined,
    },
  ])('withholds reissue while the current %s delivery is active', (overrides) => {
    expect(
      projectAccountSetupSummary(
        setupUser(overrides),
        true,
        new Date('2026-07-19T00:05:00.000Z')
      )
    ).toMatchObject({
      deliveryStatus: 'not_attempted',
      reissueAvailable: false,
    });
  });

  it.each([
    {
      passwordSetupDeliveryGeneration: undefined,
      passwordSetupDeliveryStatus: 'pending',
    },
    {
      passwordSetupDeliveryGeneration: 2,
      passwordSetupDeliveryStatus: 'claimed',
    },
  ])('exposes stale %s delivery as uncertain recovery', (overrides) => {
    expect(
      projectAccountSetupSummary(
        setupUser(overrides),
        true,
        new Date(
          new Date('2026-07-19T00:00:00.000Z').getTime() +
            PASSWORD_SETUP_DELIVERY_STALE_MS
        )
      )
    ).toMatchObject({
      deliveryStatus: 'uncertain',
      reissueAvailable: true,
    });
  });

  it('derives expiry without exposing the setup expiry timestamp', () => {
    const summary = projectAccountSetupSummary(
      setupUser({
        passwordSetupExpiresAt: new Date('2026-07-18T00:00:00.000Z'),
      }),
      true,
      new Date('2026-07-19T00:00:00.000Z')
    );

    expect(summary).toMatchObject({
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_EXPIRED,
      deliveryStatus: 'sent',
      reissueAvailable: true,
    });
    expect(summary).not.toHaveProperty('passwordSetupExpiresAt');
    expect(JSON.stringify(summary)).not.toMatch(/token|digest|claim/i);
  });

  it('loads provenance and Player evidence in bounded batch queries', async () => {
    const supported = setupUser();
    const unsupported = setupUser({
      _id: new Types.ObjectId('507f1f77bcf86cd799439012'),
    });
    const query = (result: unknown) => ({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(result),
      }),
    });
    const directFind = vi
      .spyOn(AccountOnboardingOperation, 'find')
      .mockReturnValue(
        query([{ result: { userId: supported._id.toString() } }]) as never
      );
    const approvalFind = vi
      .spyOn(RegistrationApprovalEvent, 'find')
      .mockReturnValue(query([]) as never);
    const playerFind = vi
      .spyOn(Player, 'find')
      .mockReturnValue(query([]) as never);

    const summaries = await PasswordSetupDeliveryService.setupSummariesForUsers(
      [supported, unsupported]
    );

    expect(summaries.get(supported._id.toString())?.reissueAvailable).toBe(
      true
    );
    expect(summaries.get(unsupported._id.toString())?.reissueAvailable).toBe(
      false
    );
    expect(directFind).toHaveBeenCalledOnce();
    expect(approvalFind).toHaveBeenCalledOnce();
    expect(playerFind).toHaveBeenCalledOnce();
  });

  it('does not load setup metadata for non-administrator Player readers', async () => {
    const populate = vi.fn().mockResolvedValue([]);
    vi.spyOn(Player, 'find').mockReturnValue({ populate } as never);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await PlayerService.getAllPlayersWithUserInfo(false);

    const projection = String(populate.mock.calls[0]?.[1]);
    expect(projection).not.toMatch(/passwordSetup|accountOnboardingStatus/);
  });

  it('loads the delivery claim timestamp only for administrator recovery policy', async () => {
    const populate = vi.fn().mockResolvedValue([]);
    vi.spyOn(Player, 'find').mockReturnValue({ populate } as never);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await PlayerService.getAllPlayersWithUserInfo(true);

    const projection = String(populate.mock.calls[0]?.[1]);
    expect(projection).toContain('passwordSetupDeliveryClaimedAt');
  });
});
