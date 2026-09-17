import mongoose, { Types, type ClientSession } from 'mongoose';
import type { Api } from '@club/shared-types/api/match';
import type { Domain } from '@club/shared-types/domain/match';
import {
  compareLineupEntries,
  type MatchLineupCandidate,
  type MatchLineupContext,
  type MatchLineupEntry,
  type MatchLineupIntentEntry,
  type MatchLineupWarning,
} from '@club/shared-types/domain/lineup';
import { getMatchAvailability } from '@club/shared-types/domain/match';
import {
  LineupViolationCode,
  MatchAvailabilityParticipation,
} from '@club/shared-types/core/enums';
import { Match } from '../models/Match';
import { MatchPersistenceTransformer } from '../transformers/match';
import { AppError } from '../utils/errors';
import {
  claimPlayerEligibleForMatch,
  getMatchPlayerEligibilityFacts,
  getMatchTeamCandidateEligibilityFacts,
  type MatchPlayerEligibilityFact,
} from './membershipEligibilityService';
import { MatchService } from './matchService';
import {
  blockingLineupWarnings,
  canonicalizeLineupIntent,
  classifyLineup,
  lineupKey,
  rawDuplicateWarnings,
  type LineupPolicyPlayerFact,
} from './matchLineupPolicy';

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
      throw AppError.internal('Lineup transaction produced no result');
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

function availabilityEntries(match: {
  availability: Array<{
    playerId: Types.ObjectId;
    participation: Domain.MatchAvailabilityEntry['participation'];
  }>;
}): Domain.MatchAvailabilityEntry[] {
  return match.availability.map((entry) => ({
    playerId: entry.playerId.toString(),
    participation: entry.participation,
  }));
}

function addAvailabilityFacts(
  facts: ReadonlyMap<string, MatchPlayerEligibilityFact>,
  availability: readonly Domain.MatchAvailabilityEntry[]
): Map<string, LineupPolicyPlayerFact> {
  return new Map(
    [...facts].map(([playerId, fact]) => [
      playerId,
      {
        ...fact,
        ...getMatchAvailability(availability, playerId),
      },
    ])
  );
}

function currentIntent(lineup: readonly MatchLineupEntry[]) {
  return lineup.map(({ position, playerId }) => ({ position, playerId }));
}

function isSameIntent(
  current: readonly MatchLineupIntentEntry[],
  requested: readonly MatchLineupIntentEntry[]
): boolean {
  return (
    current.length === requested.length &&
    current.every(
      (entry, index) => lineupKey(entry) === lineupKey(requested[index])
    )
  );
}

async function factsForLineup(
  playerIds: readonly string[],
  teamId: string,
  availability: readonly Domain.MatchAvailabilityEntry[],
  session?: ClientSession
): Promise<Map<string, LineupPolicyPlayerFact>> {
  return addAvailabilityFacts(
    await getMatchPlayerEligibilityFacts(playerIds, teamId, session),
    availability
  );
}

function throwLineupValidation(warnings: MatchLineupWarning[]): never {
  throw AppError.lineupValidation({ violations: warnings });
}

export class MatchLineupService {
  static async getWarnings(match: Domain.Match): Promise<MatchLineupWarning[]> {
    const facts = await factsForLineup(
      match.lineup.map((entry) => entry.playerId),
      match.teamId,
      match.availability
    );
    return classifyLineup(currentIntent(match.lineup), facts);
  }

  static async getContext(matchId: string): Promise<MatchLineupContext> {
    const objectId = ensureObjectId(matchId, 'Match');
    const document = await Match.findById(objectId).lean();
    if (!document) throw AppError.notFound('Match not found');
    const match = MatchPersistenceTransformer.toDomain(document as never);
    const candidateFacts = await getMatchTeamCandidateEligibilityFacts(
      match.teamId
    );
    const lineupFacts = await getMatchPlayerEligibilityFacts(
      match.lineup.map((entry) => entry.playerId),
      match.teamId
    );
    const allFacts = new Map([...candidateFacts, ...lineupFacts]);
    const effectiveFacts = addAvailabilityFacts(allFacts, match.availability);
    const warnings = classifyLineup(
      currentIntent(match.lineup),
      effectiveFacts
    );
    const candidates: MatchLineupCandidate[] = [...candidateFacts.values()]
      .filter(
        (
          fact
        ): fact is MatchPlayerEligibilityFact & {
          playerName: string;
          gender: NonNullable<MatchPlayerEligibilityFact['gender']>;
          singlesRanking: number;
          doublesRanking: number;
        } =>
          fact.referenceAvailable &&
          fact.currentlyEligible &&
          fact.onMatchTeam &&
          Boolean(fact.playerName && fact.gender) &&
          fact.singlesRanking !== undefined &&
          fact.doublesRanking !== undefined
      )
      .flatMap((fact) => {
        const availability = getMatchAvailability(
          match.availability,
          fact.playerId
        );
        if (
          availability.participation ===
          MatchAvailabilityParticipation.UNAVAILABLE
        ) {
          return [];
        }
        return [
          {
            playerId: fact.playerId,
            playerName: fact.playerName,
            gender: fact.gender,
            singlesRanking: fact.singlesRanking,
            doublesRanking: fact.doublesRanking,
            participation: availability.participation,
          },
        ];
      })
      .sort(
        (left, right) =>
          left.playerName.localeCompare(right.playerName) ||
          left.playerId.localeCompare(right.playerId)
      );

    return {
      matchId: match.id,
      version: match.version,
      lineup: match.lineup,
      lineupWarnings: warnings,
      candidates,
    };
  }

