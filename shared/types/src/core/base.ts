// shared/types/core/base.ts
import {
  AccountKind,
  type Gender,
  type MatchDirection,
  type MatchAvailabilityParticipation,
  type MembershipStatus,
  type PlayerType,
} from './enums';
import type { MatchLineupEntry } from '../domain/lineup';

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

interface BaseUserIdentity extends BaseEntity {
  email: string;
}

export interface BasePersonUser extends BaseUserIdentity {
  accountKind: AccountKind.PERSON;
  firstName: string;
  lastName: string;
  phone?: string;
  gender: Gender;
  dateOfBirth: string; // Format: YYYY-MM-DD
  administratorDesignation: boolean;
  membershipStatus: MembershipStatus;
  readonly isPlayer: boolean;
  address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

export interface BaseSuperAdminUser extends BaseUserIdentity {
  accountKind: AccountKind.SUPER_ADMIN;
  administratorDesignation: false;
  readonly isPlayer: false;
  firstName?: never;
  lastName?: never;
  phone?: never;
  gender?: never;
  dateOfBirth?: never;
  membershipStatus?: never;
  address?: never;
}

export type BaseUser = BasePersonUser | BaseSuperAdminUser;

export interface BaseTeam extends BaseEntity {
  name: string;
  playerIds: string[];
  createdById: string;
}

export interface BasePlayer extends BaseEntity {
  userId: string;
  type: PlayerType;
  firstName: string;
  lastName: string;
  gender: Gender;
  isActivePlayer: boolean;
  teamAffiliations: string[]; // Array of team IDs
  matchesPlayed: string[]; // Array of match IDs
}

export interface BaseMatch extends BaseEntity {
  version: number;
  teamId: string;
  opponentName: string;
  direction: MatchDirection;
  startAt: Date;
  location: string;
  result?: {
    homeScore: number;
    awayScore: number;
    note?: string;
  };
  lineup: MatchLineupEntry[];
  availability: Array<{
    playerId: string;
    participation: MatchAvailabilityParticipation;
  }>;
  createdById: string;
}

export interface BaseMembershipApplication {
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  phone: string;
  birthday: string;
  gender: string;
  city: string;
  postalCode: string;
  country: string;
  membershipType: string;
  motivation?: string;
  bankingInfo?: {
    accountHolderType: 'same' | 'different';
    debitFrequency?: 'quarterly' | 'annually';
    accountHolderFirstName?: string;
    accountHolderLastName?: string;
    accountHolderAddress?: string;
    bankName?: string;
    bic?: string;
    iban?: string;
  };
}
