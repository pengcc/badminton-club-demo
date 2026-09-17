import { MemberApplicationStatus } from '@club/shared-types/core/enums';
import {
  getBankingSummary,
  getMembershipApplicationSubmissionReadiness,
  normalizeBankingInfo,
  personalInfoSchema,
  completeBankingInfoSchema,
  type Domain,
} from '@club/shared-types/domain/membershipApplication';
import type {
  CreateMembershipApplicationRequest,
  SaveMembershipApplicationRequest,
  UpdateMembershipApplicationRequest,
} from '@club/shared-types/api/membershipApplication';
import {
  createMembershipApplicationSchema,
  MEMBERSHIP_APPLICATION_SUBMISSION_VALIDATION_ERROR_CODE,
} from '@club/shared-types/api/membershipApplication';
import { Types } from 'mongoose';
import { MembershipApplication } from '../models/MembershipApplication';
import { User } from '../models/User';
import type { MembershipApplicationPersistence } from '../types/persistence/membershipApplication';
import {
  MembershipApplicationApiTransformer,
  MembershipApplicationPersistenceTransformer,
} from '../transformers/membershipApplication';
import { AppError } from '../utils/errors';
import { bankingCryptoService } from './bankingCryptoService';
import EmailService from './emailService';
import { MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES } from './emailContracts/membershipApplication';
import { MembershipApplicantAccessService } from './membershipApplicantAccessService';
import {
  captureMembershipDocumentInputs,
  resetChangedSignedDocumentReceipts,
} from './membershipApplicationDocumentInputs';
import { MembershipApplicationDecisionDeliveryService } from './membershipApplicationDecisionDeliveryService';
import { RETENTION_CLAIM_STALE_MS } from './membershipApplicationRetentionPolicy';

function toDomain(document: unknown): Domain.MembershipApplication {
  return MembershipApplicationPersistenceTransformer.toDomain(
    document as MembershipApplicationPersistence
  );
}

export class MembershipApplicationService {
  private static assertNotRetentionClaimed(application: {
    retentionClaimedAt?: Date;
  }): void {
    if (
      application.retentionClaimedAt &&
      application.retentionClaimedAt.getTime() >
        Date.now() - RETENTION_CLAIM_STALE_MS
    ) {
      throw AppError.conflict(
        'Application cleanup is in progress; retry shortly'
      );
    }
  }

  static async createDraftForVerifiedEmail(
    email: string
  ): Promise<Domain.MembershipApplication> {
    const verifiedEmail = email.trim().toLowerCase();
    const existing = await MembershipApplication.findOne({
      verifiedEmail,
      status: {
        $in: [MemberApplicationStatus.DRAFT, MemberApplicationStatus.PENDING],
      },
    }).lean();
    if (existing) return toDomain(existing);

    const application = await MembershipApplication.create({
      verifiedEmail,
      personalInfo: { email: verifiedEmail },
      bankingSummary: { present: false, complete: false },
      status: MemberApplicationStatus.DRAFT,
      applicantDataUpdatedAt: new Date(),
    });
    return toDomain(application.toObject());
  }

  /**
   * Compatibility entry used by the pre-verification route until Checkpoint 2 replaces it.
   * It persists the canonical encrypted shape and a submitted status.
   */
  static async createApplication(
    request: CreateMembershipApplicationRequest
  ): Promise<Domain.MembershipApplication> {
    const data = MembershipApplicationApiTransformer.fromCreateRequest(
      createMembershipApplicationSchema.parse(request)
    );
    const existing = await MembershipApplication.findOne({
      verifiedEmail: data.verifiedEmail,
      status: {
        $in: [MemberApplicationStatus.DRAFT, MemberApplicationStatus.PENDING],
      },
    });
    if (existing)
      throw AppError.conflict('An application with this email already exists');

    const applicationId = new Types.ObjectId();
    const normalizedBanking = data.bankingInfo
      ? normalizeBankingInfo(data.bankingInfo)
      : undefined;
    const now = new Date();
    const application = await MembershipApplication.create({
      _id: applicationId,
      verifiedEmail: data.verifiedEmail,
      personalInfo: data.personalInfo,
      membershipType: data.membershipType,
      motivation: data.motivation,
      encryptedBanking: normalizedBanking
        ? bankingCryptoService.encrypt(
            normalizedBanking,
            'membership-application',
            applicationId.toString()
          )
        : undefined,
      bankingSummary: getBankingSummary(normalizedBanking),
      status: MemberApplicationStatus.PENDING,
      submittedAt: now,
      applicantDataUpdatedAt: now,
    });
    const domain = toDomain(application.toObject());
    void this.sendApplicationReceivedEmail(domain).catch(() => undefined);
    void this.sendAdminAlertEmail(domain).catch(() => undefined);
    return domain;
  }

