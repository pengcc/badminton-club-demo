import { describe, expect, it } from 'vitest';
import {
  AccountOnboardingStatus,
  MembershipStatus,
  PlayerType,
  AccountKind,
  Capability,
} from '@club/shared-types/core/enums';
import { User } from '../../models/User';
import { Player } from '../../models/Player';

const validUser = {
  email: 'model@example.test',
  firstName: 'Model',
  lastName: 'Tester',
  gender: 'female',
  dateOfBirth: '1990-01-01',
  accountKind: AccountKind.PERSON,
  administratorDesignation: false,
  displayName: 'Member',
  capabilities: [Capability.AUTHENTICATED_ACCOUNT],
  password: 'ValidPassword1',
};

describe('WP4 Mongoose model foundation', () => {
  it('keeps the singleton Super Admin free of person, Membership, and Player facts', async () => {
    const principal = new User({
      email: 'operator@example.test',
      accountKind: AccountKind.SUPER_ADMIN,
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
    });
    await expect(principal.validate()).resolves.toBeUndefined();
    expect(principal.membershipStatus).toBeUndefined();
    expect(principal.administratorDesignation).toBe(false);
    expect(principal.isPlayer).toBe(false);

    await expect(
      new User({
        email: 'invalid-operator@example.test',
        accountKind: AccountKind.SUPER_ADMIN,
        firstName: 'Not',
        accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
      }).validate()
    ).rejects.toThrow('Super Admin cannot contain person');

    expect(User.schema.indexes()).toContainEqual([
      { accountKind: 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: { accountKind: AccountKind.SUPER_ADMIN },
      }),
    ]);
  });

  it.each(
    Object.values(MembershipStatus)
  )('persists supported membership status %s', (membershipStatus) => {
    expect(
      new User({ ...validUser, membershipStatus }).validateSync()
    ).toBeUndefined();
  });

  it('rejects pending and defaults new Users to active', () => {
    const pending = new User({ ...validUser, membershipStatus: 'pending' });
    const current = new User(validUser);

    expect(pending.validateSync()?.errors.membershipStatus).toBeDefined();
    expect(current.membershipStatus).toBe(MembershipStatus.ACTIVE);
  });

  it('rejects invalid membership and validates Account suspension metadata shape', () => {
    expect(
      new User({ ...validUser, membershipStatus: 'archived' }).validateSync()
        ?.errors.membershipStatus
    ).toBeDefined();

    const suspended = new User({
      ...validUser,
      membershipStatus: MembershipStatus.ACTIVE,
      accountSuspension: {
        reason: 'Policy review',
        suspendedAt: new Date('2026-01-01T00:00:00.000Z'),
        suspendedBy: '507f1f77bcf86cd799439011',
      },
    });
    expect(suspended.validateSync()).toBeUndefined();
    expect(suspended.accountSuspension?.reason).toBe('Policy review');
    expect(
      new User({
        ...validUser,
        membershipStatus: MembershipStatus.ACTIVE,
        accountSuspension: { reason: 'Incomplete metadata' },
      }).validateSync()?.errors['accountSuspension.suspendedAt']
    ).toBeDefined();
  });

  it.each(
    Object.values(PlayerType)
  )('persists supported Player type %s', (type) => {
    expect(
      new Player({
        userId: '507f1f77bcf86cd799439011',
        type,
      }).validateSync()
    ).toBeUndefined();
  });

  it('requires an explicit valid Player type', () => {
    expect(
      new Player({ userId: '507f1f77bcf86cd799439011' }).validateSync()?.errors
        .type
    ).toBeDefined();
    expect(
      new Player({
        userId: '507f1f77bcf86cd799439011',
        type: 'temporary',
      }).validateSync()?.errors.type
    ).toBeDefined();
  });

  it('does not introduce a persisted accountStatus field', () => {
    expect(User.schema.path('accountStatus')).toBeUndefined();
  });

  it('persists setup-pending accounts without a usable password', () => {
    const pending = new User({
      ...validUser,
      password: undefined,
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
    });
    expect(pending.validateSync()).toBeUndefined();
    expect(pending.password).toBeUndefined();
  });

  it.each([
    new Date('2099-01-01T00:00:00.000Z'),
    new Date('2020-01-01T00:00:00.000Z'),
  ])('does not derive onboarding from password-reset expiry %s', async (expiry) => {
    const user = new User({
      ...validUser,
      resetPasswordToken: 'password-reset-token',
      resetPasswordExpire: expiry,
    });

    expect((await user.toView()).accountOnboardingStatus).toBe(
      AccountOnboardingStatus.READY
    );
  });
});
