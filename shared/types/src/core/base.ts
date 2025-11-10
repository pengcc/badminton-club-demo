// shared/types/core/base.ts
import type { UserRole, Gender, MatchStatus, LineupPosition, MembershipStatus } from './enums';

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BaseUser extends BaseEntity {
  email: string;
  name: string;
  phone?: string;
  gender: Gender;
  dateOfBirth: string; // Format: YYYY-MM-DD
  role: UserRole;
  membershipStatus: MembershipStatus;
  isPlayer: boolean;
  address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

export interface BaseTeam extends BaseEntity {
  name: string;
  playerIds: string[];
  createdById: string;
}

export interface BasePlayer extends BaseEntity {
  userId: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  isActivePlayer: boolean;
  teamAffiliations: string[]; // Array of team IDs
  matchesPlayed: string[]; // Array of match IDs
}

export interface BaseLineupPlayer extends Pick<BasePlayer, 'firstName' | 'lastName' | 'gender'> {
  id: string;
}

export interface BaseMatch extends BaseEntity {
  date: Date;
  time: string;
  location: string;
  status: MatchStatus;
  homeTeamId: string;
  awayTeamName: string;
  scores?: {
    homeScore: number;
    awayScore: number;
  };
  lineup: Record<LineupPosition, BaseLineupPlayer[]>;  // position -> player map
  unavailablePlayers: string[];                   // Only store exceptions
  cancellationReason?: string;                    // Reason when status is CANCELLED
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
    debitFrequency: string;
    accountHolderFirstName: string;
    accountHolderLastName: string;
    accountHolderAddress: string;
    bankName: string;
    bic: string;
    hasConditions: boolean;
    conditions: string;
    canParticipate: boolean;
    motivation: string;
    iban: string;
}
