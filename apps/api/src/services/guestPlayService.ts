import {
  AuditEventType,
  EntityType,
  MembershipStatus,
} from '@club/shared-types/core/enums';
import type {
  CreateGuestPlayRequest,
  GuestPlayCorrectionCommand,
  GuestPlayDecisionCommand,
  GuestPlayListQuery,
  GuestPlayStatsResponse,
} from '@club/shared-types/api/guestPlay';
import type { GuestPlay as DomainGuestPlay } from '@club/shared-types/domain/guestPlay';
import mongoose, { Types, type ClientSession } from 'mongoose';
import { AuditService } from './auditService';
import { GuestPlay } from '../models/GuestPlay';
import { User } from '../models/User';
import { GuestPlayPersistenceTransformer } from '../transformers/guestPlay';
import { AppError } from '../utils/errors';
import { GuestPlayOpportunityService } from './guestPlayOpportunityService';
import { GuestPlayNotificationService } from './guestPlayNotificationService';
import type { CommandActor } from '@club/shared-types/domain/membership';

export interface GuestPlayCommandActor extends CommandActor {
  ipAddress?: string;
  userAgent?: string;
}

function objectId(id: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id))
    throw AppError.validation(`${label} identifier is invalid`);
  return new Types.ObjectId(id);
}

function activeRequestKey(
  memberId: string,
  appointment: { locationId: string; timeSlotId: string; localDate: string }
): string {
  return [
    memberId,
    appointment.locationId,
    appointment.timeSlotId,
    appointment.localDate,
  ].join(':');
}

function duplicateError(error: unknown): boolean {
  return Boolean(
    typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
  );
}

async function withTransaction<T>(
  operation: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await operation(session);
    });
    if (result === undefined)
      throw AppError.internal('Guest Play transaction produced no result');
    return result;
  } finally {
    await session.endSession();
  }
}

async function ensureApprovalEligible(
  memberId: Types.ObjectId,
  startAt: Date,
  session: ClientSession
): Promise<void> {
  if (startAt <= new Date()) {
    throw new AppError(
      'Past Guest Play requests cannot be approved',
      409,
      'GUEST_PLAY_PAST'
    );
  }
  const member = await User.findOne({
    _id: memberId,
    membershipStatus: {
      $in: [MembershipStatus.ACTIVE, MembershipStatus.PASSIVE],
    },
  })
    .select('_id')
    .session(session);
  if (!member) {
    throw new AppError(
      'The requesting member is no longer eligible for Guest Play',
      409,
      'GUEST_PLAY_MEMBER_INELIGIBLE'
    );
  }
}

async function writeAudit(
  requestId: Types.ObjectId,
  actor: GuestPlayCommandActor,
  eventType: AuditEventType,
  changes: Array<{ field: string; oldValue: unknown; newValue: unknown }>,
  reason: string | undefined,
  session: ClientSession
): Promise<void> {
  await AuditService.writeRequired(
    {
      eventType,
      entityType: EntityType.GUEST_PLAY,
      entityId: requestId,
      actor: {
        id: objectId(actor.id, 'Actor'),
        accountKind: actor.accountKind,
      },
      changes,
      reason,
    },
    session
  );
}

export class GuestPlayService {
  private static async currentOrNotFound(id: string): Promise<DomainGuestPlay> {
    const current = await GuestPlay.findById(id);
    if (!current) throw AppError.notFound('Guest Play request not found');
    return GuestPlayPersistenceTransformer.toDomain(current);
  }

  private static async stateConflict(
    id: string,
    message: string
  ): Promise<never> {
    const latest = await this.currentOrNotFound(id);
    throw new AppError(message, 409, 'GUEST_PLAY_STATE_CONFLICT', { latest });
  }

