import type { Domain } from '@club/shared-types/domain/membershipApplication';
import type {
  CreateMembershipApplicationRequest,
  ApplicantMembershipApplicationResponse,
  MembershipApplicationResponse,
  UpdateMembershipApplicationRequest,
} from '@club/shared-types/api/membershipApplication';
import type { MembershipApplicationPersistence } from '../types/persistence/membershipApplication';

function reviewerId(
  reviewer: MembershipApplicationPersistence['reviewer']
): string | undefined {
  if (!reviewer) return undefined;
  if (typeof reviewer === 'string') return reviewer;
  if ('_id' in reviewer) return reviewer._id.toString();
  return String(reviewer as unknown);
}

function toApplicantSignedDocumentReceipt(
  receipt: MembershipApplicationResponse['signedApplicationReceipt']
): ApplicantMembershipApplicationResponse['signedApplicationReceipt'] {
  if (!receipt) return undefined;
  const { receivedBy: _receivedBy, ...applicantReceipt } = receipt;
  return applicantReceipt;
}

export class MembershipApplicationPersistenceTransformer {
  static toDomain(
    document: MembershipApplicationPersistence
  ): Domain.MembershipApplication {
    return {
      id: document._id.toString(),
      verifiedEmail: document.verifiedEmail,
      communicationLocale: document.communicationLocale ?? 'de',
      personalInfo: document.personalInfo ?? {},
      membershipType: document.membershipType,
      motivation: document.motivation,
      bankingSummary: document.bankingSummary ?? {
        present: false,
        complete: false,
      },
      status: document.status,
      studentProof: document.studentProof ?? [],
      signedApplicationReceipt: document.signedApplicationReceipt
        ? {
            ...document.signedApplicationReceipt,
            receivedBy: document.signedApplicationReceipt.receivedBy.toString(),
          }
        : undefined,
      signedSepaReceipt: document.signedSepaReceipt
        ? {
            ...document.signedSepaReceipt,
            receivedBy: document.signedSepaReceipt.receivedBy.toString(),
          }
        : undefined,
      reviewer: reviewerId(document.reviewer),
      reviewDate: document.reviewDate,
      reviewNote: document.reviewNote,
      rejectionReason: document.rejectionReason,
      approvalMessage: document.approvalMessage,
      decisionNotificationKind: document.decisionNotificationKind,
      decisionNotificationStatus: document.decisionNotificationStatus,
      decisionNotificationClaimedAt: document.decisionNotificationClaimedAt,
      decisionNotificationAttemptedAt: document.decisionNotificationAttemptedAt,
      submittedAt: document.submittedAt,
      approvedAt: document.approvedAt,
      rejectedAt: document.rejectedAt,
      withdrawnAt: document.withdrawnAt,
      applicantDataUpdatedAt: document.applicantDataUpdatedAt,
      approvedUserId: document.approvedUserId?.toString(),
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }
}

export class MembershipApplicationApiTransformer {
  static toApi(
    application: Domain.MembershipApplication
  ): MembershipApplicationResponse {
    return {
      id: application.id,
      verifiedEmail: application.verifiedEmail,
      communicationLocale: application.communicationLocale,
      personalInfo: application.personalInfo,
      membershipType: application.membershipType,
      motivation: application.motivation,
      bankingSummary: application.bankingSummary,
      status: application.status,
      studentProof: application.studentProof.map((proof) => ({
        ...proof,
        createdAt: proof.createdAt.toISOString(),
      })),
      signedApplicationReceipt: application.signedApplicationReceipt
        ? {
            ...application.signedApplicationReceipt,
            receivedAt:
              application.signedApplicationReceipt.receivedAt.toISOString(),
            resetAt:
              application.signedApplicationReceipt.resetAt?.toISOString(),
          }
        : undefined,
      signedSepaReceipt: application.signedSepaReceipt
        ? {
            ...application.signedSepaReceipt,
            receivedAt: application.signedSepaReceipt.receivedAt.toISOString(),
            resetAt: application.signedSepaReceipt.resetAt?.toISOString(),
          }
        : undefined,
      reviewer: application.reviewer,
      reviewDate: application.reviewDate?.toISOString(),
      reviewNote: application.reviewNote,
      rejectionReason: application.rejectionReason,
      approvalMessage: application.approvalMessage,
      decisionNotificationKind: application.decisionNotificationKind,
      decisionNotificationStatus: application.decisionNotificationStatus,
      decisionNotificationClaimedAt:
        application.decisionNotificationClaimedAt?.toISOString(),
      decisionNotificationAttemptedAt:
        application.decisionNotificationAttemptedAt?.toISOString(),
      submittedAt: application.submittedAt?.toISOString(),
      approvedAt: application.approvedAt?.toISOString(),
      rejectedAt: application.rejectedAt?.toISOString(),
      withdrawnAt: application.withdrawnAt?.toISOString(),
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
    };
  }

  static toApplicantApi(
    application: Domain.MembershipApplication,
    bankingInfo?: Domain.BankingInfoDraft
  ): ApplicantMembershipApplicationResponse {
    const {
      signedApplicationReceipt,
      signedSepaReceipt,
      reviewer: _reviewer,
      reviewerName: _reviewerName,
      reviewDate: _reviewDate,
      reviewNote: _reviewNote,
      decisionNotificationKind: _decisionNotificationKind,
      decisionNotificationStatus: _decisionNotificationStatus,
      decisionNotificationClaimedAt: _decisionNotificationClaimedAt,
      decisionNotificationAttemptedAt: _decisionNotificationAttemptedAt,
      ...applicant
    } = this.toApi(application);
    return {
      ...applicant,
      signedApplicationReceipt: toApplicantSignedDocumentReceipt(
        signedApplicationReceipt
      ),
      signedSepaReceipt: toApplicantSignedDocumentReceipt(signedSepaReceipt),
      bankingInfo,
    };
  }

  static fromCreateRequest(request: CreateMembershipApplicationRequest) {
    return {
      verifiedEmail: request.personalInfo.email.toLowerCase(),
      personalInfo: {
        ...request.personalInfo,
        email: request.personalInfo.email.toLowerCase(),
      },
      membershipType: request.membershipType,
      motivation: request.motivation,
      bankingInfo: request.bankingInfo,
    };
  }

  static fromUpdateRequest(request: UpdateMembershipApplicationRequest) {
    return { reviewNote: request.reviewNote };
  }
}
