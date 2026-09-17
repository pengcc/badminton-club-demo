import { UserSchema, type Domain } from '@club/shared-types/domain/user';
import type { Persistence } from '../types/persistence/user';
import type { Api } from '@club/shared-types/api/user';
import type { BaseDocument } from '../types/persistence/base';
import {
  AccountOnboardingStatus,
  AccountKind,
} from '@club/shared-types/core/enums';
import { Types } from 'mongoose';

/**
 * User Persistence ↔ Domain Transformers
 * Handles ObjectId ↔ string conversions and BaseDocument mapping
 */
export class UserPersistenceTransformer {
  /**
   * Transform Persistence.UserDocument to Domain.User
   * Converts ObjectId to string for domain layer
   */
  static toDomain(doc: Persistence.UserDocument): Domain.User {
    const base = {
      id: doc._id.toString(),
      email: doc.email,
      accountOnboardingStatus: doc.accountOnboardingStatus,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };

    if (doc.accountKind === AccountKind.SUPER_ADMIN) {
      const candidate = {
        ...base,
        accountKind: AccountKind.SUPER_ADMIN,
        administratorDesignation: doc.administratorDesignation,
        isPlayer: doc.isPlayer,
        ...('firstName' in doc ? { firstName: doc.firstName } : {}),
        ...('lastName' in doc ? { lastName: doc.lastName } : {}),
        ...('phone' in doc ? { phone: doc.phone } : {}),
        ...('gender' in doc ? { gender: doc.gender } : {}),
        ...('dateOfBirth' in doc ? { dateOfBirth: doc.dateOfBirth } : {}),
        ...('membershipStatus' in doc
          ? { membershipStatus: doc.membershipStatus }
          : {}),
        ...('accountSuspension' in doc
          ? { accountSuspension: doc.accountSuspension }
          : {}),
        ...('address' in doc ? { address: doc.address } : {}),
      };

      return UserSchema.user.parse(candidate);
    }

    if (doc.accountKind !== AccountKind.PERSON) {
      throw new Error('UserDocument has invalid accountKind');
    }

    const address = doc.address;
    const normalizedAddress =
      address &&
      [address.street, address.city, address.postalCode, address.country].some(
        (value) => value !== undefined
      )
        ? {
            street: address.street,
            city: address.city,
            postalCode: address.postalCode,
            country: address.country,
          }
        : undefined;

    const candidate = {
      ...base,
      accountKind: AccountKind.PERSON,
      firstName: doc.firstName,
      lastName: doc.lastName,
      phone: doc.phone,
      gender: doc.gender,
      dateOfBirth: doc.dateOfBirth,
      administratorDesignation: doc.administratorDesignation,
      membershipStatus: doc.membershipStatus,
      accountSuspension: doc.accountSuspension
        ? {
            reason: doc.accountSuspension.reason,
            suspendedAt: doc.accountSuspension.suspendedAt,
            suspendedBy: doc.accountSuspension.suspendedBy.toString(),
          }
        : undefined,
      accountOnboardingStatus: doc.accountOnboardingStatus,
      isPlayer: doc.isPlayer,
      address: normalizedAddress,
    };

    return UserSchema.user.parse(candidate);
  }

  /**
   * Transform Domain.User to Persistence.UserDocument (for creation/update)
   * Converts string to ObjectId for persistence layer
   * Note: This returns a partial document without _id (for creation)
   */
  static toPersistence(
    user:
      | Omit<Domain.PersonUserCore, 'id' | 'createdAt' | 'updatedAt'>
      | Omit<Domain.SuperAdminUserCore, 'id' | 'createdAt' | 'updatedAt'>
  ):
    | Omit<Persistence.PersonUserDocument, keyof BaseDocument | 'isPlayer'>
    | Omit<
        Persistence.SuperAdminUserDocument,
        keyof BaseDocument | 'isPlayer'
      > {
    if (user.accountKind === AccountKind.SUPER_ADMIN) {
      return {
        email: user.email,
        accountKind: AccountKind.SUPER_ADMIN,
        administratorDesignation: false,
        accountOnboardingStatus: user.accountOnboardingStatus,
      };
    }

    return {
      email: user.email,
      accountKind: AccountKind.PERSON,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      administratorDesignation: user.administratorDesignation,
      membershipStatus: user.membershipStatus,
      accountOnboardingStatus: user.accountOnboardingStatus,
      accountSuspension: user.accountSuspension
        ? {
            reason: user.accountSuspension.reason,
            suspendedAt: user.accountSuspension.suspendedAt,
            suspendedBy: new Types.ObjectId(user.accountSuspension.suspendedBy),
          }
        : undefined,
      address: user.address,
    };
  }
}

/**
 * User Domain ↔ API Transformers
 * Handles Date ↔ ISO string conversions and computed fields
 */
export class UserApiTransformer {
  /**
   * Transform Domain.User to Api.UserResponse
   * Converts Date to ISO string and adds computed fields
   */
  static toApi(
    user: Domain.User,
    _options?: {
      includePlayerInfo?: boolean;
      teamCount?: number;
      matchCount?: number;
    }
  ): Api.UserResponse {
    const base = {
      id: user.id,
      email: user.email,
      accountOnboardingStatus: user.accountOnboardingStatus,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    if (user.accountKind === AccountKind.SUPER_ADMIN) {
      return {
        ...base,
        accountKind: AccountKind.SUPER_ADMIN,
        fullName: 'Super Admin',
        administratorDesignation: false,
        isPlayer: false,
      };
    }

    return {
      ...base,
      accountKind: AccountKind.PERSON,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.lastName}, ${user.firstName}`,
      phone: user.phone,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      administratorDesignation: user.administratorDesignation,
      membershipStatus: user.membershipStatus,
      accountSuspension: user.accountSuspension
        ? {
            reason: user.accountSuspension.reason,
            suspendedAt: user.accountSuspension.suspendedAt.toISOString(),
            suspendedBy: user.accountSuspension.suspendedBy,
          }
        : undefined,
      isPlayer: user.isPlayer,
      address: user.address,
    };
  }

  /**
   * Transform Api.UpdateUserRequest to partial Domain.User
   * Handles partial updates
   */
  static fromUpdateRequest(
    request: Api.UpdateUserRequest
  ): Partial<Omit<Domain.PersonUserCore, 'id' | 'createdAt' | 'updatedAt'>> {
    const update: Partial<
      Omit<Domain.PersonUserCore, 'id' | 'createdAt' | 'updatedAt'>
    > = {};

    if (request.firstName !== undefined) update.firstName = request.firstName;
    if (request.lastName !== undefined) update.lastName = request.lastName;
    if (request.phone !== undefined) update.phone = request.phone ?? undefined;
    if (request.gender !== undefined) update.gender = request.gender as any;
    if (request.dateOfBirth !== undefined)
      update.dateOfBirth = request.dateOfBirth;
    if (request.address !== undefined)
      update.address = request.address ?? undefined;

    return update;
  }
}
