import type { Api } from '../../api/user';
import type { UserView } from '../user';
import { MembershipStatus, UserRole, Gender } from '../../core/enums';
import type { WithStringId, WithTimestamp } from '../../core/typeUtils';

/**
 * Helper functions to transform between API and view layer types
 */
export const UserViewTransformers = {
  /**
   * Transform API response to user card view
   */
  toUserCard(user: Api.UserResponse & WithStringId): UserView.UserCard {
    return {
      ...user,
      avatarUrl: `/images/avatars/${user.id}.jpg`
    };
  },

  /**
   * Transform API response to user profile view
   */
  toUserProfile(user: Api.UserResponse & WithStringId & WithTimestamp): UserView.UserProfile {
    return {
      ...user,
      contactInfo: {
        email: user.email,
        phone: user.phone,
        address: user.address ? formatAddress(user.address) : undefined
      },
      activity: {
        joinDate: new Date(user.createdAt).toLocaleDateString(),
        lastActive: new Date(user.updatedAt).toLocaleDateString(),
        memberSince: new Date(user.createdAt).getFullYear().toString()
      }
    };
  },

  /**
   * Transform form data to create user request
   */
  toCreateRequest(formData: UserView.UserFormData): Api.CreateUserRequest {
    const { gender, role, ...rest } = formData;
    return {
      ...rest,
      gender: gender as Gender, // Validated by Zod schema
      role: role as UserRole    // Validated by Zod schema
    };
  },

  /**
   * Transform form data to update user request
   */
  toUpdateRequest(formData: Partial<UserView.UserFormData>): Api.UpdateUserRequest {
    const { gender, role, ...rest } = formData;
    return {
      ...rest,
      gender: gender as Gender | undefined,
      role: role as UserRole | undefined
    };
  }
};


function formatAddress(address: NonNullable<Api.UserResponse['address']>): string {
  return `${address.street}, ${address.city}, ${address.postalCode}, ${address.country}`;
}