  static async saveApplicantData(
    id: string,
    request: SaveMembershipApplicationRequest
  ): Promise<Domain.MembershipApplication> {
    const application = await MembershipApplication.findById(id);
    if (!application) throw AppError.notFound('Application not found');
    this.assertNotRetentionClaimed(application);
    if (
      ![
        MemberApplicationStatus.DRAFT,
        MemberApplicationStatus.PENDING,
      ].includes(application.status)
    ) {
      throw AppError.conflict('Application is read-only');
    }

    const currentBanking = application.encryptedBanking
      ? bankingCryptoService.decrypt(
          application.encryptedBanking,
          'membership-application',
          application.id
        )
      : undefined;
    const beforeDocumentInputs = captureMembershipDocumentInputs(
      application,
      currentBanking
    );

    const currentPersonalInfo =
      typeof (application.personalInfo as any).toObject === 'function'
        ? (application.personalInfo as any).toObject()
        : application.personalInfo;
    const nextPersonalInfo = {
      ...currentPersonalInfo,
      ...request.personalInfo,
    };
    if (request.personalInfo?.address) {
      const currentAddress =
        typeof (application.personalInfo.address as any)?.toObject ===
        'function'
          ? (application.personalInfo.address as any).toObject()
          : application.personalInfo.address;
      nextPersonalInfo.address = {
        ...currentAddress,
        ...request.personalInfo.address,
      };
    }
    // Email ownership changes only through the dedicated verified-email command.
    nextPersonalInfo.email = application.verifiedEmail;
    if (application.status === MemberApplicationStatus.PENDING) {
      personalInfoSchema.parse(nextPersonalInfo);
      if (!request.membershipType && !application.membershipType) {
        throw AppError.validation('Membership type is required');
      }
    }

    application.personalInfo = nextPersonalInfo;
    if (request.membershipType)
      application.membershipType = request.membershipType;
    if ('motivation' in request) application.motivation = request.motivation;
    let nextBanking = currentBanking;
    if ('bankingInfo' in request && request.bankingInfo) {
      const normalized = normalizeBankingInfo(request.bankingInfo);
      nextBanking = normalized;
      application.encryptedBanking = bankingCryptoService.encrypt(
        normalized,
        'membership-application',
        application.id
      );
      application.bankingSummary = getBankingSummary(normalized);
    } else if ('bankingInfo' in request && request.bankingInfo === null) {
      nextBanking = undefined;
      application.encryptedBanking = undefined;
      application.bankingSummary = { present: false, complete: false };
    }
    resetChangedSignedDocumentReceipts(
      application,
      beforeDocumentInputs,
      captureMembershipDocumentInputs(application, nextBanking)
    );
    application.applicantDataUpdatedAt = new Date();
    await application.save();
    return toDomain(application.toObject());
  }

  static async getApplicantBanking(
    id: string
  ): Promise<Domain.BankingInfoDraft | undefined> {
    const application =
      await MembershipApplication.findById(id).select('+encryptedBanking');
    if (!application) throw AppError.notFound('Application not found');
    if (!application.encryptedBanking) return undefined;
    return bankingCryptoService.decrypt(
      application.encryptedBanking,
      'membership-application',
      application.id
    );
  }

  static async getApplicantApplication(id: string): Promise<{
    application: Domain.MembershipApplication;
    bankingInfo?: Domain.BankingInfoDraft;
  }> {
    const application = await this.getApplicationById(id);
    if (
      !application ||
      application.status === MemberApplicationStatus.WITHDRAWN
    ) {
      throw AppError.unauthorized('Applicant session is no longer valid');
    }
    const bankingInfo = [
      MemberApplicationStatus.DRAFT,
      MemberApplicationStatus.PENDING,
    ].includes(application.status)
      ? await this.getApplicantBanking(id)
      : undefined;
    return { application, bankingInfo };
  }

