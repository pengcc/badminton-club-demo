/**
 * LocalAdapter - IndexedDB implementation using Dexie.js
 * Stores all data locally in browser's IndexedDB
 */

import Dexie, { type Table } from 'dexie';
import type { StorageAdapter } from './StorageAdapter';
import type { Api as UserApi } from '@club/shared-types/api/user';
import type { Api as MatchApi } from '@club/shared-types/api/match';
import type { Api as TeamApi } from '@club/shared-types/api/team';
import type { Api as PlayerApi } from '@club/shared-types/api/player';
import type { Api as AuthApi } from '@club/shared-types/api/auth';
import type { LineupPosition } from '@club/shared-types/core/enums';
import type { BaseLineupPlayer } from '@club/shared-types/core/base';
import { MembershipStatus } from '@club/shared-types/core/enums';
import type { PaginatedResponse } from '../api/types';
import type { UserFilterParams } from '../api/userApi';
import type { PlayerQueryParams } from '../api/playerApi';
import { generateSeedData } from './seedData';

/**
 * IndexedDB schema using Dexie
 */
class BadmintonClubDB extends Dexie {
  users!: Table<UserApi.UserResponse, string>;
  matches!: Table<MatchApi.MatchResponse, string>;
  teams!: Table<TeamApi.TeamResponse, string>;
  players!: Table<PlayerApi.PlayerResponse, string>;

  constructor() {
    super('BadmintonClubDB');

    this.version(1).stores({
      users: 'id, email, role, membershipStatus, isPlayer, fullName',
      matches: 'id, date, status, homeTeamId, createdById',
      teams: 'id, name, matchLevel, createdById',
      players: 'id, userId, isActivePlayer, singlesRanking, doublesRanking'
    });
  }
}

export class LocalAdapter implements StorageAdapter {
  private db: BadmintonClubDB;
  private initialized = false;

  constructor() {
    this.db = new BadmintonClubDB();
  }