  static async createRequest(
    request: CreateGuestPlayRequest,
    member: { id: string; firstName: string; lastName: string; email: string }
  ): Promise<DomainGuestPlay> {
    const opportunity = await GuestPlayOpportunityService.resolve(request);
    const key = activeRequestKey(member.id, opportunity);
    try {
      const created = await GuestPlay.create({
        memberId: objectId(member.id, 'Member'),
        memberName: `${member.firstName} ${member.lastName}`.trim(),
        memberEmail: member.email.trim().toLowerCase(),
        guestCount: request.guestCount,
        message: request.message,
        status: 'pending',
        appointment: {
          locationId: opportunity.locationId,
          timeSlotId: opportunity.timeSlotId,
          locationName: opportunity.locationName,
          locationAddress: opportunity.locationAddress,
          localDate: opportunity.localDate,
          startTime: opportunity.startTime,
          endTime: opportunity.endTime,
          startAt: new Date(opportunity.startAt),
        },
        activeRequestKey: key,
        locale: request.locale,
      });
      await GuestPlayNotificationService.sendInitial(created.id).catch(
        () => undefined
      );
      return this.currentOrNotFound(created.id);
    } catch (error) {
      if (duplicateError(error)) {
        throw new AppError(
          'An active Guest Play request already exists for this opportunity',
          409,
          'ACTIVE_GUEST_PLAY_REQUEST_EXISTS'
        );
      }
      throw error;
    }
  }

  static async getRequestById(id: string): Promise<DomainGuestPlay> {
    return this.currentOrNotFound(id);
  }

