import apiClient from './client';
import axios from 'axios';
import type { ApiResponse, PaginationParams } from './types';
import { membershipApplicationSubmissionValidationErrorResponseSchema } from '@club/shared-types/api/membershipApplication';
import type {
  MembershipApplicationResponse,
  IssueRegistrationAccessRequest,
  RegistrationAccessAdminState,
  RegistrationAccessMetadata,
  PasswordSetupReissueResult,
  ApplicantMembershipApplicationResponse,
  SaveMembershipApplicationRequest,
} from '@club/shared-types/api/membershipApplication';
import type { MembershipApplicationSubmissionCorrectionField } from '@club/shared-types/domain/membershipApplication';

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

export const reissuePasswordSetup = async (
  id: string
): Promise<PasswordSetupReissueResult> => {
  const response = await apiClient.post<
    ApiResponse<PasswordSetupReissueResult>
  >(`/membership/applications/${id}/password-setup/reissue`);
  return response.data.data;
};

export const validateRegistrationAccess = async (
  accessToken: string
): Promise<boolean> => {
  const response = await apiClient.get<ApiResponse<{ valid: true }>>(
    '/membership/registration-access/validate',
    { headers: { 'X-Registration-Key': accessToken } }
  );
  return response.data.data.valid;
};

export const requestApplicantVerification = async (
  email: string,
  locale: 'de' | 'en' | 'zh',
  accessToken: string
): Promise<void> => {
  await apiClient.post(
    '/membership/applicant/verification-requests',
    { email, locale },
    {
      headers: { 'X-Registration-Key': accessToken },
    }
  );
};

export const requestApplicantAccess = async (
  email: string,
  locale: 'de' | 'en' | 'zh'
): Promise<void> => {
  await apiClient.post('/membership/applicant/access-requests', {
    email,
    locale,
  });
};

export const consumeApplicantAccess = async (token: string): Promise<void> => {
  await apiClient.post('/membership/applicant/access/consume', { token });
};

export const getApplicantApplication =
  async (): Promise<ApplicantMembershipApplicationResponse> => {
    const response = await apiClient.get<
      ApiResponse<ApplicantMembershipApplicationResponse>
    >('/membership/applicant/application');
    return response.data.data;
  };

export const saveApplicantApplication = async (
  data: SaveMembershipApplicationRequest
): Promise<ApplicantMembershipApplicationResponse> => {
  const response = await apiClient.patch<
    ApiResponse<ApplicantMembershipApplicationResponse>
  >('/membership/applicant/application', data);
  return response.data.data;
};

export const submitApplicantDraft =
  async (): Promise<ApplicantMembershipApplicationResponse> => {
    const response = await apiClient.post<
      ApiResponse<ApplicantMembershipApplicationResponse>
    >('/membership/applicant/application/submit');
    return response.data.data;
  };

export function getApplicantSubmissionCorrectionFields(
  error: unknown
): MembershipApplicationSubmissionCorrectionField[] | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  const parsed =
    membershipApplicationSubmissionValidationErrorResponseSchema.safeParse(
      error.response?.data
    );
  return parsed.success ? parsed.data.details.fields : undefined;
}

export const requestApplicantEmailChange = async (
  email: string,
  locale: 'de' | 'en' | 'zh'
): Promise<void> => {
  await apiClient.post('/membership/applicant/email-change-requests', {
    email,
    locale,
  });
};

export const synchronizeApplicantCommunicationLocale = async (
  locale: 'de' | 'en' | 'zh'
): Promise<void> => {
  await apiClient.patch(
    '/membership/applicant/application/communication-locale',
    { locale }
  );
};

export const withdrawApplicantApplication = async (): Promise<void> => {
  await apiClient.post('/membership/applicant/application/withdraw', {
    confirmed: true,
  });
};

