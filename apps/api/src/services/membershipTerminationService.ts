import { createHash } from 'node:crypto';
import mongoose, { Types, type ClientSession } from 'mongoose';
import type {
  AdminMembershipTerminationResponse,
  MembershipTerminationBatchResponse,
  MembershipTerminationResponse,
} from '@club/shared-types/api/membershipTermination';
import type {
  AdminMembershipTerminationTimingInput,
  ApproveMembershipTerminationInput,
} from '@club/shared-types/schemas';
import {
  AuditEventType,
  Capability,
  EntityType,
  MembershipStatus,
  MembershipTerminationSource,
  MembershipTerminationStatus,
  AccountKind,
} from '@club/shared-types/core/enums';
import type { MembershipLifecycleActor } from '@club/shared-types/domain/membershipLifecycle';
import {
  MembershipInactivePlayerOutcome,
  MembershipLifecycleOperation,
} from '@club/shared-types/domain/membershipLifecycle';
import { AuditService } from './auditService';
import {
  MembershipTermination,
  type IMembershipTermination,
} from '../models/MembershipTermination';
import { User } from '../models/User';
import { AppError } from '../utils/errors';
import {
  assertValidTerminationDate,
  assertValidTerminationRequestTimestamp,
  berlinDateOnly,
  parseDateOnly,
} from './membershipTerminationPolicy';
import { membershipLifecycleService } from './membershipLifecycleService';
import { IdentityDependencyClaimService } from './identityDependencyClaimService';

const CURRENT_STATUSES = new Set([
  MembershipStatus.ACTIVE,
  MembershipStatus.PASSIVE,
]);
const OFFLINE_SOURCES = new Set<MembershipTerminationSource>([
  MembershipTerminationSource.EMAIL,
  MembershipTerminationSource.PHONE,
  MembershipTerminationSource.IN_PERSON,
  MembershipTerminationSource.OTHER,
]);

interface CreateTerminationCommand {
  userId: string;
  source: MembershipTerminationSource;
  requestedAt: Date;
  effectiveTiming: AdminMembershipTerminationTimingInput['effectiveTiming'];
  effectiveDate?: string;
  note?: string;
  idempotencyKey: string;
  actor: MembershipLifecycleActor;
  approveImmediately: boolean;
  auditEvent: AuditEventType;
  evaluatedAt?: Date;
}

interface ApproveTerminationCommand {
  terminationId: string;
  effectiveTiming: ApproveMembershipTerminationInput['effectiveTiming'];
  note?: string;
  idempotencyKey: string;
  actor: MembershipLifecycleActor;
  evaluatedAt?: Date;
}

interface RejectTerminationCommand {
  terminationId: string;
  reason: string;
  idempotencyKey: string;
  actor: MembershipLifecycleActor;
  rejectedAt?: Date;
}

export interface ProcessTerminationItemResult {
  terminationId: string;
  outcome: 'processed' | 'replayed' | 'skipped' | 'failed';
  userId?: string;
  error?: { code: string; message: string };
}

export interface ProcessDueTerminationsResult {
  asOfDate: string;
  processedCount: number;
  replayedCount: number;
  skippedCount: number;
  failureCount: number;
  items: ProcessTerminationItemResult[];
}

function normalizeKey(value: string): string {
  const key = value.trim();
  if (key.length < 8 || key.length > 200) {
    throw AppError.validation('A valid Idempotency-Key is required');
  }
  return key;
}

function normalizeNote(value?: string): string | undefined {
  const note = value?.trim();
  return note || undefined;
}

function resolveAdminTiming(
  input: {
    effectiveTiming: AdminMembershipTerminationTimingInput['effectiveTiming'];
    effectiveDate?: string;
    note?: string;
  },
  now: Date
): { effectiveDate: string; isToday: boolean; note?: string } {
  const note = normalizeNote(input.note);
  if (input.effectiveTiming === 'today') {
    if (!note) {
      throw AppError.validation(
        'An administrator reason is required for termination today'
      );
    }
    return { effectiveDate: berlinDateOnly(now), isToday: true, note };
  }
  if (!input.effectiveDate) {
    throw AppError.validation('Effective date is required');
  }
  return { effectiveDate: input.effectiveDate, isToday: false, note };
}

