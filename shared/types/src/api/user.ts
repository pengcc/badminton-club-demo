import { z } from 'zod';
import {
  AccountOnboardingStatus,
  AccountKind,
  Gender,
  MembershipStatus,
  PlayerType,
  type MemberListFilter,
} from '../core/enums';
import type { AccountSuspension } from '../domain/user';
import type { AccountSetupSummary } from './accountOnboarding';

/**
 * API layer types for User
 * Serializes Domain.User for transport (Date → ISO string)
 */
export namespace Api {
  export type MemberGenderFilter = Gender | 'missing';

  interface UserResponseBase {
    id: string;
    email: string;
    fullName: string; // COMPUTED: "Lastname, Firstname"
    accountOnboardingStatus: AccountOnboardingStatus;
    createdAt: string; // ISO string for JSON serialization
    updatedAt: string; // ISO string for JSON serialization
  }

  export interface PersonUserResponse extends UserResponseBase {
    accountKind: AccountKind.PERSON;
    firstName: string;
    lastName: string;
    phone?: string;
    gender: string;
    dateOfBirth: string;
    administratorDesignation: boolean;
    membershipStatus: MembershipStatus;
    accountSuspension?: AccountSuspension<string>;
    readonly isPlayer: boolean; // @deprecated compatibility projection
    address?: {
      street: string;
      city: string;
      postalCode: string;
      country: string;
    };
  }

  export interface SuperAdminUserResponse extends UserResponseBase {
    accountKind: AccountKind.SUPER_ADMIN;
    fullName: 'Super Admin';
    administratorDesignation: false;
    readonly isPlayer: false;
    firstName?: never;
    lastName?: never;
    phone?: never;
    gender?: never;
    dateOfBirth?: never;
    membershipStatus?: never;
    accountSuspension?: never;
    address?: never;
  }

  export type UserResponse = PersonUserResponse | SuperAdminUserResponse;

  export type AdministratorUserResponse = PersonUserResponse & {
    /** Omitted from bounded read-only portfolio projections. */
    accountSetup?: AccountSetupSummary;
    /** Omitted when account-recovery controls are outside the active runtime. */
    passwordRecoveryAvailable?: boolean;
  };

  export interface MemberListQuery {
    filter?: MemberListFilter;
    gender?: MemberGenderFilter;
    administratorOnly?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
  }

  export type MemberExportCohort = 'current' | 'all';

  export interface MemberExportQuery {
    cohort: MemberExportCohort;
  }

  export interface MemberListStatistics {
    total: number;
    gender: {
      male: number;
      female: number;
      other: number;
      missing: number;
    };
    birthYears: Array<{
      year: number;
      male: number;
      female: number;
      other: number;
      missing: number;
    }>;
    missingBirthDate: number;
  }

  // Stable response contract for GET /users/filter.
  export interface MemberListResponse {
    success: true;
    appliedFilter: MemberListFilter;
    items: AdministratorUserResponse[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      returned: number;
    };
    statistics: MemberListStatistics;
    /** Counts for filter controls, calculated before the selected gender. */
    genderFilterCounts: MemberListStatistics['gender'];
  }

  export interface RichMemberExportRow {
    firstName?: string;
    lastName?: string;
    userId: string;
    fullName: string;
    email: string;
    phone?: string;
    gender?: Gender;
    dateOfBirth?: string;
    address?: PersonUserResponse['address'];
    membershipStatus: MembershipStatus;
    membershipType?: string;
    administratorDesignation: boolean;
    player?: {
      id: string;
      type: PlayerType;
      isActivePlayer: boolean;
      singlesRanking: number;
      doublesRanking: number;
      teamNames: string[];
    };
  }

  export interface RichMemberExportResponse {
    success: true;
    items: RichMemberExportRow[];
  }

  // Update request
  export interface UpdateUserRequest {
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    gender?: Gender;
    dateOfBirth?: string;
    address?: {
      street: string;
      city: string;
      postalCode: string;
      country: string;
    } | null;
  }

  // URL parameters
  export interface UserUrlParams {
    id: string;
  }
}

/**
 * User creation is owned by Account Onboarding and profile correction uses
 * the bounded schema from `schemas/user`. Keep only the transport-specific
 * URL contract here so no parallel generic User mutation schema can drift.
 */
export const userUrlParamsSchema = z.object({ id: z.string() }).strict();
