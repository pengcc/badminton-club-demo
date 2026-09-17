import type {
  MemberCsvPreview,
  MemberCsvApply,
} from '@club/shared-types/api/memberCsv';
import apiClient from './client';
import type { ApiResponse } from './types';
import type { Api } from '@club/shared-types/api/user';
import type { AccountEstablishmentResponse } from '@club/shared-types/api/accountOnboarding';
import type { AccountSetupReissueResponse } from '@club/shared-types/api/accountOnboarding';
import type { AccountEstablishmentRequest } from '@club/shared-types/api/accountOnboarding';
import type { EmailChangeRequestInput } from '@club/shared-types/schemas/user';
import type { Api as AuthApi } from '@club/shared-types/api/auth';

/**
 * User API module
 * Handles all user-related HTTP requests with full type safety
 */

/**
 * Get all users
 */
export const getUsers = async (): Promise<Api.UserResponse[]> => {
  const response =
    await apiClient.get<ApiResponse<Api.UserResponse[]>>('/users');
  return response.data.data;
};

/**
 * Get users with filters
 */
export const getMemberList = async (
  params?: Api.MemberListQuery
): Promise<Api.MemberListResponse> => {
  const response = await apiClient.get<Api.MemberListResponse>(
    '/users/filter',
    { params }
  );
  return response.data;
};

export const getRichMemberExport = async (
  params: Api.MemberExportQuery
): Promise<Api.RichMemberExportResponse> => {
  const response = await apiClient.get<Api.RichMemberExportResponse>(
    '/users/member-export/rich',
    { params }
  );
  return response.data;
};

/**
 * Get a single user by ID
 */
export const getUser = async (id: string): Promise<Api.UserResponse> => {
  const response = await apiClient.get<ApiResponse<Api.UserResponse>>(
    `/users/${id}`
  );
  return response.data.data;
};

/**
 * Establish or compatibly reuse the canonical account for an administrator task.
 */
export const establishAccount = async (
  userData: AccountEstablishmentRequest,
  idempotencyKey: string
): Promise<AccountEstablishmentResponse> => {
  const response = await apiClient.post<
    ApiResponse<AccountEstablishmentResponse>
  >('/users', userData, { headers: { 'Idempotency-Key': idempotencyKey } });
  return response.data.data;
};

/**
 * Update an existing user
 */
export const updateUser = async (
  id: string,
  userData: Api.UpdateUserRequest
): Promise<Api.UserResponse> => {
  const response = await apiClient.put<ApiResponse<Api.UserResponse>>(
    `/users/${id}`,
    userData
  );
  return response.data.data;
};

export const setAdministratorDesignation = async (
  id: string,
  designated: boolean
): Promise<Api.UserResponse> => {
  const response = await apiClient.put<ApiResponse<Api.UserResponse>>(
    `/users/${id}/administrator-designation`,
    { designated }
  );
  return response.data.data;
};

export const transitionMembershipActivity = async (
  id: string,
  targetStatus: 'active' | 'passive',
  reason: string,
  idempotencyKey: string
): Promise<Api.UserResponse> => {
  const response = await apiClient.post<ApiResponse<Api.UserResponse>>(
    `/users/${id}/membership-activity`,
    { targetStatus, reason },
    { headers: { 'Idempotency-Key': idempotencyKey } }
  );
  return response.data.data;
};

export const suspendAccount = async (
  id: string,
  reason: string
): Promise<Api.UserResponse> => {
  const response = await apiClient.post<ApiResponse<Api.UserResponse>>(
    `/users/${id}/account-suspension`,
    { reason }
  );
  return response.data.data;
};

export const unsuspendAccount = async (
  id: string
): Promise<Api.UserResponse> => {
  const response = await apiClient.delete<ApiResponse<Api.UserResponse>>(
    `/users/${id}/account-suspension`
  );
  return response.data.data;
};

/**
 * Delete a user
 */
export const deleteUser = async (
  id: string,
  reason: string
): Promise<{ success: boolean; message?: string }> => {
  const response = await apiClient.delete<ApiResponse<null>>(`/users/${id}`, {
    data: { reason },
  });
  return { success: response.data.success, message: response.data.message };
};

/**
 * Reissue the canonical password-setup generation for a User.
 */
export const reissueAccountSetup = async (
  id: string
): Promise<AccountSetupReissueResponse> => {
  const response = await apiClient.post<
    ApiResponse<AccountSetupReissueResponse>
  >(`/users/${id}/invite`);
  return response.data.data;
};

export const requestPasswordRecovery = async (
  id: string,
  locale: 'de' | 'en' | 'zh'
): Promise<AuthApi.AdministratorPasswordRecoveryResponse> => {
  const response = await apiClient.post<
    ApiResponse<AuthApi.AdministratorPasswordRecoveryResponse>
  >(`/users/${id}/password-recovery`, { locale });
  return response.data.data;
};

/**
 * Start the authenticated User-owned email-change workflow.
 */
export const requestEmailChange = async (
  request: EmailChangeRequestInput
): Promise<{ pendingEmail: string }> => {
  const response = await apiClient.post<ApiResponse<{ pendingEmail: string }>>(
    '/users/request-email-change',
    request
  );
  return response.data.data;
};

export async function previewMemberCsv(file: File): Promise<MemberCsvPreview> {
  const data = new FormData();
  data.append('file', file);
  const response = await apiClient.post<ApiResponse<MemberCsvPreview>>(
    '/users/member-import/preview',
    data,
    { headers: { 'Content-Type': undefined } }
  );
  return response.data.data;
}
export async function applyMemberCsv(
  file: File,
  previewContext: string
): Promise<MemberCsvApply> {
  const data = new FormData();
  data.append('file', file);
  data.append('previewContext', previewContext);
  const response = await apiClient.post<ApiResponse<MemberCsvApply>>(
    '/users/member-import/apply',
    data,
    { headers: { 'Content-Type': undefined } }
  );
  return response.data.data;
}
