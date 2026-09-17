import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccountKind,
  Capability,
  MatchDirection,
} from '@club/shared-types/core/enums';
import { MATCH_CSV_HEADER } from '../../lib/matchScheduleCsv';
import { MatchCsvImportService } from '../../services/matchCsvImportService';
import {
  MatchService,
  type MatchCommandActor,
} from '../../services/matchService';
import { TeamService } from '../../services/teamService';
import { AppError } from '../../utils/errors';

const teamId = '507f1f77bcf86cd799439011';
const actor = {
  id: '507f1f77bcf86cd799439012',
  email: 'admin@example.test',
  accountKind: AccountKind.PERSON,
  displayName: 'Administrator',
  capabilities: [Capability.ADMINISTRATION],
} as MatchCommandActor;

function csv(...rows: string[]): Buffer {
  return Buffer.from([MATCH_CSV_HEADER.join(','), ...rows].join('\n'));
}

describe('MatchCsvImportService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(TeamService, 'getTeamById').mockResolvedValue({
      id: teamId,
      leagueTeamName: 'Deutsch-Chinesischer BV II',
    } as never);
    vi.spyOn(MatchService, 'getMatchByScheduleDuplicateKey').mockResolvedValue(
      null
    );
  });

  it('maps exact normalized home/away rows, continues semantic failures, and resolves same-file duplicates', async () => {
    let id = 0;
    const create = vi.spyOn(MatchService, 'createMatch').mockImplementation(
      async (request) =>
        ({
          id: `match-${++id}`,
          ...request,
        }) as never
    );
    const result = await MatchCsvImportService.import(
      csv(
        '15.08.2026,19:30,Halle A,"Straße 1, Berlin",Deutsch-Chinesischer BV II,Visitors',
        '15.08.2026,19:30,  halle   a  ," Straße 1,  Berlin ",deutsch-chinesischer bv ii, visitors ',
        '16.08.2026,09:30,Halle B,Adresse B,Visitors, Deutsch-Chinesischer BV II ',
        '31.02.2026,09:30,Halle C,Adresse C,Deutsch-Chinesischer BV II,Visitors',
        '17.08.2026,9:30,Halle C,Adresse C,Deutsch-Chinesischer BV II,Visitors',
        '18.08.2026,09:30,Halle C,Adresse C,Other Club,Visitors',
        '19.08.2026,09:30,Halle C,Adresse C,Deutsch-Chinesischer BV II,Deutsch-Chinesischer BV II',
        '20.08.2026,09:30,Halle D,Adresse D,Deutsch-Chinesischer BV II Long,Visitors'
      ),
      teamId,
      actor
    );

    expect(result.summary).toEqual({
      input: 8,
      created: 2,
      duplicate: 1,
      failed: 5,
    });
    expect(result.outcomes.map((item) => item.code)).toEqual([
      'MATCH_CREATED',
      'DUPLICATE_IN_FILE',
      'MATCH_CREATED',
      'INVALID_DATE',
      'INVALID_TIME',
      'TEAM_NOT_PRESENT',
      'TEAM_MATCHES_BOTH_SIDES',
      'TEAM_NOT_PRESENT',
    ]);
    expect(create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        opponentName: 'Visitors',
        direction: MatchDirection.HOME,
        location: 'Halle A\nStraße 1, Berlin',
      }),
      actor
    );
    expect(create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        opponentName: 'Visitors',
        direction: MatchDirection.AWAY,
      }),
      actor
    );
  });

  it('reports persisted and concurrent-race duplicates without changing them', async () => {
    vi.spyOn(
      MatchService,
      'getMatchByScheduleDuplicateKey'
    ).mockResolvedValueOnce({ id: 'persisted-1' } as never);
    const create = vi.spyOn(MatchService, 'createMatch');
    const persisted = await MatchCsvImportService.import(
      csv(
        '15.08.2026,19:30,Halle A,Adresse A,Deutsch-Chinesischer BV II,Visitors'
      ),
      teamId,
      actor
    );
    expect(persisted.summary).toEqual({
      input: 1,
      created: 0,
      duplicate: 1,
      failed: 0,
    });
    expect(persisted.outcomes[0]).toMatchObject({
      code: 'MATCH_ALREADY_EXISTS',
      matchId: 'persisted-1',
    });
    expect(create).not.toHaveBeenCalled();

    vi.restoreAllMocks();
    vi.spyOn(TeamService, 'getTeamById').mockResolvedValue({
      id: teamId,
      leagueTeamName: 'Deutsch-Chinesischer BV II',
    } as never);
    vi.spyOn(MatchService, 'getMatchByScheduleDuplicateKey')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'winner' } as never);
    vi.spyOn(MatchService, 'createMatch').mockRejectedValue(
      new AppError(
        'An equal Match already exists',
        409,
        'MATCH_SCHEDULE_DUPLICATE'
      )
    );
    const raced = await MatchCsvImportService.import(
      csv(
        '15.08.2026,19:30,Halle A,Adresse A,Deutsch-Chinesischer BV II,Visitors'
      ),
      teamId,
      actor
    );
    expect(raced.outcomes[0]).toMatchObject({
      outcome: 'duplicate',
      matchId: 'winner',
    });
  });

  it('classifies Berlin DST gaps and ambiguity per row, then processes later rows', async () => {
    vi.spyOn(MatchService, 'createMatch').mockResolvedValue({
      id: 'match-1',
    } as never);
    const result = await MatchCsvImportService.import(
      csv(
        '29.03.2026,02:30,Halle,Adresse,Deutsch-Chinesischer BV II,Visitors',
        '25.10.2026,02:30,Halle,Adresse,Deutsch-Chinesischer BV II,Visitors',
        '26.10.2026,19:30,Halle,Adresse,Deutsch-Chinesischer BV II,Visitors'
      ),
      teamId,
      actor
    );
    expect(result.outcomes.map((item) => item.code)).toEqual([
      'INVALID_LOCAL_START',
      'INVALID_LOCAL_START',
      'MATCH_CREATED',
    ]);
  });

  it('aborts unexpected persistence failures instead of fabricating a row result', async () => {
    const failure = AppError.internal('database unavailable');
    vi.spyOn(MatchService, 'createMatch').mockRejectedValue(failure);
    await expect(
      MatchCsvImportService.import(
        csv(
          '15.08.2026,19:30,Halle A,Adresse A,Deutsch-Chinesischer BV II,Visitors',
          '16.08.2026,19:30,Halle B,Adresse B,Deutsch-Chinesischer BV II,Visitors'
        ),
        teamId,
        actor
      )
    ).rejects.toBe(failure);
    expect(MatchService.createMatch).toHaveBeenCalledTimes(1);
  });

  it('fails the whole request for an unknown selected Team', async () => {
    vi.spyOn(TeamService, 'getTeamById').mockResolvedValue(null);
    await expect(
      MatchCsvImportService.import(
        csv(
          '15.08.2026,19:30,Halle A,Adresse A,Deutsch-Chinesischer BV II,Visitors'
        ),
        teamId,
        actor
      )
    ).rejects.toMatchObject({ statusCode: 404, code: 'TEAM_NOT_FOUND' });
  });
});
