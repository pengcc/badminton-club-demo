import { z } from 'zod';
import { UserRole } from '../core/enums';

/**
 * Core auth domain types - pure business logic without infrastructure concerns
 */
export namespace Domain {
  // Base user related types
  export interface AuthCredentials {
    email: string;
    password: string;
  }

  export interface TokenPayload {
    sub: string;
    role: UserRole;
    exp?: number;
  }

  export interface AuthenticatedUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName?: string;              // COMPUTED: "lastName, firstName"
    role: UserRole;
    membershipStatus?: string;
    membershipType?: string;
  }

  // Response types
  export interface AuthResponse {
    token: string;
    user: AuthenticatedUser;
  }

  // Session related types
  export interface AuthSession {
    isAuthenticated: boolean;
    user: AuthenticatedUser | null;
  }

  // View layer specific types
  export interface AuthResponseView extends AuthResponse {}
  export interface AuthSessionView extends AuthSession {}

  // Metadata
  export interface AuthMetadata {
    lastLogin?: Date;
    passwordChangedAt?: Date;
    failedLoginAttempts: number;
    lockoutUntil?: Date;
  }
}

// Define individual schemas first to avoid circular references
const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(100)
});

const authenticatedUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  role: z.enum(UserRole),
  membershipStatus: z.string().optional(),
  membershipType: z.string().optional()
});

const tokenPayloadSchema = z.object({
  sub: z.string(),
  role: z.enum(UserRole),
  exp: z.number().optional()
});

const authResponseSchema = z.object({
  token: z.string(),
  user: authenticatedUserSchema
});

const authSessionSchema = z.object({
  isAuthenticated: z.boolean(),
  user: authenticatedUserSchema.nullable()
});

const authMetadataSchema = z.object({
  lastLogin: z.date().optional(),
  passwordChangedAt: z.date().optional(),
  failedLoginAttempts: z.number(),
  lockoutUntil: z.date().optional()
});

/**
 * Auth validation schemas
 */
export const AuthSchema = {
  credentials: credentialsSchema,
  authenticatedUser: authenticatedUserSchema,
  tokenPayload: tokenPayloadSchema,
  authResponse: authResponseSchema,
  authSession: authSessionSchema,
  metadata: authMetadataSchema
} as const;

// Type inference helpers
export type AuthCredentials = z.infer<typeof credentialsSchema>;
export type TokenPayload = z.infer<typeof tokenPayloadSchema>;
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type AuthMetadata = z.infer<typeof authMetadataSchema>;