  /**
   * Initialize database with seed data if empty
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if data exists
      const userCount = await this.db.users.count();

      if (userCount === 0) {
        // Load seed data
        const seedData = generateSeedData();

        await this.db.users.bulkAdd(seedData.users);
        await this.db.teams.bulkAdd(seedData.teams);
        await this.db.players.bulkAdd(seedData.players);
        await this.db.matches.bulkAdd(seedData.matches);
      }

      this.initialized = true;
    } catch (error) {
      console.error('[LocalAdapter] Failed to initialize:', error);
      throw error;
    }
  }

  // User methods
  async getUsers(): Promise<UserApi.UserResponse[]> {
    await this.initialize();
    return this.db.users.toArray();
  }

  async getUsersWithFilters(params?: UserFilterParams): Promise<PaginatedResponse<UserApi.UserResponse>> {
    await this.initialize();

    let collection = this.db.users.toCollection();

    // Apply filters
    if (params?.role) {
      collection = collection.filter(u => u.role === params.role);
    }
    if (params?.membershipStatus) {
      collection = collection.filter(u => u.membershipStatus === params.membershipStatus);
    }
    if (params?.isMatchPlayer !== undefined) {
      collection = collection.filter(u => u.isPlayer === params.isMatchPlayer);
    }

    const allUsers = await collection.toArray();
    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const total = allUsers.length;
    const pages = Math.ceil(total / limit);

    const startIndex = (page - 1) * limit;
    const data = allUsers.slice(startIndex, startIndex + limit);

    return {
      success: true,
      data,
      pagination: { page, limit, total, pages }
    };
  }

  async getUser(id: string): Promise<UserApi.UserResponse> {
    await this.initialize();

    const user = await this.db.users.get(id);
    if (!user) {
      throw new Error(`User not found: ${id}`);
    }
    return user;
  }

  async createUser(userData: UserApi.CreateUserRequest): Promise<UserApi.UserResponse> {
    await this.initialize();

    const now = new Date().toISOString();
    const newUser: UserApi.UserResponse = {
      id: crypto.randomUUID(),
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      fullName: `${userData.lastName}, ${userData.firstName}`,
      phone: userData.phone,
      gender: userData.gender,
      dateOfBirth: userData.dateOfBirth,
      role: userData.role as any, // API accepts string, converts to UserRole
      membershipStatus: MembershipStatus.ACTIVE,
      isPlayer: userData.isPlayer,
      address: userData.address,
      createdAt: now,
      updatedAt: now
    };

    await this.db.users.add(newUser);
    return newUser;
  }

  async updateUser(id: string, userData: UserApi.UpdateUserRequest): Promise<UserApi.UserResponse> {
    await this.initialize();

    const existing = await this.getUser(id);
    const updated: UserApi.UserResponse = {
      ...existing,
      ...userData,
      role: userData.role as any || existing.role,
      membershipStatus: userData.membershipStatus as any || existing.membershipStatus,
      fullName: userData.firstName || userData.lastName
        ? `${userData.lastName || existing.lastName}, ${userData.firstName || existing.firstName}`
        : existing.fullName,
      updatedAt: new Date().toISOString()
    };

    await this.db.users.put(updated);
    return updated;
  }

  async batchUpdateUsers(
    userIds: string[],
    updateData: Partial<UserApi.UpdateUserRequest>
  ): Promise<{ success: boolean; modifiedCount: number; users: UserApi.UserResponse[] }> {
    await this.initialize();

    const updatedUsers: UserApi.UserResponse[] = [];

    for (const id of userIds) {
      try {
        const updated = await this.updateUser(id, updateData);
        updatedUsers.push(updated);
      } catch (error) {
        console.error(`Failed to update user ${id}:`, error);
      }
    }

    return {
      success: true,
      modifiedCount: updatedUsers.length,
      users: updatedUsers
    };
  }

  async deleteUser(id: string): Promise<{ success: boolean; message?: string }> {
    await this.initialize();

    await this.db.users.delete(id);
    return { success: true, message: 'User deleted successfully' };
  }

  // Match methods
  async getMatches(): Promise<MatchApi.MatchResponse[]> {
    await this.initialize();
    return this.db.matches.toArray();
  }

  async getMatch(id: string): Promise<MatchApi.MatchResponse> {
    await this.initialize();

    const match = await this.db.matches.get(id);
    if (!match) {
      throw new Error(`Match not found: ${id}`);
    }
    return match;
  }

  async createMatch(matchData: MatchApi.CreateMatchRequest): Promise<MatchApi.MatchResponse> {
    await this.initialize();

    const now = new Date().toISOString();
    const matchDate = new Date(matchData.date);

    const newMatch: MatchApi.MatchResponse = {
      id: crypto.randomUUID(),
      ...matchData,
      status: 'upcoming' as any,
      lineup: matchData.lineup || {} as Record<LineupPosition, BaseLineupPlayer[]>,
      unavailablePlayers: [],
      metadata: {
        formattedDate: matchDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        statusBadge: { text: 'Upcoming', color: 'blue' },
        availablePlayerCount: 0,
        totalPlayerCount: 0
      },
      createdAt: now,
      updatedAt: now
    };

    await this.db.matches.add(newMatch);
    return newMatch;
  }

  async updateMatch(id: string, matchData: MatchApi.UpdateMatchRequest): Promise<MatchApi.MatchResponse> {
    await this.initialize();

    const existing = await this.getMatch(id);
    const updated: MatchApi.MatchResponse = {
      ...existing,
      ...matchData,
      status: matchData.status as any || existing.status,
      updatedAt: new Date().toISOString()
    };

    // Update metadata if date or status changed
    if (matchData.date) {
      const matchDate = new Date(matchData.date);
      updated.metadata.formattedDate = matchDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    if (matchData.status) {
      const statusColors: Record<string, string> = {
        upcoming: 'blue',
        scheduled: 'green',
        completed: 'gray',
        cancelled: 'red'
      };
      updated.metadata.statusBadge = {
        text: matchData.status.charAt(0).toUpperCase() + matchData.status.slice(1),
        color: statusColors[matchData.status] || 'gray'
      };
    }

    await this.db.matches.put(updated);
    return updated;
  }

  async deleteMatch(id: string): Promise<{ success: boolean; message?: string }> {
    await this.initialize();

    await this.db.matches.delete(id);
    return { success: true, message: 'Match deleted successfully' };
  }

  async toggleMatchPlayerAvailability(
    matchId: string,
    playerId: string,
    isAvailable: boolean,
    _note?: string
  ): Promise<MatchApi.MatchResponse> {
    await this.initialize();

    const match = await this.getMatch(matchId);

    if (isAvailable) {
      match.unavailablePlayers = match.unavailablePlayers.filter(id => id !== playerId);
    } else {
      if (!match.unavailablePlayers.includes(playerId)) {
        match.unavailablePlayers.push(playerId);
      }
    }

    match.updatedAt = new Date().toISOString();
    await this.db.matches.put(match);
    return match;
  }

  async updateMatchLineup(
    matchId: string,
    lineup: Record<LineupPosition, BaseLineupPlayer[]>
  ): Promise<MatchApi.MatchResponse> {
    await this.initialize();

    const match = await this.getMatch(matchId);
    match.lineup = lineup;
    match.updatedAt = new Date().toISOString();

    await this.db.matches.put(match);
    return match;
  }

  // Team methods
  async getTeams(): Promise<TeamApi.TeamResponse[]> {
    await this.initialize();

    const teams = await this.db.teams.toArray();

    // Compute playerIds for each team
    for (const team of teams) {
      const players = await this.db.players
        .filter((p: PlayerApi.PlayerResponse) => p.teamIds.includes(team.id))
        .toArray();
      team.playerIds = players.map((p: PlayerApi.PlayerResponse) => p.id);

      team.stats = {
        playerCount: players.length,
        activePlayerCount: players.filter((p: PlayerApi.PlayerResponse) => p.isActivePlayer).length
      };
    }

    return teams;
  }

  async getTeam(id: string): Promise<TeamApi.TeamResponse> {
    await this.initialize();

    const team = await this.db.teams.get(id);
    if (!team) {
      throw new Error(`Team not found: ${id}`);
    }

    const players = await this.db.players
      .filter((p: PlayerApi.PlayerResponse) => p.teamIds.includes(id))
      .toArray();
    team.playerIds = players.map((p: PlayerApi.PlayerResponse) => p.id);

    team.stats = {
      playerCount: players.length,
      activePlayerCount: players.filter((p: PlayerApi.PlayerResponse) => p.isActivePlayer).length
    };

    return team;
  }

  async createTeam(teamData: TeamApi.CreateTeamRequest): Promise<TeamApi.TeamResponse> {
    await this.initialize();

    const now = new Date().toISOString();
    const newTeam: TeamApi.TeamResponse = {
      id: crypto.randomUUID(),
      ...teamData,
      playerIds: [],
      stats: {
        playerCount: 0,
        activePlayerCount: 0
      },
      createdAt: now,
      updatedAt: now
    };

    await this.db.teams.add(newTeam);
    return newTeam;
  }

  async updateTeam(id: string, teamData: TeamApi.UpdateTeamRequest): Promise<TeamApi.TeamResponse> {
    await this.initialize();

    const existing = await this.getTeam(id);
    const updated: TeamApi.TeamResponse = {
      ...existing,
      ...teamData,
      updatedAt: new Date().toISOString()
    };

    await this.db.teams.put(updated);
    return this.getTeam(id);
  }

  async deleteTeam(id: string): Promise<{ success: boolean; message?: string }> {
    await this.initialize();

    const players = await this.db.players
      .filter((p: PlayerApi.PlayerResponse) => p.teamIds.includes(id))
      .toArray();

    for (const player of players) {
      player.teamIds = player.teamIds.filter((tid: string) => tid !== id);
      await this.db.players.put(player);
    }

    await this.db.teams.delete(id);
    return { success: true, message: 'Team deleted successfully' };
  }

  async getTeamStats(id: string): Promise<{ total: number; male: number; female: number }> {
    await this.initialize();

    const players = await this.db.players
      .filter((p: PlayerApi.PlayerResponse) => p.teamIds.includes(id))
      .toArray();

    let male = 0;
    let female = 0;

    for (const player of players) {
      const user = await this.db.users.get(player.userId);
      if (user?.gender === 'male') male++;
      if (user?.gender === 'female') female++;
    }

    return {
      total: players.length,
      male,
      female
    };
  }

  // Player methods
  async getPlayers(params?: PlayerQueryParams): Promise<PaginatedResponse<PlayerApi.PlayerResponse>> {
    await this.initialize();

    let collection = this.db.players.toCollection();

    if (params?.isActive !== undefined) {
      collection = collection.filter(p => p.isActivePlayer === params.isActive);
    }

    let allPlayers = await collection.toArray();

    if (params?.team) {
      allPlayers = allPlayers.filter(p => p.teamIds.includes(params.team!));
    }

    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const total = allPlayers.length;
    const pages = Math.ceil(total / limit);

    const startIndex = (page - 1) * limit;
    const data = allPlayers.slice(startIndex, startIndex + limit);

    return {
      success: true,
      data,
      pagination: { page, limit, total, pages }
    };
  }

  async getPlayer(id: string): Promise<PlayerApi.PlayerResponse> {
    await this.initialize();

    const player = await this.db.players.get(id);
    if (!player) {
      throw new Error(`Player not found: ${id}`);
    }
    return player;
  }

  async createPlayer(playerData: PlayerApi.CreatePlayerRequest): Promise<PlayerApi.PlayerResponse> {
    await this.initialize();

    const user = await this.getUser(playerData.userId);

    const now = new Date().toISOString();
    const newPlayer: PlayerApi.PlayerResponse = {
      id: crypto.randomUUID(),
      userId: playerData.userId,
      userName: user.fullName,
      userEmail: user.email,
      userGender: user.gender,
      singlesRanking: playerData.singlesRanking || 1000,
      doublesRanking: playerData.doublesRanking || 1000,
      rankingDisplay: `${playerData.singlesRanking || 1000}/${playerData.doublesRanking || 1000}`,
      preferredPositions: playerData.preferredPositions,
      isActivePlayer: playerData.isActivePlayer ?? true,
      teamIds: playerData.teamIds || [],
      matchCount: 0,
      createdAt: now,
      updatedAt: now
    };

    await this.db.players.add(newPlayer);
    return newPlayer;
  }

  async updatePlayer(id: string, playerData: PlayerApi.UpdatePlayerRequest): Promise<PlayerApi.PlayerResponse> {
    await this.initialize();

    const existing = await this.getPlayer(id);
    const updated: PlayerApi.PlayerResponse = {
      ...existing,
      ...playerData,
      rankingDisplay: playerData.singlesRanking || playerData.doublesRanking
        ? `${playerData.singlesRanking || existing.singlesRanking}/${playerData.doublesRanking || existing.doublesRanking}`
        : existing.rankingDisplay,
      updatedAt: new Date().toISOString()
    };

    await this.db.players.put(updated);
    return updated;
  }

  async deletePlayer(id: string): Promise<{ success: boolean; message?: string }> {
    await this.initialize();

    await this.db.players.delete(id);
    return { success: true, message: 'Player deleted successfully' };
  }

  async batchUpdatePlayers(
    playerIds: string[],
    updates: PlayerApi.UpdatePlayerRequest
  ): Promise<{ success: boolean; updated: number }> {
    await this.initialize();

    let count = 0;
    for (const id of playerIds) {
      try {
        await this.updatePlayer(id, updates);
        count++;
      } catch (error) {
        console.error(`Failed to update player ${id}:`, error);
      }
    }

    return { success: true, updated: count };
  }

  async addPlayerToTeam(playerId: string, teamId: string): Promise<PlayerApi.PlayerResponse> {
    await this.initialize();

    const player = await this.getPlayer(playerId);

    if (!player.teamIds.includes(teamId)) {
      player.teamIds.push(teamId);
      player.updatedAt = new Date().toISOString();
      await this.db.players.put(player);
    }

    return player;
  }

  async removePlayerFromTeam(playerId: string, teamId: string): Promise<PlayerApi.PlayerResponse> {
    await this.initialize();

    const player = await this.getPlayer(playerId);
    player.teamIds = player.teamIds.filter(id => id !== teamId);
    player.updatedAt = new Date().toISOString();

    await this.db.players.put(player);
    return player;
  }

  // Data Management Methods
  async clearAllData(): Promise<void> {
    await this.db.users.clear();
    await this.db.matches.clear();
    await this.db.teams.clear();
    await this.db.players.clear();

    this.initialized = false;
    await this.initialize();
  }

  async getStorageSize(): Promise<number> {
    if (!navigator.storage?.estimate) {
      return 0;
    }

    const estimate = await navigator.storage.estimate();
    return estimate.usage || 0;
  }

  async checkStorageQuota(): Promise<{ usage: number; quota: number; percentage: number }> {
    if (!navigator.storage?.estimate) {
      return { usage: 0, quota: 0, percentage: 0 };
    }

    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percentage = quota > 0 ? (usage / quota) * 100 : 0;

    return { usage, quota, percentage };
  }

  async exportData(): Promise<string> {
    await this.initialize();

    const users = await this.db.users.toArray();
    const matches = await this.db.matches.toArray();
    const teams = await this.db.teams.toArray();
    const players = await this.db.players.toArray();

    return JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: { users, matches, teams, players }
    }, null, 2);
  }

  async importData(json: string): Promise<void> {
    const imported = JSON.parse(json);

    if (imported.version !== '1.0') {
      throw new Error('Unsupported data version');
    }

    await this.db.users.clear();
    await this.db.matches.clear();
    await this.db.teams.clear();
    await this.db.players.clear();

    if (imported.data.users) await this.db.users.bulkAdd(imported.data.users);
    if (imported.data.matches) await this.db.matches.bulkAdd(imported.data.matches);
    if (imported.data.teams) await this.db.teams.bulkAdd(imported.data.teams);
    if (imported.data.players) await this.db.players.bulkAdd(imported.data.players);

    this.initialized = true;
  }

  // ============================================================================
  // AUTHENTICATION METHODS (Local Mode)
  // ============================================================================

  /**
   * Local login - validates email/password against local users
   * For demo purposes, accepts any password for existing users
   */
  async login(credentials: { email: string; password: string }): Promise<AuthApi.LoginResponse> {
    await this.initialize();

    // Find user by email
    const user = await this.db.users
      .filter((u: UserApi.UserResponse) => u.email === credentials.email)
      .first();

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // In local mode, we skip password verification for demo purposes
    // In production, you'd verify the hashed password

    // Generate a mock token
    const token = `local-token-${user.id}-${Date.now()}`;

    // Store token in localStorage for verifyToken to use
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
      localStorage.setItem('local-user-id', user.id);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        membershipStatus: user.membershipStatus
      },
      token,
      refreshToken: `refresh-${token}`
    };
  }  /**
   * Verify local token
   * Extracts user ID from mock token and returns user
   */
  async verifyToken(): Promise<any> {
    await this.initialize();

    // In local mode, check localStorage for the mock token
    if (typeof window === 'undefined') return null;

    const token = localStorage.getItem('auth-token');
    if (!token || !token.startsWith('local-token-')) {
      console.error('[LocalAdapter] verifyToken: No valid token found', { token });
      return null;
    }

    // Extract user ID from token format: local-token-{userId}-{timestamp}
    const parts = token.split('-');
    if (parts.length < 3) {
      console.error('[LocalAdapter] verifyToken: Invalid token format', { parts });
      return null;
    }

    const userId = parts[2];

    try {
      const user = await this.db.users.get(userId);
      if (!user) {
        console.error('[LocalAdapter] verifyToken: User not found', { userId });
        return null;
      }

      // Convert to Auth User format
      const authUser = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        membershipStatus: user.membershipStatus
      };

      console.error('[LocalAdapter] verifyToken: Success', authUser);
      return authUser;
    } catch (error) {
      console.error('[LocalAdapter] verifyToken: Error', error);
      return null;
    }
  }

  /**
   * Local logout - just a no-op, token is cleared by TokenManager
   */
  async logout(): Promise<void> {
    // No-op for local mode, token is managed by TokenManager
    return Promise.resolve();
  }
}
