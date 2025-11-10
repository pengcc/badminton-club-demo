import type { Domain } from '@club/shared-types/domain/user';
import type { Persistence } from '../types/persistence/user';
import type { Api } from '@club/shared-types/api/user';
import type { BaseDocument } from '../types/persistence/base';

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
    return {
      id: doc._id.toString(),
      email: doc.email,
      firstName: doc.firstName,
      lastName: doc.lastName,
      phone: doc.phone,
      gender: doc.gender,
      dateOfBirth: doc.dateOfBirth,
      role: doc.role,
      membershipStatus: doc.membershipStatus,
      isPlayer: doc.isPlayer,
      address: doc.address,
      // Timestamps
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }

  /**
   * Transform Domain.User to Persistence.UserDocument (for creation/update)
   * Converts string to ObjectId for persistence layer
   * Note: This returns a partial document without _id (for creation)
   */
  static toPersistence(
    user: Omit<Domain.User, 'id' | 'createdAt' | 'updatedAt'>
  ): Omit<Persistence.UserDocument, keyof BaseDocument> {
    return {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      role: user.role,
      membershipStatus: user.membershipStatus,
      isPlayer: user.isPlayer,
      address: user.address
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
  static toApi(user: Domain.User, _options?: {
    includePlayerInfo?: boolean;
    teamCount?: number;
    matchCount?: number;
  }): Api.UserResponse {
    // Compute fullName: "Lastname, Firstname"
    const fullName = `${user.lastName}, ${user.firstName}`;

    const response: Api.UserResponse = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: fullName,
      phone: user.phone,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      role: user.role,
      membershipStatus: user.membershipStatus,
      isPlayer: user.isPlayer,
      address: user.address,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };

    return response;
  }

  /**
   * Transform Api.CreateUserRequest to Domain.User (partial)
   * Converts ISO string to Date
   * Note: Returns partial user data for creation
   */
  static fromCreateRequest(
    request: Api.CreateUserRequest
  ): Omit<Domain.User, 'id' | 'createdAt' | 'updatedAt' | 'membershipStatus'> {
    return {
      email: request.email,
      firstName: request.firstName,
      lastName: request.lastName,
      phone: request.phone,
      gender: request.gender as any,
      dateOfBirth: request.dateOfBirth,
      role: request.role as any,
      isPlayer: request.isPlayer ?? false,
      address: request.address
    };
  }

  /**
   * Transform Api.UpdateUserRequest to partial Domain.User
   * Handles partial updates
   */
  static fromUpdateRequest(
    request: Api.UpdateUserRequest
  ): Partial<Omit<Domain.User, 'id' | 'createdAt' | 'updatedAt'>> {
    const update: Partial<Omit<Domain.User, 'id' | 'createdAt' | 'updatedAt'>> = {};

    if (request.email !== undefined) update.email = request.email;
    if (request.firstName !== undefined) update.firstName = request.firstName;
    if (request.lastName !== undefined) update.lastName = request.lastName;
    if (request.phone !== undefined) update.phone = request.phone;
    if (request.gender !== undefined) update.gender = request.gender as any;
    if (request.dateOfBirth !== undefined) update.dateOfBirth = request.dateOfBirth;
    if (request.role !== undefined) update.role = request.role as any;
    if (request.membershipStatus !== undefined) update.membershipStatus = request.membershipStatus as any;
    if (request.isPlayer !== undefined) update.isPlayer = request.isPlayer;
    if (request.address !== undefined) update.address = request.address;

    return update;
  }
}