function fingerprint(value: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function duplicate(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

function actorSnapshot(actor: MembershipLifecycleActor) {
  if (!Types.ObjectId.isValid(actor.id)) {
    throw AppError.validation('Termination actor is invalid');
  }
  return {
    id: new Types.ObjectId(actor.id),
    email: actor.email.trim().toLowerCase(),
    accountKind: actor.accountKind,
    displayName: actor.displayName,
  };
}

function assertAdministrator(actor: MembershipLifecycleActor): void {
  if (!actor.capabilities.includes(Capability.ADMINISTRATION)) {
    throw AppError.forbidden(
      'Administrator capability is required for this termination workflow'
    );
  }
}

function responseActor(actor: {
  id: Types.ObjectId;
  email: string;
  accountKind: AccountKind;
  displayName: string;
}) {
  return {
    id: actor.id.toString(),
    email: actor.email,
    accountKind: actor.accountKind,
    displayName: actor.displayName,
  };
}

export function toMembershipTerminationResponse(
  termination: IMembershipTermination
): MembershipTerminationResponse {
  const rawUser = termination.userId as unknown as {
    _id?: Types.ObjectId;
    firstName?: string;
    lastName?: string;
    email?: string;
    toString(): string;
  } | null;
  const populatedUserId = termination.populated('userId') as
    | Types.ObjectId
    | undefined;
  const userId =
    rawUser?._id?.toString() ??
    populatedUserId?.toString() ??
    rawUser?.toString();
  if (!userId) {
    throw AppError.internal(
      'Termination is missing its retained User identity'
    );
  }
  const memberName =
    rawUser?.firstName && rawUser.lastName
      ? `${rawUser.lastName}, ${rawUser.firstName}`
      : undefined;
  return {
    id: termination._id.toString(),
    userId,
    memberName,
    memberEmail: rawUser?.email,
    memberUnavailable: rawUser === null,
    status: termination.status,
    source: termination.source,
    requestedAt: termination.requestedAt.toISOString(),
    requestedBy: responseActor(termination.requestedBy),
    requestedEffectiveDate: termination.requestedEffectiveDate,
    requestNote: termination.requestNote,
    approvedAt: termination.approvedAt?.toISOString(),
    approvedBy: termination.approvedBy
      ? responseActor(termination.approvedBy)
      : undefined,
    confirmedEffectiveDate: termination.confirmedEffectiveDate,
    approvalNote: termination.approvalNote,
    rejectedAt: termination.rejectedAt?.toISOString(),
    rejectedBy: termination.rejectedBy
      ? responseActor(termination.rejectedBy)
      : undefined,
    rejectionReason: termination.rejectionReason,
    effectiveAt: termination.effectiveAt?.toISOString(),
    createdAt: termination.createdAt.toISOString(),
    updatedAt: termination.updatedAt.toISOString(),
  };
}

function toAdminMembershipTerminationResponse(
  termination: IMembershipTermination
): AdminMembershipTerminationResponse {
  return {
    ...toMembershipTerminationResponse(termination),
    lastProcessingFailure: termination.lastProcessingFailure
      ? {
          code: termination.lastProcessingFailure.code,
          message: termination.lastProcessingFailure.message,
          failedAt: termination.lastProcessingFailure.failedAt.toISOString(),
        }
      : undefined,
  };
}

function safeProcessingFailure(error: unknown): {
  code: string;
  message: string;
} {
  if (error instanceof AppError && error.statusCode < 500) {
    return {
      code: error.code.slice(0, 100),
      message: error.message.slice(0, 500),
    };
  }
  return {
    code: 'TERMINATION_PROCESSING_FAILED',
    message:
      'Membership termination processing failed. Review the current Membership and Player state before the next scheduled retry.',
  };
}

async function writeAudit(
  termination: IMembershipTermination,
  eventType: AuditEventType,
  actor: MembershipLifecycleActor,
  session: ClientSession,
  options: {
    source?: 'scheduled';
    reason?: string;
    extraChanges?: Array<{
      field: string;
      oldValue?: unknown;
      newValue?: unknown;
    }>;
  } = {}
): Promise<void> {
  await AuditService.writeRequired(
    {
      eventType,
      entityType: EntityType.MEMBERSHIP_TERMINATION,
      entityId: termination._id,
      actor: {
        id: new Types.ObjectId(actor.id),
        accountKind: actor.accountKind,
      },
      source: options.source ?? 'human',
      reason:
        options.reason ?? termination.approvalNote ?? termination.requestNote,
      changes: [
        { field: 'userId', newValue: termination.userId.toString() },
        { field: 'requestSource', newValue: termination.source },
        {
          field: 'requestedAt',
          newValue: termination.requestedAt.toISOString(),
        },
        {
          field: 'requestedEffectiveDate',
          newValue: termination.requestedEffectiveDate,
        },
        {
          field: 'confirmedEffectiveDate',
          newValue: termination.confirmedEffectiveDate,
        },
        ...(options.extraChanges ?? []),
      ],
    },
    session
  );
}

async function effectTerminationInSession(input: {
  termination: IMembershipTermination;
  asOfDate: string;
  processedAt: Date;
  actor: MembershipLifecycleActor;
  session: ClientSession;
  todayException?: boolean;
}): Promise<'processed' | 'replayed'> {
  const { termination, session } = input;
  if (
    termination.status !== MembershipTerminationStatus.APPROVED ||
    !termination.confirmedEffectiveDate
  ) {
    throw AppError.conflict('Termination is not ready to become effective');
  }
  const user = await User.findById(termination.userId).session(session);
  if (!user) throw AppError.notFound('Termination User not found');
  if (user.accountKind !== AccountKind.PERSON) {
    throw AppError.conflict(
      'Termination User is not a person Membership account'
    );
  }
  if (!CURRENT_STATUSES.has(user.membershipStatus)) {
    throw AppError.conflict(
      'Termination User is no longer in a processable membership state'
    );
  }

  const lifecycleIdempotencyKey = `membership-termination:${termination._id.toString()}:effective`;
  const lifecycleResult = await membershipLifecycleService.executeInSession(
    {
      operation: MembershipLifecycleOperation.TRANSITION_MEMBERSHIP,
      userId: user._id.toString(),
      expectedMembershipStatus: user.membershipStatus,
      targetMembershipStatus: MembershipStatus.INACTIVE,
      inactivePlayerOutcome: MembershipInactivePlayerOutcome.END_PARTICIPATION,
      actor: input.actor,
      reason: `Membership termination effective ${termination.confirmedEffectiveDate}`,
      idempotencyKey: lifecycleIdempotencyKey,
      occurredAt: input.processedAt,
    },
    session
  );

  termination.status = MembershipTerminationStatus.EFFECTIVE;
  termination.isOpen = false;
  termination.effectiveAt = input.processedAt;
  termination.lifecycleIdempotencyKey = lifecycleIdempotencyKey;
  termination.lastProcessingFailure = undefined;
  await termination.save({ session });
  await writeAudit(
    termination,
    AuditEventType.MEMBERSHIP_TERMINATION_EFFECTIVE,
    input.actor,
    session,
    {
      source: input.todayException ? undefined : 'scheduled',
      extraChanges: [
        { field: 'asOfDate', newValue: input.asOfDate },
        { field: 'status', oldValue: 'approved', newValue: 'effective' },
        ...(input.todayException
          ? [{ field: 'effectiveTiming', newValue: 'today' }]
          : []),
      ],
    }
  );
  return lifecycleResult.replayed ? 'replayed' : 'processed';
}

async function createTermination(
  input: CreateTerminationCommand
): Promise<MembershipTerminationResponse> {
  if (!Types.ObjectId.isValid(input.userId)) {
    throw AppError.validation('User identifier is invalid');
  }
  const idempotencyKey = normalizeKey(input.idempotencyKey);
  const note = normalizeNote(input.note);
  const evaluatedAt = input.evaluatedAt ?? new Date();
  assertValidTerminationRequestTimestamp({
    requestedAt: input.requestedAt,
    evaluatedAt,
  });
  const intentFingerprint = fingerprint({
    operation: input.approveImmediately ? 'record' : 'request',
    userId: input.userId,
    source: input.source,
    requestedAt:
      input.source === MembershipTerminationSource.ONLINE ||
      input.source === MembershipTerminationSource.BATCH
        ? undefined
        : input.requestedAt.toISOString(),
    effectiveTiming: input.effectiveTiming,
    effectiveDate:
      input.effectiveTiming === 'scheduled' ? input.effectiveDate : undefined,
    note: note ?? '',
    actorId: input.actor.id,
  });
  const requestKey = input.approveImmediately
    ? `${idempotencyKey}:request`
    : idempotencyKey;
  const approvalKey = input.approveImmediately
    ? `${idempotencyKey}:approval`
    : undefined;
  const replay = await MembershipTermination.findOne({
    requestIdempotencyKey: requestKey,
  });
  if (replay) {
    if (replay.requestIntentFingerprint !== intentFingerprint) {
      throw AppError.conflict(
        'Membership termination conflicts with an existing request'
      );
    }
    return toMembershipTerminationResponse(replay);
  }
  const timing = resolveAdminTiming(input, evaluatedAt);
  if (!timing.isToday) {
    assertValidTerminationDate({
      effectiveDate: timing.effectiveDate,
      requestedAt: input.requestedAt,
      evaluatedAt,
    });
  }
  let committed: IMembershipTermination | undefined;
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const existing = await MembershipTermination.findOne({
        $or: [
          { requestIdempotencyKey: requestKey },
          { userId: new Types.ObjectId(input.userId), isOpen: true },
        ],
      }).session(session);
      if (existing) {
        if (
          existing.requestIdempotencyKey === requestKey &&
          existing.requestIntentFingerprint === intentFingerprint
        ) {
          committed = existing;
          return;
        }
        throw AppError.conflict(
          'Membership already has an open or conflicting termination request'
        );
      }

      const user = await User.findById(input.userId).session(session);
      if (!user) throw AppError.notFound('User not found');
      if (user.accountKind !== AccountKind.PERSON) {
        throw AppError.validation('Super Admin has no Membership to terminate');
      }
      if (!CURRENT_STATUSES.has(user.membershipStatus)) {
        throw AppError.validation(
          'Only active or passive membership can request termination'
        );
      }
      await IdentityDependencyClaimService.claimUser(
        {
          userId: user._id,
          expectedVersion: user.get('__v') ?? 0,
          accountKind: user.accountKind,
          membershipStatus: user.membershipStatus,
        },
        session
      );
      const snapshot = actorSnapshot(input.actor);
      const status = input.approveImmediately
        ? MembershipTerminationStatus.APPROVED
        : MembershipTerminationStatus.PENDING_REVIEW;
      [committed] = await MembershipTermination.create(
        [
          {
            userId: user._id,
            status,
            isOpen: true,
            source: input.source,
            requestedAt: input.requestedAt,
            requestedBy: snapshot,
            requestedEffectiveDate: timing.effectiveDate,
            requestNote: timing.note,
            requestIdempotencyKey: requestKey,
            requestIntentFingerprint: intentFingerprint,
            ...(input.approveImmediately
              ? {
                  approvedAt: evaluatedAt,
                  approvedBy: snapshot,
                  confirmedEffectiveDate: timing.effectiveDate,
                  approvalNote: timing.note,
                  approvalIdempotencyKey: approvalKey,
                  approvalIntentFingerprint: intentFingerprint,
                }
              : {}),
          },
        ],
        { session }
      );
      await writeAudit(committed, input.auditEvent, input.actor, session);
      if (timing.isToday) {
        await effectTerminationInSession({
          termination: committed,
          asOfDate: timing.effectiveDate,
          processedAt: evaluatedAt,
          actor: input.actor,
          session,
          todayException: true,
        });
      }
    });
  } catch (error) {
    if (!duplicate(error)) throw error;
    const existing = await MembershipTermination.findOne({
      requestIdempotencyKey: requestKey,
    });
    if (!existing || existing.requestIntentFingerprint !== intentFingerprint) {
      throw AppError.conflict(
        'Membership termination conflicts with an existing request'
      );
    }
    committed = existing;
  } finally {
    await session.endSession();
  }

  if (!committed) {
    throw AppError.internal('Termination transaction produced no result');
  }
  return toMembershipTerminationResponse(committed);
}

