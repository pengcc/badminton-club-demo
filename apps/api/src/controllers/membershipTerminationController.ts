import type { Request, Response } from 'express';
import type {
  MembershipTerminationResponse,
  MembershipTerminationSelfServiceResponse,
} from '@club/shared-types/api/membershipTermination';
import type {
  ApproveMembershipTerminationInput,
  BatchRecordMembershipTerminationInput,
  RecordMembershipTerminationInput,
  RejectMembershipTerminationInput,
} from '@club/shared-types/schemas';
import type { AuthenticatedRequest } from '../middleware/auth';
import { MembershipTerminationService } from '../services/membershipTerminationService';
import { AppError } from '../utils/errors';
import { ResponseHelper } from '../utils/controllerHelpers';

function actor(req: AuthenticatedRequest) {
  return {
    id: req.user.id,
    email: req.user.email,
    accountKind: req.user.accountKind,
    displayName: req.user.displayName,
    capabilities: req.user.capabilities,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}

function idempotencyKey(req: AuthenticatedRequest): string {
  const value = req.get('idempotency-key')?.trim();
  if (!value) throw AppError.validation('Idempotency-Key header is required');
  return value;
}

function toSelfServiceResponse(
  termination: MembershipTerminationResponse
): MembershipTerminationSelfServiceResponse {
  return {
    status: termination.status,
    endDate:
      termination.confirmedEffectiveDate ?? termination.requestedEffectiveDate,
    rejectionReason: termination.rejectionReason,
  };
}

export class MembershipTerminationController {
  static async request(
    req: AuthenticatedRequest<{ effectiveDate: string; note?: string }>,
    res: Response
  ): Promise<void> {
    const result = await MembershipTerminationService.requestOnline({
      userId: req.user.id,
      effectiveDate: req.body.effectiveDate,
      note: req.body.note,
      idempotencyKey: idempotencyKey(req),
      actor: actor(req),
    });
    ResponseHelper.success(
      res,
      toSelfServiceResponse(result),
      'Termination request submitted',
      201
    );
  }

  static async getMine(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const result = await MembershipTerminationService.getRelevantForUser(
      req.user.id
    );
    ResponseHelper.success(res, result ? toSelfServiceResponse(result) : null);
  }

  static async list(req: Request, res: Response): Promise<void> {
    const query = (res.locals.validatedQuery ?? req.query) as {
      status?: any;
    };
    const items = await MembershipTerminationService.listOpen(query.status);
    ResponseHelper.success(res, { items });
  }

  static async approve(
    req: AuthenticatedRequest<
      ApproveMembershipTerminationInput,
      unknown,
      { id: string }
    >,
    res: Response
  ): Promise<void> {
    const result = await MembershipTerminationService.approve({
      terminationId: req.params.id,
      effectiveTiming: req.body.effectiveTiming,
      note: req.body.note,
      idempotencyKey: idempotencyKey(req),
      actor: actor(req),
    });
    ResponseHelper.success(res, result, 'Termination approved');
  }

  static async reject(
    req: AuthenticatedRequest<
      RejectMembershipTerminationInput,
      unknown,
      { id: string }
    >,
    res: Response
  ): Promise<void> {
    const result = await MembershipTerminationService.reject({
      terminationId: req.params.id,
      reason: req.body.reason,
      idempotencyKey: idempotencyKey(req),
      actor: actor(req),
    });
    ResponseHelper.success(res, result, 'Termination rejected');
  }

  static async recordOffline(
    req: AuthenticatedRequest<RecordMembershipTerminationInput>,
    res: Response
  ): Promise<void> {
    const result = await MembershipTerminationService.recordOffline({
      userId: req.body.userId,
      source: req.body.source,
      requestReceivedAt: new Date(req.body.requestReceivedAt),
      effectiveTiming: req.body.effectiveTiming,
      effectiveDate: req.body.effectiveDate,
      note: req.body.note,
      idempotencyKey: idempotencyKey(req),
      actor: actor(req),
    });
    ResponseHelper.success(res, result, 'Termination recorded', 201);
  }

  static async recordBatch(
    req: AuthenticatedRequest<BatchRecordMembershipTerminationInput>,
    res: Response
  ): Promise<void> {
    const result = await MembershipTerminationService.recordBatch({
      ...req.body,
      idempotencyKey: idempotencyKey(req),
      actor: actor(req),
    });
    ResponseHelper.success(res, result, 'Termination batch processed');
  }
}
