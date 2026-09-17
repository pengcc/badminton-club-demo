import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import {
  AccountKind,
  AccountOnboardingStatus,
  MembershipStatus,
  PlayerType,
} from '@club/shared-types/core/enums';
import { isPasswordRecoveryEligibleState } from '../../services/passwordRecoveryService';

function person(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    email: 'member@example.test',
    accountKind: AccountKind.PERSON,
    administratorDesignation: false,
    membershipStatus: MembershipStatus.ACTIVE,
    accountOnboardingStatus: AccountOnboardingStatus.READY,
    ...overrides,
  } as any;
}

describe('password recovery eligibility policy', () => {
  it('allows current Members and active External Players through the shared capability policy', () => {
    expect(isPasswordRecoveryEligibleState(person())).toBe(true);
    expect(
      isPasswordRecoveryEligibleState(
        person({ membershipStatus: MembershipStatus.INACTIVE }),
        { type: PlayerType.EXTERNAL, isActivePlayer: true }
      )
    ).toBe(true);
  });

  it('fails closed for suspended, inactive, non-ready, contradictory, and Super Admin states', () => {
    expect(
      isPasswordRecoveryEligibleState(person({ accountSuspension: {} }))
    ).toBe(false);
    expect(
      isPasswordRecoveryEligibleState(
        person({ membershipStatus: MembershipStatus.INACTIVE })
      )
    ).toBe(false);
    expect(
      isPasswordRecoveryEligibleState(
        person({
          accountOnboardingStatus:
            AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
        })
      )
    ).toBe(false);
    expect(
      isPasswordRecoveryEligibleState(person(), {
        type: PlayerType.EXTERNAL,
        isActivePlayer: true,
      })
    ).toBe(false);
    expect(
      isPasswordRecoveryEligibleState(
        person({
          accountKind: AccountKind.SUPER_ADMIN,
          membershipStatus: undefined,
        })
      )
    ).toBe(false);
  });
});