export class MembershipTerminationService {
  static async requestOnline(input: {
    userId: string;
    effectiveDate: string;
    note?: string;
    idempotencyKey: string;
    actor: MembershipLifecycleActor;
    now?: Date;
  }): Promise<MembershipTerminationResponse> {
    if (input.actor.id !== input.userId) {
      throw AppError.forbidden(
        'Members can request only their own termination'
      );
    }
    const now = input.now ?? new Date();
    return createTermination({
      ...input,
      effectiveTiming: 'scheduled',
      source: MembershipTerminationSource.ONLINE,
      requestedAt: now,
      evaluatedAt: now,
      approveImmediately: false,
      auditEvent: AuditEventType.MEMBERSHIP_TERMINATION_REQUESTED,
    });
  }

  static async recordOffline(input: {
    userId: string;
    source: Exclude<
      MembershipTerminationSource,
      MembershipTerminationSource.ONLINE | MembershipTerminationSource.BATCH
    >;
    requestReceivedAt: Date;
    effectiveTiming: AdminMembershipTerminationTimingInput['effectiveTiming'];
    effectiveDate?: string;
    note?: string;
    idempotencyKey: string;
    actor: MembershipLifecycleActor;
    now?: Date;
  }): Promise<MembershipTerminationResponse> {
    assertAdministrator(input.actor);
    if (!OFFLINE_SOURCES.has(input.source)) {
      throw AppError.validation(
        'Administrator-recorded termination requires an offline source'
      );
    }
    return createTermination({
      ...input,
      requestedAt: input.requestReceivedAt,
      evaluatedAt: input.now ?? new Date(),
      approveImmediately: true,
      auditEvent: AuditEventType.MEMBERSHIP_TERMINATION_RECORDED,
    });
  }

