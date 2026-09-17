import { randomUUID } from 'node:crypto';
import type {
  CreateTasterSessionRequest,
  TasterSessionDispositionCommand,
  TasterSessionListQuery,
  TasterSessionRequestListResponse,
  TasterSessionRequestResponse,
  TasterSessionRequestStatsResponse,
} from '@club/shared-types/api/tasterSessionRequest';
import { formatStoredTasterSessionPreferenceDetails } from '@club/shared-types/view/tasterSessionRequest';
import { TasterSessionRequestModel } from '../models/TasterSessionRequest';
import { TasterSessionRequestTransformer } from '../transformers/tasterSessionRequest';
import { AppError } from '../utils/errors';
import EmailService from './emailService';
import { TASTER_SESSION_EMAIL_TEMPLATES } from './emailContracts/tasterSession';
import { SettingsService } from './settingsService';
import { TasterSessionDeliveryService } from './tasterSessionDeliveryService';
import { TasterSessionPreferencePolicy } from './tasterSessionPreferencePolicy';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function preferenceDetails(
  request: TasterSessionRequestResponse,
  locale: 'de' | 'en' | 'zh'
): string {
  if (!request.preference) {
    if (locale === 'zh') return '未选择偏好时间；我们会联系你商定安排。';
    if (locale === 'en')
      return 'No preference was available; we will get in touch to arrange it.';
    return 'Keine Präferenz verfügbar; wir melden uns zur Abstimmung.';
  }
  return formatStoredTasterSessionPreferenceDetails(request.preference, locale);
}

async function sendBestEffortSubmissionMessages(
  request: TasterSessionRequestResponse
): Promise<void> {
  const adminRecipients = new Set<string>();
  try {
    const recipients = await SettingsService.getTasterSessionAlertRecipients();
    recipients.forEach((email) => adminRecipients.add(email));
  } catch {
    // Best-effort notification discovery must not affect request submission.
  }

  const origin = process.env.FRONTEND_URL?.replace(/\/$/, '') ?? '';
  const receipt = EmailService.sendFromTemplate(
    TASTER_SESSION_EMAIL_TEMPLATES.RECEIVED,
    request.email,
    request.locale,
    {
      name: request.name,
      preferenceDetails: preferenceDetails(request, request.locale),
    }
  );
  const alerts = [...adminRecipients].map((email) =>
    EmailService.sendFromTemplate(
      TASTER_SESSION_EMAIL_TEMPLATES.ADMIN_ALERT,
      email,
      'de',
      {
        name: request.name,
        email: request.email,
        playerLevel:
          request.playerLevel === 'beginner' ? 'Anfänger' : 'Erfahren',
        message: request.message ?? '',
        preferenceDetails: preferenceDetails(request, 'de'),
        requestUrl: `${origin}/de/dashboard/taster-sessions`,
      }
    )
  );
  await Promise.allSettled([receipt, ...alerts]);
}

export class TasterSessionRequestService {
  private static async currentOrNotFound(
    id: string
  ): Promise<TasterSessionRequestResponse> {
    const current = await TasterSessionRequestModel.findById(id);
    if (!current) throw AppError.notFound('Taster Session request not found');
    return TasterSessionRequestTransformer.fromDocument(current);
  }

  private static async stateConflict(
    id: string,
    message: string
  ): Promise<never> {
    const latest = await this.currentOrNotFound(id);
    throw new AppError(message, 409, 'TASTER_SESSION_STATE_CONFLICT', {
      latest,
    });
  }

