import type {
  MembershipTerminationSource,
  MembershipTerminationStatus,
  AccountKind,
} from '../core/enums';

export interface MembershipTerminationActorResponse {
  id: string;
  email: string;
  accountKind: AccountKind;
  displayName: string;
}

export interface MembershipTerminationResponse {
  id: string;
  userId: string;
  memberName?: string;
  memberEmail?: string;
  memberUnavailable?: boolean;
  status: MembershipTerminationStatus;
  source: MembershipTerminationSource;
  requestedAt: string;
  requestedBy: MembershipTerminationActorResponse;
  requestedEffectiveDate: string;
  requestNote?: string;
  approvedAt?: string;
  approvedBy?: MembershipTerminationActorResponse;
  confirmedEffectiveDate?: string;
  approvalNote?: string;
  rejectedAt?: string;
  rejectedBy?: MembershipTerminationActorResponse;
  rejectionReason?: string;
  effectiveAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipTerminationSelfServiceResponse {
  status: MembershipTerminationStatus;
  endDate: string;
  rejectionReason?: string;
}

export interface MembershipTerminationProcessingFailureResponse {
  code: string;
  message: string;
  failedAt: string;
}

export interface AdminMembershipTerminationResponse
  extends MembershipTerminationResponse {
  lastProcessingFailure?: MembershipTerminationProcessingFailureResponse;
}

export interface MembershipTerminationListResponse {
  items: AdminMembershipTerminationResponse[];
}

export interface MembershipTerminationBatchItemResult {
  userId: string;
  termination?: MembershipTerminationResponse;
  error?: { code: string; message: string };
}

export interface MembershipTerminationBatchResponse {
  success: boolean;
  createdCount: number;
  failureCount: number;
  items: MembershipTerminationBatchItemResult[];
}
