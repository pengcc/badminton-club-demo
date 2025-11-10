import apiClient from './client';
import type { ApiResponse, PaginationParams } from './types';
import type {
  CreateMembershipApplicationRequest,
  MembershipApplicationResponse,
} from '@club/shared-types/api/membershipApplication';

/**
 * Membership Application API module
 * Handles all membership application-related HTTP requests with full type safety
 */

/**
 * Query parameters for membership application list
 */
export interface MembershipApplicationQueryParams extends PaginationParams {
  status?: string;
  offset?: number;
}

/**
 * Submit a new membership application
 */
export const submitMembershipApplication = async (
  applicationData: CreateMembershipApplicationRequest
): Promise<ApiResponse<MembershipApplicationResponse>> => {
  const response = await apiClient.post<ApiResponse<MembershipApplicationResponse>>(
    '/membership/applications',
    applicationData
  );
  return response.data;
};

/**
 * Get all membership applications with optional filters
 */
export const getMembershipApplications = async (
  params?: MembershipApplicationQueryParams
): Promise<ApiResponse<MembershipApplicationResponse[]>> => {
  const response = await apiClient.get<ApiResponse<MembershipApplicationResponse[]>>(
    '/membership/applications',
    { params }
  );
  return response.data;
};

/**
 * Get a single membership application by ID
 */
export const getMembershipApplication = async (
  id: string
): Promise<ApiResponse<MembershipApplicationResponse>> => {
  const response = await apiClient.get<ApiResponse<MembershipApplicationResponse>>(
    `/membership/applications/${id}`
  );
  return response.data;
};

/**
 * Review (approve/reject) a membership application
 */
export interface ReviewApplicationRequest {
  status: 'approved' | 'rejected';
  reviewNotes?: string;
}

export const reviewMembershipApplication = async (
  id: string,
  reviewData: ReviewApplicationRequest
): Promise<ApiResponse<MembershipApplicationResponse>> => {
  const response = await apiClient.patch<ApiResponse<MembershipApplicationResponse>>(
    `/membership/applications/${id}/review`,
    reviewData
  );
  return response.data;
};

/**
 * Legacy endpoint - submit membership application (consider removing)
 * @deprecated Use submitMembershipApplication instead
 */
export const submitLegacyMembershipApplication = async (
  formData: any
): Promise<ApiResponse<any>> => {
  const response = await apiClient.post<ApiResponse<any>>('/membership/apply', formData);
  return response.data;
};
