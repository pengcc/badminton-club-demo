import type {
  MembershipTerminationBatchResponse,
  MembershipTerminationListResponse,
  MembershipTerminationResponse,
  MembershipTerminationSelfServiceResponse,
} from '@club/shared-types/api/membershipTermination';
import type {
  ApproveMembershipTerminationInput,
  BatchRecordMembershipTerminationInput,
  RecordMembershipTerminationInput,
  RejectMembershipTerminationInput,
  RequestMembershipTerminationInput,
} from '@club/shared-types/schemas';
import { MembershipTerminationStatus } from '@club/shared-types/core/enums';
import apiClient from './client';
import type { ApiResponse } from './types';

const idempotencyHeaders = (key: string) => ({
  headers: { 'Idempotency-Key': key },
});

export async function getMyTermination(): Promise<MembershipTerminationSelfServiceResponse | null> {
  const response = await apiClient.get<
    ApiResponse<MembershipTerminationSelfServiceResponse | null>
  >('/membership-terminations/me');
  return response.data.data;
}

export async function requestTermination(
  request: RequestMembershipTerminationInput,
  idempotencyKey: string
): Promise<MembershipTerminationSelfServiceResponse> {
  const response = await apiClient.post<
    ApiResponse<MembershipTerminationSelfServiceResponse>
  >(
    '/membership-terminations/requests',
    request,
    idempotencyHeaders(idempotencyKey)
  );
  return response.data.data;
}

export async function listTerminations(
  status?: MembershipTerminationStatus
): Promise<MembershipTerminationListResponse> {
  const response = await apiClient.get<
    ApiResponse<MembershipTerminationListResponse>
  >('/membership-terminations', { params: status ? { status } : undefined });
  return response.data.data;
}

export async function approveTermination(
  id: string,
  request: ApproveMembershipTerminationInput,
  idempotencyKey: string
): Promise<MembershipTerminationResponse> {
  const response = await apiClient.post<
    ApiResponse<MembershipTerminationResponse>
  >(
    `/membership-terminations/${id}/approval`,
    request,
    idempotencyHeaders(idempotencyKey)
  );
  return response.data.data;
}

export async function rejectTermination(
  id: string,
  request: RejectMembershipTerminationInput,
  idempotencyKey: string
): Promise<MembershipTerminationResponse> {
  const response = await apiClient.post<
    ApiResponse<MembershipTerminationResponse>
  >(
    `/membership-terminations/${id}/rejection`,
    request,
    idempotencyHeaders(idempotencyKey)
  );
  return response.data.data;
}

export async function recordOfflineTermination(
  request: RecordMembershipTerminationInput,
  idempotencyKey: string
): Promise<MembershipTerminationResponse> {
  const response = await apiClient.post<
    ApiResponse<MembershipTerminationResponse>
  >(
    '/membership-terminations/admin-recorded',
    request,
    idempotencyHeaders(idempotencyKey)
  );
  return response.data.data;
}

export async function recordTerminationBatch(
  request: BatchRecordMembershipTerminationInput,
  idempotencyKey: string
): Promise<MembershipTerminationBatchResponse> {
  const response = await apiClient.post<
    ApiResponse<MembershipTerminationBatchResponse>
  >(
    '/membership-terminations/batch',
    request,
    idempotencyHeaders(idempotencyKey)
  );
  return response.data.data;
}
