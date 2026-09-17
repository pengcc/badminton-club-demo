import {
  AccountOnboardingStatus,
  type AccountKind,
  type Capability,
  type MembershipStatus,
  type PlayerType,
} from '../core/enums';

/**
 * Input contract for the capability policy introduced by later work packages.
 * WP4 defines the boundary only; it does not grant or enforce capabilities.
 */
export interface CapabilityPolicyContext {
  accountKind: AccountKind;
  administratorDesignation: boolean;
  membershipStatus: MembershipStatus;
  accountOnboardingStatus: AccountOnboardingStatus;
  player?: {
    type: PlayerType;
    isActivePlayer: boolean;
  };
}

export interface CommandActor {
  id: string;
  email: string;
  accountKind: AccountKind;
  displayName: string;
  capabilities: Capability[];
}
