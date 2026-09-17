import type { MembershipLifecycleState } from '@club/shared-types/domain/membershipLifecycle';
import {
  AccountKind,
  type Gender,
  type PlayerType,
} from '@club/shared-types/core/enums';
import { Types, type ClientSession } from 'mongoose';
import { Player } from '../models/Player';
import { User } from '../models/User';
import { AppError } from '../utils/errors';
import { isPlayerEligibleForTeam } from './membershipLifecyclePolicy';
import { IdentityDependencyClaimService } from './identityDependencyClaimService';

export interface MatchPlayerEligibilityFact {
  playerId: string;
  referenceAvailable: boolean;
  currentlyEligible: boolean;
  onMatchTeam: boolean;
  playerName?: string;
  gender?: Gender;
  singlesRanking?: number;
  doublesRanking?: number;
}

function normalizePlayerName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim().replace(/\s+/g, ' ');
}

function lifecycleState(
  player: {
    _id: Types.ObjectId;
    type: PlayerType;
    isActivePlayer: boolean;
    teamIds: Types.ObjectId[];
  },
  user: {
    _id: Types.ObjectId;
    membershipStatus: MembershipLifecycleState['membershipStatus'];
  }
): MembershipLifecycleState {
  return {
    userId: user._id.toString(),
    membershipStatus: user.membershipStatus,
    player: {
      id: player._id.toString(),
      type: player.type,
      isActivePlayer: player.isActivePlayer,
      teamIds: player.teamIds.map((id) => id.toString()),
    },
  };
}

export async function getMatchPlayerEligibilityFacts(
  playerIds: readonly string[],
  teamId: string,
  session?: ClientSession
): Promise<Map<string, MatchPlayerEligibilityFact>> {
  if (!Types.ObjectId.isValid(teamId)) {
    throw AppError.validation(
      'Match eligibility contains an invalid Team identifier'
    );
  }
  const ids = [...new Set(playerIds)];
  for (const playerId of ids) {
    if (!Types.ObjectId.isValid(playerId)) {
      throw AppError.validation(
        'Match eligibility contains an invalid Player identifier'
      );
    }
  }
  if (ids.length === 0) return new Map();

  const playerQuery = Player.find({ _id: { $in: ids } });
  if (session) playerQuery.session(session);
  const players = await playerQuery.lean();
  const userIds = players.map((player) => player.userId);
  const userQuery = User.find({ _id: { $in: userIds } });
  if (session) userQuery.session(session);
  const users = await userQuery.lean();
  const playersById = new Map(
    players.map((player) => [player._id.toString(), player])
  );
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));
  const teamObjectId = new Types.ObjectId(teamId);

  const facts = new Map<string, MatchPlayerEligibilityFact>();
  for (const playerId of ids) {
    const player = playersById.get(playerId);
    const user = player ? usersById.get(player.userId.toString()) : undefined;
    if (!player || !user || user.accountKind !== AccountKind.PERSON) {
      facts.set(playerId, {
        playerId,
        referenceAvailable: false,
        currentlyEligible: false,
        onMatchTeam: false,
      });
      continue;
    }
    facts.set(playerId, {
      playerId,
      referenceAvailable: true,
      currentlyEligible: isPlayerEligibleForTeam(lifecycleState(player, user)),
      onMatchTeam: player.teamIds.some((id) => id.equals(teamObjectId)),
      playerName: normalizePlayerName(user.firstName, user.lastName),
      gender: user.gender,
      singlesRanking: player.singlesRanking,
      doublesRanking: player.doublesRanking,
    });
  }
  return facts;
}

