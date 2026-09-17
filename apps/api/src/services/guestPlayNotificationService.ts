import { randomUUID } from 'node:crypto';
import type { GuestPlayNotificationKind } from '@club/shared-types/api/guestPlay';
import { GUEST_PLAY_NOTIFICATION_STALE_MS } from '@club/shared-types/api/guestPlay';
import type { IGuestPlay } from '../models/GuestPlay';
import { GuestPlay } from '../models/GuestPlay';
import { GuestPlayPersistenceTransformer } from '../transformers/guestPlay';
import { AppError } from '../utils/errors';
import EmailService from './emailService';
import { GUEST_PLAY_EMAIL_TEMPLATES } from './emailContracts/guestPlay';
import { SettingsService } from './settingsService';
import { classifyEmailDeliveryError } from './emailDeliveryError';

type DeliveryOutcome = 'sent' | 'failed' | 'uncertain';

function appointmentDetails(
  request: IGuestPlay,
  locale: 'de' | 'en' | 'zh'
): string {
  const { localDate, startTime, endTime, locationName } = request.appointment;
  const [year, month, day] = localDate.split('-').map(Number);
  const formattedDate = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Europe/Berlin',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  return `${formattedDate}, ${startTime}–${endTime} · ${locationName}`;
}

async function recipientsFor(
  request: IGuestPlay,
  kind: GuestPlayNotificationKind
): Promise<string[]> {
  if (kind === 'administratorAlert') {
    const settings = await SettingsService.getSettings();
    return [
      ...new Set(
        (settings.notificationRecipients.guestPlayAlerts.additional ?? [])
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean)
      ),
    ];
  }
  return [request.memberEmail.trim().toLowerCase()];
}

async function send(
  request: IGuestPlay,
  kind: GuestPlayNotificationKind,
  recipients: string[]
) {
  const locale = request.locale;
  const variables = {
    memberName: request.memberName,
    memberEmail: request.memberEmail,
    guestCount: request.guestCount.toString(),
    message: request.message ?? '',
    appointmentDetails: appointmentDetails(
      request,
      kind === 'administratorAlert' ? 'de' : locale
    ),
    requestUrl: `${process.env.FRONTEND_URL?.replace(/\/$/, '') ?? ''}/de/dashboard/guest-play`,
  };

  if (kind === 'memberReceipt') {
    return EmailService.sendFromTemplate(
      GUEST_PLAY_EMAIL_TEMPLATES.RECEIVED,
      recipients[0],
      locale,
      variables
    );
  }
  if (kind === 'administratorAlert') {
    return EmailService.sendFromTemplate(
      GUEST_PLAY_EMAIL_TEMPLATES.ADMIN_ALERT,
      { bcc: recipients },
      'de',
      variables
    );
  }
  return EmailService.sendFromTemplate(
    request.status === 'approved'
      ? GUEST_PLAY_EMAIL_TEMPLATES.APPROVED
      : GUEST_PLAY_EMAIL_TEMPLATES.DECLINED,
    recipients[0],
    locale,
    variables
  );
}

async function latest(id: string) {
  const request = await GuestPlay.findById(id);
  if (!request) throw AppError.notFound('Guest Play request not found');
  return request;
}

export class GuestPlayNotificationService {
  private static async claim(
    id: string,
    kind: GuestPlayNotificationKind,
    expectedVersion?: number
  ): Promise<{ request: IGuestPlay; claimId: string } | null> {
    const current = await latest(id);
    const recipients = await recipientsFor(current, kind);
    if (kind === 'administratorAlert' && recipients.length === 0) {
      await GuestPlay.findOneAndUpdate(
        {
          _id: id,
          [`notifications.${kind}.status`]: 'not_attempted',
          ...(expectedVersion === undefined ? {} : { __v: expectedVersion }),
        },
        {
          $set: {
            [`notifications.${kind}.status`]: 'not_configured',
            [`notifications.${kind}.recipients`]: [],
            [`notifications.${kind}.error`]: 'configuration',
          },
          $inc: { __v: 1 },
        }
      );
      return null;
    }

    const claimId = randomUUID();
    const claimed = await GuestPlay.findOneAndUpdate(
      {
        _id: id,
        [`notifications.${kind}.status`]: 'not_attempted',
        ...(expectedVersion === undefined ? {} : { __v: expectedVersion }),
      },
      {
        $set: {
          [`notifications.${kind}.status`]: 'sending',
          [`notifications.${kind}.claimId`]: claimId,
          [`notifications.${kind}.claimedAt`]: new Date(),
          [`notifications.${kind}.lastAttemptAt`]: new Date(),
          [`notifications.${kind}.recipients`]: recipients,
        },
        $inc: { [`notifications.${kind}.attempts`]: 1, __v: 1 },
      },
      { new: true }
    );
    return claimed ? { request: claimed, claimId } : null;
  }

