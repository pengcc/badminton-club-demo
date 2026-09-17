import {
  AuditEventType,
  EntityType,
  AccountKind,
} from '@club/shared-types/core/enums';
import { subMonths } from 'date-fns';
import type { ClientSession } from 'mongoose';
import { Types } from 'mongoose';
import {
  AuditLog,
  type AuditExecutionSource,
  type FieldChange,
} from '../models/AuditLog';
import { User } from '../models/User';
import { RequiredAuditPersistenceError } from '../utils/errors';

export interface AuditActor {
  id: string | Types.ObjectId;
  accountKind: AccountKind;
}

export interface AuditLogParams {
  eventType: AuditEventType;
  entityType: EntityType;
  entityId?: string | Types.ObjectId;
  actor: AuditActor;
  source?: AuditExecutionSource;
  reason?: string;
  changes?: FieldChange[];
}

export interface AuditLogQuery {
  eventType?: AuditEventType | AuditEventType[];
  entityType?: EntityType | EntityType[];
  entityId?: string;
  actorId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditRetentionResult {
  mode: 'dry-run' | 'apply';
  cutoff: string;
  eligibleCount: number;
  deletedCount: number;
}

const RETENTION_MONTHS = 24;

function objectId(id: string | Types.ObjectId): Types.ObjectId {
  return id instanceof Types.ObjectId ? id : new Types.ObjectId(id);
}

function boundedRecord(params: AuditLogParams) {
  return {
    eventType: params.eventType,
    entityType: params.entityType,
    entityId: params.entityId ? objectId(params.entityId) : undefined,
    actorId: objectId(params.actor.id),
    actorAccountKind: params.actor.accountKind,
    source: params.source ?? 'human',
    reason: params.reason,
    changes: params.changes,
  };
}

export class AuditService {
  static async writeRequired(
    params: AuditLogParams,
    session?: ClientSession
  ): Promise<Types.ObjectId> {
    try {
      const [audit] = await AuditLog.create([boundedRecord(params)], {
        ...(session ? { session } : {}),
      });
      return audit._id;
    } catch (error) {
      throw new RequiredAuditPersistenceError(
        params.eventType,
        params.entityType,
        params.entityId?.toString(),
        error
      );
    }
  }

  static writeBestEffort(params: AuditLogParams): void {
    void this.writeRequired(params).catch(() => {
      console.error('Audit persistence failed', {
        operation: 'audit_write',
        eventType: params.eventType,
        entityType: params.entityType,
        entityId: params.entityId?.toString(),
      });
    });
  }

  private static async projectLogs(logs: Array<Record<string, any>>) {
    const actorIds = [...new Set(logs.map((log) => log.actorId.toString()))];
    const actors = await User.find({ _id: { $in: actorIds } })
      .select('_id accountKind firstName lastName')
      .lean();
    const actorNames = new Map(
      actors.map((actor) => [
        actor._id.toString(),
        actor.accountKind === AccountKind.SUPER_ADMIN
          ? 'Super Admin'
          : `${actor.lastName}, ${actor.firstName}`,
      ])
    );

    return logs.map((log) => {
      const actorId = log.actorId.toString();
      return {
        id: log._id.toString(),
        eventType: log.eventType,
        entityType: log.entityType,
        entityId: log.entityId?.toString(),
        actorId,
        actorAccountKind: log.actorAccountKind,
        actorDisplayName: actorNames.get(actorId) ?? actorId,
        source: log.source ?? 'human',
        ...(log.reason ? { reason: log.reason } : {}),
        ...(log.changes?.length ? { changes: log.changes } : {}),
        createdAt: log.createdAt,
      };
    });
  }

  static async getLogs(query: AuditLogQuery) {
    const filter: Record<string, unknown> = {};
    if (query.eventType) {
      filter.eventType = Array.isArray(query.eventType)
        ? { $in: query.eventType }
        : query.eventType;
    }
    if (query.entityType) {
      filter.entityType = Array.isArray(query.entityType)
        ? { $in: query.entityType }
        : query.entityType;
    }
    if (query.entityId) filter.entityId = objectId(query.entityId);
    if (query.actorId) filter.actorId = objectId(query.actorId);
    if (query.startDate || query.endDate) {
      filter.createdAt = {
        ...(query.startDate ? { $gte: query.startDate } : {}),
        ...(query.endDate ? { $lte: query.endDate } : {}),
      };
    }

    const limit = query.limit || 50;
    const offset = query.offset || 0;
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);
    return {
      logs: await this.projectLogs(logs),
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    };
  }

  static async getLogById(id: string) {
    const log = await AuditLog.findById(id).lean();
    if (!log) return null;
    return (await this.projectLogs([log]))[0];
  }

  static async getLogsForEntity(
    entityType: EntityType,
    entityId: string,
    limit = 50
  ) {
    const logs = await AuditLog.find({
      entityType,
      entityId: objectId(entityId),
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return this.projectLogs(logs);
  }

  static retentionCutoff(now = new Date()): Date {
    return subMonths(now, RETENTION_MONTHS);
  }

  static async maintainRetention({
    apply = false,
    now = new Date(),
  }: {
    apply?: boolean;
    now?: Date;
  } = {}): Promise<AuditRetentionResult> {
    const cutoff = this.retentionCutoff(now);
    const filter = { createdAt: { $lt: cutoff } };
    const eligibleCount = await AuditLog.countDocuments(filter);
    const deletedCount = apply
      ? (await AuditLog.deleteMany(filter)).deletedCount
      : 0;
    return {
      mode: apply ? 'apply' : 'dry-run',
      cutoff: cutoff.toISOString(),
      eligibleCount,
      deletedCount,
    };
  }
}