  static async create(
    input: CreateTasterSessionRequest
  ): Promise<TasterSessionRequestResponse> {
    const preference = await TasterSessionPreferencePolicy.validateSelection(
      input.playerLevel,
      input.locale,
      input.preference
    );
    try {
      const request = await TasterSessionRequestModel.create({
        name: input.name,
        email: normalizeEmail(input.email),
        playerLevel: input.playerLevel,
        message: input.message,
        preference,
        locale: input.locale,
      });
      const response = TasterSessionRequestTransformer.fromDocument(request);
      void sendBestEffortSubmissionMessages(response).catch(() => undefined);
      return response;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        throw new AppError(
          'A pending Taster Session request already exists for this email',
          409,
          'PENDING_TASTER_SESSION_REQUEST_EXISTS'
        );
      }
      throw error;
    }
  }

  static async list(
    query: TasterSessionListQuery
  ): Promise<TasterSessionRequestListResponse> {
    const filter: Record<string, unknown> = {};
    if (query.status !== 'all') filter.status = query.status;
    if (query.playerLevel !== 'all') filter.playerLevel = query.playerLevel;
    if (query.archived === 'exclude') filter.archived = false;
    if (query.archived === 'only') filter.archived = true;

    const [requests, total] = await Promise.all([
      TasterSessionRequestModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(query.offset)
        .limit(query.limit),
      TasterSessionRequestModel.countDocuments(filter),
    ]);
    return {
      requests: requests.map((request) =>
        TasterSessionRequestTransformer.fromDocument(request)
      ),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  static async get(id: string): Promise<TasterSessionRequestResponse> {
    return this.currentOrNotFound(id);
  }

  static async stats(): Promise<TasterSessionRequestStatsResponse> {
    const [total, pending, invited, declined, archived] = await Promise.all([
      TasterSessionRequestModel.countDocuments(),
      TasterSessionRequestModel.countDocuments({ status: 'pending' }),
      TasterSessionRequestModel.countDocuments({ status: 'invited' }),
      TasterSessionRequestModel.countDocuments({ status: 'declined' }),
      TasterSessionRequestModel.countDocuments({ archived: true }),
    ]);
    return { total, pending, invited, declined, archived };
  }

  static async dispose(
    id: string,
    userId: string,
    command: TasterSessionDispositionCommand
  ): Promise<TasterSessionRequestResponse> {
    const now = new Date();
    const deliveryAttemptId = command.sendEmail ? randomUUID() : undefined;
    const dispositionFields: Record<string, unknown> = {
      status: command.disposition,
      adminNotes: command.adminNotes,
      declineReason:
        command.disposition === 'declined' ? command.declineReason : undefined,
      declineReasonDetails:
        command.disposition === 'declined'
          ? command.declineReasonDetails
          : undefined,
      dispositionBy: userId,
      dispositionAt: now,
    };
    if (deliveryAttemptId) {
      dispositionFields.delivery = {
        status: 'in_progress',
        attemptId: deliveryAttemptId,
        claimedAt: now,
      };
    }
    const updated = await TasterSessionRequestModel.findOneAndUpdate(
      { _id: id, status: 'pending', __v: command.expectedVersion },
      {
        $set: dispositionFields,
        $inc: { __v: 1 },
      },
      { new: true }
    );
    if (!updated) {
      return this.stateConflict(
        id,
        'Taster Session request is no longer pending'
      );
    }

    const response = TasterSessionRequestTransformer.fromDocument(updated);
    if (!deliveryAttemptId) return response;
    return TasterSessionDeliveryService.deliverClaimed(
      updated,
      deliveryAttemptId
    );
  }

  static async setArchived(
    id: string,
    userId: string,
    expectedVersion: number,
    archived: boolean
  ): Promise<TasterSessionRequestResponse> {
    const archiveMutation = archived
      ? {
          $set: {
            archived: true,
            archivedAt: new Date(),
            archivedBy: userId,
          },
          $inc: { __v: 1 },
        }
      : {
          $set: { archived: false },
          $unset: { archivedAt: 1, archivedBy: 1 },
          $inc: { __v: 1 },
        };
    const updated = await TasterSessionRequestModel.findOneAndUpdate(
      { _id: id, __v: expectedVersion, archived: !archived },
      archiveMutation,
      { new: true }
    );
    if (updated) return TasterSessionRequestTransformer.fromDocument(updated);

    const current = await this.currentOrNotFound(id);
    if (current.version === expectedVersion && current.archived === archived) {
      return current;
    }
    return this.stateConflict(id, 'Taster Session request has changed');
  }

  static retryDelivery(
    id: string,
    expectedVersion: number
  ): Promise<TasterSessionRequestResponse> {
    return TasterSessionDeliveryService.retry(id, expectedVersion);
  }
}
