import apiClient from './client';
import axios from 'axios';
import type { Api } from '@club/shared-types/api/auth';

/**
 * Authentication API module
 * Handles all authentication-related HTTP requests with full type safety
 */

/**
 * Login with email and password
 */
export type LoginFailureKind =
  | 'invalid_credentials'
  | 'sign_in_denied'
  | 'unavailable';

export class LoginFailure extends Error {
  constructor(readonly kind: LoginFailureKind) {
    super('Login failed');
    this.name = 'LoginFailure';
  }
}

export const login = async (
  credentials: Api.LoginRequest
): Promise<Api.LoginResponse> => {
  try {
    const response = await apiClient.post<{
      success: boolean;
      user: Api.User;
    }>('/auth/login', credentials);
    return { user: response.data.user };
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : undefined;

    if (status === 401) {
      throw new LoginFailure('invalid_credentials');
    }
    if (status === 403) {
      throw new LoginFailure('sign_in_denied');
    }
    throw new LoginFailure('unavailable');
  }
};

/**
 * Resolve the current server-recognized session.
 */
export const verifySession = async (
  signal?: AbortSignal
): Promise<Api.User> => {
  const response = await apiClient.get<{ success: boolean; user: Api.User }>(
    '/auth/verify',
    { signal }
  );
  return response.data.user;
};

/**
 * Logout user (invalidate session)
 */
export const logout = async (): Promise<void> => {
  await apiClient.post('/auth/logout');
};

/**
 * Change user password
 */
export const changePassword = async (
  data: Api.ChangePasswordRequest
): Promise<void> => {
  await apiClient.patch('/auth/password', data);
};

export const setupPassword = async (
  data: Api.PasswordSetupRequest
): Promise<void> => {
  await apiClient.post<Api.PasswordSetupResponse>('/auth/password-setup', data);
};

export const getPasswordSetupStatus = async (
  token: string
): Promise<boolean> => {
  const response = await apiClient.post<{
    success: true;
    data: Api.PasswordCredentialStatusResponse;
  }>('/auth/password-setup/status', { token });
  return response.data.data.usable;
};

export const requestPasswordRecovery = async (
  data: Api.PasswordRecoveryRequest
): Promise<void> => {
  await apiClient.post<Api.PasswordRecoveryRequestResponse>(
    '/auth/password-recovery/request',
    data
  );
};

export const getPasswordRecoveryStatus = async (
  token: string
): Promise<boolean> => {
  const response = await apiClient.post<{
    success: true;
    data: Api.PasswordCredentialStatusResponse;
  }>('/auth/password-recovery/status', { token });
  return response.data.data.usable;
};

export const resetRecoveredPassword = async (
  data: Api.PasswordRecoveryResetRequest
): Promise<void> => {
  await apiClient.post<Api.PasswordRecoveryResetResponse>(
    '/auth/password-recovery/reset',
    data
  );
};
