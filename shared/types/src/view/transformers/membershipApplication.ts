import type { Domain } from '../../domain/membershipApplication';
import {
  membershipApplicationViewSchema,
  type MembershipApplicationView,
} from '../membershipApplication';
import { BaseTransformer } from './base';

export class MembershipApplicationTransformer extends BaseTransformer {
  static toApplicationView(
    application: Domain.MembershipApplication
  ): MembershipApplicationView {
    return membershipApplicationViewSchema.parse({
      id: application.id,
      verifiedEmail: application.verifiedEmail,
      personalInfo: application.personalInfo,
      membershipType: application.membershipType,
      motivation: application.motivation,
      bankingSummary: application.bankingSummary,
      status: application.status,
      reviewer:
        typeof application.reviewer === 'string'
          ? application.reviewer
          : undefined,
      reviewDate: application.reviewDate?.toISOString(),
      reviewNote: application.reviewNote,
      rejectionReason: application.rejectionReason,
      approvalMessage: application.approvalMessage,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
    });
  }

  static toMembershipApplicationViews(
    applications: Domain.MembershipApplication[]
  ): MembershipApplicationView[] {
    return applications.map((application) =>
      this.toApplicationView(application)
    );
  }
}
