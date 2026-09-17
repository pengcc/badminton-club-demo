import mongoose, { Types, type ClientSession } from 'mongoose';
import {
  AuditEventType,
  EntityType,
  MatchDirection,
  MatchListView,
} from '@club/shared-types/core/enums';
import type { Api } from '@club/shared-types/api/match';
import type { Domain } from '@club/shared-types/domain/match';
import { AuditService } from './auditService';
import { Match } from '../models/Match';
import { MatchPersistenceTransformer } from '../transformers/match';
import { AppError } from '../utils/errors';
import { berlinLocalStartToDate } from './matchTimePolicy';
import {
  buildMatchScheduleDuplicateKey,
  isMatchScheduleDuplicateError,
} from './matchScheduleDuplicateKey';
import { TeamService } from './teamService';
import type { CommandActor } from '@club/shared-types/domain/membership';
import { DemoEditingService } from './demoEditingService';

export interface MatchCommandActor extends CommandActor {
  ipAddress?: string;
  userAgent?: string;
}

interface MatchListOptions {
  view?: MatchListView;
  now?: Date;
  demoScratchLeaseId?: string;
}

export interface DemoMatchCommandContext {
  authSessionId: string;
}

const canonicalMatchQuery = { demoScratchLeaseId: { $exists: false } };

function visibleMatchQuery(demoScratchLeaseId?: string) {
  return demoScratchLeaseId
    ? { $or: [canonicalMatchQuery, { demoScratchLeaseId }] }
    : canonicalMatchQuery;
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
    if (result === undefined) {
      throw AppError.internal('Match transaction produced no result');
    }
    return result;
  } finally {
    await session.endSession();
  }
}

function ensureObjectId(id: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw AppError.validation(`${label} identifier is invalid`);
  }
  return new Types.ObjectId(id);
}

function listQuery(view: MatchListView, now: Date): Record<string, unknown> {
  if (view === MatchListView.UPCOMING) return { startAt: { $gt: now } };
  if (view === MatchListView.HISTORY) return { startAt: { $lte: now } };
  return {};
}

function listSort(view: MatchListView): { startAt: 1 | -1; _id: 1 | -1 } {
  return view === MatchListView.UPCOMING
    ? { startAt: 1, _id: 1 }
    : { startAt: -1, _id: -1 };
}

function baseFacts(match: {
  teamId: Types.ObjectId;
  opponentName: string;
  direction: MatchDirection;
  startAt: Date;
  location: string;
  arrivalGuidance?: string;
}) {
  return {
    teamId: match.teamId.toString(),
    opponentName: match.opponentName,
    direction: match.direction,
    startAt: match.startAt.toISOString(),
    location: match.location,
    arrivalGuidance: match.arrivalGuidance,
  };
}

function auditChanges(
  fields: string[],
  before?: ReturnType<typeof baseFacts>,
  after?: ReturnType<typeof baseFacts>
) {
  return fields.map((field) =>
    field === 'arrivalGuidance'
      ? { field }
      : {
          field,
          ...(before ? { oldValue: before[field as keyof typeof before] } : {}),
          ...(after ? { newValue: after[field as keyof typeof after] } : {}),
        }
  );
}

async function writeMatchAudit(
  input: {
    eventType: AuditEventType;
    matchId: Types.ObjectId;
    actor: MatchCommandActor;
    changes: Array<{
      field: string;
      oldValue?: unknown;
      newValue?: unknown;
    }>;
  },
  session: ClientSession
): Promise<void> {
  await AuditService.writeRequired(
    {
      eventType: input.eventType,
      entityType: EntityType.MATCH,
      entityId: input.matchId,
      actor: {
        id: ensureObjectId(input.actor.id, 'Actor'),
        accountKind: input.actor.accountKind,
      },
      changes: input.changes,
    },
    session
  );
}

export class MatchService {
  private static toDomain(match: Record<string, any>): Domain.Match {
    return MatchPersistenceTransformer.toDomain(match as never);
  }

  private static async getMatchByQuery(
    query: Record<string, unknown>
  ): Promise<Domain.Match | null> {
    const match = await Match.findOne(query)
      .select('+demoScratchLeaseId')
      .lean();
    return match ? this.toDomain(match) : null;
  }

