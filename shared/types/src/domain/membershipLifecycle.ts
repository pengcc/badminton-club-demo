import { z } from 'zod';
import {
  AccountKind,
  Capability,
  MembershipStatus,
  PlayerType,
} from '../core/enums';
import type { CommandActor } from './membership';

export enum MembershipLifecycleOperation {
  TRANSITION_MEMBERSHIP = 'transition_membership',
  SET_PLAYER_ELIGIBILITY = 'set_player_eligibility',
  CONVERT_PLAYER_TYPE = 'convert_player_type',
}

export enum MembershipInactivePlayerOutcome {
  END_PARTICIPATION = 'end_participation',
  CONTINUE_AS_EXTERNAL = 'continue_as_external',
}

export interface MembershipLifecycleActor extends CommandActor {
  ipAddress?: string;
  userAgent?: string;
}

interface MembershipLifecycleCommandBase {
  userId: string;
  expectedMembershipStatus?: MembershipStatus;
  actor: MembershipLifecycleActor;
  reason: string;
  idempotencyKey: string;
  occurredAt: Date;
}

export interface TransitionMembershipCommand
  extends MembershipLifecycleCommandBase {
  operation: MembershipLifecycleOperation.TRANSITION_MEMBERSHIP;
  targetMembershipStatus: MembershipStatus;
  convertExternalPlayerToMember?: boolean;
  inactivePlayerOutcome?: MembershipInactivePlayerOutcome;
}

export interface SetPlayerEligibilityCommand
  extends MembershipLifecycleCommandBase {
  operation: MembershipLifecycleOperation.SET_PLAYER_ELIGIBILITY;
  eligible: boolean;
  playerTypeForCreation?: PlayerType;
}

export interface ConvertPlayerTypeCommand
  extends MembershipLifecycleCommandBase {
  operation: MembershipLifecycleOperation.CONVERT_PLAYER_TYPE;
  targetPlayerType: PlayerType;
  eligible?: boolean;
}

export type MembershipLifecycleCommand =
  | TransitionMembershipCommand
  | SetPlayerEligibilityCommand
  | ConvertPlayerTypeCommand;

export interface MembershipLifecyclePlayerState {
  id?: string;
  type: PlayerType;
  isActivePlayer: boolean;
  teamIds: string[];
}

export interface MembershipLifecycleState {
  userId: string;
  membershipStatus: MembershipStatus;
  player?: MembershipLifecyclePlayerState;
}

export interface MembershipLifecycleResult extends MembershipLifecycleState {
  operation: MembershipLifecycleOperation;
  idempotencyKey: string;
  changedFields: string[];
  replayed: boolean;
  inactivePlayerOutcome?: MembershipInactivePlayerOutcome;
}

const lifecycleActorSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  accountKind: z.enum(AccountKind),
  displayName: z.string().min(1),
  capabilities: z.array(z.enum(Capability)),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

const lifecycleCommandBaseSchema = z.object({
  userId: z.string().min(1),
  expectedMembershipStatus: z.enum(MembershipStatus).optional(),
  actor: lifecycleActorSchema,
  reason: z.string().trim().min(1).max(500),
  idempotencyKey: z.string().trim().min(8).max(200),
  occurredAt: z.date(),
});

export const membershipLifecycleCommandSchema = z.discriminatedUnion(
  'operation',
  [
    lifecycleCommandBaseSchema.extend({
      operation: z.literal(MembershipLifecycleOperation.TRANSITION_MEMBERSHIP),
      targetMembershipStatus: z.enum(MembershipStatus),
      convertExternalPlayerToMember: z.boolean().optional(),
      inactivePlayerOutcome: z.enum(MembershipInactivePlayerOutcome).optional(),
    }),
    lifecycleCommandBaseSchema.extend({
      operation: z.literal(MembershipLifecycleOperation.SET_PLAYER_ELIGIBILITY),
      eligible: z.boolean(),
      playerTypeForCreation: z.enum(PlayerType).optional(),
    }),
    lifecycleCommandBaseSchema.extend({
      operation: z.literal(MembershipLifecycleOperation.CONVERT_PLAYER_TYPE),
      targetPlayerType: z.enum(PlayerType),
      eligible: z.boolean().optional(),
    }),
  ]
);
