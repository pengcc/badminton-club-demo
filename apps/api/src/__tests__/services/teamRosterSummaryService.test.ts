import { afterEach, describe, expect, it, vi } from 'vitest';
import { Gender } from '@club/shared-types/core/enums';
import { Player } from '../../models/Player';
import { TeamService } from '../../services/teamService';

describe('TeamService.getTeamStats', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reconciles the total with every supported gender category', async () => {
    vi.spyOn(Player, 'aggregate').mockResolvedValue([
      { _id: Gender.MALE, count: 2 },
      { _id: Gender.FEMALE, count: 3 },
      { _id: Gender.NON_BINARY, count: 1 },
    ]);

    await expect(
      TeamService.getTeamStats('507f1f77bcf86cd799439013')
    ).resolves.toEqual({
      total: 6,
      male: 2,
      female: 3,
      nonBinary: 1,
    });
  });

  it('returns zero for supported categories absent from the aggregate', async () => {
    vi.spyOn(Player, 'aggregate').mockResolvedValue([
      { _id: Gender.FEMALE, count: 2 },
    ]);

    await expect(
      TeamService.getTeamStats('507f1f77bcf86cd799439013')
    ).resolves.toEqual({
      total: 2,
      male: 0,
      female: 2,
      nonBinary: 0,
    });
  });
});
