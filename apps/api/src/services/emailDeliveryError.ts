import { AppError } from '../utils/errors';

export type EmailDeliveryFailureCategory = 'failed' | 'uncertain';

export function classifyEmailDeliveryError(
  error: unknown
): EmailDeliveryFailureCategory {
  if (error instanceof AppError) return 'failed';
  if (typeof error !== 'object' || error === null) return 'uncertain';

  const candidate = error as { code?: string; responseCode?: number };
  return ['EAUTH', 'ECONNECTION', 'EENVELOPE', 'EMESSAGE'].includes(
    candidate.code ?? ''
  ) ||
    (candidate.responseCode !== undefined && candidate.responseCode >= 500)
    ? 'failed'
    : 'uncertain';
}
