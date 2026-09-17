import { createHash } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import type { MembershipApprovalResult } from '@club/shared-types/api/membershipApplication';
import {
  AuditEventType,
  EntityType,
  MemberApplicationStatus,
  MembershipStatus,
  MembershipType,
} from '@club/shared-types/core/enums';
import { AccountOnboardingTargetKind } from '@club/shared-types/domain/accountOnboarding';
import type { MembershipLifecycleActor } from '@club/shared-types/domain/membershipLifecycle';
import { AuditService } from './auditService';
import { MembershipApplication } from '../models/MembershipApplication';
import { MemberBankingProfile } from '../models/MemberBankingProfile';
import {
  RegistrationApprovalEvent,
  RegistrationApprovalStatus,
  type RegistrationApprovalResultRecord,
} from '../models/RegistrationApprovalEvent';
import { AppError } from '../utils/errors';
import {
  completeBankingInfoSchema,
  personalInfoSchema,
} from '@club/shared-types/domain/membershipApplication';
import { accountEstablishmentCore } from './accountOnboardingService';
import { PasswordSetupDeliveryService } from './passwordSetupDeliveryService';
import { bankingCryptoService } from './bankingCryptoService';
import { MembershipApplicationDecisionDeliveryService } from './membershipApplicationDecisionDeliveryService';
import { UserService } from './userService';

export interface RegistrationApprovalCommand {
  applicationId: string;
  reviewNote?: string;
  approvalMessage?: string;
  idempotencyKey: string;
  actor: MembershipLifecycleActor;
}

function fingerprint(command: RegistrationApprovalCommand): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        applicationId: command.applicationId,
        reviewerId: command.actor.id,
        reviewNote: command.reviewNote?.trim() || '',
        approvalMessage: command.approvalMessage?.trim() || '',
      })
    )
    .digest('hex');
}

