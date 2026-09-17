import { MemberApplicationStatus } from '@club/shared-types/core/enums';

export const DRAFT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const TERMINAL_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export const RETENTION_CLAIM_STALE_MS = 10 * 60 * 1000;

export interface RetentionCandidate {
  status: MemberApplicationStatus;
  applicantDataUpdatedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  withdrawnAt?: Date;
}

export function isMembershipApplicationRetentionDue(
  candidate: RetentionCandidate,
  now: Date
): boolean {
  if (candidate.status === MemberApplicationStatus.DRAFT) {
    return Boolean(
      candidate.applicantDataUpdatedAt &&
        candidate.applicantDataUpdatedAt.getTime() <=
          now.getTime() - DRAFT_RETENTION_MS
    );
  }
  const terminalAt =
    candidate.status === MemberApplicationStatus.APPROVED
      ? candidate.approvedAt
      : candidate.status === MemberApplicationStatus.REJECTED
        ? candidate.rejectedAt
        : candidate.status === MemberApplicationStatus.WITHDRAWN
          ? candidate.withdrawnAt
          : undefined;
  return Boolean(
    terminalAt && terminalAt.getTime() <= now.getTime() - TERMINAL_RETENTION_MS
  );
}
