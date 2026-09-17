import { describe, expect, it } from 'vitest';
import {
  AccountOnboardingStatus,
  MemberApplicationStatus,
  MembershipStatus,
  PlayerType,
} from '../enums';
import { PlayerSchema } from '../../domain/player';
import type { CapabilityPolicyContext } from '../../domain/membership';
import { UserSchema } from '../../domain/user';
import { membershipApplicationSchema } from '../../domain/membershipApplication';
import { directMemberEstablishmentSchema } from '../../schemas/accountOnboarding';
import { updateUserSchema } from '../../schemas/user';

const application = {
  id: '00000000-0000-4000-8000-000000000001',
  verifiedEmail: 'ada@example.test',
  personalInfo: {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.test',
    phone: '+491234567890',
    dateOfBirth: '1990-01-01',
    gender: 'female',
    address: {
      street: 'Test 1',
      city: 'Berlin',
      postalCode: '10115',
      country: 'Deutschland',
    },
  },
  membershipType: 'regular' as const,
  bankingSummary: { present: false, complete: false },
  status: MemberApplicationStatus.PENDING,
  studentProof: [],
  applicantDataUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('WP4 membership model contract', () => {
  it('keeps pending outside the current membership vocabulary', () => {
    expect(Object.values(MembershipStatus)).toEqual([
      'active',
      'passive',
      'inactive',
    ]);
    expect(Object.values(MembershipStatus)).not.toContain('pending');
    expect(membershipApplicationSchema.parse(application).status).toBe(
      MemberApplicationStatus.PENDING
    );
  });

  it.each(
    Object.values(MembershipStatus)
  )('rejects generic profile writes for membership value %s', (membershipStatus) => {
    expect(() => updateUserSchema.parse({ membershipStatus })).toThrow();
  });

  it('rejects legacy/invalid membership writes and independent isPlayer writes', () => {
    expect(() =>
      updateUserSchema.parse({ membershipStatus: 'pending' })
    ).toThrow();
    expect(() =>
      updateUserSchema.parse({ membershipStatus: 'archived' })
    ).toThrow();
    expect(() =>
      directMemberEstablishmentSchema.parse({
        ...application.personalInfo,
        targetKind: 'member',
        establishPlayer: false,
        initialMembershipStatus: MembershipStatus.ACTIVE,
        isPlayer: false,
      })
    ).toThrow();
    expect(() => updateUserSchema.parse({ isPlayer: true })).toThrow();
  });

  it.each([
    { name: 'Legacy Name' },
    { email: 'replacement@example.test' },
    { accountKind: 'super_admin' },
  ])('rejects stale generic User mutation fields: %j', (input) => {
    expect(() => updateUserSchema.parse(input)).toThrow();
  });

  it('accepts bounded Person Profile updates and explicit optional clears', () => {
    expect(
      updateUserSchema.parse({
        firstName: '李',
        lastName: "D'Angelo-Smith",
        dateOfBirth: '2000-02-29',
        phone: null,
        address: null,
      })
    ).toEqual({
      firstName: '李',
      lastName: "D'Angelo-Smith",
      dateOfBirth: '2000-02-29',
      phone: null,
      address: null,
    });
  });

  it('rejects impossible and future Person birth dates', () => {
    expect(
      updateUserSchema.safeParse({ dateOfBirth: '2025-02-29' }).success
    ).toBe(false);
    expect(
      updateUserSchema.safeParse({
        dateOfBirth: `${new Date().getFullYear() + 1}-01-01`,
      }).success
    ).toBe(false);
  });

  it.each(
    Object.values(PlayerType)
  )('accepts Player type %s on new Player contracts', (type) => {
    const result = PlayerSchema.create.parse({
      userId: '00000000-0000-4000-8000-000000000002',
      type,
    });
    expect(result.type).toBe(type);
  });

  it('rejects invalid or missing Player types', () => {
    expect(() =>
      PlayerSchema.create.parse({
        userId: '00000000-0000-4000-8000-000000000002',
        type: 'guest',
      })
    ).toThrow();
    expect(() =>
      PlayerSchema.player.parse({
        userId: '00000000-0000-4000-8000-000000000002',
        singlesRanking: 0,
        doublesRanking: 0,
        isActivePlayer: true,
        teamIds: [],
      })
    ).toThrow();
  });

  it('keeps onboarding, membership, and Player state as separate contracts', () => {
    const context: CapabilityPolicyContext = {
      accountKind: 'person' as never,
      administratorDesignation: false,
      membershipStatus: MembershipStatus.INACTIVE,
      accountOnboardingStatus: AccountOnboardingStatus.READY,
      player: { type: PlayerType.EXTERNAL, isActivePlayer: true },
    };
    expect(context).toEqual(
      expect.objectContaining({ membershipStatus: MembershipStatus.INACTIVE })
    );
  });

  it('rejects pending in canonical domain schemas', () => {
    const canonicalUser = {
      id: '00000000-0000-4000-8000-000000000003',
      email: 'canonical@example.test',
      firstName: 'Canonical',
      lastName: 'Member',
      gender: 'female',
      dateOfBirth: '1990-01-01',
      accountKind: 'person',
      administratorDesignation: false,
      membershipStatus: 'pending',
      accountOnboardingStatus: AccountOnboardingStatus.READY,
      isPlayer: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    expect(() => UserSchema.core.parse(canonicalUser)).toThrow();
  });
});
