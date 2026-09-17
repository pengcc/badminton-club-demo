import { TeamLevel } from '@club/shared-types/core/enums';
import { Types } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../../models/Player';
import { Team } from '../../models/Team';
import { TeamService } from '../../services/teamService';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('protected Team class projection', () => {
  it('orders the protected Team list by teamId when creation time conflicts', async () => {
    const persistedTeams = [
      {
        _id: new Types.ObjectId(),
        teamId: 'dcbv1',
        shortName: 'DCBV I',
        leagueTeamName: 'DCBV I',
        matchLevel: TeamLevel.B,
        createdById: new Types.ObjectId(),
        createdAt: new Date('2026-08-23T00:00:00.000Z'),
        updatedAt: new Date('2026-08-23T00:00:00.000Z'),
      },
      {
        _id: new Types.ObjectId(),
        teamId: 'dcbv2',
        shortName: 'DCBV II',
        leagueTeamName: 'DCBV II',
        matchLevel: TeamLevel.D,
        createdById: new Types.ObjectId(),
        createdAt: new Date('2026-08-24T00:00:00.000Z'),
        updatedAt: new Date('2026-08-24T00:00:00.000Z'),
      },
    ];
    const lean = vi.fn().mockResolvedValue(persistedTeams);
    const sort = vi.fn().mockReturnValue({ lean });
    vi.spyOn(Team, 'find').mockReturnValue({ sort } as never);
    vi.spyOn(Player, 'aggregate').mockResolvedValue([]);

    await expect(TeamService.getAllTeams()).resolves.toMatchObject([
      { teamId: 'dcbv1' },
      { teamId: 'dcbv2' },
    ]);
    expect(sort).toHaveBeenCalledWith({ teamId: 1 });
  });

  it('rejects a stale persisted class before the Team list reaches Web presentation', async () => {
    const persistedTeam = {
      _id: new Types.ObjectId(),
      teamId: 'stale1',
      shortName: 'Stale Team',
      leagueTeamName: 'Stale League Team',
      matchLevel: 'BVBB B',
      createdById: new Types.ObjectId(),
      createdAt: new Date('2026-08-23T00:00:00.000Z'),
      updatedAt: new Date('2026-08-23T00:00:00.000Z'),
    };
    const lean = vi.fn().mockResolvedValue([persistedTeam]);
    const sort = vi.fn().mockReturnValue({ lean });
    vi.spyOn(Team, 'find').mockReturnValue({ sort } as never);
    vi.spyOn(Player, 'aggregate').mockResolvedValue([]);

    await expect(TeamService.getAllTeams()).rejects.toThrow();
  });

  it('projects a canonical persisted class unchanged', async () => {
    const persistedTeam = {
      _id: new Types.ObjectId(),
      teamId: 'canonical1',
      shortName: 'Canonical Team',
      leagueTeamName: 'Canonical League Team',
      matchLevel: TeamLevel.C,
      createdById: new Types.ObjectId(),
      createdAt: new Date('2026-08-23T00:00:00.000Z'),
      updatedAt: new Date('2026-08-23T00:00:00.000Z'),
    };
    const lean = vi.fn().mockResolvedValue([persistedTeam]);
    const sort = vi.fn().mockReturnValue({ lean });
    vi.spyOn(Team, 'find').mockReturnValue({ sort } as never);
    vi.spyOn(Player, 'aggregate').mockResolvedValue([]);

    await expect(TeamService.getAllTeams()).resolves.toMatchObject([
      { matchLevel: TeamLevel.C },
    ]);
  });
});
