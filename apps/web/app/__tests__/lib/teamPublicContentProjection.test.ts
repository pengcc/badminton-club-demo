import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Language } from '@club/shared-types/core/enums';

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock('react', () => ({
  cache: <T extends (...args: never[]) => unknown>(callback: T) => callback,
}));
vi.stubGlobal('fetch', fetchMock);

import {
  getPublicTeams,
  getTeamPublicContent,
} from '../../lib/data/getTeamsPageData';

function response(data: unknown, ok = true) {
  return { ok, statusText: ok ? 'OK' : 'Unavailable', json: async () => data };
}

describe('Team public projections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('preserves ready Team items and successful empty lists', async () => {
    fetchMock
      .mockResolvedValueOnce(
        response({
          success: true,
          data: [
            {
              shortName: 'Team 1',
              leagueTeamName: 'DCBV',
              matchLevel: 'C',
            },
          ],
        })
      )
      .mockResolvedValueOnce(response({ success: true, data: [] }));

    await expect(getPublicTeams()).resolves.toEqual({
      status: 'ready',
      data: [
        {
          shortName: 'Team 1',
          leagueTeamName: 'DCBV',
          matchLevel: 'C',
        },
      ],
    });
    await expect(getPublicTeams()).resolves.toEqual({
      status: 'ready',
      data: [],
    });
  });

  it.each([
    response({}, false),
    response({ success: true, data: [{ shortName: 42 }] }),
    response({
      success: true,
      data: [
        {
          shortName: 'Team 1',
          leagueTeamName: 'DCBV',
          matchLevel: 'Class C',
        },
      ],
    }),
  ])('reports a non-success or malformed Team list as unavailable', async (value) => {
    fetchMock.mockResolvedValue(value);
    await expect(getPublicTeams()).resolves.toEqual({ status: 'unavailable' });
  });

  it('preserves enabled and intentionally disabled introductions', async () => {
    fetchMock
      .mockResolvedValueOnce(
        response({
          success: true,
          data: { enabled: true, title: '球队', description: '介绍' },
        })
      )
      .mockResolvedValueOnce(
        response({
          success: true,
          data: { enabled: false, title: '', description: '' },
        })
      );

    await expect(getTeamPublicContent(Language.CHINESE)).resolves.toEqual({
      status: 'ready',
      data: { enabled: true, title: '球队', description: '介绍' },
    });
    await expect(getTeamPublicContent(Language.GERMAN)).resolves.toEqual({
      status: 'ready',
      data: { enabled: false, title: '', description: '' },
    });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe('/api/team-public-content');
    expect([...url.searchParams.entries()]).toEqual([['language', 'zh']]);
  });

  it.each([
    response({}, false),
    response({
      success: true,
      data: { enabled: true, title: '', description: '' },
    }),
    response({ success: true, data: { enabled: 'yes' } }),
  ])('reports a non-success or unusable Team introduction as unavailable', async (value) => {
    fetchMock.mockResolvedValue(value);
    await expect(getTeamPublicContent(Language.ENGLISH)).resolves.toEqual({
      status: 'unavailable',
    });
  });
});
