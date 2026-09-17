import type { Domain } from '@club/shared-types/domain/user';
import {
  AccountKind,
  AccountOnboardingStatus,
  MembershipStatus,
} from '@club/shared-types/core/enums';
import type { BaseDocument } from './base';
import type { Types } from 'mongoose';

/**
 * Persistence layer types for User
 * Converts Domain.User to database-specific format
 */
export namespace Persistence {
  interface UserPersistenceFields {
    accountOnboardingStatus: AccountOnboardingStatus;
    resetPasswordToken?: string;
    resetPasswordExpire?: Date;
    passwordRecoveryTokenDigest?: string;
    passwordRecoveryExpiresAt?: Date;
  }

  export type PersonUserDocument = Omit<
    Domain.PersonUserCore,
    'id' | 'createdAt' | 'updatedAt' | 'accountSuspension'
  > &
    BaseDocument &
    UserPersistenceFields & {
      accountSuspension?: {
        reason: string;
        suspendedAt: Date;
        suspendedBy: Types.ObjectId;
      };
    };

  export type SuperAdminUserDocument = Omit<
    Domain.SuperAdminUserCore,
    'id' | 'createdAt' | 'updatedAt'
  > &
    BaseDocument &
    UserPersistenceFields;

  export type UserDocument = PersonUserDocument | SuperAdminUserDocument;
}

/**
 * Type guards for User persistence layer
 */
export const isPersistenceUser = (
  value: unknown
): value is Persistence.UserDocument => {
  if (
    !(
      typeof value === 'object' &&
      value !== null &&
      '_id' in value &&
      'createdAt' in value &&
      'updatedAt' in value &&
      'email' in value &&
      'accountKind' in value &&
      'administratorDesignation' in value &&
      'isPlayer' in value &&
      'accountOnboardingStatus' in value
    )
  ) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.accountKind === AccountKind.SUPER_ADMIN) {
    return (
      candidate.administratorDesignation === false &&
      candidate.isPlayer === false &&
      !('firstName' in candidate) &&
      !('lastName' in candidate) &&
      !('gender' in candidate) &&
      !('dateOfBirth' in candidate) &&
      !('membershipStatus' in candidate)
    );
  }

  return (
    candidate.accountKind === AccountKind.PERSON &&
    typeof candidate.firstName === 'string' &&
    typeof candidate.lastName === 'string' &&
    typeof candidate.gender === 'string' &&
    typeof candidate.dateOfBirth === 'string' &&
    typeof candidate.administratorDesignation === 'boolean' &&
    typeof candidate.isPlayer === 'boolean' &&
    Object.values(MembershipStatus).includes(
      candidate.membershipStatus as MembershipStatus
    )
  );
};
