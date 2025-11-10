import apiClient from './client';
import type { ApiResponse, PaginatedResponse, PaginationParams } from './types';
import type { Api } from '@club/shared-types/api/user';

/**
 * User API module
 * Handles all user-related HTTP requests with full type safety
 */

/**
 * Get all users
 */
export const getUsers = async (): Promise<Api.UserResponse[]> => {
  const response = await apiClient.get<ApiResponse<Api.UserResponse[]>>('/users');
  return response.data.data;
};

/**
 * Query parameters for filtered user list
 */
export interface UserFilterParams extends PaginationParams {
  role?: string;
  isMatchPlayer?: boolean;
  membershipStatus?: string;
}

/**
 * Get users with filters
 */
export const getUsersWithFilters = async (
  params?: UserFilterParams
): Promise<PaginatedResponse<Api.UserResponse>> => {
  const response = await apiClient.get<PaginatedResponse<Api.UserResponse>>(
    '/users/filter',
    { params }
  );
  // API returns the paginated response directly (not wrapped in ApiResponse)
  return response.data;
};

/**
 * Get a single user by ID
 */
export const getUser = async (id: string): Promise<Api.UserResponse> => {
  const response = await apiClient.get<ApiResponse<Api.UserResponse>>(`/users/${id}`);
  return response.data.data;
};

/**
 * Create a new user
 */
export const createUser = async (userData: Api.CreateUserRequest): Promise<Api.UserResponse> => {
  const response = await apiClient.post<ApiResponse<Api.UserResponse>>('/users', userData);
  return response.data.data;
};

/**
 * Update an existing user
 */
export const updateUser = async (
  id: string,
  userData: Api.UpdateUserRequest
): Promise<Api.UserResponse> => {
  const response = await apiClient.put<ApiResponse<Api.UserResponse>>(`/users/${id}`, userData);
  return response.data.data;
};

/**
 * Batch update multiple users
 */
export interface BatchUpdateResponse {
  success: boolean;
  modifiedCount: number;
  users: Api.UserResponse[];
}

export const batchUpdateUsers = async (
  userIds: string[],
  updateData: Partial<Api.UpdateUserRequest>
): Promise<BatchUpdateResponse> => {
  const response = await apiClient.patch<BatchUpdateResponse>('/users/batch', {
    userIds,
    updateData,
  });
  return response.data;
};

/**
 * Delete a user
 */
export const deleteUser = async (id: string): Promise<{ success: boolean; message?: string }> => {
  const response = await apiClient.delete<ApiResponse<null>>(`/users/${id}`);
  return { success: response.data.success, message: response.data.message };
};
