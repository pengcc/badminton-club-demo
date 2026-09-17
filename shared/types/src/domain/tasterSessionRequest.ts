import type {
  TasterSessionDeclineReason,
  TasterSessionDeliveryStatus,
  TasterSessionPlayerLevel,
  TasterSessionStatus,
} from '../api/tasterSessionRequest';

export interface TasterSessionRequest {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly playerLevel: TasterSessionPlayerLevel;
  readonly message?: string;
  readonly status: TasterSessionStatus;
  readonly adminNotes?: string;
  readonly declineReason?: TasterSessionDeclineReason;
  readonly declineReasonDetails?: string;
  readonly dispositionBy?: string;
  readonly dispositionAt?: Date;
  readonly preference?: {
    readonly optionId: string;
    readonly startsAt: Date;
    readonly locationId: string;
    readonly locationName: string;
    readonly timeSlotId?: string;
    readonly locationAddress?: string;
    readonly localDate?: string;
    readonly startTime?: string;
    readonly endTime?: string;
    readonly participationNote?: string;
  };
  readonly archived: boolean;
  readonly archivedAt?: Date;
  readonly archivedBy?: string;
  readonly delivery: {
    readonly status: TasterSessionDeliveryStatus;
    readonly claimedAt?: Date;
    readonly attemptedAt?: Date;
  };
  readonly locale: 'de' | 'en' | 'zh';
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
