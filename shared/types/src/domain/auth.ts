import { z } from 'zod';
import { AccountKind, Capability } from '../core/enums';

/**
 * Core auth domain types - pure business logic without infrastructure concerns
 */
export namespace Domain {
  // Base user related types
  export interface AuthCredentials {
    email: string;
    password: string;
  }

  export interface AuthenticatedUser {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    name: string;
    fullName?: string; // COMPUTED: "lastName, firstName"
    accountKind: AccountKind;
    capabilities: Capability[];
    playerId?: string;
    membershipStatus?: string;
    membershipType?: string;
    demoMode?: boolean;
  }

  // Response types
  export interface AuthResponse {
    user: AuthenticatedUser;
  }

  // Session related types
  export interface AuthSession {
    isAuthenticated: boolean;
    user: AuthenticatedUser | null;
  }

  // View layer specific types
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
  password: z.string().min(8).max(100),
});

const authenticatedUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  accountKind: z.enum(AccountKind),
  capabilities: z.array(z.enum(Capability)),
  playerId: z.string().optional(),
  membershipStatus: z.string().optional(),
  membershipType: z.string().optional(),
  demoMode: z.boolean().optional(),
});

const authResponseSchema = z.object({
  user: authenticatedUserSchema,
});

const authSessionSchema = z.object({
  isAuthenticated: z.boolean(),
  user: authenticatedUserSchema.nullable(),
});

const authMetadataSchema = z.object({
  lastLogin: z.date().optional(),
  passwordChangedAt: z.date().optional(),
  failedLoginAttempts: z.number(),
  lockoutUntil: z.date().optional(),
});

/**
 * Auth validation schemas
 */
export const AuthSchema = {
  credentials: credentialsSchema,
  authenticatedUser: authenticatedUserSchema,
  authResponse: authResponseSchema,
  authSession: authSessionSchema,
  metadata: authMetadataSchema,
} as const;

// Type inference helpers
export type AuthCredentials = z.infer<typeof credentialsSchema>;
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type AuthMetadata = z.infer<typeof authMetadataSchema>;
