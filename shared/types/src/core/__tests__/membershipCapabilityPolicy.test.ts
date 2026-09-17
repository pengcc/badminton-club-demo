import { describe, expect, it } from 'vitest';
import {
  AccountOnboardingStatus,
  AccountKind,
  Capability,
  MembershipStatus,
  PlayerType,
} from '../enums';
import type { CapabilityPolicyContext } from '../../domain/membership';
import {
  CapabilityPolicyContradiction,
  evaluateCapabilityPolicy,
} from '../../domain/membershipCapability';

const ready = AccountOnboardingStatus.READY;

function decide(
  overrides: Partial<CapabilityPolicyContext> = {}
): ReturnType<typeof evaluateCapabilityPolicy> {
  return evaluateCapabilityPolicy({
    accountKind: AccountKind.PERSON,
    administratorDesignation: false,
    membershipStatus: MembershipStatus.ACTIVE,
    accountOnboardingStatus: ready,
    ...overrides,
  });
}

describe('WP6 Capability Policy matrix', () => {
  it.each([
    MembershipStatus.ACTIVE,
    MembershipStatus.PASSIVE,
  ])('grants current-member access to %s members', (membershipStatus) => {
    expect(decide({ membershipStatus }).capabilities).toEqual(
      expect.arrayContaining([
        Capability.AUTHENTICATED_ACCOUNT,
        Capability.CURRENT_MEMBER,
        Capability.MEMBERSHIP_SELF_SERVICE,
      ])
    );
  });

  it('grants active member Players both member and Player capabilities', () => {
    expect(
      decide({
        player: { type: PlayerType.MEMBER, isActivePlayer: true },
      }).capabilities
    ).toEqual(
      expect.arrayContaining([
        Capability.CURRENT_MEMBER,
        Capability.ACTIVE_PLAYER,
      ])
    );
  });

  it('denies inactive former members without another active responsibility', () => {
    expect(
      decide({ membershipStatus: MembershipStatus.INACTIVE }).capabilities
    ).toEqual([]);
  });

  it('grants active external Players only account and Player capabilities', () => {
    const decision = decide({
      membershipStatus: MembershipStatus.INACTIVE,
      player: { type: PlayerType.EXTERNAL, isActivePlayer: true },
    });
    expect(decision.capabilities).toEqual(
      expect.arrayContaining([
        Capability.AUTHENTICATED_ACCOUNT,
        Capability.ACTIVE_PLAYER,
        Capability.EXTERNAL_PLAYER,
      ])
    );
    expect(decision.capabilities).not.toContain(Capability.CURRENT_MEMBER);
    expect(decision.capabilities).not.toContain(
      Capability.MEMBERSHIP_SELF_SERVICE
    );
  });

  it('denies inactive external Players', () => {
    expect(
      decide({
        membershipStatus: MembershipStatus.INACTIVE,
        player: { type: PlayerType.EXTERNAL, isActivePlayer: false },
      }).capabilities
    ).toEqual([]);
  });

  it.each([
    MembershipStatus.ACTIVE,
    MembershipStatus.PASSIVE,
  ])('grants administration to designated current %s members', (membershipStatus) => {
    const decision = decide({
      administratorDesignation: true,
      membershipStatus,
    });
    expect(decision.capabilities).toEqual(
      expect.arrayContaining([
        Capability.ADMINISTRATION,
        Capability.AUTHENTICATED_ACCOUNT,
      ])
    );
  });

  it('grants only account and administration capabilities to Super Admin', () => {
    expect(
      decide({
        accountKind: AccountKind.SUPER_ADMIN,
        administratorDesignation: false,
        membershipStatus: undefined as never,
      }).capabilities
    ).toEqual([Capability.ADMINISTRATION, Capability.AUTHENTICATED_ACCOUNT]);
  });

  it('denies normal capabilities while onboarding is incomplete', () => {
    expect(
      decide({
        accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
      }).capabilities
    ).toEqual([]);
  });

  it.each([
    {
      context: {
        membershipStatus: MembershipStatus.ACTIVE,
        player: { type: PlayerType.EXTERNAL, isActivePlayer: true },
      },
      contradiction:
        CapabilityPolicyContradiction.CURRENT_MEMBER_WITH_EXTERNAL_PLAYER,
    },
    {
      context: {
        membershipStatus: MembershipStatus.INACTIVE,
        player: { type: PlayerType.MEMBER, isActivePlayer: true },
      },
      contradiction:
        CapabilityPolicyContradiction.INACTIVE_MEMBER_WITH_ACTIVE_MEMBER_PLAYER,
    },
  ])('fails closed for $contradiction', ({ context, contradiction }) => {
    const decision = decide(context);
    expect(decision.capabilities).toEqual([]);
    expect(decision.contradictions).toContain(contradiction);
  });
});