export const replaceApplicantStudentProof = async (
  retainedIds: string[],
  files: File[]
): Promise<ApplicantMembershipApplicationResponse> => {
  const form = new FormData();
  form.append('retainedIds', JSON.stringify(retainedIds));
  files.forEach((file) => form.append('proofs', file));
  const response = await apiClient.patch<
    ApiResponse<ApplicantMembershipApplicationResponse>
  >('/membership/applicant/application/student-proof', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data;
};

export const downloadApplicantDocument = async (
  kind: 'application' | 'sepa'
): Promise<Blob> => {
  const response = await apiClient.get(
    `/membership/applicant/application/documents/${kind}`,
    {
      responseType: 'blob',
    }
  );
  return response.data;
};

export const emailApplicantDocuments = async (
  documents: Array<'application' | 'sepa'>
): Promise<void> => {
  await apiClient.post('/membership/applicant/application/documents/email', {
    documents,
  });
};

export const downloadAdminStudentProof = async (
  applicationId: string,
  proofId: string
): Promise<Blob> => {
  const response = await apiClient.get(
    `/membership/applications/${applicationId}/student-proof/${proofId}?download=true`,
    { responseType: 'blob' }
  );
  return response.data;
};

export const viewAdminStudentProof = async (
  applicationId: string,
  proofId: string
): Promise<Blob> => {
  const response = await apiClient.get(
    `/membership/applications/${applicationId}/student-proof/${proofId}`,
    { responseType: 'blob' }
  );
  return response.data;
};

export const deleteAdminStudentProof = async (
  applicationId: string,
  proofId: string
): Promise<void> => {
  await apiClient.delete(
    `/membership/applications/${applicationId}/student-proof/${proofId}`
  );
};

export const confirmSignedReceipt = async (
  applicationId: string,
  kind: 'application' | 'sepa'
): Promise<MembershipApplicationResponse> => {
  const response = await apiClient.post<
    ApiResponse<MembershipApplicationResponse>
  >(
    `/membership/applications/${applicationId}/signed-receipts/${kind}/confirm`
  );
  return response.data.data;
};

export const resetSignedReceipt = async (
  applicationId: string,
  kind: 'application' | 'sepa'
): Promise<MembershipApplicationResponse> => {
  const response = await apiClient.post<
    ApiResponse<MembershipApplicationResponse>
  >(`/membership/applications/${applicationId}/signed-receipts/${kind}/reset`);
  return response.data.data;
};

export const getRegistrationAccess =
  async (): Promise<RegistrationAccessAdminState> => {
    const response = await apiClient.get<
      ApiResponse<RegistrationAccessAdminState>
    >('/membership/registration-access');
    return response.data.data;
  };

export const generateRegistrationAccess = async (
  request: IssueRegistrationAccessRequest
): Promise<RegistrationAccessMetadata> => {
  const response = await apiClient.post<
    ApiResponse<RegistrationAccessMetadata>
  >('/membership/registration-access/generate', request);
  return response.data.data;
};

export const rotateRegistrationAccess = async (
  request: IssueRegistrationAccessRequest
): Promise<RegistrationAccessMetadata> => {
  const response = await apiClient.post<
    ApiResponse<RegistrationAccessMetadata>
  >('/membership/registration-access/rotate', request);
  return response.data.data;
};

/**
 * Get all membership applications with optional filters
 */
export const getMembershipApplications = async (
  params?: MembershipApplicationQueryParams
): Promise<ApiResponse<MembershipApplicationResponse[]>> => {
  const response = await apiClient.get<
    ApiResponse<MembershipApplicationResponse[]>
  >('/membership/applications', { params });
  return response.data;
};

/**
 * Get a single membership application by ID
 */
export const getMembershipApplication = async (
  id: string
): Promise<ApiResponse<MembershipApplicationResponse>> => {
  const response = await apiClient.get<
    ApiResponse<MembershipApplicationResponse>
  >(`/membership/applications/${id}`);
  return response.data;
};

/**
 * Approve a membership application
 */
export const approveMembershipApplication = async (
  id: string,
  reviewNote: string | undefined,
  approvalMessage: string | undefined,
  idempotencyKey: string
): Promise<
  ApiResponse<
    import('@club/shared-types/api/membershipApplication').MembershipApprovalResult
  >
> => {
  const response = await apiClient.post<
    ApiResponse<
      import('@club/shared-types/api/membershipApplication').MembershipApprovalResult
    >
  >(
    `/membership/applications/${id}/approve`,
    { reviewNote, approvalMessage },
    { headers: { 'Idempotency-Key': idempotencyKey } }
  );
  return response.data;
};

/**
 * Reject a membership application
 */
export const rejectMembershipApplication = async (
  id: string,
  reason: string,
  reviewNote?: string
): Promise<ApiResponse<MembershipApplicationResponse>> => {
  const response = await apiClient.post<
    ApiResponse<MembershipApplicationResponse>
  >(`/membership/applications/${id}/reject`, { reason, reviewNote });
  return response.data;
};

export const retryDecisionNotification = async (
  id: string
): Promise<MembershipApplicationResponse> => {
  const response = await apiClient.post<
    ApiResponse<MembershipApplicationResponse>
  >(`/membership/applications/${id}/decision-notification/retry`);
  return response.data.data;
};

export const updateApplicationReviewNote = async (
  id: string,
  reviewNote: string
): Promise<MembershipApplicationResponse> => {
  const response = await apiClient.patch<
    ApiResponse<MembershipApplicationResponse>
  >(`/membership/applications/${id}/review-note`, { reviewNote });
  return response.data.data;
};

/**
 * Contact applicant with custom message
 */
export interface ContactApplicantRequest {
  message: string;
}

export const contactApplicant = async (
  id: string,
  data: ContactApplicantRequest
): Promise<ApiResponse<void>> => {
  const response = await apiClient.post<ApiResponse<void>>(
    `/membership/applications/${id}/contact`,
    data
  );
  return response.data;
};
