import type { Domain } from '../domain/auth';
import { z } from 'zod';

export const authenticationLocaleSchema = z.enum(['de', 'en', 'zh']);
export type AuthenticationLocale = z.infer<typeof authenticationLocaleSchema>;

export const passwordRecoveryRequestSchema = z
  .object({
    email: z.email(),
    locale: authenticationLocaleSchema,
  })
  .strict();

export const passwordCredentialStatusSchema = z
  .object({ ['token']: z.string().min(1).max(512) })
  .strict();

export const passwordRecoveryResetSchema = passwordCredentialStatusSchema
  .extend({
    ['password']: z.string().min(8),
    passwordConfirmation: z.string().min(8),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  });

export const administratorPasswordRecoverySchema = z
  .object({ locale: authenticationLocaleSchema.default('de') })
  .strict();

/**
 * API request/response types for authentication endpoints
 */
export namespace Api {
  // Re-export User type from Domain
  export interface User extends Domain.AuthenticatedUser {}

  // Request types
  export interface LoginRequest extends Domain.AuthCredentials {}
  export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
  }
  export interface PasswordSetupRequest {
    token: string;
    password: string;
    passwordConfirmation: string;
  }
  export interface PasswordSetupResponse {
    success: true;
    message: string;
  }
  export type PasswordRecoveryRequest = z.infer<
    typeof passwordRecoveryRequestSchema
  >;
  export type PasswordCredentialStatusRequest = z.infer<
    typeof passwordCredentialStatusSchema
  >;
  export type PasswordRecoveryResetRequest = z.infer<
    typeof passwordRecoveryResetSchema
  >;
  export type AdministratorPasswordRecoveryRequest = z.infer<
    typeof administratorPasswordRecoverySchema
  >;
  export interface PasswordCredentialStatusResponse {
    usable: boolean;
  }
  export interface PasswordRecoveryRequestResponse {
    success: true;
    message: string;
  }
  export interface PasswordRecoveryResetResponse {
    success: true;
    message: string;
  }
  export type PasswordRecoveryDeliveryStatus = 'sent' | 'failed' | 'uncertain';
  export interface AdministratorPasswordRecoveryResponse {
    deliveryStatus: PasswordRecoveryDeliveryStatus;
  }
  // Response types
  export interface LoginResponse {
    user: User;
  }
  export interface ChangePasswordResponse {
    success: boolean;
    message: string;
  }
  // Error types
  export interface AuthError {
    message: string;
    code: string;
    field?: string;
  }
}
