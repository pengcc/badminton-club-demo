import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerType } from '@club/shared-types/core/enums';
import type { Api } from '@club/shared-types/api/player';

const client = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../../lib/api/client', () => ({ default: client }));

import { getPlayers } from '../../lib/api/playerApi';

const player: Api.PlayerResponse = {
  id: 'player-1',
  userId: 'user-1',
  type: PlayerType.EXTERNAL,
  userName: 'Player, External',
  userEmail: 'external@example.test',
  singlesRanking: 100,
  doublesRanking: 100,
  rankingDisplay: '100/100',
  isActivePlayer: true,
  teamIds: [],
  matchCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Player API adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.get.mockResolvedValue({
      data: { success: true, data: [player] } satisfies Api.PlayerListResponse,
    });
  });

  it('unwraps the complete Player list without sending query parameters', async () => {
    await expect(getPlayers()).resolves.toEqual([player]);
    expect(client.get).toHaveBeenCalledWith('/players');
  });
});