  static async approve(
    input: ApproveTerminationCommand
  ): Promise<MembershipTerminationResponse> {
    assertAdministrator(input.actor);
    if (!Types.ObjectId.isValid(input.terminationId)) {
      throw AppError.validation('Termination identifier is invalid');
    }
    const idempotencyKey = normalizeKey(input.idempotencyKey);
    const note = normalizeNote(input.note);
    const now = input.evaluatedAt ?? new Date();
    const timing =
      input.effectiveTiming === 'today'
        ? resolveAdminTiming(input, now)
        : { effectiveDate: undefined, isToday: false, note };
    const intentFingerprint = fingerprint({
      operation: 'approve',
      terminationId: input.terminationId,
      effectiveTiming: input.effectiveTiming,
      note: note ?? '',
      actorId: input.actor.id,
    });
    let committed: IMembershipTermination | undefined;
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const reusedKey = await MembershipTermination.findOne({
          approvalIdempotencyKey: idempotencyKey,
        }).session(session);
        if (reusedKey && reusedKey._id.toString() !== input.terminationId) {
          throw AppError.conflict(
            'Approval Idempotency-Key is already used by another termination'
          );
        }
        const termination = await MembershipTermination.findById(
          input.terminationId
        ).session(session);
        if (!termination) throw AppError.notFound('Termination not found');
        if (
          termination.status === MembershipTerminationStatus.APPROVED ||
          termination.status === MembershipTerminationStatus.EFFECTIVE
        ) {
          if (
            termination.approvalIdempotencyKey === idempotencyKey &&
            termination.approvalIntentFingerprint === intentFingerprint
          ) {
            committed = termination;
            return;
          }
          throw AppError.conflict('Termination has already been approved');
        }
        if (termination.status !== MembershipTerminationStatus.PENDING_REVIEW) {
          throw AppError.conflict('Termination is no longer pending review');
        }
        assertValidTerminationDate({
          effectiveDate: termination.requestedEffectiveDate,
          requestedAt: termination.requestedAt,
          evaluatedAt: now,
        });
        const approvedEffectiveDate: string = timing.isToday
          ? (timing.effectiveDate as string)
          : termination.requestedEffectiveDate;
        termination.status = MembershipTerminationStatus.APPROVED;
        termination.approvedAt = now;
        termination.approvedBy = actorSnapshot(input.actor);
        termination.confirmedEffectiveDate = approvedEffectiveDate;
        termination.approvalNote = timing.note;
        termination.approvalIdempotencyKey = idempotencyKey;
        termination.approvalIntentFingerprint = intentFingerprint;
        await termination.save({ session });
        await writeAudit(
          termination,
          AuditEventType.MEMBERSHIP_TERMINATION_APPROVED,
          input.actor,
          session,
          undefined
        );
        if (timing.isToday) {
          await effectTerminationInSession({
            termination,
            asOfDate: approvedEffectiveDate,
            processedAt: now,
            actor: input.actor,
            session,
            todayException: true,
          });
        }
        committed = termination;
      });
    } catch (error) {
      if (!duplicate(error)) throw error;
      const replay = await MembershipTermination.findOne({
        approvalIdempotencyKey: idempotencyKey,
      });
      if (
        !replay ||
        replay._id.toString() !== input.terminationId ||
        replay.approvalIntentFingerprint !== intentFingerprint
      ) {
        throw AppError.conflict(
          'Termination approval conflicts with an existing intent'
        );
      }
      committed = replay;
    } finally {
      await session.endSession();
    }

    if (!committed) {
      throw AppError.internal('Approval transaction produced no result');
    }
    return toMembershipTerminationResponse(committed);
  }

  static async reject(
    input: RejectTerminationCommand
  ): Promise<MembershipTerminationResponse> {
    assertAdministrator(input.actor);
    if (!Types.ObjectId.isValid(input.terminationId)) {
      throw AppError.validation('Termination identifier is invalid');
    }
    const idempotencyKey = normalizeKey(input.idempotencyKey);
    const reason = normalizeNote(input.reason);
    if (!reason) {
      throw AppError.validation('A rejection reason is required');
    }
    const rejectedAt = input.rejectedAt ?? new Date();
    const intentFingerprint = fingerprint({
      operation: 'reject',
      terminationId: input.terminationId,
      reason,
      actorId: input.actor.id,
    });
    let committed: IMembershipTermination | undefined;
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const reusedKey = await MembershipTermination.findOne({
          rejectionIdempotencyKey: idempotencyKey,
        }).session(session);
        if (reusedKey && reusedKey._id.toString() !== input.terminationId) {
          throw AppError.conflict(
            'Rejection Idempotency-Key is already used by another termination'
          );
        }
        const termination = await MembershipTermination.findById(
          input.terminationId
        ).session(session);
        if (!termination) throw AppError.notFound('Termination not found');
        if (termination.status === MembershipTerminationStatus.REJECTED) {
          if (
            termination.rejectionIdempotencyKey === idempotencyKey &&
            termination.rejectionIntentFingerprint === intentFingerprint
          ) {
            committed = termination;
            return;
          }
          throw AppError.conflict('Termination has already been rejected');
        }
        if (
          termination.status !== MembershipTerminationStatus.PENDING_REVIEW ||
          termination.source !== MembershipTerminationSource.ONLINE
        ) {
          throw AppError.conflict(
            'Only a pending online termination request can be rejected'
          );
        }
        termination.status = MembershipTerminationStatus.REJECTED;
        termination.isOpen = false;
        termination.rejectedAt = rejectedAt;
        termination.rejectedBy = actorSnapshot(input.actor);
        termination.rejectionReason = reason;
        termination.rejectionIdempotencyKey = idempotencyKey;
        termination.rejectionIntentFingerprint = intentFingerprint;
        await termination.save({ session });
        await writeAudit(
          termination,
          AuditEventType.MEMBERSHIP_TERMINATION_REJECTED,
          input.actor,
          session,
          {
            reason,
            extraChanges: [
              {
                field: 'status',
                oldValue: MembershipTerminationStatus.PENDING_REVIEW,
                newValue: MembershipTerminationStatus.REJECTED,
              },
            ],
          }
        );
        committed = termination;
      });
    } catch (error) {
      if (!duplicate(error)) throw error;
      const replay = await MembershipTermination.findOne({
        rejectionIdempotencyKey: idempotencyKey,
      });
      if (
        !replay ||
        replay._id.toString() !== input.terminationId ||
        replay.rejectionIntentFingerprint !== intentFingerprint
      ) {
        throw AppError.conflict(
          'Termination rejection conflicts with an existing intent'
        );
      }
      committed = replay;
    } finally {
      await session.endSession();
    }

    if (!committed) {
      throw AppError.internal('Rejection transaction produced no result');
    }
    return toMembershipTerminationResponse(committed);
  }

  static async recordBatch(input: {
    userIds: string[];
    effectiveTiming: AdminMembershipTerminationTimingInput['effectiveTiming'];
    effectiveDate?: string;
    note?: string;
    idempotencyKey: string;
    actor: MembershipLifecycleActor;
    now?: Date;
  }): Promise<MembershipTerminationBatchResponse> {
    assertAdministrator(input.actor);
    const baseKey = normalizeKey(input.idempotencyKey);
    const uniqueUserIds = [...new Set(input.userIds)];
    if (uniqueUserIds.length < 1 || uniqueUserIds.length > 50) {
      throw AppError.validation('Batch must contain between 1 and 50 Users');
    }
    const now = input.now ?? new Date();
    const items = [];
    for (const userId of uniqueUserIds) {
      try {
        const termination = await createTermination({
          userId,
          source: MembershipTerminationSource.BATCH,
          requestedAt: now,
          evaluatedAt: now,
          effectiveTiming: input.effectiveTiming,
          effectiveDate: input.effectiveDate,
          note: input.note,
          idempotencyKey: `${baseKey}:member:${userId}`,
          actor: input.actor,
          approveImmediately: true,
          auditEvent: AuditEventType.MEMBERSHIP_TERMINATION_BATCH_RECORDED,
        });
        items.push({ userId, termination });
      } catch (error) {
        const appError =
          error instanceof AppError
            ? error
            : AppError.internal('Termination batch item failed');
        items.push({
          userId,
          error: { code: appError.code, message: appError.message },
        });
      }
    }
    const createdCount = items.filter((item) => item.termination).length;
    return {
      success: createdCount === items.length,
      createdCount,
      failureCount: items.length - createdCount,
      items,
    };
  }

  static async getRelevantForUser(
    userId: string
  ): Promise<MembershipTerminationResponse | null> {
    if (!Types.ObjectId.isValid(userId)) {
      throw AppError.validation('User identifier is invalid');
    }
    const open = await MembershipTermination.findOne({
      userId,
      isOpen: true,
    });
    if (open) return toMembershipTerminationResponse(open);
    const latestClosed = await MembershipTermination.findOne({
      userId,
      isOpen: false,
      status: {
        $in: [
          MembershipTerminationStatus.REJECTED,
          MembershipTerminationStatus.EFFECTIVE,
        ],
      },
    }).sort({ createdAt: -1, _id: -1 });
    return latestClosed?.status === MembershipTerminationStatus.REJECTED &&
      latestClosed.source === MembershipTerminationSource.ONLINE
      ? toMembershipTerminationResponse(latestClosed)
      : null;
  }

  static async listOpen(
    status?: MembershipTerminationStatus
  ): Promise<AdminMembershipTerminationResponse[]> {
    const filter: Record<string, unknown> = { isOpen: true };
    if (status) filter.status = status;
    const records = await MembershipTermination.find(filter)
      .populate('userId', 'firstName lastName email')
      .sort({ requestedAt: 1 });
    return records.map(toAdminMembershipTerminationResponse);
  }

  private static async processOneDue(input: {
    terminationId: string;
    asOfDate: string;
    processedAt: Date;
  }): Promise<ProcessTerminationItemResult> {
    const session = await mongoose.startSession();
    let result: ProcessTerminationItemResult | undefined;
    try {
      await session.withTransaction(async () => {
        const termination = await MembershipTermination.findById(
          input.terminationId
        ).session(session);
        if (!termination) {
          result = {
            terminationId: input.terminationId,
            outcome: 'skipped',
          };
          return;
        }
        if (termination.status === MembershipTerminationStatus.EFFECTIVE) {
          result = {
            terminationId: input.terminationId,
            userId: termination.userId.toString(),
            outcome: 'replayed',
          };
          return;
        }
        if (
          termination.status !== MembershipTerminationStatus.APPROVED ||
          !termination.confirmedEffectiveDate ||
          termination.confirmedEffectiveDate > input.asOfDate
        ) {
          result = {
            terminationId: input.terminationId,
            userId: termination.userId.toString(),
            outcome: 'skipped',
          };
          return;
        }
        if (!termination.approvedBy) {
          throw AppError.internal(
            'Approved termination is missing its administrator actor'
          );
        }
        const scheduledActor = {
          id: termination.approvedBy.id.toString(),
          email: termination.approvedBy.email,
          accountKind: termination.approvedBy.accountKind,
          displayName: termination.approvedBy.displayName,
          capabilities: [Capability.ADMINISTRATION],
        };
        const outcome = await effectTerminationInSession({
          termination,
          asOfDate: input.asOfDate,
          processedAt: input.processedAt,
          actor: scheduledActor,
          session,
        });
        result = {
          terminationId: termination._id.toString(),
          userId: termination.userId.toString(),
          outcome,
        };
      });
    } finally {
      await session.endSession();
    }
    if (!result) {
      throw AppError.internal('Termination processor produced no result');
    }
    return result;
  }

  static async processDue(input: {
    asOfDate: string;
    processedAt?: Date;
    limit?: number;
  }): Promise<ProcessDueTerminationsResult> {
    parseDateOnly(input.asOfDate);
    const processedAt = input.processedAt ?? new Date();
    if (!Number.isFinite(processedAt.getTime())) {
      throw AppError.validation('Processing time is invalid');
    }
    if (berlinDateOnly(processedAt) < input.asOfDate) {
      throw AppError.validation(
        'Processing time cannot be earlier than the as-of date'
      );
    }
    const limit = input.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw AppError.validation('Processor limit must be between 1 and 500');
    }
    const due = await MembershipTermination.find({
      status: MembershipTerminationStatus.APPROVED,
      isOpen: true,
      confirmedEffectiveDate: { $lte: input.asOfDate },
    })
      .sort({ confirmedEffectiveDate: 1, _id: 1 })
      .limit(limit)
      .select('_id');
    const items: ProcessTerminationItemResult[] = [];
    for (const termination of due) {
      try {
        items.push(
          await MembershipTerminationService.processOneDue({
            terminationId: termination._id.toString(),
            asOfDate: input.asOfDate,
            processedAt,
          })
        );
      } catch (error) {
        const safeFailure = safeProcessingFailure(error);
        await MembershipTermination.updateOne(
          {
            _id: termination._id,
            status: MembershipTerminationStatus.APPROVED,
            isOpen: true,
            confirmedEffectiveDate: { $lte: input.asOfDate },
          },
          {
            $set: {
              lastProcessingFailure: {
                ...safeFailure,
                failedAt: processedAt,
              },
            },
          },
          { runValidators: true }
        );
        items.push({
          terminationId: termination._id.toString(),
          outcome: 'failed',
          error: safeFailure,
        });
      }
    }
    return {
      asOfDate: input.asOfDate,
      processedCount: items.filter((item) => item.outcome === 'processed')
        .length,
      replayedCount: items.filter((item) => item.outcome === 'replayed').length,
      skippedCount: items.filter((item) => item.outcome === 'skipped').length,
      failureCount: items.filter((item) => item.outcome === 'failed').length,
      items,
    };
  }
}
