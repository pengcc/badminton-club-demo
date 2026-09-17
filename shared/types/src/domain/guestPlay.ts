import type {
  GuestPlayLocale,
  GuestPlayNotificationStatus,
  GuestPlayStatus,
} from '../api/guestPlay';

export interface GuestPlayNotificationEntry {
  readonly status: GuestPlayNotificationStatus;
  readonly attempts: number;
  readonly lastAttemptAt?: Date;
  readonly recipients: readonly string[];
  readonly sentAt?: Date;
  readonly error?: 'configuration' | 'transport' | 'unknown';
  readonly claimedAt?: Date;
  readonly claimId?: string;
}

export interface GuestPlay {
  readonly id: string;
  readonly memberId: string;
  readonly memberName: string;
  readonly memberEmail: string;
  readonly guestCount: number;
  readonly message?: string;
  readonly status: GuestPlayStatus;
  readonly adminNotes?: string;
  readonly decisionBy?: string;
  readonly decisionAt?: Date;
  readonly appointment: {
    readonly locationId: string;
    readonly timeSlotId: string;
    readonly locationName: string;
    readonly locationAddress: string;
    readonly localDate: string;
    readonly startTime: string;
    readonly endTime: string;
    readonly startAt: Date;
  };
  readonly activeRequestKey?: string;
  readonly archived: boolean;
  readonly archivedAt?: Date;
  readonly archivedBy?: string;
  readonly notifications: {
    readonly memberReceipt: GuestPlayNotificationEntry;
    readonly administratorAlert: GuestPlayNotificationEntry;
    readonly decisionEmail: GuestPlayNotificationEntry;
  };
  readonly locale: GuestPlayLocale;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
