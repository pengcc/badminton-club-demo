import { describe, expect, it } from 'vitest';
import { Gender, MembershipStatus } from '../enums';
import { AccountOnboardingTargetKind } from '../../domain/accountOnboarding';
import {
  accountEstablishmentSchema,
  directMemberEstablishmentSchema,
} from '../../schemas/accountOnboarding';

const identity = {
  email: ' Member@Example.Test ',
  firstName: 'Ming',
  lastName: 'Li',
  dateOfBirth: '1990-01-01',
  gender: Gender.FEMALE,
};

describe('account establishment schema', () => {
  it('normalizes email and accepts both confirmed target kinds', () => {
    expect(
      accountEstablishmentSchema.parse({
        ...identity,
        targetKind: AccountOnboardingTargetKind.MEMBER,
        establishPlayer: false,
        initialMembershipStatus: MembershipStatus.PASSIVE,
      })
    ).toMatchObject({
      email: 'member@example.test',
      sendPasswordSetupEmailNow: false,
    });

    expect(
      accountEstablishmentSchema.parse({
        ...identity,
        targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
        establishPlayer: true,
      }).targetKind
    ).toBe(AccountOnboardingTargetKind.EXTERNAL_PLAYER);
  });

  it('accepts explicit immediate setup delivery only for Member intent', () => {
    expect(
      accountEstablishmentSchema.parse({
        ...identity,
        targetKind: AccountOnboardingTargetKind.MEMBER,
        establishPlayer: false,
        initialMembershipStatus: MembershipStatus.ACTIVE,
        sendPasswordSetupEmailNow: true,
      })
    ).toMatchObject({ sendPasswordSetupEmailNow: true });

    expect(() =>
      accountEstablishmentSchema.parse({
        ...identity,
        targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
        establishPlayer: true,
        sendPasswordSetupEmailNow: true,
      })
    ).toThrow();
  });

  it('rejects invalid target combinations and lifecycle states', () => {
    expect(() =>
      accountEstablishmentSchema.parse({
        ...identity,
        targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
        establishPlayer: false,
      })
    ).toThrow();
    expect(() =>
      accountEstablishmentSchema.parse({
        ...identity,
        targetKind: AccountOnboardingTargetKind.MEMBER,
        establishPlayer: false,
        initialMembershipStatus: 'suspended',
      })
    ).toThrow();
    expect(() =>
      accountEstablishmentSchema.parse({
        ...identity,
        targetKind: AccountOnboardingTargetKind.MEMBER,
        establishPlayer: false,
        initialMembershipStatus: MembershipStatus.ACTIVE,
        role: 'admin',
      })
    ).toThrow();
  });

  it('narrows the legacy direct Member request to Member without Player', () => {
    expect(() =>
      directMemberEstablishmentSchema.parse({
        ...identity,
        targetKind: AccountOnboardingTargetKind.MEMBER,
        establishPlayer: true,
        initialMembershipStatus: MembershipStatus.ACTIVE,
      })
    ).toThrow();
  });
});