  private static async deliverClaimed(
    request: IGuestPlay,
    kind: GuestPlayNotificationKind,
    claimId: string
  ): Promise<void> {
    let outcome: DeliveryOutcome = 'sent';
    let error: 'transport' | 'unknown' | undefined;
    try {
      await send(request, kind, request.notifications[kind].recipients);
    } catch (caught) {
      outcome = classifyEmailDeliveryError(caught);
      error = outcome === 'failed' ? 'transport' : 'unknown';
    }

    const set: Record<string, unknown> = {
      [`notifications.${kind}.status`]: outcome,
      [`notifications.${kind}.lastAttemptAt`]: new Date(),
    };
    if (outcome === 'sent') set[`notifications.${kind}.sentAt`] = new Date();
    if (error) set[`notifications.${kind}.error`] = error;
    const unset: Record<string, 1> = {
      [`notifications.${kind}.claimId`]: 1,
      [`notifications.${kind}.claimedAt`]: 1,
    };
    if (!error) unset[`notifications.${kind}.error`] = 1;

    await GuestPlay.findOneAndUpdate(
      {
        _id: request._id,
        [`notifications.${kind}.status`]: 'sending',
        [`notifications.${kind}.claimId`]: claimId,
      },
      { $set: set, $unset: unset, $inc: { __v: 1 } }
    );
  }

  static async sendInitial(id: string): Promise<void> {
    for (const kind of ['memberReceipt', 'administratorAlert'] as const) {
      try {
        const claim = await this.claim(id, kind);
        if (claim)
          await this.deliverClaimed(claim.request, kind, claim.claimId);
      } catch {
        // One notification's tracking failure must not block the other attempt.
      }
    }
  }

  static async sendDecision(id: string): Promise<void> {
    const claim = await this.claim(id, 'decisionEmail');
    if (claim)
      await this.deliverClaimed(claim.request, 'decisionEmail', claim.claimId);
  }

  static async retry(
    id: string,
    kind: GuestPlayNotificationKind,
    expectedVersion: number
  ) {
    const current = await latest(id);
    const recipients = await recipientsFor(current, kind);
    if (kind === 'administratorAlert' && recipients.length === 0) {
      throw new AppError(
        'Guest Play alert recipients are not configured',
        409,
        'GUEST_PLAY_NOTIFICATION_NOT_CONFIGURED'
      );
    }
    const claimId = randomUUID();
    const staleBefore = new Date(Date.now() - GUEST_PLAY_NOTIFICATION_STALE_MS);
    const claimed = await GuestPlay.findOneAndUpdate(
      {
        _id: id,
        __v: expectedVersion,
        ...(kind === 'decisionEmail'
          ? { status: { $in: ['approved', 'declined'] } }
          : {}),
        $or: [
          {
            [`notifications.${kind}.status`]: { $in: ['failed', 'uncertain'] },
          },
          {
            [`notifications.${kind}.status`]: 'sending',
            [`notifications.${kind}.claimedAt`]: { $lte: staleBefore },
          },
        ],
      },
      {
        $set: {
          [`notifications.${kind}.status`]: 'sending',
          [`notifications.${kind}.claimId`]: claimId,
          [`notifications.${kind}.claimedAt`]: new Date(),
          [`notifications.${kind}.lastAttemptAt`]: new Date(),
          [`notifications.${kind}.recipients`]: recipients,
        },
        $unset: {
          [`notifications.${kind}.sentAt`]: 1,
          [`notifications.${kind}.error`]: 1,
        },
        $inc: { [`notifications.${kind}.attempts`]: 1, __v: 1 },
      },
      { new: true }
    );
    if (!claimed) {
      throw new AppError(
        'Guest Play notification cannot be retried from the current state',
        409,
        'GUEST_PLAY_NOTIFICATION_STATE_CONFLICT',
        { latest: GuestPlayPersistenceTransformer.toDomain(await latest(id)) }
      );
    }
    await this.deliverClaimed(claimed, kind, claimId);
    return GuestPlayPersistenceTransformer.toDomain(await latest(id));
  }
}
