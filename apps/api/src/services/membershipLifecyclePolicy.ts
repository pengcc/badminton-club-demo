import { MembershipStatus, PlayerType } from '@club/shared-types/core/enums';
import {
  MembershipInactivePlayerOutcome,
  MembershipLifecycleOperation,
  membershipLifecycleCommandSchema,
  type MembershipLifecycleCommand,
  type MembershipLifecycleResult,
  type MembershipLifecycleState,
} from '@club/shared-types/domain/membershipLifecycle';
import { AppError } from '../utils/errors';

const currentMembershipStatuses = new Set<MembershipStatus>([
  MembershipStatus.ACTIVE,
  MembershipStatus.PASSIVE,
]);

const allowedMembershipTransitions: Record<
  MembershipStatus,
  ReadonlySet<MembershipStatus>
> = {
  [MembershipStatus.ACTIVE]: new Set([
    MembershipStatus.ACTIVE,
    MembershipStatus.PASSIVE,
    MembershipStatus.INACTIVE,
  ]),
  [MembershipStatus.PASSIVE]: new Set([
    MembershipStatus.PASSIVE,
    MembershipStatus.ACTIVE,
    MembershipStatus.INACTIVE,
  ]),
  [MembershipStatus.INACTIVE]: new Set([
    MembershipStatus.INACTIVE,
    MembershipStatus.ACTIVE,
    MembershipStatus.PASSIVE,
  ]),
};

function cloneState(state: MembershipLifecycleState): MembershipLifecycleState {
  return {
    ...state,
    player: state.player
      ? { ...state.player, teamIds: [...state.player.teamIds] }
      : undefined,
  };
}

function assertExpectedState(
  state: MembershipLifecycleState,
  command: MembershipLifecycleCommand
): void {
  if (
    command.expectedMembershipStatus !== undefined &&
    state.membershipStatus !== command.expectedMembershipStatus
  ) {
    throw AppError.conflict(
      'Membership state changed before lifecycle command',
      {
        expected: command.expectedMembershipStatus,
        actual: state.membershipStatus,
      }
    );
  }
}

function assertPlayerCanBeEligible(
  membershipStatus: MembershipStatus,
  playerType: PlayerType
): void {
  if (
    playerType === PlayerType.MEMBER &&
    !currentMembershipStatuses.has(membershipStatus)
  ) {
    throw AppError.validation(
      'A member Player requires active or passive membership'
    );
  }
  if (
    playerType === PlayerType.EXTERNAL &&
    membershipStatus !== MembershipStatus.INACTIVE
  ) {
    throw AppError.validation(
      'An external Player requires inactive membership'
    );
  }
}

function freezePlayer(
  state: MembershipLifecycleState,
  changedFields: Set<string>
): void {
  if (!state.player) return;
  if (state.player.isActivePlayer) {
    state.player.isActivePlayer = false;
    changedFields.add('player.isActivePlayer');
  }
  if (state.player.teamIds.length > 0) {
    state.player.teamIds = [];
    changedFields.add('player.teamIds');
  }
}

function transitionMembership(
  state: MembershipLifecycleState,
  command: Extract<
    MembershipLifecycleCommand,
    { operation: MembershipLifecycleOperation.TRANSITION_MEMBERSHIP }
  >,
  changedFields: Set<string>
): void {
  const inactivePlayerOutcome =
    command.inactivePlayerOutcome ??
    MembershipInactivePlayerOutcome.END_PARTICIPATION;
  if (
    command.inactivePlayerOutcome !== undefined &&
    command.targetMembershipStatus !== MembershipStatus.INACTIVE
  ) {
    throw AppError.validation(
      'Inactive Player outcome is valid only for transition to inactive Membership'
    );
  }
  if (
    !allowedMembershipTransitions[state.membershipStatus].has(
      command.targetMembershipStatus
    )
  ) {
    throw AppError.validation(
      `Membership transition ${state.membershipStatus} -> ${command.targetMembershipStatus} is not allowed`
    );
  }

  const targetIsCurrent = currentMembershipStatuses.has(
    command.targetMembershipStatus
  );
  if (targetIsCurrent && state.player?.type === PlayerType.EXTERNAL) {
    if (!command.convertExternalPlayerToMember) {
      throw AppError.validation(
        'Current membership requires explicit external-to-member Player conversion'
      );
    }
    state.player.type = PlayerType.MEMBER;
    changedFields.add('player.type');
  }

  if (
    command.targetMembershipStatus === MembershipStatus.INACTIVE &&
    inactivePlayerOutcome ===
      MembershipInactivePlayerOutcome.CONTINUE_AS_EXTERNAL
  ) {
    if (
      ![MembershipStatus.ACTIVE, MembershipStatus.PASSIVE].includes(
        state.membershipStatus
      ) ||
      !state.player ||
      state.player.type !== PlayerType.MEMBER ||
      !state.player.isActivePlayer
    ) {
      throw AppError.validation(
        'External Player continuation requires an active member Player'
      );
    }
    state.player.type = PlayerType.EXTERNAL;
    changedFields.add('player.type');
  }

  if (state.membershipStatus !== command.targetMembershipStatus) {
    state.membershipStatus = command.targetMembershipStatus;
    changedFields.add('membershipStatus');
  }

  if (
    state.player?.type === PlayerType.MEMBER &&
    command.targetMembershipStatus === MembershipStatus.INACTIVE
  ) {
    freezePlayer(state, changedFields);
  }
}

