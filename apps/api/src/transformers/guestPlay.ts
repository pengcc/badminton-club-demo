import type { GuestPlay as DomainGuestPlay } from '@club/shared-types/domain/guestPlay';
import type {
  GuestPlayAdminResponse,
  GuestPlayMemberResponse,
} from '@club/shared-types/api/guestPlay';
import { GUEST_PLAY_NOTIFICATION_STALE_MS } from '@club/shared-types/api/guestPlay';
import type { IGuestPlay } from '../models/GuestPlay';
import type { GuestPlayNotificationEntry } from '@club/shared-types/domain/guestPlay';

function notificationEntry(entry: GuestPlayNotificationEntry) {
  return {
    status: entry.status,
    attempts: entry.attempts,
    lastAttemptAt: entry.lastAttemptAt?.toISOString(),
    recipients: [...entry.recipients],
    sentAt: entry.sentAt?.toISOString(),
    error: entry.error,
    retryAvailable:
      ['failed', 'uncertain'].includes(entry.status) ||
      (entry.status === 'sending' &&
        Boolean(
          entry.claimedAt &&
            entry.claimedAt.getTime() <=
              Date.now() - GUEST_PLAY_NOTIFICATION_STALE_MS
        )),
  };
}

export class GuestPlayPersistenceTransformer {
  static toDomain(doc: IGuestPlay): DomainGuestPlay {
    return {
      id: doc._id.toString(),
      memberId: doc.memberId.toString(),
      memberName: doc.memberName,
      memberEmail: doc.memberEmail,
      guestCount: doc.guestCount,
      message: doc.message,
      status: doc.status,
      adminNotes: doc.adminNotes,
      decisionBy: doc.decisionBy?.toString(),
      decisionAt: doc.decisionAt,
      appointment: {
        locationId: doc.appointment.locationId,
        timeSlotId: doc.appointment.timeSlotId,
        locationName: doc.appointment.locationName,
        locationAddress: doc.appointment.locationAddress,
        localDate: doc.appointment.localDate,
        startTime: doc.appointment.startTime,
        endTime: doc.appointment.endTime,
        startAt: doc.appointment.startAt,
      },
      activeRequestKey: doc.activeRequestKey,
      archived: doc.archived,
      archivedAt: doc.archivedAt,
      archivedBy: doc.archivedBy?.toString(),
      notifications: doc.notifications,
      locale: doc.locale,
      version: doc.__v,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}

function base(domain: DomainGuestPlay) {
  return {
    id: domain.id,
    memberId: domain.memberId,
    guestCount: domain.guestCount,
    message: domain.message,
    status: domain.status,
    appointment: {
      ...domain.appointment,
      startAt: domain.appointment.startAt.toISOString(),
    },
    locale: domain.locale,
    version: domain.version,
    createdAt: domain.createdAt.toISOString(),
    updatedAt: domain.updatedAt.toISOString(),
  };
}

export class GuestPlayApiTransformer {
  static toMemberResponse(domain: DomainGuestPlay): GuestPlayMemberResponse {
    return {
      ...base(domain),
      decisionAt: domain.decisionAt?.toISOString(),
    };
  }

  static toAdminResponse(domain: DomainGuestPlay): GuestPlayAdminResponse {
    return {
      ...base(domain),
      memberName: domain.memberName,
      memberEmail: domain.memberEmail,
      adminNotes: domain.adminNotes,
      decisionBy: domain.decisionBy,
      decisionAt: domain.decisionAt?.toISOString(),
      archived: domain.archived,
      archivedAt: domain.archivedAt?.toISOString(),
      archivedBy: domain.archivedBy,
      notifications: {
        memberReceipt: notificationEntry(domain.notifications.memberReceipt),
        administratorAlert: notificationEntry(
          domain.notifications.administratorAlert
        ),
        decisionEmail: notificationEntry(domain.notifications.decisionEmail),
      },
    };
  }
}
