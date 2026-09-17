import type { RequestHandler } from 'express';
import { config } from '../config';
import { AppError } from '../utils/errors';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function normalizedOrigin(value: string): string | undefined {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

export function isTrustedFirstPartyRequest(headers: {
  origin?: string;
  referer?: string;
}): boolean {
  const trustedOrigin = normalizedOrigin(config.frontendUrl);
  if (!trustedOrigin) return false;

  const origin = headers.origin && normalizedOrigin(headers.origin);
  if (headers.origin) return origin === trustedOrigin;

  const referer = headers.referer && normalizedOrigin(headers.referer);
  return referer === trustedOrigin;
}

export const requireFirstPartyRequest: RequestHandler = (req, _res, next) => {
  if (!UNSAFE_METHODS.has(req.method)) return next();
  if (
    isTrustedFirstPartyRequest({
      origin: req.get('origin'),
      referer: req.get('referer'),
    })
  ) {
    return next();
  }
  return next(
    new AppError(
      'Request origin is not trusted',
      403,
      'FIRST_PARTY_REQUEST_REQUIRED'
    )
  );
};
