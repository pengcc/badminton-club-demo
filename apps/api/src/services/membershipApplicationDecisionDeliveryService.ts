import { AppError } from '../utils/errors';
import { MemberApplicationStatus } from '@club/shared-types/core/enums';
import { MembershipApplication } from '../models/MembershipApplication';
import {
  RegistrationApprovalEvent,
  RegistrationApprovalStatus,
} from '../models/RegistrationApprovalEvent';
import EmailService from './emailService';
import { MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES } from './emailContracts/membershipApplication';
import { classifyEmailDeliveryError } from './emailDeliveryError';

export type DecisionDeliveryStatus = 'sent' | 'failed' | 'uncertain';
export const DECISION_DELIVERY_STALE_MS = 10 * 60 * 1000;

export class MembershipApplicationDecisionDeliveryService {
  static async deliver(applicationId: string): Promise<DecisionDeliveryStatus> {
    const claimed = await MembershipApplication.findOneAndUpdate(
      {
        _id: applicationId,
        status: {
          $in: [
            MemberApplicationStatus.APPROVED,
            MemberApplicationStatus.REJECTED,
          ],
        },
        $or: [
          {
            decisionNotificationStatus: {
              $in: ['pending', 'failed', 'uncertain'],
            },
          },
          {
            decisionNotificationStatus: 'claimed',
            decisionNotificationClaimedAt: {
              $lte: new Date(Date.now() - DECISION_DELIVERY_STALE_MS),
            },
          },
        ],
      },
      {
        $set: {
          decisionNotificationStatus: 'claimed',
          decisionNotificationClaimedAt: new Date(),
        },
      },
      { new: true }
    );
    if (!claimed) {
      const current = await MembershipApplication.findById(applicationId)
        .select('decisionNotificationStatus')
        .lean();
      if (current?.decisionNotificationStatus === 'sent') return 'sent';
      if (current?.decisionNotificationStatus === 'claimed') return 'uncertain';
      throw AppError.conflict('Decision notification is unavailable');
    }

    let status: DecisionDeliveryStatus = 'sent';
    try {
      const locale = claimed.communicationLocale ?? 'de';
      if (claimed.decisionNotificationKind === 'approval') {
        const approval = await RegistrationApprovalEvent.findOne({
          applicationId: claimed._id,
          status: RegistrationApprovalStatus.COMPLETED,
        }).lean();
        const setupRequired = approval?.result?.setupRequired === true;
        await EmailService.sendFromTemplate(
          MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.APPROVED,
          claimed.verifiedEmail,
          locale,
          {
            firstName: claimed.personalInfo.firstName ?? '',
            lastName: claimed.personalInfo.lastName ?? '',
            approvalMessage: claimed.approvalMessage ?? '',
            setupGuidance: setupRequired
              ? locale === 'zh'
                ? '您将另行收到一封用于设置账户访问权限的邮件。'
                : locale === 'en'
                  ? 'A separate email for setting up your account access will follow.'
                  : 'Eine separate E-Mail zur Einrichtung deines Kontozugangs folgt.'
              : locale === 'zh'
                ? '您现有的登录信息仍然有效。'
                : locale === 'en'
                  ? 'Your existing sign-in details remain valid.'
                  : 'Deine bestehenden Zugangsdaten bleiben gültig.',
          }
        );
      } else if (
        claimed.decisionNotificationKind === 'rejection' &&
        claimed.rejectionReason
      ) {
        await EmailService.sendFromTemplate(
          MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.REJECTED,
          claimed.verifiedEmail,
          locale,
          {
            firstName: claimed.personalInfo.firstName ?? '',
            lastName: claimed.personalInfo.lastName ?? '',
            reason: claimed.rejectionReason,
          }
        );
      } else {
        throw AppError.internal('Decision notification data is incomplete');
      }
    } catch (error) {
      status = classifyEmailDeliveryError(error);
    }

    try {
      const updated = await MembershipApplication.updateOne(
        { _id: claimed._id, decisionNotificationStatus: 'claimed' },
        {
          $set: {
            decisionNotificationStatus: status,
            decisionNotificationAttemptedAt: new Date(),
          },
        }
      );
      return updated.matchedCount === 1 ? status : 'uncertain';
    } catch {
      return 'uncertain';
    }
  }
}
