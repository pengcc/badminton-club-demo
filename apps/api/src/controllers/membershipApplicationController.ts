import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { MembershipApplicationService } from '../services/membershipApplicationService';
import { AuditService } from '../services/auditService';
import {
  AuditEventType,
  EntityType,
  MemberApplicationStatus,
} from '@club/shared-types/core/enums';
import type {
  CreateMembershipApplicationRequest,
  UpdateMembershipApplicationRequest,
} from '@club/shared-types/api/membershipApplication';
import {
  approveMembershipApplicationSchema,
  rejectMembershipApplicationSchema,
  updateMembershipApplicationSchema,
} from '@club/shared-types/api/membershipApplication';

import { MembershipApplicationApiTransformer } from '../transformers/membershipApplication';
import { RegistrationAccessService } from '../services/registrationAccessService';
import { AppError } from '../utils/errors';
import { RegistrationApprovalService } from '../services/registrationApprovalService';
import { PasswordSetupDeliveryService } from '../services/passwordSetupDeliveryService';
import { membershipStudentProofService } from '../services/membershipStudentProofService';
import { MembershipSignedReceiptService } from '../services/membershipSignedReceiptService';
import { MembershipApplicationDecisionDeliveryService } from '../services/membershipApplicationDecisionDeliveryService';

function receiptKind(value: string): 'application' | 'sepa' {
  if (value !== 'application' && value !== 'sepa')
    throw AppError.notFound('Receipt type not found');
  return value;
}

/**
 * Controller for MembershipApplication entity operations
 * Thin layer that delegates to MembershipApplicationService
 */
