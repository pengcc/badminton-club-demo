import { describe, expect, it } from 'vitest';
import {
  AccountKind,
  AccountOnboardingStatus,
  Gender,
  MembershipStatus,
} from '../enums';
import { evaluateCapabilityPolicy } from '../../domain/membershipCapability';
import { accountEstablishmentSchema } from '../../schemas/accountOnboarding';
import { AccountOnboardingTargetKind } from '../../domain/accountOnboarding';
import { UserSchema } from '../../domain/user';

describe('account onboarding contract', () => {
  it.each([
    AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
    AccountOnboardingStatus.PASSWORD_SETUP_EXPIRED,
  ])('denies capabilities for %s', (accountOnboardingStatus) => {
    expect(
      evaluateCapabilityPolicy({
        accountKind: AccountKind.PERSON,
        administratorDesignation: false,
        membershipStatus: MembershipStatus.ACTIVE,
        accountOnboardingStatus,
      }).capabilities
    ).toEqual([]);
  });

  const identity = {
    email: 'new.person@example.test',
    firstName: 'New',
    lastName: 'Person',
    dateOfBirth: '1990-01-01',
    gender: Gender.FEMALE,
  };

  it.each([
    [MembershipStatus.ACTIVE, false],
    [MembershipStatus.ACTIVE, true],
    [MembershipStatus.PASSIVE, false],
    [MembershipStatus.PASSIVE, true],
  ] as const)('preserves %s Member establishment with establishPlayer=%s', (initialMembershipStatus, establishPlayer) => {
    expect(
      accountEstablishmentSchema.parse({
        ...identity,
        targetKind: AccountOnboardingTargetKind.MEMBER,
        initialMembershipStatus,
        establishPlayer,
      })
    ).toMatchObject({
      initialMembershipStatus,
      establishPlayer,
      setupLocale: 'de',
      sendPasswordSetupEmailNow: false,
    });
  });

  it('accepts only the fixed External Player intent', () => {
    expect(
      accountEstablishmentSchema.parse({
        ...identity,
        targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
        establishPlayer: true,
      })
    ).toMatchObject({
      targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
      establishPlayer: true,
      setupLocale: 'de',
    });

    expect(
      accountEstablishmentSchema.parse({
        ...identity,
        targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
        establishPlayer: true,
        setupLocale: 'zh',
      })
    ).toMatchObject({ setupLocale: 'zh' });

    expect(() =>
      accountEstablishmentSchema.parse({
        ...identity,
        targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
        establishPlayer: false,
      })
    ).toThrow();
  });

  it.each([
    { role: 'admin' },
    { teamIds: ['team-1'] },
    { singlesRanking: 100 },
    { isActivePlayer: true },
  ])('rejects client-owned fields: %j', (extra) => {
    expect(() =>
      accountEstablishmentSchema.parse({
        ...identity,
        targetKind: AccountOnboardingTargetKind.MEMBER,
        establishPlayer: false,
        initialMembershipStatus: MembershipStatus.ACTIVE,
        ...extra,
      })
    ).toThrow();
  });

  it('discriminates required person facts from a personless Super Admin', () => {
    const common = {
      id: 'user-1',
      email: 'operator@example.test',
      accountOnboardingStatus: AccountOnboardingStatus.READY,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(
      UserSchema.core.parse({
        ...common,
        accountKind: AccountKind.SUPER_ADMIN,
        administratorDesignation: false,
        isPlayer: false,
      })
    ).not.toHaveProperty('membershipStatus');
    expect(() =>
      UserSchema.core.parse({
        ...common,
        accountKind: AccountKind.PERSON,
        administratorDesignation: false,
        membershipStatus: MembershipStatus.ACTIVE,
        isPlayer: false,
      })
    ).toThrow();
  });
});
