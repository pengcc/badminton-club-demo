import React, { type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Gender,
  MembershipStatus,
  PlayerType,
} from '@club/shared-types/core/enums';
import {
  MEMBER_CSV_HEADERS,
  decodeMemberCsvValue,
} from '@club/shared-types/api/memberCsv';
import type { CsvColumn } from '../../lib/utils/csv';
import type { Api } from '@club/shared-types/api/user';
import {
  useMemberExport,
  useRichMemberExport,
} from '../../hooks/useMemberExport';
import { UserService } from '../../services/userService';

const csvMocks = vi.hoisted(() => ({
  downloadCsv: vi.fn((_options: unknown) => true),
}));

vi.mock('../../lib/utils/csv', () => csvMocks);

const messages = {
  dashboard: {
    memberList: {
      noMembersToExport: 'No members to export',
      exportFailed: 'Export failed',
    },
  },
};

const exportResponse: Api.RichMemberExportResponse = {
  success: true,
  items: [
    {
      userId: 'member-1',
      email: 'member@example.test',
      firstName: 'Test',
      lastName: 'Member',
      fullName: 'Member, Test',
      gender: Gender.FEMALE,
      dateOfBirth: '1990-01-01',
      membershipStatus: MembershipStatus.INACTIVE,
      administratorDesignation: false,
      player: {
        id: 'player-1',
        type: PlayerType.EXTERNAL,
        isActivePlayer: true,
        singlesRanking: 1,
        doublesRanking: 2,
        teamNames: ['A1'],
      },
    },
  ],
};

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('Member CSV export hooks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    csvMocks.downloadCsv.mockClear();
  });

  it('uses the bounded export source for Portable CSV with only the current cohort', async () => {
    vi.spyOn(UserService, 'getRichMemberExport').mockResolvedValue(
      exportResponse
    );
    const { result } = renderHook(() => useMemberExport(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.exportMembers('current');
    });

    expect(UserService.getRichMemberExport).toHaveBeenCalledWith({
      cohort: 'current',
    });
    expect(csvMocks.downloadCsv).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: expect.stringMatching(
          /^members_portable_current_\d{4}-\d{2}-\d{2}\.csv$/
        ),
        rows: exportResponse.items,
      })
    );
  });

  it('exports canonical portable values with reversible spreadsheet safety and positive-only Member Player eligibility', async () => {
    const member = {
      ...exportResponse.items[0],
      firstName: "'Ada",
      phone: '+49123456789',
      membershipStatus: MembershipStatus.ACTIVE,
    };
    const items = [
      {
        ...member,
        player: {
          ...member.player!,
          type: PlayerType.MEMBER,
          isActivePlayer: true,
        },
      },
      {
        ...member,
        player: {
          ...member.player!,
          type: PlayerType.MEMBER,
          isActivePlayer: false,
        },
      },
      {
        ...member,
        player: {
          ...member.player!,
          type: PlayerType.EXTERNAL,
          isActivePlayer: true,
        },
      },
      {
        ...member,
        player: undefined,
        firstName: undefined,
        dateOfBirth: undefined,
      },
    ];
    vi.spyOn(UserService, 'getRichMemberExport').mockResolvedValue({
      success: true,
      items,
    });
    const { result } = renderHook(() => useMemberExport(), {
      wrapper: Wrapper,
    });
    await act(() => result.current.exportMembers('current'));
    const options = csvMocks.downloadCsv.mock.calls[0][0] as unknown as {
      columns: CsvColumn<Api.RichMemberExportRow>[];
    };
    expect(options.columns.map((c) => c.header)).toEqual(MEMBER_CSV_HEADERS);
    const values = items.map((item) =>
      options.columns.map((c) => String(c.value(item)))
    );
    expect(values[0].map(decodeMemberCsvValue)).toEqual([
      "'Ada",
      'Member',
      'member@example.test',
      'female',
      '1990-01-01',
      '+49123456789',
      '',
      '',
      '',
      'active',
      '',
      'true',
    ]);
    expect(values.map((v) => v[11])).toEqual(['true', '', '', '']);
    expect(values[3][0]).toBe('');
    expect(values[3][4]).toBe('');
    const { serializeCsv } = await vi.importActual<
      typeof import('../../lib/utils/csv')
    >('../../lib/utils/csv');
    const text = serializeCsv([items[0]], options.columns);
    expect(text).toContain('"\'\'Ada"');
    expect(text).toContain('"\'+49123456789"');
  });

  it('retains Basic All as a reporting export', async () => {
    vi.spyOn(UserService, 'getRichMemberExport').mockResolvedValue(
      exportResponse
    );
    const { result } = renderHook(() => useMemberExport(), {
      wrapper: Wrapper,
    });
    await act(() => result.current.exportMembers('all'));
    expect(UserService.getRichMemberExport).toHaveBeenCalledWith({
      cohort: 'all',
    });
    expect(csvMocks.downloadCsv).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: expect.stringMatching(/^members_basic_all_/),
      })
    );
  });

  it('uses the same cohort semantics for Rich CSV and retains its variant filename', async () => {
    vi.spyOn(UserService, 'getRichMemberExport').mockResolvedValue(
      exportResponse
    );
    const { result } = renderHook(() => useRichMemberExport(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.exportMembers('all');
    });

    expect(UserService.getRichMemberExport).toHaveBeenCalledWith({
      cohort: 'all',
    });
    expect(csvMocks.downloadCsv).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: expect.stringMatching(
          /^members_rich_all_\d{4}-\d{2}-\d{2}\.csv$/
        ),
        rows: exportResponse.items,
      })
    );
  });
});