export async function getMatchTeamCandidateEligibilityFacts(
  teamId: string,
  session?: ClientSession
): Promise<Map<string, MatchPlayerEligibilityFact>> {
  if (!Types.ObjectId.isValid(teamId)) {
    throw AppError.validation(
      'Match eligibility contains an invalid Team identifier'
    );
  }
  const playerQuery = Player.find({
    teamIds: new Types.ObjectId(teamId),
  }).select('_id');
  if (session) playerQuery.session(session);
  const players = await playerQuery.lean();
  return getMatchPlayerEligibilityFacts(
    players.map((player) => player._id.toString()),
    teamId,
    session
  );
}

export async function assertPlayerEligibleForTeam(
  playerId: string,
  session: ClientSession
): Promise<{
  playerId: string;
  playerType: PlayerType;
  playerVersion: number;
}> {
  const player = await Player.findById(playerId).session(session);
  if (!player) throw AppError.notFound('Player not found');
  const user = await User.findById(player.userId).session(session);
  if (!user) throw AppError.notFound('Player User not found');
  if (user.accountKind !== AccountKind.PERSON) {
    throw AppError.validation('Player cannot reference Super Admin');
  }

  const state = lifecycleState(player, user);
  if (!isPlayerEligibleForTeam(state)) {
    throw AppError.validation(
      'Player is not eligible for Team participation under membership lifecycle rules'
    );
  }
  return {
    playerId: player._id.toString(),
    playerType: player.type,
    playerVersion: player.get('__v') ?? 0,
  };
}

export async function claimPlayerEligibleForMatch(
  playerId: string,
  teamId: string,
  session: ClientSession
): Promise<void> {
  if (!Types.ObjectId.isValid(playerId) || !Types.ObjectId.isValid(teamId)) {
    throw AppError.validation(
      'Match eligibility contains an invalid identifier'
    );
  }
  const player = await Player.findById(playerId).session(session);
  if (!player) throw AppError.notFound('Player not found');
  const user = await User.findById(player.userId).session(session);
  if (!user) throw AppError.notFound('Player User not found');
  if (user.accountKind !== AccountKind.PERSON) {
    throw AppError.validation('Player cannot reference Super Admin');
  }

  const state = lifecycleState(player, user);
  if (!isPlayerEligibleForTeam(state)) {
    throw AppError.validation(
      'Player is not eligible for Match participation under membership lifecycle rules'
    );
  }

  const teamObjectId = new Types.ObjectId(teamId);
  if (!player.teamIds.some((id) => id.equals(teamObjectId))) {
    throw AppError.validation('Player is not assigned to the Match Team');
  }

  await IdentityDependencyClaimService.claimPlayer(
    {
      playerId: player._id,
      expectedVersion: player.get('__v') ?? 0,
      type: player.type,
      isActivePlayer: true,
      teamId: teamObjectId,
      conflictMessage:
        'Player eligibility changed before the Match operation could be applied',
    },
    session
  );
}

export async function assertPlayerEligibleForMatch(
  playerId: string,
  teamId: string,
  session?: ClientSession
): Promise<void> {
  if (!Types.ObjectId.isValid(playerId) || !Types.ObjectId.isValid(teamId)) {
    throw AppError.validation(
      'Match eligibility contains an invalid identifier'
    );
  }

  const playerQuery = Player.findById(playerId);
  if (session) playerQuery.session(session);
  const player = await playerQuery;
  if (!player) throw AppError.notFound('Player not found');

  const userQuery = User.findById(player.userId);
  if (session) userQuery.session(session);
  const user = await userQuery;
  if (!user) throw AppError.notFound('Player User not found');
  if (user.accountKind !== AccountKind.PERSON) {
    throw AppError.validation('Player cannot reference Super Admin');
  }

  const state = lifecycleState(player, user);
  if (!isPlayerEligibleForTeam(state)) {
    throw AppError.validation(
      'Player is not eligible for Match participation under membership lifecycle rules'
    );
  }

  const teamObjectId = new Types.ObjectId(teamId);
  if (!player.teamIds.some((id) => id.equals(teamObjectId))) {
    throw AppError.validation('Player is not assigned to the Match Team');
  }
}
