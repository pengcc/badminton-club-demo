import apiClient from './client';
import { ApiResponse } from './types';
import { Api } from '@club/shared-types/api/auth';

/**
 * Authentication API module
 * Handles all authentication-related HTTP requests with full type safety
 */

/**
 * Login with email and password
 */
export const login = async (
  credentials: Api.LoginRequest
): Promise<Api.LoginResponse> => {
  const response = await apiClient.post<{ success: boolean; token: string; user: Api.User }>('/auth/login', credentials);
  return {
    token: response.data.token,
    user: response.data.user
  };
};

/**
 * Register a new user account
 */
export const register = async (
  userData: Api.RegisterRequest
): Promise<Api.RegisterResponse> => {
  const response = await apiClient.post<Api.RegisterResponse>('/auth/register', userData);
  return response.data;
};

/**
 * Refresh authentication token
 * @param refreshToken - The refresh token
 */
export const refreshToken = async (refreshToken: string): Promise<Api.LoginResponse> => {
  const response = await apiClient.post<Api.LoginResponse>('/auth/refresh', { refreshToken });
  return response.data;
};

/**
 * Verify if the current token is valid and get user data
 */
export const verifyToken = async (): Promise<Api.User> => {
  const response = await apiClient.get<{ success: boolean; user: Api.User }>('/auth/verify');
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