  static async setLineup(
    matchId: string,
    request: Api.SetMatchLineupRequest
  ): Promise<{ match: Domain.Match; warnings: MatchLineupWarning[] }> {
    const matchObjectId = ensureObjectId(matchId, 'Match');
    for (const entry of request.lineup) {
      ensureObjectId(entry.playerId, 'Player');
    }

    const committedId = await withTransaction(async (session) => {
      const document = await Match.findById(matchObjectId).session(session);
      if (!document) throw AppError.notFound('Match not found');
      if (document.__v !== request.expectedVersion) {
        throw AppError.conflict('Match changed since it was loaded');
      }

      const duplicateWarnings = rawDuplicateWarnings(request.lineup);
      if (duplicateWarnings.length > 0) {
        throwLineupValidation(duplicateWarnings);
      }

      const current = [...document.lineup]
        .map((entry) => ({
          position: entry.position,
          playerId: entry.playerId.toString(),
          playerNameSnapshot: entry.playerNameSnapshot,
        }))
        .sort(compareLineupEntries);
      const requested = canonicalizeLineupIntent(request.lineup);
      if (isSameIntent(currentIntent(current), requested)) {
        return document._id.toString();
      }

      const currentKeys = new Set(current.map(lineupKey));
      const newEntries = requested.filter(
        (entry) => !currentKeys.has(lineupKey(entry))
      );
      const referencedPlayerIds = [
        ...new Set([
          ...current.map((entry) => entry.playerId),
          ...requested.map((entry) => entry.playerId),
        ]),
      ];
      const availability = availabilityEntries(document);
      const facts = await factsForLineup(
        referencedPlayerIds,
        document.teamId.toString(),
        availability,
        session
      );
      const baselineWarnings = classifyLineup(currentIntent(current), facts);
      const proposedWarnings = classifyLineup(requested, facts);
      const blockingWarnings = blockingLineupWarnings({
        currentEntries: currentIntent(current),
        proposedEntries: requested,
        baselineWarnings,
        proposedWarnings,
        newEntries,
      });
      for (const playerId of [
        ...new Set(newEntries.map((entry) => entry.playerId)),
      ]) {
        try {
          await claimPlayerEligibleForMatch(
            playerId,
            document.teamId.toString(),
            session
          );
        } catch (error) {
          const playerWarnings = blockingWarnings.filter(
            (warning) => warning.playerId === playerId
          );
          if (playerWarnings.length > 0) {
            throwLineupValidation(playerWarnings);
          }
          throw error;
        }
      }
      if (blockingWarnings.length > 0) {
        throwLineupValidation(blockingWarnings);
      }

      const currentByKey = new Map(
        current.map((entry) => [lineupKey(entry), entry])
      );
      const lineup = requested.map((entry) => {
        const unchanged = currentByKey.get(lineupKey(entry));
        if (unchanged) return unchanged;
        const playerNameSnapshot = facts.get(entry.playerId)?.playerName;
        if (!playerNameSnapshot) {
          throwLineupValidation([
            {
              code: LineupViolationCode.PLAYER_REFERENCE_UNAVAILABLE,
              position: entry.position,
              playerId: entry.playerId,
            },
          ]);
        }
        return { ...entry, playerNameSnapshot };
      });

      const update = await Match.updateOne(
        { _id: matchObjectId, __v: request.expectedVersion },
        {
          $set: { lineup },
          $inc: { __v: 1 },
        },
        { runValidators: true, session }
      );
      if (update.matchedCount !== 1) {
        throw AppError.conflict('Match changed since it was loaded');
      }
      return document._id.toString();
    });

    const match = await MatchService.getMatchById(committedId);
    if (!match) {
      throw AppError.internal('Updated Match Lineup was not committed');
    }
    return { match, warnings: await this.getWarnings(match) };
  }
}
