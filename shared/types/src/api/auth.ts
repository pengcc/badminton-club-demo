import type { Domain } from '../domain/auth';

/**
 * API request/response types for authentication endpoints
 */
export namespace Api {
  // Re-export User type from Domain
  export interface User extends Domain.AuthenticatedUser {}

  // Request types
  export interface LoginRequest extends Domain.AuthCredentials {}
  export interface RegisterRequest extends Domain.AuthCredentials {
    name: string;
    dateOfBirth: string;
    gender: string;
  }
  export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
  }
  export interface RefreshRequest {
    refreshToken: string;
  }

  // Response types
  export interface LoginResponse {
    token: string;
    refreshToken?: string;
    user: User;
  }
  export interface RegisterResponse extends Domain.AuthResponse {}
  export interface ChangePasswordResponse {
    success: boolean;
    message: string;
  }
  export interface RefreshResponse {
    token: string;
    refreshToken: string;
  }

  // Error types
  export interface AuthError {
    message: string;
    code: string;
    field?: string;
  }
}