import {
  AccountOnboardingStatus,
  type AccountKind,
  type MembershipStatus,
} from '@club/shared-types/core/enums';
import type { CapabilityPolicyDecision } from '@club/shared-types/domain/membershipCapability';
import { evaluateCapabilityPolicy } from '@club/shared-types/domain/membershipCapability';
import { Player } from '../models/Player';

export interface CapabilityUserState {
  _id: { toString(): string } | string;
  accountKind: AccountKind;
  administratorDesignation: boolean;
  membershipStatus?: MembershipStatus;
  accountOnboardingStatus: AccountOnboardingStatus;
  passwordSetupExpiresAt?: Date;
}

export interface UserCapabilityDecision extends CapabilityPolicyDecision {
  playerId?: string;
}

export function reportCapabilityContradictions(
  decision: CapabilityPolicyDecision,
  source: 'login' | 'protected_request'
): void {
  if (decision.contradictions.length === 0) return;
  console.warn('[capability-policy-contradiction]', {
    source,
    contradictions: decision.contradictions,
  });
}

/**
 * Builds the policy decision from current persistence state.
 */
export async function evaluateUserCapabilities(
  user: CapabilityUserState
): Promise<UserCapabilityDecision> {
  const player = await Player.findOne({ userId: user._id })
    .select('type isActivePlayer')
    .lean();

  const decision = evaluateCapabilityPolicy({
    accountKind: user.accountKind,
    administratorDesignation: user.administratorDesignation,
    membershipStatus: user.membershipStatus!,
    accountOnboardingStatus:
      user.accountOnboardingStatus ===
        AccountOnboardingStatus.PASSWORD_SETUP_PENDING &&
      user.passwordSetupExpiresAt &&
      user.passwordSetupExpiresAt.getTime() <= Date.now()
        ? AccountOnboardingStatus.PASSWORD_SETUP_EXPIRED
        : user.accountOnboardingStatus,
    player: player
      ? {
          type: player.type,
          isActivePlayer: player.isActivePlayer,
        }
      : undefined,
  });

  return {
    ...decision,
    playerId: player?._id.toString(),
  };
}
