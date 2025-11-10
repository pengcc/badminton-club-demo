import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { MembershipApplicationService } from '../services/membershipApplicationService';
import {
  CreateMembershipApplicationRequest,
  UpdateMembershipApplicationRequest,
  MembershipApplicationResponse
} from '@club/shared-types/api/membershipApplication';
import { MembershipApplicationApiTransformer } from '../transformers/membershipApplication';
import { MemberApplicationStatus } from '@club/shared-types/core/enums';

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
      const domainApplication = await MembershipApplicationService.createApplication(req.body);
      const apiApplication = MembershipApplicationApiTransformer.toApi(domainApplication);

      res.status(201).json({
        success: true,
        message: 'Membership application submitted successfully',
        data: apiApplication
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
    req: AuthenticatedRequest<unknown, { status?: string; limit?: string; offset?: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { status, limit, offset } = req.query;

      // Parse status enum
      let statusEnum: MemberApplicationStatus | undefined;
      if (status) {
        statusEnum = status === 'pending'
          ? MemberApplicationStatus.PENDING_REVIEW
          : status === 'approved'
          ? MemberApplicationStatus.APPLICATION_APPROVED
          : status === 'rejected'
          ? MemberApplicationStatus.APPLICATION_REJECTED
          : undefined;
      }

      const { applications, total } = await MembershipApplicationService.getAllApplications({
        status: statusEnum,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      });

      const apiApplications = applications.map(app =>
        MembershipApplicationApiTransformer.toApi(app)
      );

      res.status(200).json({
        success: true,
        data: apiApplications,
        pagination: {
          total,
          limit: limit ? parseInt(limit) : 50,
          offset: offset ? parseInt(offset) : 0,
          hasMore: (offset ? parseInt(offset) : 0) + apiApplications.length < total
        }
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
      const domainApplications = await MembershipApplicationService.getPendingApplications();
      const apiApplications = domainApplications.map(app =>
        MembershipApplicationApiTransformer.toApi(app)
      );

      res.status(200).json({
        success: true,
        data: apiApplications
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
        data: stats
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
      const domainApplication = await MembershipApplicationService.getApplicationById(req.params.id);

      if (!domainApplication) {
        res.status(404).json({
          success: false,
          error: 'Application not found'
        });
        return;
      }

      const apiApplication = MembershipApplicationApiTransformer.toApi(domainApplication);

      res.status(200).json({
        success: true,
        data: apiApplication
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /applications/:id
   * Update an application (admin only)
   */
  static async updateApplication(
    req: AuthenticatedRequest<UpdateMembershipApplicationRequest, unknown, { id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const domainApplication = await MembershipApplicationService.updateApplication(
        req.params.id,
        req.body
      );

      const apiApplication = MembershipApplicationApiTransformer.toApi(domainApplication);

      res.status(200).json({
        success: true,
        data: apiApplication
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
    req: AuthenticatedRequest<{ reviewNotes?: string }, unknown, { id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const reviewerId = req.user!.id;
      const { reviewNotes } = req.body;

      const domainApplication = await MembershipApplicationService.approveApplication(
        req.params.id,
        reviewerId,
        reviewNotes
      );

      const apiApplication = MembershipApplicationApiTransformer.toApi(domainApplication);

      res.status(200).json({
        success: true,
        message: 'Application approved successfully',
        data: apiApplication
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
    req: AuthenticatedRequest<{ reason: string }, unknown, { id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const reviewerId = req.user!.id;
      const { reason } = req.body;

      if (!reason) {
        res.status(400).json({
          success: false,
          error: 'Rejection reason is required'
        });
        return;
      }

      const domainApplication = await MembershipApplicationService.rejectApplication(
        req.params.id,
        reviewerId,
        reason
      );

      const apiApplication = MembershipApplicationApiTransformer.toApi(domainApplication);

      res.status(200).json({
        success: true,
        message: 'Application rejected',
        data: apiApplication
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /applications/:id
   * Delete an application (admin only)
   */
  static async deleteApplication(
    req: AuthenticatedRequest<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await MembershipApplicationService.deleteApplication(req.params.id);

      res.status(200).json({
        success: true,
        message: 'Application deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