  static async submitApplicantApplication(
    id: string
  ): Promise<Domain.MembershipApplication> {
    const application = await MembershipApplication.findById(id);
    if (!application) throw AppError.notFound('Application not found');
    this.assertNotRetentionClaimed(application);
    if (application.status !== MemberApplicationStatus.DRAFT) {
      throw AppError.conflict('Only a draft can be submitted');
    }
    const readiness = getMembershipApplicationSubmissionReadiness({
      personalInfo: application.personalInfo,
      membershipType: application.membershipType,
    });
    if (!readiness.ready) {
      if (readiness.fields.length === 0) throw AppError.internal();
      throw new AppError(
        'Application has missing or invalid submission information',
        400,
        MEMBERSHIP_APPLICATION_SUBMISSION_VALIDATION_ERROR_CODE,
        { fields: readiness.fields }
      );
    }
    if (application.bankingSummary.complete && application.encryptedBanking) {
      const banking = bankingCryptoService.decrypt(
        application.encryptedBanking,
        'membership-application',
        application.id
      );
      completeBankingInfoSchema.parse(banking);
    }
    const now = new Date();
    application.status = MemberApplicationStatus.PENDING;
    application.submittedAt = now;
    application.applicantDataUpdatedAt = now;
    await application.save();
    const domain = toDomain(application.toObject());
    void this.sendApplicationReceivedEmail(domain).catch(() => undefined);
    void this.sendAdminAlertEmail(domain).catch(() => undefined);
    return domain;
  }

  static async withdrawApplicantApplication(
    id: string
  ): Promise<Domain.MembershipApplication> {
    const staleClaim = new Date(Date.now() - RETENTION_CLAIM_STALE_MS);
    const application = await MembershipApplication.findOneAndUpdate(
      {
        _id: id,
        status: MemberApplicationStatus.PENDING,
        $or: [
          { retentionClaimedAt: { $exists: false } },
          { retentionClaimedAt: { $lte: staleClaim } },
        ],
      },
      {
        $set: {
          status: MemberApplicationStatus.WITHDRAWN,
          withdrawnAt: new Date(),
        },
      },
      { new: true, runValidators: true }
    );
    if (!application)
      throw AppError.conflict('Only a pending application can be withdrawn');
    await MembershipApplicantAccessService.revokeApplicationSessions(id);
    return toDomain(application.toObject());
  }

  static async getApplicationById(
    id: string
  ): Promise<Domain.MembershipApplication | null> {
    const application = await MembershipApplication.findById(id)
      .populate('reviewer', 'firstName lastName')
      .lean<MembershipApplicationPersistence>();
    return application ? toDomain(application) : null;
  }