  static async getAllRequests(query: GuestPlayListQuery) {
    const filter: Record<string, unknown> = {};
    if (query.status !== 'all') filter.status = query.status;
    if (query.archived === 'exclude') filter.archived = false;
    if (query.archived === 'only') filter.archived = true;
    const [requests, total] = await Promise.all([
      GuestPlay.find(filter)
        .sort({ createdAt: -1 })
        .skip(query.offset)
        .limit(query.limit),
      GuestPlay.countDocuments(filter),
    ]);
    return {
      requests: requests.map(GuestPlayPersistenceTransformer.toDomain),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  static async getMyRequests(memberId: string): Promise<DomainGuestPlay[]> {
    const requests = await GuestPlay.find({ memberId }).sort({ createdAt: -1 });
    return requests.map(GuestPlayPersistenceTransformer.toDomain);
  }

  static async cancelOwnRequest(
    id: string,
    memberId: string,
    expectedVersion: number
  ): Promise<DomainGuestPlay> {
    const updated = await GuestPlay.findOneAndUpdate(
      { _id: id, memberId, status: 'pending', __v: expectedVersion },
      {
        $set: { status: 'cancelled' },
        $unset: { activeRequestKey: 1 },
        $inc: { __v: 1 },
      },
      { new: true }
    );
    if (!updated) {
      throw new AppError(
        'Guest Play request cannot be cancelled',
        409,
        'GUEST_PLAY_STATE_CONFLICT'
      );
    }
    return GuestPlayPersistenceTransformer.toDomain(updated);
  }

  static async decide(
    id: string,
    actor: GuestPlayCommandActor,
    command: GuestPlayDecisionCommand
  ): Promise<DomainGuestPlay> {
    const decided = await withTransaction(async (session) => {
      const current = await GuestPlay.findById(id).session(session);
      if (!current) throw AppError.notFound('Guest Play request not found');
      if (
        current.status !== 'pending' ||
        current.__v !== command.expectedVersion
      ) {
        return this.stateConflict(
          id,
          'Guest Play request is no longer pending'
        );
      }
      if (command.decision === 'approved') {
        await ensureApprovalEligible(
          current.memberId,
          current.appointment.startAt,
          session
        );
      }
      const mutation: Record<string, unknown> = {
        status: command.decision,
        adminNotes: command.adminNotes,
        decisionBy: objectId(actor.id, 'Actor'),
        decisionAt: new Date(),
        'notifications.decisionEmail': {
          status: 'not_attempted',
          attempts: 0,
          recipients: [],
        },
      };
      const update =
        command.decision === 'declined'
          ? {
              $set: mutation,
              $unset: { activeRequestKey: 1 },
              $inc: { __v: 1 },
            }
          : { $set: mutation, $inc: { __v: 1 } };
      const updated = await GuestPlay.findOneAndUpdate(
        { _id: id, status: 'pending', __v: command.expectedVersion },
        update,
        { new: true, session }
      );
      if (!updated)
        return this.stateConflict(
          id,
          'Guest Play request is no longer pending'
        );
      await writeAudit(
        updated._id,
        actor,
        AuditEventType.GUEST_PLAY_DECIDED,
        [{ field: 'status', oldValue: 'pending', newValue: command.decision }],
        undefined,
        session
      );
      return GuestPlayPersistenceTransformer.toDomain(updated);
    });
    await GuestPlayNotificationService.sendDecision(decided.id).catch(
      () => undefined
    );
    return this.currentOrNotFound(decided.id);
  }

  static async correctDecision(
    id: string,
    actor: GuestPlayCommandActor,
    command: GuestPlayCorrectionCommand
  ): Promise<DomainGuestPlay> {
    try {
      const corrected = await withTransaction(async (session) => {
        const current = await GuestPlay.findById(id).session(session);
        if (!current) throw AppError.notFound('Guest Play request not found');
        if (
          !['approved', 'declined'].includes(current.status) ||
          current.status === command.decision ||
          current.__v !== command.expectedVersion
        ) {
          return this.stateConflict(
            id,
            'Guest Play decision cannot be corrected from the current state'
          );
        }
        if (command.decision === 'approved') {
          await ensureApprovalEligible(
            current.memberId,
            current.appointment.startAt,
            session
          );
        }
        const oldStatus = current.status;
        const set: Record<string, unknown> = {
          status: command.decision,
          adminNotes: command.adminNotes,
          decisionBy: objectId(actor.id, 'Actor'),
          decisionAt: new Date(),
          'notifications.decisionEmail': {
            status: 'not_attempted',
            attempts: 0,
            recipients: [],
          },
        };
        if (command.decision === 'approved') {
          set.activeRequestKey = activeRequestKey(
            current.memberId.toString(),
            current.appointment
          );
        }
        const updated = await GuestPlay.findOneAndUpdate(
          { _id: id, status: oldStatus, __v: command.expectedVersion },
          command.decision === 'declined'
            ? { $set: set, $unset: { activeRequestKey: 1 }, $inc: { __v: 1 } }
            : { $set: set, $inc: { __v: 1 } },
          { new: true, runValidators: true, session }
        );
        if (!updated)
          return this.stateConflict(id, 'Guest Play request has changed');
        await writeAudit(
          updated._id,
          actor,
          AuditEventType.GUEST_PLAY_DECISION_CORRECTED,
          [
            {
              field: 'status',
              oldValue: oldStatus,
              newValue: command.decision,
            },
          ],
          command.reason,
          session
        );
        return GuestPlayPersistenceTransformer.toDomain(updated);
      });
      await GuestPlayNotificationService.sendDecision(corrected.id).catch(
        () => undefined
      );
      return this.currentOrNotFound(corrected.id);
    } catch (error) {
      if (duplicateError(error)) {
        throw new AppError(
          'Another active Guest Play request exists for this opportunity',
          409,
          'ACTIVE_GUEST_PLAY_REQUEST_EXISTS'
        );
      }
      throw error;
    }
  }

  static async setArchived(
    id: string,
    actor: GuestPlayCommandActor,
    expectedVersion: number,
    archived: boolean
  ): Promise<DomainGuestPlay> {
    return withTransaction(async (session) => {
      const now = new Date();
      const update = archived
        ? {
            $set: {
              archived: true,
              archivedAt: now,
              archivedBy: objectId(actor.id, 'Actor'),
            },
            $inc: { __v: 1 },
          }
        : {
            $set: { archived: false },
            $unset: { archivedAt: 1, archivedBy: 1 },
            $inc: { __v: 1 },
          };
      const updated = await GuestPlay.findOneAndUpdate(
        {
          _id: id,
          __v: expectedVersion,
          archived: !archived,
          status: { $in: ['approved', 'declined', 'cancelled'] },
        },
        update,
        { new: true, session }
      );
      if (!updated)
        return this.stateConflict(
          id,
          'Guest Play archive state cannot be changed'
        );
      await writeAudit(
        updated._id,
        actor,
        archived
          ? AuditEventType.GUEST_PLAY_ARCHIVED
          : AuditEventType.GUEST_PLAY_RESTORED,
        [{ field: 'archived', oldValue: !archived, newValue: archived }],
        undefined,
        session
      );
      return GuestPlayPersistenceTransformer.toDomain(updated);
    });
  }

  static async getStats(): Promise<GuestPlayStatsResponse> {
    const [total, pending, approved, declined, cancelled, archived] =
      await Promise.all([
        GuestPlay.countDocuments(),
        GuestPlay.countDocuments({ status: 'pending' }),
        GuestPlay.countDocuments({ status: 'approved' }),
        GuestPlay.countDocuments({ status: 'declined' }),
        GuestPlay.countDocuments({ status: 'cancelled' }),
        GuestPlay.countDocuments({ archived: true }),
      ]);
    return { total, pending, approved, declined, cancelled, archived };
  }
}
