/**
 * Local Storage Seed Data
 *
 * Matches the structure from apps/api/src/scripts/seedData.ts
 * but adapted for browser storage (no password hashing, pre-computed IDs)
 *
 * ARCHITECTURE RULES:
 * - Uses exact same types from @club/shared-types/api/*
 * - No new properties or modifications
 * - Data structure mirrors backend seed data
 * - Pre-computed IDs for relationships
 */

import type { Api as UserApi } from '@club/shared-types/api/user';
import type { Api as MatchApi } from '@club/shared-types/api/match';
import type { Api as TeamApi } from '@club/shared-types/api/team';
import type { Api as PlayerApi } from '@club/shared-types/api/player';
import type { BaseLineupPlayer } from '@club/shared-types/core/base';
import type { LineupPosition } from '@club/shared-types/core/enums';
import {
  MatchStatus,
  UserRole,
  MembershipStatus,
  PlayerPosition
} from '@club/shared-types/core/enums';

// Helper to generate UUID-like IDs
const generateId = (prefix: string, index: number): string => {
  return `${prefix}-${index.toString().padStart(4, '0')}-local-demo`;
};

// Mock data generators (same as backend)
const firstNames = {
  male: ['Max', 'Thomas', 'Michael', 'Andreas', 'Stefan', 'Daniel', 'Alexander', 'Christian', 'Sebastian', 'Matthias'],
  female: ['Anna', 'Lisa', 'Sarah', 'Julia', 'Laura', 'Maria', 'Sandra', 'Nicole', 'Stefanie', 'Andrea']
};

const lastNames = ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann'];

const cities = ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund'];

const getRandomElement = <T>(array: T[]): T => array[Math.floor(Math.random() * array.length)];

const getRandomPhone = () => `+4915${Math.floor(Math.random() * 900000000 + 100000000)}`;

const getRandomPostalCode = () => Math.floor(Math.random() * 90000 + 10000).toString();

const getRandomRanking = () => Math.floor(Math.random() * 10) + 1;

const normalizeForEmail = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
};

/**
 * Generate seed data for local storage
 * Returns data compatible with IndexedDB storage
 */
export interface SeedData {
  users: UserApi.UserResponse[];
  players: PlayerApi.PlayerResponse[];
  teams: TeamApi.TeamResponse[];
  matches: MatchApi.MatchResponse[];
}

