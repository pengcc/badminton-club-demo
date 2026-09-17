import {
  AccountOnboardingStatus,
  AccountKind,
  Capability,
  MembershipStatus,
  PlayerType,
} from '../core/enums';
import type { CapabilityPolicyContext } from './membership';

export enum CapabilityPolicyContradiction {
  CURRENT_MEMBER_WITH_EXTERNAL_PLAYER = 'current_member_with_external_player',
  INACTIVE_MEMBER_WITH_ACTIVE_MEMBER_PLAYER = 'inactive_member_with_active_member_player',
}

export interface CapabilityPolicyDecision {
  capabilities: Capability[];
  contradictions: CapabilityPolicyContradiction[];
}

const CURRENT_MEMBERSHIP_STATUSES = new Set<MembershipStatus>([
  MembershipStatus.ACTIVE,
  MembershipStatus.PASSIVE,
]);

function findContradictions(
  context: CapabilityPolicyContext
): CapabilityPolicyContradiction[] {
  const contradictions: CapabilityPolicyContradiction[] = [];
  const isCurrentMember = CURRENT_MEMBERSHIP_STATUSES.has(
    context.membershipStatus
  );

  if (isCurrentMember && context.player?.type === PlayerType.EXTERNAL) {
    contradictions.push(
      CapabilityPolicyContradiction.CURRENT_MEMBER_WITH_EXTERNAL_PLAYER
    );
  }

  if (
    context.membershipStatus === MembershipStatus.INACTIVE &&
    context.player?.type === PlayerType.MEMBER &&
    context.player.isActivePlayer
  ) {
    contradictions.push(
      CapabilityPolicyContradiction.INACTIVE_MEMBER_WITH_ACTIVE_MEMBER_PLAYER
    );
  }

  return contradictions;
}

export function evaluateCapabilityPolicy(
  context: CapabilityPolicyContext
): CapabilityPolicyDecision {
  const capabilities = new Set<Capability>();
  const contradictions = findContradictions(context);
  const isReady =
    context.accountOnboardingStatus === AccountOnboardingStatus.READY;
  const isSuperAdmin = context.accountKind === AccountKind.SUPER_ADMIN;

  if (!isReady) {
    return { capabilities: [], contradictions };
  }

  if (isSuperAdmin) {
    capabilities.add(Capability.ADMINISTRATION);
    capabilities.add(Capability.AUTHENTICATED_ACCOUNT);
    return { capabilities: [...capabilities], contradictions: [] };
  }

  // Contradictory person lifecycle state fails closed.
  if (contradictions.length > 0) {
    return { capabilities: [...capabilities], contradictions };
  }

  const isCurrentMember = CURRENT_MEMBERSHIP_STATUSES.has(
    context.membershipStatus
  );
  if (context.administratorDesignation && isCurrentMember) {
    capabilities.add(Capability.ADMINISTRATION);
  }

  if (isCurrentMember) {
    capabilities.add(Capability.AUTHENTICATED_ACCOUNT);
    capabilities.add(Capability.CURRENT_MEMBER);
    capabilities.add(Capability.MEMBERSHIP_SELF_SERVICE);
  }

  if (
    context.player?.isActivePlayer &&
    context.player.type === PlayerType.MEMBER &&
    isCurrentMember
  ) {
    capabilities.add(Capability.ACTIVE_PLAYER);
  }

  if (
    context.player?.isActivePlayer &&
    context.player.type === PlayerType.EXTERNAL &&
    context.membershipStatus === MembershipStatus.INACTIVE
  ) {
    capabilities.add(Capability.AUTHENTICATED_ACCOUNT);
    capabilities.add(Capability.ACTIVE_PLAYER);
    capabilities.add(Capability.EXTERNAL_PLAYER);
  }

  return { capabilities: [...capabilities], contradictions };
}

export function hasCapability(
  capabilities: readonly Capability[] | undefined,
  capability: Capability
): boolean {
  return capabilities?.includes(capability) ?? false;
}
