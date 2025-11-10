import { z } from 'zod';
import type { Domain } from '../../domain/auth';
import { BaseTransformer } from './base';
import { UserRole } from '../../core/enums';

/**
 * View layer transformer for auth data
 */
export class AuthTransformer extends BaseTransformer {
  /**
   * Transform login response for frontend display
   */
  static toLoginView(auth: { token: string; user: Domain.AuthenticatedUser }): Domain.AuthResponseView {
    return {
      token: auth.token,
      user: {
        id: auth.user.id,
        email: auth.user.email,
        firstName: auth.user.firstName,
        lastName: auth.user.lastName,
        fullName: auth.user.fullName,
        role: auth.user.role,
        membershipStatus: auth.user.membershipStatus || undefined,
        membershipType: auth.user.membershipType || undefined
      }
    };
  }

  /**
   * Transform user session for frontend state
   */
  static toSessionView(session: Domain.AuthSession): Domain.AuthSessionView {
    return {
      isAuthenticated: session.isAuthenticated,
      user: session.user ? {
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        fullName: session.user.fullName,
        role: session.user.role,
        membershipStatus: session.user.membershipStatus || undefined,
        membershipType: session.user.membershipType || undefined
      } : null
    };
  }
}

// View layer validation schemas
const userViewSchema = z.object({
  id: z.string(),
  email: z.email(),
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string().optional(),
  role: z.enum(UserRole),
  membershipStatus: z.string().optional(),
  membershipType: z.string().optional()
});

/**
 * View layer validation schemas
 */
export const AuthViewSchema = {
  login: z.object({
    token: z.string(),
    user: userViewSchema
  }),

  session: z.object({
    isAuthenticated: z.boolean(),
    user: userViewSchema.nullable()
  })
} as const;

// Type inference helpers
export type AuthLoginView = z.infer<typeof AuthViewSchema.login>;
export type AuthSessionView = z.infer<typeof AuthViewSchema.session>;