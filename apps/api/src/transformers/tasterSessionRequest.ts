import type { TasterSessionRequest as DomainTasterSessionRequest } from '@club/shared-types/domain/tasterSessionRequest';
import type { TasterSessionRequestResponse } from '@club/shared-types/api/tasterSessionRequest';
import type { ITasterSessionRequest } from '../models/TasterSessionRequest';

export class TasterSessionRequestTransformer {
  static toDomain(document: ITasterSessionRequest): DomainTasterSessionRequest {
    return {
      id: document._id.toString(),
      name: document.name,
      email: document.email,
      playerLevel: document.playerLevel,
      message: document.message,
      status: document.status,
      adminNotes: document.adminNotes,
      declineReason: document.declineReason,
      declineReasonDetails: document.declineReasonDetails,
      dispositionBy: document.dispositionBy?.toString(),
      dispositionAt: document.dispositionAt,
      preference: document.preference
        ? {
            optionId: document.preference.optionId,
            startsAt: document.preference.startsAt,
            locationId: document.preference.locationId,
            locationName: document.preference.locationName,
            timeSlotId: document.preference.timeSlotId,
            locationAddress: document.preference.locationAddress,
            localDate: document.preference.localDate,
            startTime: document.preference.startTime,
            endTime: document.preference.endTime,
            participationNote: document.preference.participationNote,
          }
        : undefined,
      archived: document.archived,
      archivedAt: document.archivedAt,
      archivedBy: document.archivedBy?.toString(),
      delivery: {
        status: document.delivery.status,
        claimedAt: document.delivery.claimedAt,
        attemptedAt: document.delivery.attemptedAt,
      },
      locale: document.locale,
      version: document.__v,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  static toResponse(
    domain: DomainTasterSessionRequest
  ): TasterSessionRequestResponse {
    const staleClaim =
      domain.delivery.status === 'in_progress' &&
      domain.delivery.claimedAt !== undefined &&
      Date.now() - domain.delivery.claimedAt.getTime() >= 10 * 60 * 1000;

    return {
      id: domain.id,
      name: domain.name,
      email: domain.email,
      playerLevel: domain.playerLevel,
      message: domain.message,
      status: domain.status,
      adminNotes: domain.adminNotes,
      declineReason: domain.declineReason,
      declineReasonDetails: domain.declineReasonDetails,
      dispositionBy: domain.dispositionBy,
      dispositionAt: domain.dispositionAt?.toISOString(),
      preference: domain.preference
        ? {
            optionId: domain.preference.optionId,
            startsAt: domain.preference.startsAt.toISOString(),
            locationId: domain.preference.locationId,
            locationName: domain.preference.locationName,
            timeSlotId: domain.preference.timeSlotId,
            locationAddress: domain.preference.locationAddress,
            localDate: domain.preference.localDate,
            startTime: domain.preference.startTime,
            endTime: domain.preference.endTime,
            participationNote: domain.preference.participationNote,
          }
        : undefined,
      archived: domain.archived,
      archivedAt: domain.archivedAt?.toISOString(),
      archivedBy: domain.archivedBy,
      delivery: {
        status: staleClaim ? 'uncertain' : domain.delivery.status,
        attemptedAt: domain.delivery.attemptedAt?.toISOString(),
        retryAvailable:
          domain.delivery.status === 'failed' ||
          domain.delivery.status === 'uncertain' ||
          staleClaim,
      },
      locale: domain.locale,
      version: domain.version,
      createdAt: domain.createdAt.toISOString(),
      updatedAt: domain.updatedAt.toISOString(),
    };
  }

  static fromDocument(
    document: ITasterSessionRequest
  ): TasterSessionRequestResponse {
    return this.toResponse(this.toDomain(document));
  }
}
