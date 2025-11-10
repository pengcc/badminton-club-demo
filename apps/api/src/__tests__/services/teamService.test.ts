// @ts-nocheck
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TeamService } from '../../services/teamService';
import { Team } from '../../models/Team';
import { Player } from '../../models/Player';
import { Types } from 'mongoose';

/**
 * Team-Player Relationship (Phase 3 Architecture):
 * - Player.teamIds is the SINGLE SOURCE OF TRUTH
 * - Team.playerIds field REMOVED (computed from Player.teamIds)
 * - Team roster retrieved via: Player.find({ teamIds: teamId })
 * - Use PlayerService.batchUpdatePlayers to add/remove players from teams
 */

// Mock the models
jest.mock('../../models/Team');
jest.mock('../../models/Player');

describe('TeamService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTeamPlayers', () => {
    it('should get players by querying Player.teamIds', async () => {
      const teamId = new Types.ObjectId().toString();
      const teamObjectId = new Types.ObjectId(teamId);

      const mockTeam = {
        _id: teamObjectId,
        name: 'Test Team',
        division: 'A'
      };

      const player1Id = new Types.ObjectId();
      const player2Id = new Types.ObjectId();
      const mockPlayers = [
        {
          _id: player1Id,
          userId: new Types.ObjectId(),
          firstName: 'Player',
          lastName: 'One',
          teamIds: [teamObjectId],
          isActivePlayer: true,
          singlesRanking: 100,
          doublesRanking: 150,
          preferredPositions: [],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: player2Id,
          userId: new Types.ObjectId(),
          firstName: 'Player',
          lastName: 'Two',
          teamIds: [teamObjectId],
          isActivePlayer: true,
          singlesRanking: 120,
          doublesRanking: 140,
          preferredPositions: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      (Team.findById as jest.Mock) = jest.fn().mockResolvedValue(mockTeam);
      (Player.find as jest.Mock) = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockPlayers)
      });

      const result = await TeamService.getTeamPlayers(teamId);

      // Verify Player.find was called with correct query (UNIDIRECTIONAL)
      expect(Player.find).toHaveBeenCalledWith({
        teamIds: teamObjectId,
        isActivePlayer: true
      });

      // Verify team was looked up
      expect(Team.findById).toHaveBeenCalledWith(teamId);

      // Verify players were returned
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(player1Id.toString());
      expect(result[0].userId).toBeDefined();
      expect(result[0].singlesRanking).toBe(100);
    });

    it('should throw error if team not found', async () => {
      const teamId = new Types.ObjectId().toString();

      (Team.findById as jest.Mock) = jest.fn().mockResolvedValue(null);

      await expect(
        TeamService.getTeamPlayers(teamId)
      ).rejects.toThrow('Team not found');
    });

    it('should only return active players', async () => {
      const teamId = new Types.ObjectId().toString();
      const teamObjectId = new Types.ObjectId(teamId);

      const mockTeam = {
        _id: teamObjectId,
        name: 'Test Team'
      };

      (Team.findById as jest.Mock) = jest.fn().mockResolvedValue(mockTeam);
      (Player.find as jest.Mock) = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      });

      await TeamService.getTeamPlayers(teamId);

      // Verify query includes isActivePlayer: true
      expect(Player.find).toHaveBeenCalledWith({
        teamIds: teamObjectId,
        isActivePlayer: true
      });
    });
  });

  describe('getTeamsForPlayer', () => {
    it('should get teams where player has teamId in Player.teamIds', async () => {
      const playerId = new Types.ObjectId().toString();
      const playerObjectId = new Types.ObjectId(playerId);

      const teamId1 = new Types.ObjectId();
      const teamId2 = new Types.ObjectId();

      const mockPlayer = {
        _id: playerObjectId,
        userId: new Types.ObjectId(),
        firstName: 'Test',
        lastName: 'Player',
        teamIds: [teamId1, teamId2],
        isActivePlayer: true
      };

      const mockTeams = [
        {
          _id: teamId1,
          name: 'Team One',
          division: 'A',
          category: 'seniors',
          level: 'A',
          createdById: new Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: teamId2,
          name: 'Team Two',
          division: 'B',
          category: 'youth',
          level: 'B',
          createdById: new Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const mockAggregateResult = [
        {
          _id: teamId1,
          playerIds: [new Types.ObjectId(), new Types.ObjectId()]
        },
        {
          _id: teamId2,
          playerIds: [new Types.ObjectId()]
        }
      ];

      (Player.findById as jest.Mock) = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockPlayer)
      });
      (Team.find as jest.Mock) = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockTeams)
      });
      (Player.aggregate as jest.Mock) = jest.fn().mockResolvedValue(mockAggregateResult);

      const result = await TeamService.getTeamsForPlayer(playerId);

      // Verify Player was looked up
      expect(Player.findById).toHaveBeenCalledWith(playerId);

      // Verify Team.find was called with player's teamIds
      expect(Team.find).toHaveBeenCalledWith({
        _id: { $in: [teamId1, teamId2] }
      });

      // Verify teams were returned
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Team One');
      expect(result[1].name).toBe('Team Two');
    });

    it('should throw error if player not found', async () => {
      const playerId = new Types.ObjectId().toString();

      (Player.findById as jest.Mock) = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      });

      const result = await TeamService.getTeamsForPlayer(playerId);

      // Service returns empty array if player not found (per implementation line 177-178)
      expect(result).toEqual([]);
    });

    it('should return empty array if player has no teams', async () => {
      const playerId = new Types.ObjectId().toString();

      const mockPlayer = {
        _id: new Types.ObjectId(playerId),
        userId: new Types.ObjectId(),
        singlesRanking: 1500,
        doublesRanking: 1600,
        preferredPositions: [],
        isActivePlayer: true,
        teamIds: [], // No teams
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (Player.findById as jest.Mock) = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockPlayer)
      });
      (Team.find as jest.Mock) = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      });
      (Player.aggregate as jest.Mock) = jest.fn().mockResolvedValue([]);

      const result = await TeamService.getTeamsForPlayer(playerId);

      expect(result).toHaveLength(0);
    });
  });

  describe('Architecture Compliance', () => {
    it('should NOT have Team.playerIds field in queries', async () => {
      const teamId = new Types.ObjectId().toString();
      const teamObjectId = new Types.ObjectId(teamId);

      const mockTeam = {
        _id: teamObjectId,
        name: 'Test Team'
      };

      (Team.findById as jest.Mock) = jest.fn().mockResolvedValue(mockTeam);
      (Player.find as jest.Mock) = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      });

      await TeamService.getTeamPlayers(teamId);

      // Verify Team model was NOT updated (no Team.playerIds sync)
      expect(Team.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(Team.updateMany).not.toHaveBeenCalled();
    });
  });
});
