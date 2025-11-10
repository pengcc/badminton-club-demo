import { MembershipApplication } from '../models/MembershipApplication';
import { User } from '../models/User';
import { Types } from 'mongoose';
import {
  MembershipApplicationPersistenceTransformer,
  MembershipApplicationApiTransformer
} from '../transformers/membershipApplication';
import type { Domain } from '@club/shared-types/domain/membershipApplication';
import type {
  CreateMembershipApplicationRequest,
  UpdateMembershipApplicationRequest} from '@club/shared-types/api/membershipApplication';

import { MemberApplicationStatus } from '@club/shared-types/core/enums';
import type { MembershipApplicationPersistence } from '../types/persistence/membershipApplication';

/**
 * Service for MembershipApplication entity operations
 * Handles business logic and transformations between layers
 */
export class MembershipApplicationService {
  /**
   * Create a new membership application
   */
  static async createApplication(
    request: CreateMembershipApplicationRequest
  ): Promise<Domain.MembershipApplication> {
    const domainData = MembershipApplicationApiTransformer.fromCreateRequest(request);

    // Check if an application with this email already exists
    const existingApplication = await MembershipApplication.findOne({
      'personalInfo.email': domainData.personalInfo.email,
      status: MemberApplicationStatus.PENDING_REVIEW
    });

    if (existingApplication) {
      throw new Error('An application with this email already exists and is pending review');
    }

    // Create persistence data with initial status
    const persistenceData = MembershipApplicationPersistenceTransformer.toPersistence({
      ...domainData,
      status: MemberApplicationStatus.PENDING_REVIEW as any, // Cast due to Domain type inconsistency
      documents: {},
      reviewer: undefined,
      reviewDate: undefined,
      reviewNotes: undefined
    });

    const application = await MembershipApplication.create(persistenceData);
    const saved = application.toObject() as unknown as MembershipApplicationPersistence;
    return MembershipApplicationPersistenceTransformer.toDomain(saved);
  }

  /**
   * Get application by ID
   */
  static async getApplicationById(id: string): Promise<Domain.MembershipApplication | null> {
    const application = await MembershipApplication.findById(id).lean<MembershipApplicationPersistence>();
    if (!application) return null;
    return MembershipApplicationPersistenceTransformer.toDomain(application);
  }

  /**
   * Get all applications with optional filters
   */
  static async getAllApplications(options?: {
    status?: MemberApplicationStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ applications: Domain.MembershipApplication[]; total: number }> {
    const { status, limit = 50, offset = 0 } = options || {};

    const filter: any = {};
    if (status) {
      filter.status = status;
    }

    const applications = await MembershipApplication.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean<MembershipApplicationPersistence[]>();

    const total = await MembershipApplication.countDocuments(filter);

    return {
      applications: applications.map(app =>
        MembershipApplicationPersistenceTransformer.toDomain(app)
      ),
      total
    };
  }

  /**
   * Get pending applications (awaiting review)
   */
  static async getPendingApplications(): Promise<Domain.MembershipApplication[]> {
    const applications = await MembershipApplication.find({
      status: MemberApplicationStatus.PENDING_REVIEW
    })
      .sort({ createdAt: 1 }) // Oldest first
      .lean<MembershipApplicationPersistence[]>();

    return applications.map(app =>
      MembershipApplicationPersistenceTransformer.toDomain(app)
    );
  }

  /**
   * Update application (partial update)
   */
  static async updateApplication(
    id: string,
    request: UpdateMembershipApplicationRequest
  ): Promise<Domain.MembershipApplication> {
    const updates = MembershipApplicationApiTransformer.fromUpdateRequest(request);

    const application = await MembershipApplication.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).lean<MembershipApplicationPersistence>();

    if (!application) {
      throw new Error('Application not found');
    }
    return MembershipApplicationPersistenceTransformer.toDomain(application);
  }

  /**
   * Approve an application and create user account
   */
  static async approveApplication(
    id: string,
    reviewerId: string,
    reviewNotes?: string
  ): Promise<Domain.MembershipApplication> {
    const application = await MembershipApplication.findById(id);

    if (!application) {
      throw new Error('Application not found');
    }

    if (application.status !== MemberApplicationStatus.PENDING_REVIEW) {
      throw new Error('Application has already been reviewed');
    }

    // Check if user with this email already exists
    const existingUser = await User.findOne({
      email: application.personalInfo.email
    });

    if (existingUser) {
      throw new Error('A user with this email already exists');
    }

    // Update application status
    application.status = MemberApplicationStatus.APPLICATION_APPROVED;
    application.reviewer = new Types.ObjectId(reviewerId) as any;
    application.reviewDate = new Date();
    application.reviewNotes = reviewNotes;

    await application.save();

    // TODO: Create User account with MEMBER role
    // This would typically be done here:
    // await UserService.createUserFromApplication(application);

    const saved = application.toObject() as unknown as MembershipApplicationPersistence;
    return MembershipApplicationPersistenceTransformer.toDomain(saved);
  }

  /**
   * Reject an application
   */
  static async rejectApplication(
    id: string,
    reviewerId: string,
    reason: string
  ): Promise<Domain.MembershipApplication> {
    const application = await MembershipApplication.findById(id);

    if (!application) {
      throw new Error('Application not found');
    }

    if (application.status !== MemberApplicationStatus.PENDING_REVIEW) {
      throw new Error('Application has already been reviewed');
    }

    // Update application status
    application.status = MemberApplicationStatus.APPLICATION_REJECTED;
    application.reviewer = new Types.ObjectId(reviewerId) as any;
    application.reviewDate = new Date();
    application.reviewNotes = reason;

    await application.save();

    const saved = application.toObject() as unknown as MembershipApplicationPersistence;
    return MembershipApplicationPersistenceTransformer.toDomain(saved);
  }

  /**
   * Delete an application (soft delete if needed, or hard delete)
   */
  static async deleteApplication(id: string): Promise<void> {
    const result = await MembershipApplication.findByIdAndDelete(id);
    if (!result) {
      throw new Error('Application not found');
    }
  }

  /**
   * Check if email has existing application
   */
  static async hasExistingApplication(email: string): Promise<boolean> {
    const existing = await MembershipApplication.findOne({
      'personalInfo.email': email,
      status: MemberApplicationStatus.PENDING_REVIEW
    });

    return !!existing;
  }

  /**
   * Get application statistics
   */
  static async getApplicationStats(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  }> {
    const [pending, approved, rejected, total] = await Promise.all([
      MembershipApplication.countDocuments({ status: MemberApplicationStatus.PENDING_REVIEW }),
      MembershipApplication.countDocuments({ status: MemberApplicationStatus.APPLICATION_APPROVED }),
      MembershipApplication.countDocuments({ status: MemberApplicationStatus.APPLICATION_REJECTED }),
      MembershipApplication.countDocuments()
    ]);

    return { pending, approved, rejected, total };
  }
}