  private static async getMatchesByQuery(
    query: Record<string, unknown>,
    view: MatchListView
  ): Promise<Domain.Match[]> {
    const matches = await Match.find(query)
      .select('+demoScratchLeaseId')
      .sort(listSort(view))
      .lean();
    return matches.map((match) => this.toDomain(match));
  }

  static async createMatch(
    request: Api.CreateMatchRequest,
    actor: MatchCommandActor,
    demoContext?: DemoMatchCommandContext
  ): Promise<Domain.Match> {
    const teamId = ensureObjectId(request.teamId, 'Team');
    const createdById = ensureObjectId(actor.id, 'Actor');
    const startAt = berlinLocalStartToDate(
      request.localDate,
      request.localTime
    );
    const scheduleDuplicateKey = buildMatchScheduleDuplicateKey({
      teamId,
      opponentName: request.opponentName,
      direction: request.direction,
      startAt,
      location: request.location,
    });

    let committedContext: { matchId: string; demoScratchLeaseId?: string };
    try {
      committedContext = await withTransaction(async (session) => {
        const demoScratchLeaseId = demoContext
          ? await DemoEditingService.reserveMutation(
              demoContext.authSessionId,
              new Date(),
              session
            )
          : undefined;
        await TeamService.claimTeams([teamId], session);

        const [match] = await Match.create(
          [
            {
              scheduleDuplicateKey,
              teamId,
              opponentName: request.opponentName,
              direction: request.direction,
              startAt,
              location: request.location,
              ...(request.arrivalGuidance
                ? { arrivalGuidance: request.arrivalGuidance }
                : {}),
              lineup: [],
              availability: [],
              createdById,
              ...(demoScratchLeaseId ? { demoScratchLeaseId } : {}),
            },
          ],
          { session }
        );
        await writeMatchAudit(
          {
            eventType: AuditEventType.MATCH_CREATED,
            matchId: match._id,
            actor,
            changes: auditChanges(
              Object.keys(baseFacts(match)).filter(
                (field) =>
                  baseFacts(match)[
                    field as keyof ReturnType<typeof baseFacts>
                  ] !== undefined
              ),
              undefined,
              baseFacts(match)
            ),
          },
          session
        );
        return {
          matchId: match._id.toString(),
          ...(demoScratchLeaseId ? { demoScratchLeaseId } : {}),
        };
      });
    } catch (error) {
      if (
        demoContext &&
        (error as { code?: number }).code === 11000 &&
        !isMatchScheduleDuplicateError(error)
      ) {
        throw new AppError(
          'This demo lease already has a temporary Match',
          409,
          'DEMO_SCRATCH_LIMIT_REACHED'
        );
      }
      if (isMatchScheduleDuplicateError(error)) {
        throw new AppError(
          'An equal Match already exists',
          409,
          'MATCH_SCHEDULE_DUPLICATE'
        );
      }
      throw error;
    }

    const committed = await this.getMatchById(
      committedContext.matchId,
      committedContext.demoScratchLeaseId
    );
    if (!committed) throw AppError.internal('Created Match was not committed');
    return committed;
  }

  static async getMatchById(
    id: string,
    demoScratchLeaseId?: string
  ): Promise<Domain.Match | null> {
    ensureObjectId(id, 'Match');
    return this.getMatchByQuery({
      _id: id,
      ...visibleMatchQuery(demoScratchLeaseId),
    });
  }

  static async getMatchByScheduleDuplicateKey(
    scheduleDuplicateKey: string
  ): Promise<Domain.Match | null> {
    return this.getMatchByQuery({
      scheduleDuplicateKey,
      ...canonicalMatchQuery,
    });
  }

  static async getMatchByIdForUser(
    id: string,
    userId: string
  ): Promise<Domain.Match | null> {
    ensureObjectId(id, 'Match');
    const teamIds = await TeamService.getCurrentTeamIdsForUser(userId);
    if (teamIds.length === 0) return null;
    return this.getMatchByQuery({
      _id: id,
      teamId: { $in: teamIds },
      ...canonicalMatchQuery,
    });
  }