export class MembershipApplicationController {
  /**
   * POST /applications
   * Submit a new membership application (public route)
   */
  static async createApplication(
    req: Request<unknown, unknown, CreateMembershipApplicationRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const accessToken = RegistrationAccessService.requireTokenHeader(
        req.headers
      );
      if (!(await RegistrationAccessService.validate(accessToken))) {
        throw new AppError('Registration is unavailable', 404);
      }
      const domainApplication =
        await MembershipApplicationService.createApplication(req.body);
      const apiApplication =
        MembershipApplicationApiTransformer.toApi(domainApplication);

      res.status(201).json({
        success: true,
        message: 'Membership application submitted successfully',
        data: apiApplication,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStudentProof(
    req: AuthenticatedRequest<
      unknown,
      { download?: string },
      { id: string; proofId: string }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { metadata, buffer } =
        await membershipStudentProofService.readForAdmin(
          req.params.id,
          req.params.proofId
        );
      const safeName = metadata.originalName.replace(/["\\\r\n]/g, '_');
      res.setHeader('Content-Type', metadata.mimeType);
      res.setHeader(
        'Content-Disposition',
        `${req.query.download === 'true' ? 'attachment' : 'inline'}; filename="${safeName}"`
      );
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  static async deleteStudentProof(
    req: AuthenticatedRequest<
      unknown,
      unknown,
      { id: string; proofId: string }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await membershipStudentProofService.deleteForAdmin(
        req.params.id,
        req.params.proofId
      );
      AuditService.writeBestEffort({
        eventType: AuditEventType.APPLICATION_UPDATED,
        entityType: EntityType.MEMBERSHIP_APPLICATION,
        entityId: req.params.id,
        actor: { id: req.user.id, accountKind: req.user.accountKind },
        changes: [{ field: 'studentProof', oldValue: req.params.proofId }],
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async confirmSignedReceipt(
    req: AuthenticatedRequest<unknown, unknown, { id: string; kind: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const kind = receiptKind(req.params.kind);
      await MembershipSignedReceiptService.confirm(
        req.params.id,
        kind,
        req.user.id
      );
      AuditService.writeBestEffort({
        eventType: AuditEventType.APPLICATION_UPDATED,
        entityType: EntityType.MEMBERSHIP_APPLICATION,
        entityId: req.params.id,
        actor: { id: req.user.id, accountKind: req.user.accountKind },
        changes: [{ field: `${kind}Receipt`, newValue: 'confirmed' }],
      });
      const application = await MembershipApplicationService.getApplicationById(
        req.params.id
      );
      res.json({
        success: true,
        data: MembershipApplicationApiTransformer.toApi(application!),
      });
    } catch (error) {
      next(error);
    }
  }

  static async resetSignedReceipt(
    req: AuthenticatedRequest<unknown, unknown, { id: string; kind: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const kind = receiptKind(req.params.kind);
      await MembershipSignedReceiptService.reset(req.params.id, kind);
      AuditService.writeBestEffort({
        eventType: AuditEventType.APPLICATION_UPDATED,
        entityType: EntityType.MEMBERSHIP_APPLICATION,
        entityId: req.params.id,
        actor: { id: req.user.id, accountKind: req.user.accountKind },
        reason: 'Administrator reset',
        changes: [
          {
            field: `${kind}Receipt`,
            oldValue: 'confirmed',
            newValue: 'pending',
          },
        ],
      });
      const application = await MembershipApplicationService.getApplicationById(
        req.params.id
      );
      res.json({
        success: true,
        data: MembershipApplicationApiTransformer.toApi(application!),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /applications
   * Get all applications with optional filters (admin only)
   */
  static async getAllApplications(
    req: AuthenticatedRequest<
      unknown,
      { status?: string; limit?: string; offset?: string }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { status, limit, offset } = req.query;

      // Parse status enum
      let statusEnum: MemberApplicationStatus | undefined;
      if (status) {
        statusEnum =
          status !== MemberApplicationStatus.DRAFT &&
          Object.values(MemberApplicationStatus).includes(
            status as MemberApplicationStatus
          )
            ? (status as MemberApplicationStatus)
            : undefined;
      }

      const { applications, total } =
        await MembershipApplicationService.getAllApplications({
          status: statusEnum,
          limit: limit ? parseInt(limit) : undefined,
          offset: offset ? parseInt(offset) : undefined,
        });

      const apiApplications = applications.map((app) =>
        MembershipApplicationApiTransformer.toApi(app)
      );

      res.status(200).json({
        success: true,
        data: apiApplications,
        pagination: {
          total,
          limit: limit ? parseInt(limit) : 50,
          offset: offset ? parseInt(offset) : 0,
          hasMore:
            (offset ? parseInt(offset) : 0) + apiApplications.length < total,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /applications/pending
   * Get all pending applications (admin only)
   */
  static async getPendingApplications(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const domainApplications =
        await MembershipApplicationService.getPendingApplications();
      const apiApplications = domainApplications.map((app) =>
        MembershipApplicationApiTransformer.toApi(app)
      );

      res.status(200).json({
        success: true,
        data: apiApplications,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /applications/stats
   * Get application statistics (admin only)
   */
  static async getApplicationStats(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await MembershipApplicationService.getApplicationStats();

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /applications/:id
   * Get a specific application by ID (admin only)
   */
  static async getApplicationById(
    req: AuthenticatedRequest<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const domainApplication =
        await MembershipApplicationService.getApplicationById(req.params.id);

      if (
        !domainApplication ||
        domainApplication.status === MemberApplicationStatus.DRAFT
      ) {
        res.status(404).json({
          success: false,
          error: 'Application not found',
        });
        return;
      }

      const apiApplication =
        MembershipApplicationApiTransformer.toApi(domainApplication);

      res.status(200).json({
        success: true,
        data: apiApplication,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /applications/:id/review-note
   * Update only the administrator's internal review note.
   */
  static async updateApplication(
    req: AuthenticatedRequest<
      UpdateMembershipApplicationRequest,
      unknown,
      { id: string }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const update = updateMembershipApplicationSchema.parse(req.body);
      const domainApplication =
        await MembershipApplicationService.updateApplication(
          req.params.id,
          update
        );

      const apiApplication =
        MembershipApplicationApiTransformer.toApi(domainApplication);

      // Audit log: Application updated
      AuditService.writeBestEffort({
        eventType: AuditEventType.APPLICATION_UPDATED,
        entityType: EntityType.MEMBERSHIP_APPLICATION,
        entityId: req.params.id,
        actor: {
          id: req.user.id,
          accountKind: req.user.accountKind,
        },
        changes: Object.keys(update).map((field) => ({ field })),
      });

      res.status(200).json({
        success: true,
        data: apiApplication,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /applications/:id/approve
   * Approve an application (admin only)
   */
  static async approveApplication(
    req: AuthenticatedRequest<
      { reviewNote?: string; approvalMessage?: string },
      unknown,
      { id: string }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { reviewNote, approvalMessage } =
        approveMembershipApplicationSchema.parse(req.body);
      const idempotencyKey = req.get('Idempotency-Key');
      if (!idempotencyKey)
        throw AppError.badRequest('Idempotency-Key header is required');
      const result = await RegistrationApprovalService.approve({
        applicationId: req.params.id,
        reviewNote,
        approvalMessage,
        idempotencyKey,
        actor: {
          id: req.user.id,
          email: req.user.email,
          accountKind: req.user.accountKind,
          displayName: req.user.displayName,
          capabilities: req.user.capabilities,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      });

      res.status(200).json({
        success: true,
        message: 'Application approved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async reissuePasswordSetup(
    req: AuthenticatedRequest<unknown, unknown, { id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await PasswordSetupDeliveryService.reissueForApplication(
        req.params.id
      );
      res.status(200).json({
        success: true,
        message: 'Password setup reissued',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /applications/:id/reject
   * Reject an application (admin only)
   */
  static async rejectApplication(
    req: AuthenticatedRequest<
      { reason: string; reviewNote?: string },
      unknown,
      { id: string }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const reviewerId = req.user!.id;
      const { reason, reviewNote } = rejectMembershipApplicationSchema.parse(
        req.body
      );

      const domainApplication =
        await MembershipApplicationService.rejectApplication(
          req.params.id,
          reviewerId,
          reason,
          reviewNote
        );

      const apiApplication =
        MembershipApplicationApiTransformer.toApi(domainApplication);

      // Audit log: Application rejected
      AuditService.writeBestEffort({
        eventType: AuditEventType.APPLICATION_REJECTED,
        entityType: EntityType.MEMBERSHIP_APPLICATION,
        entityId: req.params.id,
        actor: {
          id: req.user.id,
          accountKind: req.user.accountKind,
        },
        reason,
        changes: [
          { field: 'status', oldValue: 'pending', newValue: 'rejected' },
          {
            field: 'decisionNotificationStatus',
            newValue: domainApplication.decisionNotificationStatus,
          },
        ],
      });

      res.status(200).json({
        success: true,
        message: 'Application rejected',
        data: apiApplication,
      });
    } catch (error) {
      next(error);
    }
  }

  static async retryDecisionNotification(
    req: AuthenticatedRequest<unknown, unknown, { id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const deliveryStatus =
        await MembershipApplicationDecisionDeliveryService.deliver(
          req.params.id
        );
      const application = await MembershipApplicationService.getApplicationById(
        req.params.id
      );
      if (!application) throw AppError.notFound('Application not found');
      AuditService.writeBestEffort({
        eventType: AuditEventType.APPLICATION_UPDATED,
        entityType: EntityType.MEMBERSHIP_APPLICATION,
        entityId: req.params.id,
        actor: { id: req.user.id, accountKind: req.user.accountKind },
        changes: [
          { field: 'decisionNotificationStatus', newValue: deliveryStatus },
        ],
      });
      res.json({
        success: true,
        data: MembershipApplicationApiTransformer.toApi(application),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /applications/:id/contact
   * Send a custom message to applicant (admin only)
   */
  static async contactApplicant(
    req: AuthenticatedRequest<{ message: string }, unknown, { id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const senderId = req.user!.id;
      const { message } = req.body;

      if (!message) {
        res.status(400).json({
          success: false,
          error: 'Message is required',
        });
        return;
      }

      await MembershipApplicationService.contactApplicant(
        req.params.id,
        senderId,
        message
      );

      // Audit log: Applicant contacted
      AuditService.writeBestEffort({
        eventType: AuditEventType.APPLICATION_CONTACTED,
        entityType: EntityType.MEMBERSHIP_APPLICATION,
        entityId: req.params.id,
        actor: {
          id: req.user.id,
          accountKind: req.user.accountKind,
        },
        changes: [{ field: 'contact', newValue: 'sent' }],
      });

      res.status(200).json({
        success: true,
        message: 'Message sent successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