function duplicate(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

export class RegistrationApprovalService {
  static async approve(
    command: RegistrationApprovalCommand
  ): Promise<MembershipApprovalResult> {
    if (
      !Types.ObjectId.isValid(command.applicationId) ||
      command.idempotencyKey.trim().length < 8
    ) {
      throw AppError.badRequest(
        'A valid application and Idempotency-Key are required'
      );
    }
    const normalized = {
      ...command,
      idempotencyKey: command.idempotencyKey.trim(),
      reviewNote: command.reviewNote?.trim(),
      approvalMessage: command.approvalMessage?.trim(),
    };
    const intentFingerprint = fingerprint(normalized);
    let setupToken: string | undefined;
    let committed: RegistrationApprovalResultRecord | undefined;
    let replayedApproval = false;
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const replay = await RegistrationApprovalEvent.findOne({
          $or: [
            { idempotencyKey: normalized.idempotencyKey },
            { applicationId: normalized.applicationId },
          ],
        }).session(session);
        if (replay) {
          if (
            replay.idempotencyKey !== normalized.idempotencyKey ||
            replay.intentFingerprint !== intentFingerprint ||
            replay.status !== RegistrationApprovalStatus.COMPLETED ||
            !replay.result
          ) {
            throw AppError.conflict(
              'Application approval conflicts with an existing intent'
            );
          }
          committed = replay.result;
          replayedApproval = true;
          return;
        }

        await RegistrationApprovalEvent.create(
          [
            {
              applicationId: new Types.ObjectId(normalized.applicationId),
              idempotencyKey: normalized.idempotencyKey,
              intentFingerprint,
              status: RegistrationApprovalStatus.PENDING,
            },
          ],
          { session }
        );

        const application = await MembershipApplication.findById(
          normalized.applicationId
        ).session(session);
        if (!application) throw AppError.notFound('Application not found');
        if (application.status !== MemberApplicationStatus.PENDING_REVIEW)
          throw AppError.conflict('Application has already been reviewed');
        const personalInfo = personalInfoSchema.parse(application.personalInfo);
        if (!application.membershipType) {
          throw AppError.conflict('Application membership type is incomplete');
        }
        if (
          !application.encryptedBanking ||
          !application.bankingSummary.complete
        ) {
          throw AppError.conflict(
            'Complete banking information is required for approval'
          );
        }
        const bankingResult = completeBankingInfoSchema.safeParse(
          bankingCryptoService.decrypt(
            application.encryptedBanking,
            'membership-application',
            application.id
          )
        );
        if (!bankingResult.success) {
          throw AppError.conflict(
            'Complete banking information is required for approval'
          );
        }
        if (
          !application.signedApplicationReceipt ||
          application.signedApplicationReceipt.resetAt
        ) {
          throw AppError.conflict(
            'Signed Membership Application receipt is required for approval'
          );
        }
        if (
          !application.signedSepaReceipt ||
          application.signedSepaReceipt.resetAt
        ) {
          throw AppError.conflict(
            'Signed SEPA receipt is required for approval'
          );
        }

        const establishment = await accountEstablishmentCore.executeInSession(
          {
            identity: {
              email: personalInfo.email,
              firstName: personalInfo.firstName,
              lastName: personalInfo.lastName,
              phone: personalInfo.phone,
              dateOfBirth: personalInfo.dateOfBirth,
              gender: personalInfo.gender,
              address: personalInfo.address,
            },
            targetKind: AccountOnboardingTargetKind.MEMBER,
            establishPlayer: false,
            initialMembershipStatus: MembershipStatus.ACTIVE,
            membershipType: application.membershipType as MembershipType,
            actor: normalized.actor,
            source: {
              kind: 'registration',
              reference: application._id.toString(),
            },
            idempotencyKey: `${normalized.idempotencyKey}:approval`,
            setupLocale: application.communicationLocale ?? 'de',
          },
          session
        );
        if (establishment.identityMode !== 'create') {
          await UserService.updatePersonProfile(
            establishment.userId,
            {
              gender: personalInfo.gender,
              address: personalInfo.address,
              ...(personalInfo.phone ? { phone: personalInfo.phone } : {}),
            },
            session
          );
        }
        setupToken = establishment.setupToken;
        const existingBanking = await MemberBankingProfile.findOne({
          userId: establishment.userId,
        }).session(session);
        if (
          existingBanking &&
          !existingBanking.sourceApplicationId.equals(application._id)
        ) {
          throw AppError.conflict(
            'Member banking is already owned by another approval source'
          );
        }
        const encryptedMemberBanking = bankingCryptoService.encrypt(
          bankingResult.data,
          'member-banking-profile',
          establishment.userId
        );
        if (existingBanking) {
          existingBanking.encryptedBanking = encryptedMemberBanking;
          existingBanking.bankingSummary = application.bankingSummary;
          await existingBanking.save({ session });
        } else {
          await MemberBankingProfile.create(
            [
              {
                userId: new Types.ObjectId(establishment.userId),
                encryptedBanking: encryptedMemberBanking,
                bankingSummary: application.bankingSummary,
                sourceApplicationId: application._id,
              },
            ],
            { session }
          );
        }
        application.status = MemberApplicationStatus.APPLICATION_APPROVED;
        application.reviewer = new Types.ObjectId(normalized.actor.id);
        application.reviewDate = new Date();
        application.approvedAt = application.reviewDate;
        application.reviewNote = normalized.reviewNote;
        application.approvalMessage = normalized.approvalMessage;
        application.decisionNotificationKind = 'approval';
        application.decisionNotificationStatus = 'pending';
        application.approvedUserId = new Types.ObjectId(establishment.userId);
        await application.save({ session });

        await AuditService.writeRequired(
          {
            eventType: AuditEventType.APPLICATION_APPROVED,
            entityType: EntityType.MEMBERSHIP_APPLICATION,
            entityId: application._id,
            actor: {
              id: new Types.ObjectId(normalized.actor.id),
              accountKind: normalized.actor.accountKind,
            },
            changes: [
              {
                field: 'status',
                oldValue: MemberApplicationStatus.PENDING_REVIEW,
                newValue: MemberApplicationStatus.APPLICATION_APPROVED,
              },
              {
                field: 'approvedUserId',
                newValue: establishment.userId,
              },
              {
                field: 'identityMode',
                newValue: establishment.identityMode,
              },
            ],
          },
          session
        );

        committed = {
          applicationId: application._id.toString(),
          userId: establishment.userId,
          ...(establishment.playerId
            ? { playerId: establishment.playerId }
            : {}),
          setupGeneration: establishment.setupGeneration,
          setupRequired: establishment.setupRequired,
        };
        const completed = await RegistrationApprovalEvent.updateOne(
          {
            idempotencyKey: normalized.idempotencyKey,
            status: RegistrationApprovalStatus.PENDING,
          },
          {
            $set: {
              status: RegistrationApprovalStatus.COMPLETED,
              result: committed,
            },
          },
          { session }
        );
        if (completed.matchedCount !== 1)
          throw AppError.conflict('Approval completion state changed');
      });
    } catch (error) {
      if (duplicate(error)) {
        const replay = await RegistrationApprovalEvent.findOne({
          applicationId: normalized.applicationId,
        }).lean();
        if (
          replay?.status === RegistrationApprovalStatus.COMPLETED &&
          replay.idempotencyKey === normalized.idempotencyKey &&
          replay.intentFingerprint === intentFingerprint &&
          replay.result
        ) {
          committed = replay.result;
          replayedApproval = true;
        } else
          throw AppError.conflict(
            'Application approval conflicts with an existing intent'
          );
      } else throw error;
    } finally {
      await session.endSession();
    }

    if (!committed)
      throw AppError.internal('Approval transaction produced no result');
    if (setupToken)
      await PasswordSetupDeliveryService.deliver(
        committed.userId,
        committed.setupGeneration,
        setupToken
      );
    const decisionDeliveryStatus =
      await MembershipApplicationDecisionDeliveryService.deliver(
        committed.applicationId
      );
    return {
      ...committed,
      replayed: replayedApproval,
      deliveryStatus: committed.setupRequired
        ? await PasswordSetupDeliveryService.statusForGeneration(
            committed.userId,
            committed.setupGeneration
          )
        : 'sent',
      decisionDeliveryStatus,
    };
  }
}
