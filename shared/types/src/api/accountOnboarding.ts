import type {
  AccountOnboardingDeliveryStatus,
  AccountOnboardingTargetKind,
} from '../domain/accountOnboarding';
import type { AccountOnboardingStatus } from '../core/enums';
import type {
  AccountEstablishmentInput,
  DirectMemberEstablishmentInput,
} from '../schemas/accountOnboarding';

export type AccountEstablishmentRequest = AccountEstablishmentInput;
export type DirectMemberEstablishmentRequest = DirectMemberEstablishmentInput;

export interface AccountEstablishmentResponse {
  userId: string;
  playerId?: string;
  targetKind: AccountOnboardingTargetKind;
  setupRequired: boolean;
  setupGeneration: number;
  deliveryStatus?: AccountOnboardingDeliveryStatus;
  replayed: boolean;
}

export interface AccountSetupReissueResponse {
  generation: number;
  deliveryStatus: AccountOnboardingDeliveryStatus;
}

export type AccountSetupDeliveryStatus =
  | AccountOnboardingDeliveryStatus
  | 'not_attempted'
  | 'none';

/** Allowlisted administrator view of the current password-setup generation. */
export interface AccountSetupSummary {
  userId: string;
  accountOnboardingStatus: AccountOnboardingStatus;
  deliveryStatus: AccountSetupDeliveryStatus;
  reissueAvailable: boolean;
}
