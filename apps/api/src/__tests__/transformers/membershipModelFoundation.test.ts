import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { ZodError } from 'zod';
import {
  AccountOnboardingStatus,
  MembershipStatus,
  PlayerType,
  AccountKind,
  Capability,
} from '@club/shared-types/core/enums';
import {
  UserApiTransformer,
  UserPersistenceTransformer,
} from '../../transformers/user';
import {
  PlayerApiTransformer,
  PlayerPersistenceTransformer,
} from '../../transformers/player';
import { isPersistencePlayer } from '../../types/persistence/player';
import { isPersistenceUser } from '../../types/persistence/user';

const timestamp = new Date('2026-01-01T00:00:00.000Z');

describe('WP4 persistence and API transformers', () => {
  it('serializes Membership, Account suspension, and derived onboarding separately', () => {
    const suspendedBy = new Types.ObjectId('507f1f77bcf86cd799439011');
    const domain = UserPersistenceTransformer.toDomain({
      _id: new Types.ObjectId('507f1f77bcf86cd799439012'),
      email: 'transform@example.test',
      firstName: 'Transform',
      lastName: 'Tester',
      gender: 'female',
      dateOfBirth: '1990-01-01',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      displayName: 'Member',
      capabilities: [Capability.AUTHENTICATED_ACCOUNT],
      membershipStatus: MembershipStatus.ACTIVE,
      accountOnboardingStatus: AccountOnboardingStatus.READY,
      accountSuspension: {
        reason: 'Policy review',
        suspendedAt: timestamp,
        suspendedBy,
      },
      resetPasswordToken: 'must-not-be-serialized',
      resetPasswordExpire: new Date('2099-01-01T00:00:00.000Z'),
      isPlayer: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    } as never);
    const api = UserApiTransformer.toApi(domain);

    expect(api).toEqual(
      expect.objectContaining({
        membershipStatus: MembershipStatus.ACTIVE,
        accountSuspension: {
          reason: 'Policy review',
          suspendedAt: timestamp.toISOString(),
          suspendedBy: suspendedBy.toString(),
        },
        accountOnboardingStatus: AccountOnboardingStatus.READY,
        isPlayer: true,
      })
    );
    expect(JSON.stringify(api)).not.toContain('must-not-be-serialized');
  });

  it('rejects pending at the persistence-to-domain boundary', () => {
    expect(() =>
      UserPersistenceTransformer.toDomain({
        _id: new Types.ObjectId('507f1f77bcf86cd799439012'),
        email: 'legacy@example.test',
        firstName: 'Legacy',
        lastName: 'Tester',
        gender: 'female',
        dateOfBirth: '1990-01-01',
        accountKind: AccountKind.PERSON,
        administratorDesignation: false,
        displayName: 'Applicant',
        capabilities: [],
        membershipStatus: 'pending',
        isPlayer: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      } as never)
    ).toThrow(ZodError);
    expect(
      isPersistenceUser({
        _id: new Types.ObjectId(),
        createdAt: timestamp,
        updatedAt: timestamp,
        email: 'pending@example.test',
        name: 'Pending Tester',
        gender: 'female',
        accountKind: AccountKind.PERSON,
        administratorDesignation: false,
        displayName: 'Applicant',
        capabilities: [],
        membershipStatus: 'pending',
        isPlayer: false,
        dateOfBirth: '1990-01-01',
      })
    ).toBe(false);
  });

  it('recognizes personless Super Admin persistence and rejects incomplete person accounts', () => {
    const common = {
      _id: new Types.ObjectId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      email: 'operator@example.test',
      accountOnboardingStatus: AccountOnboardingStatus.READY,
      administratorDesignation: false,
      isPlayer: false,
    };

    expect(
      isPersistenceUser({
        ...common,
        accountKind: AccountKind.SUPER_ADMIN,
      })
    ).toBe(true);
    expect(
      isPersistenceUser({
        ...common,
        accountKind: AccountKind.PERSON,
        membershipStatus: MembershipStatus.ACTIVE,
      })
    ).toBe(false);
  });

  it('rejects noncanonical User discriminators and onboarding state', () => {
    const canonicalPerson = {
      _id: new Types.ObjectId('507f1f77bcf86cd799439012'),
      email: 'canonical@example.test',
      firstName: 'Canonical',
      lastName: 'Person',
      gender: 'female',
      dateOfBirth: '1990-01-01',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipStatus: MembershipStatus.ACTIVE,
      accountOnboardingStatus: AccountOnboardingStatus.READY,
      isPlayer: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    expect(() =>
      UserPersistenceTransformer.toDomain({
        ...canonicalPerson,
        accountKind: undefined,
      } as never)
    ).toThrow('invalid accountKind');
    expect(() =>
      UserPersistenceTransformer.toDomain({
        ...canonicalPerson,
        accountKind: 'legacy',
      } as never)
    ).toThrow('invalid accountKind');
    expect(() =>
      UserPersistenceTransformer.toDomain({
        ...canonicalPerson,
        accountOnboardingStatus: undefined,
      } as never)
    ).toThrow(ZodError);
    expect(() =>
      UserPersistenceTransformer.toDomain({
        ...canonicalPerson,
        firstName: '',
      } as never)
    ).toThrow(ZodError);

    expect(
      UserPersistenceTransformer.toDomain({
        _id: new Types.ObjectId('507f1f77bcf86cd799439013'),
        email: 'operator@example.test',
        accountKind: AccountKind.SUPER_ADMIN,
        accountOnboardingStatus: AccountOnboardingStatus.READY,
        administratorDesignation: false,
        isPlayer: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      } as never)
    ).toMatchObject({
      accountKind: AccountKind.SUPER_ADMIN,
      administratorDesignation: false,
      isPlayer: false,
    });
  });

  it('keeps password-reset state independent from onboarding', () => {
    const domain = UserPersistenceTransformer.toDomain({
      _id: new Types.ObjectId('507f1f77bcf86cd799439012'),
      email: 'reset@example.test',
      firstName: 'Reset',
      lastName: 'Tester',
      gender: 'female',
      dateOfBirth: '1990-01-01',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      displayName: 'Member',
      capabilities: [Capability.AUTHENTICATED_ACCOUNT],
      membershipStatus: MembershipStatus.ACTIVE,
      accountOnboardingStatus: AccountOnboardingStatus.READY,
      resetPasswordToken: 'password-reset-token',
      resetPasswordExpire: new Date('2020-01-01T00:00:00.000Z'),
      isPlayer: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    } as never);

    expect(domain.accountOnboardingStatus).toBe(AccountOnboardingStatus.READY);
    expect(domain.accountKind).toBe(AccountKind.PERSON);
    if (domain.accountKind !== AccountKind.PERSON) {
      throw new Error('Expected a person account');
    }
    expect(
      UserPersistenceTransformer.toPersistence({
        ...domain,
        membershipStatus: MembershipStatus.INACTIVE,
      })
    ).not.toHaveProperty('isPlayer');
  });

  it('round-trips Player subtype independently of eligibility', () => {
    const domain = PlayerPersistenceTransformer.toDomain({
      _id: new Types.ObjectId('507f1f77bcf86cd799439013'),
      userId: new Types.ObjectId('507f1f77bcf86cd799439012'),
      type: PlayerType.EXTERNAL,
      singlesRanking: 1,
      doublesRanking: 2,
      preferredPositions: [],
      isActivePlayer: false,
      teamIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    } as never);
    const api = PlayerApiTransformer.toApi(domain);
    const persisted = PlayerPersistenceTransformer.toPersistence({
      ...domain,
      type: PlayerType.MEMBER,
    });

    expect(api).toEqual(
      expect.objectContaining({
        type: PlayerType.EXTERNAL,
        isActivePlayer: false,
      })
    );
    expect(persisted.type).toBe(PlayerType.MEMBER);
    expect(persisted.isActivePlayer).toBe(false);
  });

  it('rejects missing Player type at persistence boundaries', () => {
    const playerWithoutType = {
      _id: new Types.ObjectId('507f1f77bcf86cd799439013'),
      userId: new Types.ObjectId('507f1f77bcf86cd799439012'),
      singlesRanking: 1,
      doublesRanking: 2,
      preferredPositions: [],
      isActivePlayer: true,
      teamIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    expect(isPersistencePlayer(playerWithoutType)).toBe(false);
    expect(() =>
      PlayerPersistenceTransformer.toDomain(playerWithoutType as never)
    ).toThrow('invalid type');
  });
});
