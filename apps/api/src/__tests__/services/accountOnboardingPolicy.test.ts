import { describe, expect, it } from 'vitest';
import {
  AccountOnboardingStatus,
  Gender,
  MembershipStatus,
  MembershipType,
  PlayerType,
  AccountKind,
  Capability,
} from '@club/shared-types/core/enums';
import {
  AccountOnboardingTargetKind,
  type AccountOnboardingUserState,
  type EstablishAccountCommand,
  type EstablishMemberCommand,
} from '@club/shared-types/domain/accountOnboarding';
import {
  ACCOUNT_ONBOARDING_FIELD_CLASSIFICATION,
  planAccountEstablishment,
} from '../../services/accountOnboardingPolicy';

const actor = {
  id: '507f1f77bcf86cd799439011',
  email: 'admin@example.test',
  accountKind: AccountKind.PERSON,
  displayName: 'Administrator',
  capabilities: [Capability.ADMINISTRATION],
};
const identity = {
  email: 'member@example.test',
  firstName: 'Ming',
  lastName: 'Li',
  dateOfBirth: '1990-01-01',
  gender: Gender.FEMALE,
  phone: '+49123456789',
};
const memberCommand: EstablishMemberCommand = {
  targetKind: AccountOnboardingTargetKind.MEMBER,
  establishPlayer: false,
  initialMembershipStatus: MembershipStatus.ACTIVE,
  identity,
  actor,
  source: { kind: 'administrator' },
  idempotencyKey: 'member-establishment',
};
const user: AccountOnboardingUserState = {
  id: '507f1f77bcf86cd799439012',
  ...identity,
  accountKind: AccountKind.PERSON,
  administratorDesignation: false,
  membershipStatus: MembershipStatus.INACTIVE,
  accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
};

describe('account onboarding compatibility policy', () => {
  it('classifies source fields before persistence orchestration', () => {
    expect(ACCOUNT_ONBOARDING_FIELD_CLASSIFICATION).toEqual({
      email: 'authoritative_lookup',
      firstName: 'identity_consistency',
      lastName: 'identity_consistency',
      dateOfBirth: 'identity_consistency',
      gender: 'mutable_profile',
      phone: 'optional_source_missing',
      address: 'optional_source_missing',
    });
  });

  it('creates an active Member without implicitly creating a Player', () => {
    expect(planAccountEstablishment(memberCommand, null, null)).toMatchObject({
      kind: 'establish',
      identityMode: 'create',
      membershipTransition: { to: MembershipStatus.ACTIVE },
      playerEligibility: undefined,
      setupRequired: true,
    });
  });

  it('reuses a compatible applicant and ignores mutable profile differences', () => {
    expect(
      planAccountEstablishment(
        {
          ...memberCommand,
          identity: { ...identity, gender: Gender.MALE, phone: '0123456789' },
        },
        user,
        null
      )
    ).toMatchObject({
      kind: 'establish',
      identityMode: 'reuse_applicant',
      membershipTransition: { to: MembershipStatus.ACTIVE },
    });
  });

  it('requires review for inconsistent identity facts and Super Admin collisions', () => {
    expect(
      planAccountEstablishment(
        {
          ...memberCommand,
          identity: { ...identity, dateOfBirth: '1991-01-01' },
        },
        user,
        null
      )
    ).toMatchObject({ kind: 'review_required' });
    expect(
      planAccountEstablishment(
        memberCommand,
        {
          id: user.id,
          email: user.email,
          accountKind: AccountKind.SUPER_ADMIN,
          administratorDesignation: false,
          accountOnboardingStatus: AccountOnboardingStatus.READY,
        },
        null
      )
    ).toMatchObject({ kind: 'review_required' });
  });

  it('preserves and converts an existing External Player for a no-new-Player Member request', () => {
    expect(
      planAccountEstablishment(memberCommand, user, {
        id: '507f1f77bcf86cd799439013',
        type: PlayerType.EXTERNAL,
        isActivePlayer: true,
      })
    ).toMatchObject({
      kind: 'establish',
      identityMode: 'reuse_external_player',
      membershipTransition: { convertExternalPlayerToMember: true },
    });
  });

  it('preserves a compatible existing Member Player without requesting a new one', () => {
    expect(
      planAccountEstablishment(
        { ...memberCommand, membershipType: MembershipType.REGULAR },
        {
          ...user,
          accountKind: AccountKind.PERSON,
          administratorDesignation: false,
          membershipStatus: MembershipStatus.ACTIVE,
          membershipType: MembershipType.REGULAR,
        },
        {
          id: '507f1f77bcf86cd799439013',
          type: PlayerType.MEMBER,
          isActivePlayer: true,
        }
      )
    ).toMatchObject({
      kind: 'establish',
      identityMode: 'reuse_member',
      playerEligibility: undefined,
    });
  });

  it.each([
    [MembershipType.REGULAR, MembershipType.REGULAR, 'establish'],
    [MembershipType.REGULAR, MembershipType.STUDENT, 'review_required'],
    [MembershipType.REGULAR, undefined, 'review_required'],
  ] as const)('compares requested Membership type %s with existing type %s', (requestedType, existingType, expectedKind) => {
    expect(
      planAccountEstablishment(
        { ...memberCommand, membershipType: requestedType },
        {
          ...user,
          accountKind: AccountKind.PERSON,
          administratorDesignation: false,
          membershipStatus: MembershipStatus.ACTIVE,
          membershipType: existingType,
        },
        null
      )
    ).toMatchObject({ kind: expectedKind });
  });

  it('supports External Player creation and compatible reuse only without Membership', () => {
    const command: EstablishAccountCommand = {
      targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
      establishPlayer: true,
      identity,
      actor,
      source: { kind: 'administrator' },
      idempotencyKey: 'external-establishment',
    };
    expect(planAccountEstablishment(command, null, null)).toMatchObject({
      kind: 'establish',
      playerEligibility: { type: PlayerType.EXTERNAL },
    });
    expect(
      planAccountEstablishment(
        command,
        {
          ...user,
          accountKind: AccountKind.PERSON,
          administratorDesignation: false,
          membershipStatus: MembershipStatus.ACTIVE,
        },
        null
      )
    ).toMatchObject({ kind: 'incompatible' });
  });
});