export const generateSeedData = (): SeedData => {
  const now = new Date().toISOString();

  // ============================================================================
  // USERS
  // ============================================================================

  const users: UserApi.UserResponse[] = [];

  // Admin users
  const adminUser: UserApi.UserResponse = {
    id: generateId('user', 0),
    email: 'admin@club.dev',
    firstName: 'Admin',
    lastName: 'Manager',
    fullName: 'Manager, Admin',
    phone: '+49301234568',
    gender: 'female',
    dateOfBirth: '1980-06-15',
    role: UserRole.ADMIN,
    membershipStatus: MembershipStatus.ACTIVE,
    isPlayer: true,
    address: {
      street: 'Management Ave 15',
      city: 'Berlin',
      postalCode: '10178',
      country: 'Germany'
    },
    createdAt: now,
    updatedAt: now
  };

  const coachUser: UserApi.UserResponse = {
    id: generateId('user', 1),
    email: 'coach@club.dev',
    firstName: 'Head',
    lastName: 'Coach',
    fullName: 'Coach, Head',
    phone: '+49301234569',
    gender: 'male',
    dateOfBirth: '1985-03-22',
    role: UserRole.ADMIN,
    membershipStatus: MembershipStatus.ACTIVE,
    isPlayer: true,
    address: {
      street: 'Training Center 8',
      city: 'Berlin',
      postalCode: '10963',
      country: 'Germany'
    },
    createdAt: now,
    updatedAt: now
  };

  users.push(adminUser, coachUser);

  // Demo member (easy login)
  const demoMember: UserApi.UserResponse = {
    id: generateId('user', 2),
    email: 'member@club.dev',
    firstName: 'Demo',
    lastName: 'Member',
    fullName: 'Member, Demo',
    phone: getRandomPhone(),
    gender: 'male',
    dateOfBirth: '1995-01-01',
    role: UserRole.MEMBER,
    membershipStatus: MembershipStatus.ACTIVE,
    isPlayer: false,
    address: {
      street: 'Demo Straße 1',
      city: 'Berlin',
      postalCode: '10115',
      country: 'Germany'
    },
    createdAt: now,
    updatedAt: now
  };

  users.push(demoMember);

  // Generate 27 more members (30 total users including admins)
  for (let i = 0; i < 27; i++) {
    const gender = Math.random() > 0.5 ? 'male' : 'female';
    const firstName = getRandomElement(firstNames[gender]);
    const lastName = getRandomElement(lastNames);
    const city = getRandomElement(cities);
    const isPlayer = i < 25; // 25 players + 2 admins = 27 total players

    const birthYear = Math.floor(Math.random() * 40) + 1970;
    const birthMonth = Math.floor(Math.random() * 12) + 1;
    const birthDay = Math.floor(Math.random() * 28) + 1;

    users.push({
      id: generateId('user', i + 3),
      email: `${normalizeForEmail(firstName)}.${normalizeForEmail(lastName)}${i}@club.dev`,
      firstName,
      lastName,
      fullName: `${lastName}, ${firstName}`,
      phone: getRandomPhone(),
      gender,
      dateOfBirth: `${birthYear}-${birthMonth.toString().padStart(2, '0')}-${birthDay.toString().padStart(2, '0')}`,
      role: UserRole.MEMBER,
      membershipStatus: MembershipStatus.ACTIVE,
      isPlayer,
      address: {
        street: `Street ${Math.floor(Math.random() * 200) + 1}`,
        city,
        postalCode: getRandomPostalCode(),
        country: 'Germany'
      },
      createdAt: now,
      updatedAt: now
    });
  }

  // ============================================================================
  // PLAYERS
  // ============================================================================

  const players: PlayerApi.PlayerResponse[] = [];
  const playerUsers = users.filter(u => u.isPlayer);

  playerUsers.forEach((user, index) => {
    players.push({
      id: generateId('player', index),
      userId: user.id,
      userName: user.fullName,
      userEmail: user.email,
      userGender: user.gender,
      singlesRanking: getRandomRanking(),
      doublesRanking: getRandomRanking(),
      rankingDisplay: `${getRandomRanking()}/${getRandomRanking()}`,
      preferredPositions: [PlayerPosition.SINGLES, PlayerPosition.DOUBLES],
      isActivePlayer: user.membershipStatus === MembershipStatus.ACTIVE,
      teamIds: [], // Will be populated after teams are created
      matchCount: 0,
      createdAt: now,
      updatedAt: now
    });
  });

  // ============================================================================
  // TEAMS
  // ============================================================================

  const teams: TeamApi.TeamResponse[] = [
    {
      id: generateId('team', 0),
      name: 'Team 1',
      matchLevel: 'Class C',
      createdById: adminUser.id,
      stats: {
        playerCount: 0,
        activePlayerCount: 0
      },
      playerIds: [],
      createdAt: now,
      updatedAt: now
    },
    {
      id: generateId('team', 1),
      name: 'Team 2',
      matchLevel: 'Class F',
      createdById: adminUser.id,
      stats: {
        playerCount: 0,
        activePlayerCount: 0
      },
      playerIds: [],
      createdAt: now,
      updatedAt: now
    }
  ];

  // Assign players to teams
  teams.forEach((team, teamIndex) => {
    const teamSize = Math.floor(Math.random() * 7) + 6; // 6-12 players
    const startIdx = teamIndex * Math.floor(players.length / teams.length);
    const endIdx = Math.min(startIdx + teamSize, players.length);
    const teamPlayers = players.slice(startIdx, endIdx);

    team.playerIds = teamPlayers.map(p => p.id);
    team.stats = {
      playerCount: teamPlayers.length,
      activePlayerCount: teamPlayers.filter(p => p.isActivePlayer).length
    };

    // Update player teamIds
    teamPlayers.forEach(player => {
      player.teamIds.push(team.id);
    });
  });

  // ============================================================================
  // MATCHES
  // ============================================================================

  const matches: MatchApi.MatchResponse[] = [];

  // Historical matches (September 2025)
  const historicalDates = [
    '2025-09-07T10:00:00Z',
    '2025-09-14T14:00:00Z',
    '2025-09-21T16:00:00Z'
  ];

  const opponents = ['BSV Hamburg', 'TV München Badminton', 'SV Frankfurt 1880'];

  historicalDates.forEach((date, index) => {
    matches.push({
      id: generateId('match', index),
      date,
      time: '10:00',
      location: 'Sporthalle TU, Musterstraße 19, 10163 Berlin',
      status: MatchStatus.COMPLETED,
      homeTeamId: teams[index % teams.length].id,
      awayTeamName: opponents[index],
      createdById: adminUser.id,
      scores: {
        homeScore: Math.floor(Math.random() * 3) + 5, // 5-7
        awayScore: Math.floor(Math.random() * 3) + 2  // 2-4
      },
      lineup: {} as Record<LineupPosition, BaseLineupPlayer[]>,
      unavailablePlayers: [],
      metadata: {
        formattedDate: new Date(date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        statusBadge: {
          text: 'Completed',
          color: 'green'
        },
        availablePlayerCount: 0,
        totalPlayerCount: 0
      },
      createdAt: now,
      updatedAt: now
    });
  });

  // Upcoming matches (October-November 2025)
  const upcomingDates = [
    '2025-10-05T10:00:00Z',
    '2025-10-12T14:00:00Z',
    '2025-10-19T16:00:00Z',
    '2025-11-02T10:00:00Z',
    '2025-11-16T14:00:00Z',
    '2025-11-23T16:00:00Z'
  ];

  const upcomingOpponents = [
    'Badminton Club Leipzig',
    'TSV Hannover Badminton',
    'SC Potsdam',
    'Berliner SC',
    'SG Spandau Badminton',
    'VfL Tegel Badminton'
  ];

  upcomingDates.forEach((date, index) => {
    matches.push({
      id: generateId('match', index + 3),
      date,
      time: ['10:00', '14:00', '16:00'][index % 3],
      location: 'Sporthalle TU, Musterstraße 19, 10163 Berlin',
      status: MatchStatus.SCHEDULED,
      homeTeamId: teams[index % teams.length].id,
      awayTeamName: upcomingOpponents[index],
      createdById: adminUser.id,
      scores: {
        homeScore: 0,
        awayScore: 0
      },
      lineup: {} as Record<LineupPosition, BaseLineupPlayer[]>,
      unavailablePlayers: [],
      metadata: {
        formattedDate: new Date(date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        statusBadge: {
          text: 'Scheduled',
          color: 'blue'
        },
        availablePlayerCount: 0,
        totalPlayerCount: 0
      },
      createdAt: now,
      updatedAt: now
    });
  });

  return {
    users,
    players,
    teams,
    matches
  };
};
