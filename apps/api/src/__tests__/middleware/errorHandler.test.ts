import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import {
  AuditEventType,
  EntityType,
  AccountKind,
} from '@club/shared-types/core/enums';
import { AppError } from '../../utils/errors';
import { MEMBERSHIP_APPLICATION_SUBMISSION_VALIDATION_ERROR_CODE } from '@club/shared-types/api/membershipApplication';
import { errorHandler } from '../../middleware/errorHandler';
import { AuditLog } from '../../models/AuditLog';
import { AuditService } from '../../services/auditService';

describe('global API error diagnostics', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    [
      AppError.badRequest('Invalid input'),
      400,
      'VALIDATION_ERROR',
      { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' },
    ],
    [
      AppError.conflict('Changed Team'),
      409,
      'CONFLICT',
      { success: false, error: 'Changed Team', code: 'CONFLICT' },
    ],
    [
      new AppError('Rate limited', 429, 'RATE_LIMITED'),
      429,
      'RATE_LIMITED',
      { success: false, error: 'Rate limited', code: 'RATE_LIMITED' },
    ],
    [
      Object.assign(new Error('Invalid field'), { name: 'ValidationError' }),
      400,
      'ValidationError',
      { success: false, error: 'Validation Error', details: 'Invalid field' },
    ],
    [
      Object.assign(new Error('Invalid identifier'), { name: 'CastError' }),
      400,
      'CastError',
      { success: false, error: 'Invalid ID format' },
    ],
    [
      new Error('Private internal detail'),
      500,
      'Error',
      { success: false, error: 'Internal Server Error' },
    ],
    [
      AppError.lineupValidation({ field: 'players' }),
      400,
      'LINEUP_VALIDATION_FAILED',
      {
        success: false,
        error: 'Lineup violates current Match rules',
        code: 'LINEUP_VALIDATION_FAILED',
        details: { field: 'players' },
      },
    ],
    [
      new AppError(
        'Application has missing or invalid submission information',
        400,
        MEMBERSHIP_APPLICATION_SUBMISSION_VALIDATION_ERROR_CODE,
        { fields: ['street', 'membershipType'] }
      ),
      400,
      MEMBERSHIP_APPLICATION_SUBMISSION_VALIDATION_ERROR_CODE,
      {
        success: false,
        error: 'Application has missing or invalid submission information',
        code: MEMBERSHIP_APPLICATION_SUBMISSION_VALIDATION_ERROR_CODE,
        details: { fields: ['street', 'membershipType'] },
      },
    ],
  ])('logs the returned status and preserves the response for %s', async (failure, statusCode, reasonCode, body) => {
    const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = express();
    const router = express.Router();
    router.put('/:id', () => {
      throw failure;
    });
    app.use('/api/players', router);
    app.use(errorHandler);

    const response = await request(app)
      .put('/api/players/synthetic-private-id?email=private%40example.invalid')
      .set('Authorization', 'Bearer synthetic-private-token')
      .send({ name: 'Synthetic private name' });

    expect(response.status).toBe(statusCode);
    expect(response.body).toEqual(body);
    expect(diagnostic.mock.calls).toEqual([
      [
        'API request failed',
        {
          operation: 'api:players',
          method: 'PUT',
          statusCode,
          reasonCode,
        },
      ],
    ]);
  });

  it.each([
    [
      '/api/auth/reset-password/synthetic-token?token=synthetic-query',
      'api:auth',
    ],
    ['/api/synthetic-token/players', 'api:other'],
    ['/api/players-secret/123', 'api:other'],
    ['/api/%70layers/123', 'api:other'],
    ['/api', 'api:other'],
    ['/API/PLAYERS/123', 'api:players'],
    ['/uploads/synthetic-private-file.pdf', 'uploads'],
    ['/de/reset-password/synthetic-token', 'web'],
  ])('retains only a fixed operation family for %s', async (url, operation) => {
    const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = express();
    app.use(() => {
      throw AppError.badRequest('Invalid input');
    });
    app.use(errorHandler);
    await request(app).post(url).expect(400);
    expect(diagnostic.mock.calls).toEqual([
      [
        'API request failed',
        {
          operation,
          method: 'POST',
          statusCode: 400,
          reasonCode: 'VALIDATION_ERROR',
        },
      ],
    ]);
  });

  it('does not log successful requests', async () => {
    const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = express();
    app.get('/api/health', (_req, res) => res.sendStatus(200));
    app.use(errorHandler);
    await request(app).get('/api/health').expect(200);
    expect(diagnostic).not.toHaveBeenCalled();
  });

  it('does not emit the raw Error, stack, or request payload', () => {
    const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const error = new Error('sensitive failure detail');

    errorHandler(
      error,
      {
        method: 'POST',
        path: '/api/auth/login',
        body: { password: 'secret' },
      } as never,
      { status, json } as never,
      vi.fn()
    );

    expect(diagnostic).toHaveBeenCalledWith('API request failed', {
      operation: 'api:auth',
      method: 'POST',
      statusCode: 500,
      reasonCode: 'Error',
    });
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('sensitive');
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('password');
  });

  it('preserves bounded required-Audit classification through the global boundary', async () => {
    const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(AuditLog, 'create').mockRejectedValue(
      new Error('sensitive database topology detail')
    );
    const entityId = new Types.ObjectId();
    const actorId = new Types.ObjectId();
    let failure: Error;
    try {
      await AuditService.writeRequired({
        eventType: AuditEventType.MATCH_UPDATED,
        entityType: EntityType.MATCH,
        entityId,
        actor: { id: actorId, accountKind: AccountKind.PERSON },
      });
      throw new Error('Expected required Audit persistence to fail');
    } catch (error) {
      failure = error as Error;
    }
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();

    errorHandler(
      failure,
      { method: 'PUT', path: '/api/matches/synthetic-id' } as never,
      { status, json } as never,
      vi.fn()
    );

    expect(diagnostic).toHaveBeenCalledWith('API request failed', {
      operation: 'audit_write_required',
      method: 'PUT',
      statusCode: 500,
      reasonCode: 'RequiredAuditPersistenceError',
      eventType: AuditEventType.MATCH_UPDATED,
      entityType: EntityType.MATCH,
      entityId: entityId.toString(),
    });
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: 'Internal Server Error',
    });
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('topology');
  });
});