  static async updateMatch(
    id: string,
    request: Api.UpdateMatchRequest,
    actor: MatchCommandActor,
    evaluatedAt = new Date(),
    demoContext?: DemoMatchCommandContext
  ): Promise<Domain.Match> {
    const matchId = ensureObjectId(id, 'Match');
    const teamId = ensureObjectId(request.teamId, 'Team');
    const startAt = berlinLocalStartToDate(
      request.localDate,
      request.localTime
    );
    const scheduleDuplicateKey = buildMatchScheduleDuplicateKey({
      teamId,
      opponentName: request.opponentName,
      direction: request.direction,
      startAt,
      location: request.location,
    });

    let committedContext: { matchId: string; demoScratchLeaseId?: string };
    try {
      committedContext = await withTransaction(async (session) => {
        const demoScratchLeaseId = demoContext
          ? await DemoEditingService.reserveMutation(
              demoContext.authSessionId,
              evaluatedAt,
              session
            )
          : undefined;
        const current = await Match.findOne({
          _id: matchId,
          ...(demoScratchLeaseId
            ? { demoScratchLeaseId }
            : canonicalMatchQuery),
        })
          .select('+demoScratchLeaseId')
          .session(session);
        if (!current) throw AppError.notFound('Match not found');
        if (current.__v !== request.expectedVersion) {
          throw AppError.conflict('Match changed since it was loaded');
        }

        const proposed = {
          teamId,
          opponentName: request.opponentName,
          direction: request.direction,
          startAt,
          location: request.location,
          arrivalGuidance: request.arrivalGuidance,
        };
        const before = baseFacts(current);
        const after = baseFacts(proposed);
        const changedFields = Object.keys(after).filter(
          (field) =>
            before[field as keyof typeof before] !==
            after[field as keyof typeof after]
        );
        if (changedFields.length === 0) {
          return {
            matchId: current._id.toString(),
            ...(demoScratchLeaseId ? { demoScratchLeaseId } : {}),
          };
        }
        if (current.result && startAt.getTime() > evaluatedAt.getTime()) {
          throw AppError.conflict(
            'A Match with a result cannot be moved to the future'
          );
        }

        if (current.teamId.toString() !== teamId.toString()) {
          await TeamService.claimTeams([teamId], session);
        }

        const update = await Match.updateOne(
          {
            _id: matchId,
            __v: request.expectedVersion,
            ...(demoScratchLeaseId
              ? { demoScratchLeaseId }
              : canonicalMatchQuery),
          },
          {
            $set: {
              teamId,
              opponentName: request.opponentName,
              direction: request.direction,
              startAt,
              location: request.location,
              scheduleDuplicateKey,
              ...(request.arrivalGuidance
                ? { arrivalGuidance: request.arrivalGuidance }
                : {}),
            },
            ...(!request.arrivalGuidance
              ? { $unset: { arrivalGuidance: 1 } }
              : {}),
            $inc: { __v: 1 },
          },
          { runValidators: true, session }
        );
        if (update.matchedCount !== 1) {
          throw AppError.conflict('Match changed since it was loaded');
        }

        await writeMatchAudit(
          {
            eventType: AuditEventType.MATCH_UPDATED,
            matchId,
            actor,
            changes: auditChanges(changedFields, before, after),
          },
          session
        );
        return {
          matchId: current._id.toString(),
          ...(demoScratchLeaseId ? { demoScratchLeaseId } : {}),
        };
      });
    } catch (error) {
      if (isMatchScheduleDuplicateError(error)) {
        throw new AppError(
          'An equal Match already exists',
          409,
          'MATCH_SCHEDULE_DUPLICATE'
        );
      }
      throw error;
    }

    const committed = await this.getMatchById(
      committedContext.matchId,
      committedContext.demoScratchLeaseId
    );
    if (!committed) throw AppError.internal('Updated Match was not committed');
    return committed;
  }

