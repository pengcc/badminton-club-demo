import type { Api } from '../api/user';
import { z } from 'zod';
import type { MembershipStatus} from '../core/enums';
import { UserRole } from '../core/enums';

/**
 * View layer types for User components
 */
export namespace UserView {
  // Base user display type

  // User card for list views
  export interface UserCard extends Api.UserResponse {
    avatarUrl?: string;
  }

  // User profile for detail view
  export interface UserProfile {
    contactInfo: {
      email: string;
      phone?: string;
      address?: string;
    };
    activity: {
      joinDate: string;
      lastActive: string;
      memberSince: string;
    };
  }

  // Form data for create/edit
  export interface UserFormData {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    gender: string;
    dateOfBirth: string;
    role: UserRole;
    membershipStatus: MembershipStatus;
    isPlayer: boolean;
    address?: {
      street: string;
      city: string;
      postalCode: string;
      country: string;
    };
  }

  // User filter state
  export interface UserListState {
    items: UserCard[];
    filters: {
      role?: UserRole;
      membershipStatus?: MembershipStatus;
      isPlayer?: boolean;
      search?: string;
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    isLoading: boolean;
    error?: string;
  }
}

/**
 * Form validation schemas
 */
export const ViewSchemas = {
  userForm: z.object({
    email: z.email(),
    name: z.string().min(2).max(100),
    phone: z.string().optional(),
    gender: z.string(),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    role: z.enum(UserRole),
    isPlayer: z.boolean(),
    address: z.object({
      street: z.string(),
      city: z.string(),
      postalCode: z.string(),
      country: z.string()
    }).optional()
  })
};