import {
  MembershipTerminationSource,
  MembershipTerminationStatus,
  type AccountKind,
} from '../core/enums';

export interface MembershipTerminationActorSnapshot {
  id: string;
  email: string;
  accountKind: AccountKind;
  displayName: string;
}

export interface MembershipTermination {
  id: string;
  userId: string;
  status: MembershipTerminationStatus;
  source: MembershipTerminationSource;
  requestedAt: Date;
  requestedBy: MembershipTerminationActorSnapshot;
  requestedEffectiveDate: string;
  requestNote?: string;
  approvedAt?: Date;
  approvedBy?: MembershipTerminationActorSnapshot;
  confirmedEffectiveDate?: string;
  approvalNote?: string;
  rejectedAt?: Date;
  rejectedBy?: MembershipTerminationActorSnapshot;
  rejectionReason?: string;
  effectiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
