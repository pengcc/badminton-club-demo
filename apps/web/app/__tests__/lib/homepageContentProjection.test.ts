import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock('react', () => ({
  cache: <T extends (...args: never[]) => unknown>(callback: T) => callback,
}));

vi.stubGlobal('fetch', fetchMock);

import {
  getAnnouncements,
  getClubInformation,
  getHomepageContent,
  getLocations,
} from '../../lib/data/getHomepageContent';
import { Language } from '@club/shared-types/core/enums';

function response(data: unknown, ok = true) {
  return { ok, statusText: ok ? 'OK' : 'Unavailable', json: async () => data };
}

describe('homepage public content projections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('requests announcement and location projections by locale', async () => {
    fetchMock.mockResolvedValue(response({ success: true, data: [] }));

    await getAnnouncements(Language.GERMAN);
    await getLocations(Language.CHINESE);

    const announcementUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(announcementUrl.pathname).toBe('/api/announcements');
    expect([...announcementUrl.searchParams.entries()]).toEqual([
      ['language', 'de'],
    ]);

    const locationUrl = new URL(fetchMock.mock.calls[1][0]);
    expect(locationUrl.pathname).toBe('/api/locations');
    expect([...locationUrl.searchParams.entries()]).toEqual([
      ['language', 'zh'],
    ]);
  });

  it('preserves successful empty announcement and location lists', async () => {
    fetchMock.mockResolvedValue(response({ success: true, data: [] }));

    await expect(getAnnouncements(Language.ENGLISH)).resolves.toEqual({
      status: 'ready',
      data: [],
    });
    expect(console.error).not.toHaveBeenCalled();
    await expect(getLocations(Language.ENGLISH)).resolves.toEqual({
      status: 'ready',
      data: [],
    });
  });

  it('accepts optional empty Homepage introductions but requires the main message', async () => {
    fetchMock
      .mockResolvedValueOnce(
        response({
          success: true,
          data: {
            mainMessage: 'Welcome',
            visitUsIntroduction: '',
            contactIntroduction: '',
          },
        })
      )
      .mockResolvedValueOnce(
        response({
          success: true,
          data: {
            mainMessage: '',
            visitUsIntroduction: 'Visit',
            contactIntroduction: 'Contact',
          },
        })
      );

    await expect(getHomepageContent(Language.ENGLISH)).resolves.toEqual({
      status: 'ready',
      data: {
        mainMessage: 'Welcome',
        visitUsIntroduction: '',
        contactIntroduction: '',
      },
    });
    await expect(getHomepageContent(Language.ENGLISH)).resolves.toEqual({
      status: 'unavailable',
    });
  });

  it('requires the locale-resolved Club identity and introduction contract', async () => {
    fetchMock.mockResolvedValue(
      response({
        success: true,
        data: {
          officialNameGerman: 'Deutsch-Chinesischer Badminton Verein',
          nameEnglish: 'German-Chinese Badminton Club',
          nameChinese: '德中羽毛球俱乐部',
          localizedName: '',
          shortName: 'DCBV',
          foundingYear: 2009,
          introduction: 'Club introduction',
        },
      })
    );

    await expect(getClubInformation(Language.ENGLISH)).resolves.toEqual({
      status: 'unavailable',
    });
  });

  it.each([
    ['non-success response', response({}, false)],
    ['malformed envelope', response({ success: true, data: {} })],
    ['invalid list item', response({ success: true, data: [{ id: 42 }] })],
    [
      'invalid announcement external link',
      response({
        success: true,
        data: [
          {
            id: 'announcement-1',
            title: 'Update',
            content: 'Details',
            type: 'info',
            displayDate: '2026.08.13',
            externalLink: 'https://',
          },
        ],
      }),
    ],
  ])('reports %s as unavailable instead of valid empty', async (_name, value) => {
    fetchMock.mockResolvedValue(value);

    await expect(getAnnouncements(Language.ENGLISH)).resolves.toEqual({
      status: 'unavailable',
    });
  });
});
