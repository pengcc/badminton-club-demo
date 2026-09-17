import { describe, expect, it } from 'vitest';
import { PlayerService } from '../../services/playerService';
import {
  playerCleanupSchema,
  playerLifecycleBatchSchema,
} from '@club/shared-types/schemas/playerLifecycle';
import { batchUpdatePlayersSchema } from '@club/shared-types/schemas/team';

describe('PlayerService lifecycle bypass guards', () => {
  it('rejects direct single-Player eligibility writes', async () => {
    await expect(
      PlayerService.updatePlayerSportsData('player-id', {
        isActivePlayer: true,
      } as unknown as Parameters<
        typeof PlayerService.updatePlayerSportsData
      >[1])
    ).rejects.toThrow('authoritative services');
  });

  it('rejects direct Team replacement through the sporting update method', async () => {
    await expect(
      PlayerService.updatePlayerSportsData('player-id', {
        teamIds: ['team-id'],
      } as unknown as Parameters<
        typeof PlayerService.updatePlayerSportsData
      >[1])
    ).rejects.toThrow('authoritative services');
  });

  it('rejects direct batch eligibility writes', async () => {
    await expect(
      PlayerService.batchUpdatePlayers(['player-id'], {
        isActivePlayer: false,
      } as never)
    ).rejects.toThrow('MembershipLifecycleService');
  });

  it('keeps lifecycle intent out of the generic Player-data batch schema', () => {
    expect(
      batchUpdatePlayersSchema.safeParse({
        playerIds: ['507f1f77bcf86cd799439011'],
        updates: { isActivePlayer: false },
      }).success
    ).toBe(false);
    expect(
      playerLifecycleBatchSchema.safeParse({
        userIds: ['507f1f77bcf86cd799439012'],
        action: 'deactivate',
        reason: 'Participation ended',
      }).success
    ).toBe(true);
  });

  it('requires an explicit bounded cleanup reason', () => {
    expect(playerCleanupSchema.safeParse({ reason: '' }).success).toBe(false);
    expect(
      playerCleanupSchema.safeParse({ reason: 'Historical-only cleanup' })
        .success
    ).toBe(true);
  });
});
