import {
  AccountOnboardingStatus,
  AccountKind,
  MembershipStatus,
  PlayerType,
} from '@club/shared-types/core/enums';
import {
  AccountOnboardingTargetKind,
  type AccountOnboardingIdentityInput,
  type AccountOnboardingPersonUserState,
  type AccountOnboardingPlayerState,
  type AccountOnboardingUserState,
  type EstablishAccountCommand,
} from '@club/shared-types/domain/accountOnboarding';

export const ACCOUNT_ONBOARDING_FIELD_CLASSIFICATION = {
  email: 'authoritative_lookup',
  firstName: 'identity_consistency',
  lastName: 'identity_consistency',
  dateOfBirth: 'identity_consistency',
  gender: 'mutable_profile',
  phone: 'optional_source_missing',
  address: 'optional_source_missing',
} as const;

export type AccountOnboardingPolicyDecision =
  | {
      kind: 'establish';
      identityMode:
        | 'create'
        | 'reuse_member'
        | 'reuse_applicant'
        | 'reuse_external_player';
      membershipTransition?: {
        from: MembershipStatus;
        to: MembershipStatus.ACTIVE | MembershipStatus.PASSIVE;
        convertExternalPlayerToMember: boolean;
      };
      playerEligibility?: {
        type: PlayerType;
        eligible: true;
      };
      setupRequired: boolean;
    }
  | {
      kind: 'review_required' | 'incompatible';
      reason: string;
    };

function normalizeIdentityText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
}

export function identityConsistencyMatches(
  existing: AccountOnboardingPersonUserState,
  requested: AccountOnboardingIdentityInput
): boolean {
  return (
    normalizeIdentityText(existing.firstName) ===
      normalizeIdentityText(requested.firstName) &&
    normalizeIdentityText(existing.lastName) ===
      normalizeIdentityText(requested.lastName) &&
    existing.dateOfBirth === requested.dateOfBirth
  );
}

function setupRequired(user: AccountOnboardingUserState | null): boolean {
  return user?.accountOnboardingStatus !== AccountOnboardingStatus.READY;
}

function review(reason: string): AccountOnboardingPolicyDecision {
  return { kind: 'review_required', reason };
}

function incompatible(reason: string): AccountOnboardingPolicyDecision {
  return { kind: 'incompatible', reason };
}

export function planAccountEstablishment(
  command: EstablishAccountCommand,
  user: AccountOnboardingUserState | null,
  player: AccountOnboardingPlayerState | null
): AccountOnboardingPolicyDecision {
  if (user?.accountKind === AccountKind.SUPER_ADMIN) {
    return review('Super Admin identity cannot be changed by onboarding');
  }

  if (user && !identityConsistencyMatches(user, command.identity)) {
    return review('Existing identity facts require administrator review');
  }

  if (command.targetKind === AccountOnboardingTargetKind.EXTERNAL_PLAYER) {
    if (!user) {
      if (player) return review('Player has no canonical User');
      return {
        kind: 'establish',
        identityMode: 'create',
        playerEligibility: { type: PlayerType.EXTERNAL, eligible: true },
        setupRequired: true,
      };
    }

    if (user.membershipStatus !== MembershipStatus.INACTIVE) {
      return incompatible(
        'A current Member cannot be established as an External Player'
      );
    }
    if (player && player.type !== PlayerType.EXTERNAL) {
      return review(
        'Existing Player type conflicts with External Player establishment'
      );
    }
    return {
      kind: 'establish',
      identityMode: player ? 'reuse_external_player' : 'reuse_applicant',
      playerEligibility:
        !player || !player.isActivePlayer
          ? { type: PlayerType.EXTERNAL, eligible: true }
          : undefined,
      setupRequired: setupRequired(user),
    };
  }

  const targetStatus = command.initialMembershipStatus;
  if (!user) {
    if (player) return review('Player has no canonical User');
    return {
      kind: 'establish',
      identityMode: 'create',
      membershipTransition: {
        from: MembershipStatus.INACTIVE,
        to: targetStatus,
        convertExternalPlayerToMember: false,
      },
      playerEligibility: command.establishPlayer
        ? { type: PlayerType.MEMBER, eligible: true }
        : undefined,
      setupRequired: true,
    };
  }

  if (user.membershipStatus !== MembershipStatus.INACTIVE) {
    if (user.membershipStatus !== targetStatus) {
      return incompatible(
        'Existing Membership state does not match the requested establishment'
      );
    }
    if (
      command.membershipType !== undefined &&
      user.membershipType !== command.membershipType
    ) {
      return review(
        'Existing Membership type does not match the requested establishment'
      );
    }
    if (player?.type === PlayerType.EXTERNAL) {
      return review('Member identity has an incompatible External Player');
    }
    return {
      kind: 'establish',
      identityMode: 'reuse_member',
      playerEligibility:
        command.establishPlayer && (!player || !player.isActivePlayer)
          ? { type: PlayerType.MEMBER, eligible: true }
          : undefined,
      setupRequired: setupRequired(user),
    };
  }

  if (player && player.type !== PlayerType.EXTERNAL) {
    return review(
      'Existing Player type is incompatible with Member establishment'
    );
  }

  return {
    kind: 'establish',
    identityMode: player ? 'reuse_external_player' : 'reuse_applicant',
    membershipTransition: {
      from: MembershipStatus.INACTIVE,
      to: targetStatus,
      convertExternalPlayerToMember: player?.type === PlayerType.EXTERNAL,
    },
    playerEligibility: command.establishPlayer
      ? { type: PlayerType.MEMBER, eligible: true }
      : undefined,
    setupRequired: setupRequired(user),
  };
}
