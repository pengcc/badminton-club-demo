import type {
  AccountOnboardingStatus,
  AccountKind,
  Gender,
  MembershipStatus,
  MembershipType,
  PlayerType,
} from '../core/enums';
import type { MembershipLifecycleActor } from './membershipLifecycle';

export const AccountOnboardingTargetKind = {
  MEMBER: 'member',
  EXTERNAL_PLAYER: 'external_player',
} as const;

export type AccountOnboardingTargetKind =
  (typeof AccountOnboardingTargetKind)[keyof typeof AccountOnboardingTargetKind];

export type AccountOnboardingSourceKind =
  | 'administrator'
  | 'registration'
  | 'legacy_import';

export type AccountOnboardingDeliveryStatus = 'sent' | 'failed' | 'uncertain';

export interface AccountOnboardingIdentityInput {
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  phone?: string;
  address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

interface EstablishAccountCommandBase {
  identity: AccountOnboardingIdentityInput;
  actor: MembershipLifecycleActor;
  source: {
    kind: AccountOnboardingSourceKind;
    reference?: string;
  };
  idempotencyKey: string;
  setupLocale?: 'de' | 'en' | 'zh';
}

export interface EstablishMemberCommand extends EstablishAccountCommandBase {
  targetKind: typeof AccountOnboardingTargetKind.MEMBER;
  establishPlayer: boolean;
  initialMembershipStatus: MembershipStatus.ACTIVE | MembershipStatus.PASSIVE;
  membershipType?: MembershipType;
  sendPasswordSetupEmailNow?: boolean;
}

export interface EstablishExternalPlayerCommand
  extends EstablishAccountCommandBase {
  targetKind: typeof AccountOnboardingTargetKind.EXTERNAL_PLAYER;
  establishPlayer: true;
  initialMembershipStatus?: never;
  membershipType?: never;
}

export type EstablishAccountCommand =
  | EstablishMemberCommand
  | EstablishExternalPlayerCommand;

export interface EstablishAccountResult {
  userId: string;
  playerId?: string;
  targetKind: AccountOnboardingTargetKind;
  setupRequired: boolean;
  setupGeneration: number;
  deliveryStatus?: AccountOnboardingDeliveryStatus;
  replayed: boolean;
}

interface AccountOnboardingUserStateBase {
  id: string;
  accountOnboardingStatus: AccountOnboardingStatus;
}

export interface AccountOnboardingPersonUserState
  extends AccountOnboardingUserStateBase,
    AccountOnboardingIdentityInput {
  accountKind: AccountKind.PERSON;
  administratorDesignation: boolean;
  membershipStatus: MembershipStatus;
  membershipType?: MembershipType;
}

export interface AccountOnboardingSuperAdminUserState
  extends AccountOnboardingUserStateBase {
  accountKind: AccountKind.SUPER_ADMIN;
  administratorDesignation: false;
  email: string;
  firstName?: never;
  lastName?: never;
  dateOfBirth?: never;
  gender?: never;
  phone?: never;
  address?: never;
  membershipStatus?: never;
  membershipType?: never;
}

export type AccountOnboardingUserState =
  | AccountOnboardingPersonUserState
  | AccountOnboardingSuperAdminUserState;

export interface AccountOnboardingPlayerState {
  id: string;
  type: PlayerType;
  isActivePlayer: boolean;
}
