import type {
  AccountKind,
  MembershipStatus,
  PlayerType,
} from '@club/shared-types/core/enums';
import type { ClientSession, Types } from 'mongoose';
import { Player } from '../models/Player';
import { User } from '../models/User';
import { AppError } from '../utils/errors';

export class IdentityDependencyClaimService {
  static async claimUser(
    input: {
      userId: Types.ObjectId;
      expectedVersion: number;
      accountKind: AccountKind;
      membershipStatus?: MembershipStatus;
    },
    session: ClientSession
  ): Promise<void> {
    const claim = await User.updateOne(
      {
        _id: input.userId,
        __v: input.expectedVersion,
        accountKind: input.accountKind,
        ...(input.membershipStatus === undefined
          ? {}
          : { membershipStatus: input.membershipStatus }),
      },
      { $inc: { __v: 1 } },
      { session, timestamps: false }
    );
    if (claim.matchedCount !== 1) {
      throw AppError.conflict(
        'User identity changed before the operation could be applied'
      );
    }
  }

  static async claimPlayer(
    input: {
      playerId: Types.ObjectId;
      expectedVersion: number;
      type?: PlayerType;
      isActivePlayer?: boolean;
      teamId?: Types.ObjectId;
      conflictMessage?: string;
    },
    session: ClientSession
  ): Promise<void> {
    const claim = await Player.updateOne(
      {
        _id: input.playerId,
        __v: input.expectedVersion,
        ...(input.type === undefined ? {} : { type: input.type }),
        ...(input.isActivePlayer === undefined
          ? {}
          : { isActivePlayer: input.isActivePlayer }),
        ...(input.teamId === undefined ? {} : { teamIds: input.teamId }),
      },
      { $inc: { __v: 1 } },
      { runValidators: true, session }
    );
    if (claim.matchedCount !== 1) {
      throw AppError.conflict(
        input.conflictMessage ??
          'Player identity changed before the operation could be applied'
      );
    }
  }
}
