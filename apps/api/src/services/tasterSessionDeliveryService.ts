import { randomUUID } from 'node:crypto';
import type { ITasterSessionRequest } from '../models/TasterSessionRequest';
import { TasterSessionRequestModel } from '../models/TasterSessionRequest';
import { TasterSessionRequestTransformer } from '../transformers/tasterSessionRequest';
import type { TasterSessionRequestResponse } from '@club/shared-types/api/tasterSessionRequest';
import { formatStoredTasterSessionPreferenceDetails } from '@club/shared-types/view/tasterSessionRequest';
import EmailService from './emailService';
import { TASTER_SESSION_EMAIL_TEMPLATES } from './emailContracts/tasterSession';
import { AppError } from '../utils/errors';
import { classifyEmailDeliveryError } from './emailDeliveryError';

export const TASTER_SESSION_DELIVERY_STALE_MS = 10 * 60 * 1000;

function preferenceDetails(request: ITasterSessionRequest): string {
  if (!request.preference) {
    if (request.locale === 'zh')
      return '未选择偏好时间；我们会联系你商定安排。';
    if (request.locale === 'en') {
      return 'No preference was available; we will get in touch to arrange it.';
    }
    return 'Keine Präferenz verfügbar; wir melden uns zur Abstimmung.';
  }
  return formatStoredTasterSessionPreferenceDetails(
    request.preference,
    request.locale
  );
}

function localizedDeclineReason(request: ITasterSessionRequest): string {
  if (request.declineReason === 'no_capacity') {
    if (request.locale === 'zh') return '目前无接待能力';
    if (request.locale === 'en') return 'No capacity';
    return 'Derzeit keine Kapazität';
  }
  if (request.locale === 'zh') return '其他原因';
  if (request.locale === 'en') return 'Another reason';
  return 'Anderer Grund';
}

async function latestOrNotFound(id: string): Promise<ITasterSessionRequest> {
  const latest = await TasterSessionRequestModel.findById(id);
  if (!latest) throw AppError.notFound('Taster Session request not found');
  return latest;
}

export class TasterSessionDeliveryService {
  static async deliverClaimed(
    request: ITasterSessionRequest,
    attemptId: string
  ): Promise<TasterSessionRequestResponse> {
    let outcome: 'sent' | 'failed' | 'uncertain' = 'sent';
    try {
      await EmailService.sendFromTemplate(
        request.status === 'invited'
          ? TASTER_SESSION_EMAIL_TEMPLATES.INVITED
          : TASTER_SESSION_EMAIL_TEMPLATES.DECLINED,
        request.email,
        request.locale,
        {
          name: request.name,
          declineReason: localizedDeclineReason(request),
          declineReasonDetails: request.declineReasonDetails ?? '',
          preferenceDetails: preferenceDetails(request),
        }
      );
    } catch (error) {
      outcome = classifyEmailDeliveryError(error);
    }

    try {
      const settled = await TasterSessionRequestModel.findOneAndUpdate(
        {
          _id: request._id,
          'delivery.status': 'in_progress',
          'delivery.attemptId': attemptId,
        },
        {
          $set: {
            'delivery.status': outcome,
            'delivery.attemptedAt': new Date(),
          },
          $inc: { __v: 1 },
        },
        { new: true }
      );
      const latest =
        settled ?? (await latestOrNotFound(request._id.toString()));
      return TasterSessionRequestTransformer.fromDocument(latest);
    } catch {
      const latest = await latestOrNotFound(request._id.toString());
      return TasterSessionRequestTransformer.fromDocument(latest);
    }
  }

  static async retry(
    id: string,
    expectedVersion: number
  ): Promise<TasterSessionRequestResponse> {
    const attemptId = randomUUID();
    const staleBefore = new Date(Date.now() - TASTER_SESSION_DELIVERY_STALE_MS);
    const claimed = await TasterSessionRequestModel.findOneAndUpdate(
      {
        _id: id,
        __v: expectedVersion,
        status: { $in: ['invited', 'declined'] },
        $or: [
          { 'delivery.status': { $in: ['failed', 'uncertain'] } },
          {
            'delivery.status': 'in_progress',
            'delivery.claimedAt': { $lte: staleBefore },
          },
        ],
      },
      {
        $set: {
          'delivery.status': 'in_progress',
          'delivery.attemptId': attemptId,
          'delivery.claimedAt': new Date(),
        },
        $inc: { __v: 1 },
      },
      { new: true }
    );

    if (!claimed) {
      const latest = await latestOrNotFound(id);
      throw new AppError(
        'Email delivery cannot be retried from the current state',
        409,
        'TASTER_SESSION_STATE_CONFLICT',
        { latest: TasterSessionRequestTransformer.fromDocument(latest) }
      );
    }
    return this.deliverClaimed(claimed, attemptId);
  }
}
