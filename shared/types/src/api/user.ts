import { z } from 'zod';
import { Domain, UserSchema } from '../domain/user';
import { UserRole, MembershipStatus } from '../core/enums';

/**
 * API layer types for User
 * Serializes Domain.User for transport (Date → ISO string)
 */
export namespace Api {
  // API response type - converts Date to ISO string
  export interface UserResponse {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string; // COMPUTED: "Lastname, Firstname"
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
    createdAt: string; // ISO string for JSON serialization
    updatedAt: string; // ISO string for JSON serialization
  }

  // List response
  export interface UserListResponse {
    items: UserResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }

  // Create request
  export interface CreateUserRequest {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    gender: string;
    dateOfBirth: string;
    role: string;
    isPlayer: boolean;
    address?: {
      street: string;
      city: string;
      postalCode: string;
      country: string;
    };
  }

  // Update request
  export interface UpdateUserRequest {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    gender?: string;
    dateOfBirth?: string;
    role?: string;
    membershipStatus?: string;
    isPlayer?: boolean;
    address?: {
      street: string;
      city: string;
      postalCode: string;
      country: string;
    };
  }

  // Query parameters
  export interface UserQueryParams {
    page?: number;
    limit?: number;
    role?: string;
    membershipStatus?: string;
    isPlayer?: boolean;
  }

  // URL parameters
  export interface UserUrlParams {
    id: string;
  }
}

/**
 * API validation schemas (extend domain schemas with transport-specific validation)
 */
export const ApiSchemas = {
  createUser: z.object({
    email: z.email(),
    name: z.string().min(2).max(100),
    phone: z.string().optional(),
    gender: z.string(),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    role: z.string(),
    isPlayer: z.boolean().optional(),
    address: z.object({
      street: z.string(),
      city: z.string(),
      postalCode: z.string(),
      country: z.string()
    }).optional()
  }).refine(
    (data) => {
      // Only members and guest players can be players
      if (data.isPlayer) {
        return ['member', 'guest_player'].includes(data.role);
      }
      return true;
    },
    { message: 'Only members and guest players can be players', path: ['isPlayer'] }
  ),

  updateUser: z.object({
    email: z.email().optional(),
    name: z.string().min(2).max(100).optional(),
    phone: z.string().optional(),
    gender: z.string().optional(),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    role: z.string().optional(),
    membershipStatus: z.string().optional(),
    isPlayer: z.boolean().optional(),
    address: z.object({
      street: z.string(),
      city: z.string(),
      postalCode: z.string(),
      country: z.string()
    }).optional()
  }),

  queryParams: z.object({
    page: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    role: z.string().optional(),
    membershipStatus: z.string().optional(),
    isPlayer: z.boolean().optional()
  }),

  urlParams: z.object({
    id: z.string()
  })
};