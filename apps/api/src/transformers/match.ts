import type { Domain } from '@club/shared-types/domain/match';
import type { Persistence } from '../types/persistence/match';
import type { Api } from '@club/shared-types/api/match';
import { MatchDirection, MatchOutcome } from '@club/shared-types/core/enums';
import { dateToBerlinLocalStart } from '../services/matchTimePolicy';

export class MatchPersistenceTransformer {
  static toDomain(doc: Persistence.MatchDocument): Domain.Match {
    if (!doc._id) throw new Error('MatchDocument missing _id field');
    if (!doc.teamId) {
      throw new Error(`MatchDocument ${doc._id} missing teamId field`);
    }
    if (!doc.createdById) {
      throw new Error(`MatchDocument ${doc._id} missing createdById field`);
    }

    return {
      id: doc._id.toString(),
      version: doc.__v ?? 0,
      teamId: doc.teamId.toString(),
      opponentName: doc.opponentName,
      direction: doc.direction,
      startAt: doc.startAt,
      location: doc.location,
      ...(doc.arrivalGuidance ? { arrivalGuidance: doc.arrivalGuidance } : {}),
      result: doc.result
        ? {
            homeScore: doc.result.homeScore,
            awayScore: doc.result.awayScore,
            ...(doc.result.note ? { note: doc.result.note } : {}),
          }
        : undefined,
      createdById: doc.createdById.toString(),
      lineup: (doc.lineup ?? []).map((entry) => ({
        position: entry.position,
        playerId: entry.playerId.toString(),
        playerNameSnapshot: entry.playerNameSnapshot,
      })),
      availability: (doc.availability ?? []).map((entry) => ({
        playerId: entry.playerId.toString(),
        participation: entry.participation,
      })),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      ...(doc.demoScratchLeaseId ? { isDemoScratch: true } : {}),
    };
  }
}

function deriveOutcome(
  result: Domain.MatchResult,
  direction: MatchDirection
): MatchOutcome {
  if (result.homeScore === result.awayScore) return MatchOutcome.DRAW;
  const clubWon =
    direction === MatchDirection.HOME
      ? result.homeScore > result.awayScore
      : result.awayScore > result.homeScore;
  return clubWon ? MatchOutcome.WIN : MatchOutcome.LOSS;
}

export class MatchApiTransformer {
  static toApi(match: Domain.Match): Api.MatchResponse {
    return {
      id: match.id,
      version: match.version,
      teamId: match.teamId,
      opponentName: match.opponentName,
      direction: match.direction,
      startAt: match.startAt.toISOString(),
      localStart: dateToBerlinLocalStart(match.startAt),
      location: match.location,
      ...(match.arrivalGuidance
        ? { arrivalGuidance: match.arrivalGuidance }
        : {}),
      result: match.result
        ? {
            ...match.result,
            outcome: deriveOutcome(match.result, match.direction),
          }
        : undefined,
      lineup: match.lineup,
      availability: match.availability,
      createdById: match.createdById,
      createdAt: match.createdAt.toISOString(),
      updatedAt: match.updatedAt.toISOString(),
      ...(match.isDemoScratch ? { isDemoScratch: true } : {}),
    };
  }

  static toDetail(
    match: Domain.Match,
    lineupWarnings: Api.MatchDetailResponse['lineupWarnings']
  ): Api.MatchDetailResponse {
    return {
      ...this.toApi(match),
      lineupWarnings,
    };
  }
}
