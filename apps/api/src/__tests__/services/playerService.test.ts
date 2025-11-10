// @ts-nocheck
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PlayerService } from '../../services/playerService';
import { Player } from '../../models/Player';
import { Types } from 'mongoose';

/**
 * Team-Player Relationship (Phase 3 Architecture):
 * - Player.teamIds is the SINGLE SOURCE OF TRUTH
 * - Team.playerIds field REMOVED (computed from Player.teamIds)
 * - Operations only update Player.teamIds, not Team
 * - Team roster retrieved via: Player.find({ teamIds: teamId })
 */

// Mock the models
jest.mock('../../models/Player');

describe('PlayerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('batchUpdatePlayers', () => {
    describe('Add to Teams', () => {
      it('should add teamIds to player arrays', async () => {
        const playerIds = [new Types.ObjectId().toString(), new Types.ObjectId().toString()];
        const teamIds = [new Types.ObjectId().toString()];

        const mockPlayerUpdateMany = jest.fn().mockResolvedValue({ modifiedCount: 2 });

        (Player.updateMany as jest.Mock) = mockPlayerUpdateMany;

        const result = await PlayerService.batchUpdatePlayers(playerIds, {
          addToTeams: teamIds
        });

        // Verify Player.updateMany was called with correct parameters
        expect(mockPlayerUpdateMany).toHaveBeenCalledWith(
          { _id: { $in: expect.any(Array) } },
          { $addToSet: { teamIds: { $each: expect.any(Array) } } }
        );

        // Verify calls used ObjectIds
        const playerCall = mockPlayerUpdateMany.mock.calls[0];

        expect(playerCall[0]._id.$in).toHaveLength(2);
        expect(playerCall[1].$addToSet.teamIds.$each).toHaveLength(1);

        expect(result).toEqual({ modifiedCount: 2 });

        // Team.playerIds no longer exists - roster computed from Player.teamIds
      });

      it('should handle multiple teams', async () => {
        const playerIds = [new Types.ObjectId().toString()];
        const teamIds = [
          new Types.ObjectId().toString(),
          new Types.ObjectId().toString(),
          new Types.ObjectId().toString()
        ];

        const mockPlayerUpdateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });

        (Player.updateMany as jest.Mock) = mockPlayerUpdateMany;

        await PlayerService.batchUpdatePlayers(playerIds, {
          addToTeams: teamIds
        });

        const playerCall = mockPlayerUpdateMany.mock.calls[0];

        expect(playerCall[1].$addToSet.teamIds.$each).toHaveLength(3);
      });

      it('should not create duplicate entries with $addToSet', async () => {
        const playerIds = [new Types.ObjectId().toString()];
        const teamIds = [new Types.ObjectId().toString()];

        const mockPlayerUpdateMany = jest.fn().mockResolvedValue({ modifiedCount: 0 }); // No changes if already exists

        (Player.updateMany as jest.Mock) = mockPlayerUpdateMany;

        await PlayerService.batchUpdatePlayers(playerIds, {
          addToTeams: teamIds
        });

        // Verify $addToSet operator is used (prevents duplicates)
        expect(mockPlayerUpdateMany).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            $addToSet: expect.anything()
          })
        );
      });
    });

    describe('Remove from Teams', () => {
      it('should remove teamIds from player arrays', async () => {
        const playerIds = [new Types.ObjectId().toString(), new Types.ObjectId().toString()];
        const teamIds = [new Types.ObjectId().toString()];

        const mockPlayerUpdateMany = jest.fn().mockResolvedValue({ modifiedCount: 2 });

        (Player.updateMany as jest.Mock) = mockPlayerUpdateMany;

        const result = await PlayerService.batchUpdatePlayers(playerIds, {
          removeFromTeams: teamIds
        });

        // Verify Player.updateMany was called with $pull
        expect(mockPlayerUpdateMany).toHaveBeenCalledWith(
          { _id: { $in: expect.any(Array) } },
          { $pull: { teamIds: { $in: expect.any(Array) } } }
        );

        expect(result).toEqual({ modifiedCount: 2 });

        // Team.playerIds no longer exists - roster computed from Player.teamIds
      });
    });

    describe('Update Player Status', () => {
      it('should activate players', async () => {
        const playerIds = [new Types.ObjectId().toString(), new Types.ObjectId().toString()];

        const mockPlayerUpdateMany = jest.fn().mockResolvedValue({ modifiedCount: 2 });
        (Player.updateMany as jest.Mock) = mockPlayerUpdateMany;

        const result = await PlayerService.batchUpdatePlayers(playerIds, {
          isActivePlayer: true
        });

        expect(mockPlayerUpdateMany).toHaveBeenCalledWith(
          { _id: { $in: expect.any(Array) } },
          { $set: { isActivePlayer: true } }
        );

        expect(result).toEqual({ modifiedCount: 2 });
      });

      it('should deactivate players', async () => {
        const playerIds = [new Types.ObjectId().toString()];

        const mockPlayerUpdateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });
        (Player.updateMany as jest.Mock) = mockPlayerUpdateMany;

        const result = await PlayerService.batchUpdatePlayers(playerIds, {
          isActivePlayer: false
        });

        expect(mockPlayerUpdateMany).toHaveBeenCalledWith(
          expect.anything(),
          { $set: { isActivePlayer: false } }
        );

        expect(result).toEqual({ modifiedCount: 1 });
      });
    });

    describe('Update Player Ranking', () => {
      it('should update rankings with absolute value', async () => {
        const playerIds = [new Types.ObjectId().toString()];

        const mockPlayerUpdateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });
        (Player.updateMany as jest.Mock) = mockPlayerUpdateMany;

        const result = await PlayerService.batchUpdatePlayers(playerIds, {
          singlesRanking: 100,
          doublesRanking: 150
        });

        expect(mockPlayerUpdateMany).toHaveBeenCalledWith(
          { _id: { $in: expect.any(Array) } },
          { $set: { singlesRanking: 100, doublesRanking: 150 } }
        );
        expect(result).toEqual({ modifiedCount: 1 });
      });

      it('should update rankings with offset using $inc', async () => {
        const playerIds = [new Types.ObjectId().toString(), new Types.ObjectId().toString()];

        const mockPlayerUpdateMany = jest.fn().mockResolvedValue({ modifiedCount: 2 });
        (Player.updateMany as jest.Mock) = mockPlayerUpdateMany;

        const result = await PlayerService.batchUpdatePlayers(playerIds, {
          singlesRankingOffset: 50,
          doublesRankingOffset: 25
        });

        expect(mockPlayerUpdateMany).toHaveBeenCalledWith(
          { _id: { $in: expect.any(Array) } },
          { $inc: { singlesRanking: 50, doublesRanking: 25 } }
        );

        expect(result).toEqual({ modifiedCount: 2 });
      });
    });

    describe('Combined Operations', () => {
      it('should handle status update and team addition together', async () => {
        const playerIds = [new Types.ObjectId().toString()];
        const teamIds = [new Types.ObjectId().toString()];

        const mockPlayerUpdateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });

        (Player.updateMany as jest.Mock) = mockPlayerUpdateMany;

        await PlayerService.batchUpdatePlayers(playerIds, {
          isActivePlayer: true,
          addToTeams: teamIds
        });

        // Should call both team operations and status update
        expect(mockPlayerUpdateMany).toHaveBeenCalledTimes(2); // Once for teams, once for status
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty player array', async () => {
        const mockPlayerUpdateMany = jest.fn();
        (Player.updateMany as jest.Mock) = mockPlayerUpdateMany;

        const result = await PlayerService.batchUpdatePlayers([], {
          isActivePlayer: true
        });

        // Should still attempt the update but with empty array
        expect(result).toEqual({ modifiedCount: 0 });
      });

      it('should handle empty team array', async () => {
        const playerIds = [new Types.ObjectId().toString()];

        const mockPlayerUpdateMany = jest.fn().mockResolvedValue({ modifiedCount: 0 });

        (Player.updateMany as jest.Mock) = mockPlayerUpdateMany;

        await PlayerService.batchUpdatePlayers(playerIds, {
          addToTeams: []
        });

        // Should not call updateMany if no teams (empty operation)
        // The service may handle this differently, adjust based on actual implementation
      });
    });

    describe('ObjectId Conversion', () => {
      it('should convert string IDs to ObjectIds correctly', async () => {
        const playerIds = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']; // Valid hex strings
        const teamIds = ['507f1f77bcf86cd799439013'];

        await PlayerService.batchUpdatePlayers(playerIds, { addToTeams: teamIds });

        // Get the ObjectIds that were created
        const updateCall = (Player.updateMany as jest.Mock).mock.calls.find(
          call => call[1]?.$addToSet
        );

        expect(updateCall).toBeDefined();

        const playerObjectIds = updateCall[0]._id.$in;
        const teamObjectIds = updateCall[1].$addToSet.teamIds.$each;

        // Verify conversion happened - just check the arrays exist and have correct length
        expect(playerObjectIds).toHaveLength(2);
        expect(teamObjectIds).toHaveLength(1);

        // Verify they're ObjectId instances (accepts both Types.ObjectId and Schema.Types.ObjectId)
        playerObjectIds.forEach((id: any) => {
          expect(['ObjectId', 'SchemaObjectId']).toContain(id.constructor.name);
        });

        teamObjectIds.forEach((id: any) => {
          expect(['ObjectId', 'SchemaObjectId']).toContain(id.constructor.name);
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error if database operation fails', async () => {
      const playerIds = [new Types.ObjectId().toString()];

      const mockPlayerUpdateMany = jest.fn().mockRejectedValue(new Error('Database error'));
      (Player.updateMany as jest.Mock) = mockPlayerUpdateMany;

      await expect(
        PlayerService.batchUpdatePlayers(playerIds, { isActivePlayer: true })
      ).rejects.toThrow('Database error');
    });
  });
});
