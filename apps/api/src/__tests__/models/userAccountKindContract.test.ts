import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  AccountKind,
  AccountOnboardingStatus,
  Gender,
  MembershipStatus,
} from '@club/shared-types/core/enums';
import {
  User,
  type IUser,
  type PersonUserDocument,
  type SuperAdminUserDocument,
} from '../../models/User';

type NarrowedPerson = Extract<IUser, { accountKind: AccountKind.PERSON }>;
type NarrowedSuperAdmin = Extract<
  IUser,
  { accountKind: AccountKind.SUPER_ADMIN }
>;

describe('Mongoose User account-kind contract', () => {
  it('exposes person facts only on the narrowed person document', () => {
    expectTypeOf<IUser['firstName']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<IUser['membershipStatus']>().toEqualTypeOf<
      MembershipStatus | undefined
    >();
    expectTypeOf<NarrowedPerson>().toEqualTypeOf<PersonUserDocument>();
    expectTypeOf<NarrowedPerson['firstName']>().toEqualTypeOf<string>();
    expectTypeOf<
      NarrowedPerson['membershipStatus']
    >().toEqualTypeOf<MembershipStatus>();
    expectTypeOf<NarrowedSuperAdmin>().toEqualTypeOf<SuperAdminUserDocument>();
    expectTypeOf<NarrowedSuperAdmin['firstName']>().toEqualTypeOf<undefined>();
    expectTypeOf<
      NarrowedSuperAdmin['membershipStatus']
    >().toEqualTypeOf<undefined>();
  });

  it('accepts a personless Super Admin and rejects person facts on it', async () => {
    const valid = new User({
      email: 'operator@example.test',
      accountKind: AccountKind.SUPER_ADMIN,
      administratorDesignation: false,
      isPlayer: false,
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
    });
    await expect(valid.validate()).resolves.toBeUndefined();

    const invalid = new User({
      email: 'invalid-operator@example.test',
      accountKind: AccountKind.SUPER_ADMIN,
      firstName: 'Invalid',
      administratorDesignation: false,
      isPlayer: false,
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
    } as never);
    await expect(invalid.validate()).rejects.toThrow(
      'Super Admin cannot contain person, Membership, or Player facts'
    );
  });

  it('requires the canonical person identity and Membership facts', async () => {
    const incomplete = new User({
      email: 'incomplete@example.test',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      isPlayer: false,
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
    } as never);
    await expect(incomplete.validate()).rejects.toThrow(/required/);

    const complete = new User({
      email: 'person@example.test',
      accountKind: AccountKind.PERSON,
      firstName: 'Valid',
      lastName: 'Person',
      gender: Gender.NON_BINARY,
      dateOfBirth: '1990-01-01',
      membershipStatus: MembershipStatus.ACTIVE,
      administratorDesignation: false,
      isPlayer: false,
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
    });
    await expect(complete.validate()).resolves.toBeUndefined();
  });
});
