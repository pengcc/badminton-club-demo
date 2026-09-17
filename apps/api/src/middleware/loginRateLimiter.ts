import type { Request } from 'express';
import rateLimit from 'express-rate-limit';

interface LoginRateLimiterOptions {
  windowMs?: number;
  max?: number;
}

export function createLoginRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 100,
}: LoginRateLimiterOptions = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (request, response) => {
      const resetTime = (
        request as Request & { rateLimit?: { resetTime?: Date } }
      ).rateLimit?.resetTime;
      const retryAfter = resetTime
        ? Math.ceil((resetTime.getTime() - Date.now()) / 1000)
        : Math.ceil(windowMs / 1000);

      response.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
        retryAfter,
      });
    },
  });
}
