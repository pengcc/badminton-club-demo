/**
 * User Service
 *
 * Handles all user-related data fetching and mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserView } from '@club/shared-types/view/user';
import { UserViewTransformers } from '@club/shared-types/view/transformers/user';
import * as userApi from '@app/lib/api/userApi';
import { BaseService } from './baseService';

export class UserService {
  /**
   * Get all users as cards (for list views)
   */
  static async getUserCards(filters?: any): Promise<UserView.UserCard[]> {
    const response = filters
      ? await userApi.getUsersWithFilters(filters)
      : await userApi.getUsers();

    // Handle both array and paginated response
    const users = Array.isArray(response) ? response : response.data;
    return users.map((user: any) => UserViewTransformers.toUserCard(user));
  }

  /**
   * Get single user profile (for detail views)
   */
  static async getUserProfile(id: string): Promise<UserView.UserProfile> {
    const apiUser = await userApi.getUser(id);
    return UserViewTransformers.toUserProfile(apiUser as any);
  }

  /**
   * Hook: Get list of users
   */
  static useUserList(filters?: any) {
    return useQuery({
      queryKey: BaseService.queryKey('users', 'list', filters),
      queryFn: () => UserService.getUserCards(filters),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }

  /**
   * Hook: Get single user profile
   */
  static useUserProfile(id: string) {
    return useQuery({
      queryKey: BaseService.queryKey('users', 'profile', { id }),
      queryFn: () => UserService.getUserProfile(id),
      enabled: !!id,
      staleTime: 5 * 60 * 1000,
    });
  }

  /**
   * Hook: Create user mutation
   */
  static useCreateUser() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (formData: UserView.UserFormData) => {
        const request = UserViewTransformers.toCreateRequest(formData);
        const response = await userApi.createUser(request);
        return UserViewTransformers.toUserCard(response as any);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
        // Invalidate player queries since creating user with isPlayer=true creates Player entity
        queryClient.invalidateQueries({ queryKey: ['players'] });
      },
    });
  }

  /**
   * Hook: Update user mutation
   */
  static useUpdateUser() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({ id, formData }: { id: string; formData: Partial<UserView.UserFormData> }) => {
        const request = UserViewTransformers.toUpdateRequest(formData);
        const response = await userApi.updateUser(id, request);
        return UserViewTransformers.toUserCard(response as any);
      },
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
        queryClient.invalidateQueries({ queryKey: ['users', 'profile', { id: variables.id }] });

        // Always invalidate player queries for updates since form sends all fields
        queryClient.invalidateQueries({ queryKey: ['players'] });

        // Invalidate matches when player status changes
        // This ensures match modals reflect player changes immediately (add/remove from roster)
        queryClient.invalidateQueries({ queryKey: ['matches', 'list'] });
        queryClient.invalidateQueries({ queryKey: ['matches', 'details'] });
      },
    });
  }

  /**
   * Hook: Delete user mutation
   */
  static useDeleteUser() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (id: string) => {
        await userApi.deleteUser(id);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
        // Invalidate player queries since deleting user could affect Player entity
        console.log('Invalidating players query due to user deletion');
        queryClient.invalidateQueries({ queryKey: ['players'] });
      },
    });
  }

  /**
   * Hook: Batch update users mutation
   */
  static useBatchUpdate() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({ userIds, updateData }: { userIds: string[]; updateData: any }) => {
        const response = await userApi.batchUpdateUsers(userIds, updateData);
        return response;
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
        // Only invalidate player queries if isPlayer status was updated
        if ('isPlayer' in variables.updateData) {
          queryClient.invalidateQueries({ queryKey: ['players'] });
        }
      },
    });
  }
}