  static async getAllApplications(
    options: {
      status?: MemberApplicationStatus;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ applications: Domain.MembershipApplication[]; total: number }> {
    const { status, limit = 50, offset = 0 } = options;
    const filter =
      status && status !== MemberApplicationStatus.DRAFT
        ? { status }
        : { status: { $ne: MemberApplicationStatus.DRAFT } };
    const [applications, total] = await Promise.all([
      MembershipApplication.find(filter)
        .populate('reviewer', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .lean<MembershipApplicationPersistence[]>(),
      MembershipApplication.countDocuments(filter),
    ]);
    return { applications: applications.map(toDomain), total };
  }

  static async getPendingApplications(): Promise<
    Domain.MembershipApplication[]
  > {
    const applications = await MembershipApplication.find({
      status: MemberApplicationStatus.PENDING,
    })
      .populate('reviewer', 'firstName lastName')
      .sort({ submittedAt: 1 })
      .lean<MembershipApplicationPersistence[]>();
    return applications.map(toDomain);
  }

  static async updateApplication(
    id: string,
    request: UpdateMembershipApplicationRequest
  ): Promise<Domain.MembershipApplication> {
    const application = await MembershipApplication.findOneAndUpdate(
      { _id: id, status: { $ne: MemberApplicationStatus.DRAFT } },
      MembershipApplicationApiTransformer.fromUpdateRequest(request),
      { new: true, runValidators: true }
    ).lean<MembershipApplicationPersistence>();
    if (!application) throw AppError.notFound('Application not found');
    return toDomain(application);
  }

  static async rejectApplication(
    id: string,
    reviewerId: string,
    reason: string,
    reviewNote?: string
  ): Promise<Domain.MembershipApplication> {
    const now = new Date();
    const application = await MembershipApplication.findOneAndUpdate(
      { _id: id, status: MemberApplicationStatus.PENDING },
      {
        $set: {
          status: MemberApplicationStatus.REJECTED,
          reviewer: new Types.ObjectId(reviewerId),
          reviewDate: now,
          reviewNote,
          rejectedAt: now,
          rejectionReason: reason.trim(),
          decisionNotificationKind: 'rejection',
          decisionNotificationStatus: 'pending',
        },
      },
      { new: true, runValidators: true }
    );
    if (!application)
      throw AppError.conflict('Application has already been reviewed');
    await MembershipApplicationDecisionDeliveryService.deliver(id);
    return (await this.getApplicationById(id))!;
  }

  static async hasExistingApplication(email: string): Promise<boolean> {
    return Boolean(
      await MembershipApplication.exists({
        verifiedEmail: email.trim().toLowerCase(),
        status: {
          $in: [MemberApplicationStatus.DRAFT, MemberApplicationStatus.PENDING],
        },
      })
    );
  }

  static async getApplicationStats() {
    const [draft, pending, approved, rejected, withdrawn, total] =
      await Promise.all([
        MembershipApplication.countDocuments({
          status: MemberApplicationStatus.DRAFT,
        }),
        MembershipApplication.countDocuments({
          status: MemberApplicationStatus.PENDING,
        }),
        MembershipApplication.countDocuments({
          status: MemberApplicationStatus.APPROVED,
        }),
        MembershipApplication.countDocuments({
          status: MemberApplicationStatus.REJECTED,
        }),
        MembershipApplication.countDocuments({
          status: MemberApplicationStatus.WITHDRAWN,
        }),
        MembershipApplication.countDocuments(),
      ]);
    return { draft, pending, approved, rejected, withdrawn, total };
  }

  static async contactApplicant(
    id: string,
    senderId: string,
    message: string
  ): Promise<void> {
    const application = await MembershipApplication.findById(id);
    if (!application) throw AppError.notFound('Application not found');
    if (application.status === MemberApplicationStatus.DRAFT) {
      throw AppError.notFound('Application not found');
    }
    const sender = await User.findById(senderId).select('firstName lastName');
    if (!sender) throw AppError.notFound('Sender not found');
    await EmailService.sendFromTemplate(
      MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.CONTACT,
      application.verifiedEmail,
      application.communicationLocale ?? 'de',
      {
        firstName: application.personalInfo.firstName ?? '',
        lastName: application.personalInfo.lastName ?? '',
        message,
        senderName: `${sender.firstName} ${sender.lastName}`,
      }
    );
  }

  private static async sendApplicationReceivedEmail(
    application: Domain.MembershipApplication
  ): Promise<void> {
    await EmailService.sendFromTemplate(
      MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.RECEIVED,
      application.verifiedEmail,
      application.communicationLocale ?? 'de',
      {
        firstName: application.personalInfo.firstName ?? '',
        lastName: application.personalInfo.lastName ?? '',
      }
    );
  }

  private static async sendAdminAlertEmail(
    application: Domain.MembershipApplication
  ): Promise<void> {
    const { SettingsService } = await import('./settingsService');
    const recipients = await SettingsService.getApplicationAlertRecipients();
    const origin = (
      process.env.FRONTEND_URL ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    const applicationUrl = `${origin}/de/dashboard/applications?application=${encodeURIComponent(application.id)}`;
    await Promise.all(
      recipients.map((recipient) =>
        EmailService.sendFromTemplate(
          MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.ADMIN_ALERT,
          recipient,
          'de',
          {
            applicantName:
              `${application.personalInfo.firstName ?? ''} ${application.personalInfo.lastName ?? ''}`.trim(),
            email: application.verifiedEmail,
            membershipType:
              application.membershipType === 'student'
                ? 'Studenten-Mitgliedschaft'
                : application.membershipType === 'regular'
                  ? 'Reguläre Mitgliedschaft'
                  : '',
            applicationUrl,
          }
        )
      )
    );
  }
}
