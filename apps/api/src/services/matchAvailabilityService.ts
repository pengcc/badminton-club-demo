import mongoose, { Types, type ClientSession } from 'mongoose';
import type { Api } from '@club/shared-types/api/match';
import { MatchAvailabilityParticipation } from '@club/shared-types/core/enums';
import type { Domain } from '@club/shared-types/domain/match';
import { Match } from '../models/Match';
import { AppError } from '../utils/errors';
import {
  assertPlayerEligibleForMatch,
  claimPlayerEligibleForMatch,
} from './membershipEligibilityService';
import { MatchService } from './matchService';
import { TeamService } from './teamService';

export interface MatchAvailabilityActor {
  userId: string;
  playerId?: string;
}

type AvailabilityState = Pick<Domain.MatchAvailabilityEntry, 'participation'>;

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
      throw AppError.internal('Availability transaction produced no result');
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

function isSameState(
  entry: Domain.MatchAvailabilityEntry | undefined,
  state: AvailabilityState
): boolean {
  return entry?.participation === state.participation;
}

function isDefaultState(state: AvailabilityState): boolean {
  return state.participation === MatchAvailabilityParticipation.AVAILABLE;
}

export class MatchAvailabilityService {
  private static async updateEntry(
    match: {
      _id: Types.ObjectId;
      __v: number;
      teamId: Types.ObjectId;
      availability: Array<{
        playerId: Types.ObjectId;
        participation: MatchAvailabilityParticipation;
      }>;
    },
    playerId: string,
    expectedVersion: number,
    state: AvailabilityState,
    session: ClientSession
  ): Promise<boolean> {
    const existing = match.availability.find(
      (entry) => entry.playerId.toString() === playerId
    );
    const domainEntry = existing
      ? {
          playerId,
          participation: existing.participation,
        }
      : undefined;

    if (
      isSameState(domainEntry, state) ||
      (!existing && isDefaultState(state))
    ) {
      return false;
    }

    const availability = match.availability
      .filter((entry) => entry.playerId.toString() !== playerId)
      .map((entry) => ({
        playerId: entry.playerId,
        participation: entry.participation,
      }));
    availability.push({
      playerId: new Types.ObjectId(playerId),
      participation: state.participation,
    });
    availability.sort((left, right) =>
      left.playerId.toString().localeCompare(right.playerId.toString())
    );

    const update = await Match.updateOne(
      { _id: match._id, __v: expectedVersion },
      {
        $set: { availability },
        $inc: { __v: 1 },
      },
      { runValidators: true, session }
    );
    if (update.matchedCount !== 1) {
      throw AppError.conflict('Match changed since it was loaded');
    }
    return true;
  }

  static async setOwnAvailability(
    matchId: string,
    request: Api.SetOwnMatchAvailabilityRequest,
    actor: MatchAvailabilityActor,
    evaluatedAt = new Date()
  ): Promise<Domain.Match> {
    const matchObjectId = ensureObjectId(matchId, 'Match');
    const playerId = actor.playerId;
    if (!playerId) {
      throw AppError.forbidden('Active Player identity is required');
    }
    ensureObjectId(playerId, 'Player');

    const teamIds = await TeamService.getCurrentTeamIdsForUser(actor.userId);
    if (teamIds.length === 0) throw AppError.notFound('Match not found');

    const committedId = await withTransaction(async (session) => {
      const match = await Match.findOne({
        _id: matchObjectId,
        teamId: { $in: teamIds },
      }).session(session);
      if (!match) throw AppError.notFound('Match not found');
      if (match.__v !== request.expectedVersion) {
        throw AppError.conflict('Match changed since it was loaded');
      }
      if (match.startAt.getTime() <= evaluatedAt.getTime()) {
        throw AppError.conflict(
          'Player Availability cannot be changed after the Match starts'
        );
      }

      const existing = match.availability.some(
        (entry) => entry.playerId.toString() === playerId
      );
      if (existing || isDefaultState(request)) {
        await assertPlayerEligibleForMatch(
          playerId,
          match.teamId.toString(),
          session
        );
      } else {
        await claimPlayerEligibleForMatch(
          playerId,
          match.teamId.toString(),
          session
        );
      }
      await this.updateEntry(
        match,
        playerId,
        request.expectedVersion,
        {
          participation: request.participation,
        },
        session
      );
      return match._id.toString();
    });

    // Authorization is established before the write. A concurrent Team removal
    // may make this entry immediately retained, but must not turn a committed
    // self response into an ambiguous failure.
    const committed = await MatchService.getMatchById(committedId);
    if (!committed) {
      throw AppError.internal('Updated Match Availability was not committed');
    }
    return committed;
  }

  static async setPlayerAvailability(
    matchId: string,
    playerId: string,
    request: Api.SetPlayerMatchAvailabilityRequest
  ): Promise<Domain.Match> {
    const matchObjectId = ensureObjectId(matchId, 'Match');
    ensureObjectId(playerId, 'Player');

    const committedId = await withTransaction(async (session) => {
      const match = await Match.findById(matchObjectId).session(session);
      if (!match) throw AppError.notFound('Match not found');
      if (match.__v !== request.expectedVersion) {
        throw AppError.conflict('Match changed since it was loaded');
      }

      const existing = match.availability.some(
        (entry) => entry.playerId.toString() === playerId
      );
      if (!existing) {
        const requestedState = {
          participation: request.participation,
        };
        if (isDefaultState(requestedState)) {
          await assertPlayerEligibleForMatch(
            playerId,
            match.teamId.toString(),
            session
          );
        } else {
          await claimPlayerEligibleForMatch(
            playerId,
            match.teamId.toString(),
            session
          );
        }
      }

      await this.updateEntry(
        match,
        playerId,
        request.expectedVersion,
        {
          participation: request.participation,
        },
        session
      );
      return match._id.toString();
    });

    const committed = await MatchService.getMatchById(committedId);
    if (!committed) {
      throw AppError.internal('Updated Match Availability was not committed');
    }
    return committed;
  }
}