function setPlayerEligibility(
  state: MembershipLifecycleState,
  command: Extract<
    MembershipLifecycleCommand,
    { operation: MembershipLifecycleOperation.SET_PLAYER_ELIGIBILITY }
  >,
  changedFields: Set<string>
): void {
  if (!state.player) {
    if (!command.eligible) return;
    if (!command.playerTypeForCreation) {
      throw AppError.validation(
        'Player type is required when enabling a new Player identity'
      );
    }
    assertPlayerCanBeEligible(
      state.membershipStatus,
      command.playerTypeForCreation
    );
    state.player = {
      type: command.playerTypeForCreation,
      isActivePlayer: true,
      teamIds: [],
    };
    changedFields.add('player');
    return;
  }

  if (command.eligible) {
    assertPlayerCanBeEligible(state.membershipStatus, state.player.type);
    if (!state.player.isActivePlayer) {
      state.player.isActivePlayer = true;
      changedFields.add('player.isActivePlayer');
    }
    return;
  }

  freezePlayer(state, changedFields);
}

function convertPlayerType(
  state: MembershipLifecycleState,
  command: Extract<
    MembershipLifecycleCommand,
    { operation: MembershipLifecycleOperation.CONVERT_PLAYER_TYPE }
  >,
  changedFields: Set<string>
): void {
  if (!state.player) {
    throw AppError.notFound('Player identity not found');
  }
  if (command.targetPlayerType === PlayerType.MEMBER) {
    if (!currentMembershipStatuses.has(state.membershipStatus)) {
      throw AppError.validation(
        'External-to-member conversion requires active or passive membership'
      );
    }
  } else if (state.membershipStatus !== MembershipStatus.INACTIVE) {
    throw AppError.validation(
      'Member-to-external conversion requires inactive membership'
    );
  }

  if (state.player.type !== command.targetPlayerType) {
    state.player.type = command.targetPlayerType;
    changedFields.add('player.type');
  }
  if (command.eligible === false) {
    freezePlayer(state, changedFields);
  } else if (command.eligible === true) {
    assertPlayerCanBeEligible(state.membershipStatus, state.player.type);
    if (!state.player.isActivePlayer) {
      state.player.isActivePlayer = true;
      changedFields.add('player.isActivePlayer');
    }
  } else if (state.player.isActivePlayer) {
    assertPlayerCanBeEligible(state.membershipStatus, state.player.type);
  }
}

export function planMembershipLifecycleCommand(
  currentState: MembershipLifecycleState,
  input: MembershipLifecycleCommand
): MembershipLifecycleResult {
  const command = membershipLifecycleCommandSchema.parse(input);
  if (command.userId !== currentState.userId) {
    throw AppError.validation('Lifecycle command User does not match state');
  }
  assertExpectedState(currentState, command);

  const nextState = cloneState(currentState);
  const changedFields = new Set<string>();

  switch (command.operation) {
    case MembershipLifecycleOperation.TRANSITION_MEMBERSHIP:
      transitionMembership(nextState, command, changedFields);
      break;
    case MembershipLifecycleOperation.SET_PLAYER_ELIGIBILITY:
      setPlayerEligibility(nextState, command, changedFields);
      break;
    case MembershipLifecycleOperation.CONVERT_PLAYER_TYPE:
      convertPlayerType(nextState, command, changedFields);
      break;
  }

  const inactivePlayerOutcome =
    command.operation === MembershipLifecycleOperation.TRANSITION_MEMBERSHIP &&
    command.targetMembershipStatus === MembershipStatus.INACTIVE
      ? (command.inactivePlayerOutcome ??
        MembershipInactivePlayerOutcome.END_PARTICIPATION)
      : undefined;

  return {
    ...nextState,
    operation: command.operation,
    idempotencyKey: command.idempotencyKey,
    changedFields: [...changedFields].sort(),
    replayed: false,
    inactivePlayerOutcome,
  };
}

export function isPlayerEligibleForTeam(
  state: MembershipLifecycleState
): boolean {
  if (!state.player?.isActivePlayer) return false;
  if (state.player.type === PlayerType.MEMBER) {
    return currentMembershipStatuses.has(state.membershipStatus);
  }
  return state.membershipStatus === MembershipStatus.INACTIVE;
}
