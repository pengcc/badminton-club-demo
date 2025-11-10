import { Types } from 'mongoose';
import { Domain } from '@club/shared-types/domain/membershipApplication';
import { MembershipApplicationPersistence } from '../types/persistence/membershipApplication';
import {
  CreateMembershipApplicationRequest,
  UpdateMembershipApplicationRequest,
  MembershipApplicationResponse
} from '@club/shared-types/api/membershipApplication';
import { MemberApplicationStatus } from '@club/shared-types/core/enums';

/**
 * MembershipApplication Persistence ↔ Domain Transformers
 * Handles ObjectId ↔ string conversions and BaseDocument mapping
 */
export class MembershipApplicationPersistenceTransformer {
  /**
   * Transform MembershipApplicationPersistence to Domain.MembershipApplication
   * Converts ObjectId to string for domain layer
   * Maps reviewer/reviewDate to reviewer/reviewDate for domain consistency
   * 
   * Note: dateOfBirth is kept as string (YYYY-MM-DD) to match persistence layer.
   * Previously attempted Date conversion here, but that bypassed Mongoose schema
   * validation which expects string format. Now just pass-through.
   */
  static toDomain(doc: MembershipApplicationPersistence): Domain.MembershipApplication {
    return {
      id: doc._id.toString(),
      personalInfo: {
        ...doc.personalInfo,
        // Keep as YYYY-MM-DD string to align with persistence/domain layers
        dateOfBirth: doc.personalInfo.dateOfBirth
      },
      membershipType: doc.membershipType,
      bankingInfo: doc.bankingInfo,
      canParticipate: doc.canParticipate,
      motivation: doc.motivation,
      hasConditions: doc.hasConditions,
      conditions: doc.conditions,
      status: doc.status,
      documents: doc.documents,
      reviewer: doc.reviewer?.toString(),
      reviewDate: doc.reviewDate ? new Date(doc.reviewDate) : undefined,
      reviewNotes: doc.reviewNotes,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }

  /**
   * Transform Domain.MembershipApplication to MembershipApplicationPersistence (for creation/update)
   * Note: This returns a partial document without _id (for creation)
   */
  static toPersistence(
    application: Omit<Domain.MembershipApplication, 'id' | 'createdAt' | 'updatedAt'>
  ): Omit<MembershipApplicationPersistence, keyof import('../types/persistence/base').BaseDocument> {
    return {
      personalInfo: {
        ...application.personalInfo,
        dateOfBirth: application.personalInfo.dateOfBirth
      },
      membershipType: application.membershipType,
      bankingInfo: application.bankingInfo,
      canParticipate: application.canParticipate,
      motivation: application.motivation,
      hasConditions: application.hasConditions,
      conditions: application.conditions,
      status: application.status,
      documents: application.documents,
      reviewer: application.reviewer,
      reviewDate: application.reviewDate,
      reviewNotes: application.reviewNotes
    };
  }
}

/**
 * MembershipApplication Domain ↔ API Transformers
 * Handles Date ↔ ISO string conversions
 */
export class MembershipApplicationApiTransformer {
  /**
   * Transform Domain.MembershipApplication to API response
   * Converts Date to ISO string
   *
   * Note: dateOfBirth is already a YYYY-MM-DD string in domain layer, no conversion needed.
   * Previously converted Date → string here (.toISOString().split('T')[0]), but now 
   * dateOfBirth stays as string throughout backend layers for consistency.
   * 
   * Note: Domain layer incorrectly uses MembershipStatus instead of MemberApplicationStatus
   * We cast to work around this type system inconsistency
   */
  static toApi(application: Domain.MembershipApplication): MembershipApplicationResponse {
    // Cast status to correct type (Domain layer has wrong enum)
    const status = application.status as unknown as MemberApplicationStatus;

    // Map MemberApplicationStatus enum to API status literals
    const apiStatus = status === MemberApplicationStatus.APPLICATION_APPROVED
      ? 'approved'
      : status === MemberApplicationStatus.APPLICATION_REJECTED
      ? 'rejected'
      : 'pending' as const;

    return {
      id: application.id,
      personalInfo: {
        ...application.personalInfo,
        // Already a YYYY-MM-DD string
        dateOfBirth: application.personalInfo.dateOfBirth
      },
      membershipType: application.membershipType,
      hasConditions: application.hasConditions,
      conditions: application.conditions,
      canParticipate: application.canParticipate,
      motivation: application.motivation,
      bankingInfo: application.bankingInfo,
      status: apiStatus,
      documents: application.documents,
      reviewer: application.reviewer,
      reviewDate: application.reviewDate?.toISOString(),
      reviewNotes: application.reviewNotes,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString()
    };
  }

  /**
   * Transform CreateMembershipApplicationRequest to partial Domain.MembershipApplication
   * Converts ISO string to Date
   * Note: Returns partial application data for creation
   * 
   * Note: dateOfBirth is preserved as string (YYYY-MM-DD). Previously converted to Date
   * here (new Date(...)), but that caused Mongoose validation to fail since the schema
   * expects string format. Now transformer just passes through the string.
   */
  static fromCreateRequest(
    request: CreateMembershipApplicationRequest
  ): Omit<Domain.MembershipApplication, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'documents' | 'reviewer' | 'reviewDate' | 'reviewNotes'> {
    return {
      personalInfo: {
        ...request.personalInfo,
        // Preserve as string; Mongoose schema validates format
        dateOfBirth: request.personalInfo.dateOfBirth
      },
      membershipType: request.membershipType,
      bankingInfo: request.bankingInfo,
      canParticipate: request.canParticipate,
      motivation: request.motivation,
      hasConditions: request.hasConditions,
      conditions: request.conditions
    };
  }

  /**
   * Transform UpdateMembershipApplicationRequest to partial Domain.MembershipApplication
   * Handles partial updates (typically for approval/rejection)
   *
   * Note: We map API status literals to MemberApplicationStatus enum
   */
  static fromUpdateRequest(
    request: UpdateMembershipApplicationRequest
  ): Partial<Pick<Domain.MembershipApplication, 'status' | 'reviewNotes'>> {
    // Map API status to enum (cast needed due to Domain layer type inconsistency)
    let status: MemberApplicationStatus | undefined;
    if (request.status === 'approved') {
      status = MemberApplicationStatus.APPLICATION_APPROVED;
    } else if (request.status === 'rejected') {
      status = MemberApplicationStatus.APPLICATION_REJECTED;
    } else if (request.status === 'pending') {
      status = MemberApplicationStatus.PENDING_REVIEW;
    }

    return {
      status: status as any, // Cast needed due to Domain layer using wrong enum
      reviewNotes: request.reviewNotes
    };
  }
}