  static async deleteMatch(
    id: string,
    request: Api.DeleteMatchRequest,
    actor: MatchCommandActor
  ): Promise<void> {
    const matchId = ensureObjectId(id, 'Match');
    await withTransaction(async (session) => {
      const current = await Match.findById(matchId).session(session);
      if (!current) throw AppError.notFound('Match not found');
      if (current.__v !== request.expectedVersion) {
        throw AppError.conflict('Match changed since it was loaded');
      }

      const deletion = await Match.deleteOne(
        { _id: matchId, __v: request.expectedVersion },
        { session }
      );
      if (deletion.deletedCount !== 1) {
        throw AppError.conflict('Match changed since it was loaded');
      }
      await writeMatchAudit(
        {
          eventType: AuditEventType.MATCH_DELETED,
          matchId,
          actor,
          changes: Object.entries({
            ...baseFacts(current),
            ...(current.result
              ? {
                  result: {
                    homeScore: current.result.homeScore,
                    awayScore: current.result.awayScore,
                    ...(current.result.note
                      ? { note: current.result.note }
                      : {}),
                  },
                }
              : {}),
          })
            .filter(([, oldValue]) => oldValue !== undefined)
            .map(([field, oldValue]) =>
              field === 'arrivalGuidance' ? { field } : { field, oldValue }
            ),
        },
        session
      );
      return true;
    });
  }

  static async setResult(
    id: string,
    request: Api.SetMatchResultRequest,
    actor: MatchCommandActor,
    evaluatedAt = new Date()
  ): Promise<Domain.Match> {
    const matchId = ensureObjectId(id, 'Match');
    const result = {
      homeScore: request.homeScore,
      awayScore: request.awayScore,
      ...(request.note?.trim() ? { note: request.note.trim() } : {}),
    };

    const committedId = await withTransaction(async (session) => {
      const current = await Match.findById(matchId).session(session);
      if (!current) throw AppError.notFound('Match not found');
      if (current.__v !== request.expectedVersion) {
        throw AppError.conflict('Match changed since it was loaded');
      }
      if (current.startAt.getTime() > evaluatedAt.getTime()) {
        throw AppError.conflict(
          'A result cannot be recorded before the Match starts'
        );
      }

      const previous = current.result
        ? {
            homeScore: current.result.homeScore,
            awayScore: current.result.awayScore,
            ...(current.result.note ? { note: current.result.note } : {}),
          }
        : undefined;
      if (
        previous?.homeScore === result.homeScore &&
        previous.awayScore === result.awayScore &&
        previous.note === result.note
      ) {
        return current._id.toString();
      }

      const update = await Match.updateOne(
        { _id: matchId, __v: request.expectedVersion },
        {
          $set: { result },
          $inc: { __v: 1 },
        },
        { runValidators: true, session }
      );
      if (update.matchedCount !== 1) {
        throw AppError.conflict('Match changed since it was loaded');
      }

      await writeMatchAudit(
        {
          eventType: previous
            ? AuditEventType.MATCH_RESULT_CORRECTED
            : AuditEventType.MATCH_RESULT_RECORDED,
          matchId,
          actor,
          changes: [
            {
              field: 'result',
              oldValue: previous,
              newValue: result,
            },
          ],
        },
        session
      );
      return current._id.toString();
    });

    const committed = await this.getMatchById(committedId);
    if (!committed) {
      throw AppError.internal('Updated Match result was not committed');
    }
    return committed;
  }

  static async getMatchesByTeam(teamId: string): Promise<Domain.Match[]> {
    return this.getMatchesByQuery(
      {
        teamId: ensureObjectId(teamId, 'Team'),
        ...canonicalMatchQuery,
      },
      MatchListView.ALL
    );
  }

  static async getUpcomingMatches(now = new Date()): Promise<Domain.Match[]> {
    return this.getMatchesByQuery(
      { ...canonicalMatchQuery, ...listQuery(MatchListView.UPCOMING, now) },
      MatchListView.UPCOMING
    );
  }

  static async getAllMatches(
    options: MatchListOptions = {}
  ): Promise<Domain.Match[]> {
    const view = options.view ?? MatchListView.ALL;
    return this.getMatchesByQuery(
      {
        ...visibleMatchQuery(options.demoScratchLeaseId),
        ...listQuery(view, options.now ?? new Date()),
      },
      view
    );
  }

  static async getMatchesForUser(
    userId: string,
    options: MatchListOptions = {}
  ): Promise<Domain.Match[]> {
    const teamIds = await TeamService.getCurrentTeamIdsForUser(userId);
    if (teamIds.length === 0) return [];
    const view = options.view ?? MatchListView.ALL;
    return this.getMatchesByQuery(
      {
        teamId: { $in: teamIds },
        ...canonicalMatchQuery,
        ...listQuery(view, options.now ?? new Date()),
      },
      view
    );
  }
}
