import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchDirection } from '@club/shared-types/core/enums';
import matchMessages from '../../../messages/en/match.json';

const mocks = vi.hoisted(() => ({
  importCsv: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@app/components/ui/modal', () => ({
  Modal: ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
  }) => (isOpen ? <div>{children}</div> : null),
}));

vi.mock('@app/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select
      aria-label="Club team"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: ({ placeholder }: any) => (
    <option value="">{placeholder}</option>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock('@app/services/teamService', () => ({
  TeamService: {
    useTeamList: () => ({
      data: [
        {
          id: 'team-1',
          shortName: 'Club II',
          leagueTeamName: 'Deutsch-Chinesischer BV II',
        },
      ],
      isLoading: false,
    }),
  },
}));

vi.mock('@app/lib/api/matchApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@app/lib/api/matchApi')>();
  return { ...actual, importFromCSV: mocks.importCsv };
});

vi.mock('sonner', () => ({
  toast: {
    success: mocks.success,
    warning: mocks.warning,
    error: mocks.error,
  },
}));

import { CSVUploadModal } from '../../components/Dashboard/modals/CSVUploadModal';

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  render(
    <NextIntlClientProvider locale="en" messages={{ match: matchMessages }}>
      <QueryClientProvider client={queryClient}>
        <CSVUploadModal isOpen onClose={vi.fn()} userId="admin-1" />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
  return { invalidate };
}

async function selectFile(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByRole('combobox'), 'team-1');
  const file = new File(['csv bytes'], 'schedule.csv', { type: 'text/csv' });
  await user.upload(screen.getByLabelText('CSV file'), file);
  return file;
}

describe('administrator Match CSV import task', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads the original File, keeps mixed outcomes visible, and invalidates Match lists after creation', async () => {
    mocks.importCsv.mockResolvedValue({
      summary: { input: 3, created: 1, duplicate: 1, failed: 1 },
      outcomes: [
        {
          rowNumber: 2,
          outcome: 'created',
          code: 'MATCH_CREATED',
          matchId: 'match-1',
          localDate: '2026-08-15',
          localTime: '19:30',
          opponentName: 'Visitors',
          direction: MatchDirection.HOME,
          location: 'Hall\nAddress',
        },
        {
          rowNumber: 3,
          outcome: 'duplicate',
          code: 'MATCH_ALREADY_EXISTS',
          matchId: 'match-1',
          localDate: '2026-08-15',
          localTime: '19:30',
          opponentName: 'Visitors',
          direction: MatchDirection.HOME,
          location: 'Hall\nAddress',
        },
        {
          rowNumber: 4,
          outcome: 'failed',
          code: 'INVALID_DATE',
          message: 'invalid',
        },
      ],
    });
    const user = userEvent.setup();
    const { invalidate } = renderModal();
    const file = await selectFile(user);

    expect(screen.getAllByText(/Deutsch-Chinesischer BV II/)).toHaveLength(2);
    expect(
      screen.getByText(
        'Datum,Zeit,Sporthalle,Hallenadresse,Heimmannschaft,Gastmannschaft'
      )
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Import matches' }));

    await waitFor(() =>
      expect(mocks.importCsv).toHaveBeenCalledWith(file, 'team-1')
    );
    expect(await screen.findByText('Created (1)')).toBeVisible();
    expect(screen.getByText('Duplicates (1)')).toBeVisible();
    expect(screen.getByText('Failed (1)')).toBeVisible();
    expect(screen.getByText(/Row 3: 2026-08-15 19:30, Visitors/)).toBeVisible();
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['matches', 'list'],
    });
    expect(mocks.warning).toHaveBeenCalledWith(
      'Import completed with mixed row outcomes.'
    );
  });

  it('treats all-duplicate as successful without invalidation', async () => {
    mocks.importCsv.mockResolvedValue({
      summary: { input: 1, created: 0, duplicate: 1, failed: 0 },
      outcomes: [
        {
          rowNumber: 2,
          outcome: 'duplicate',
          code: 'MATCH_ALREADY_EXISTS',
          matchId: 'match-1',
          localDate: '2026-08-15',
          localTime: '19:30',
          opponentName: 'Visitors',
          direction: MatchDirection.HOME,
          location: 'Hall\nAddress',
        },
      ],
    });
    const user = userEvent.setup();
    const { invalidate } = renderModal();
    await selectFile(user);
    await user.click(screen.getByRole('button', { name: 'Import matches' }));

    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith(
        'Nothing changed; every row already exists.'
      )
    );
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('preserves Team and file after request failure, explains replay, and refreshes defensively', async () => {
    mocks.importCsv.mockRejectedValue(new Error('connection lost'));
    const user = userEvent.setup();
    const { invalidate } = renderModal();
    const file = await selectFile(user);
    await user.click(screen.getByRole('button', { name: 'Import matches' }));

    expect(await screen.findByText('Import was interrupted')).toBeVisible();
    expect(
      screen.getByText(/replay the unchanged file to converge safely/)
    ).toBeVisible();
    expect(screen.getByText(file.name)).toBeVisible();
    expect(screen.getByRole('combobox')).toHaveValue('team-1');
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['matches', 'list'],
    });
  });

  it('reports a known file-level rejection as zero-write without invalidating Matches', async () => {
    mocks.importCsv.mockRejectedValue({
      response: {
        status: 400,
        data: { code: 'MATCH_CSV_INVALID_HEADER' },
      },
    });
    const user = userEvent.setup();
    const { invalidate } = renderModal();
    await selectFile(user);
    await user.click(screen.getByRole('button', { name: 'Import matches' }));

    expect(await screen.findByText('Import was not accepted')).toBeVisible();
    expect(
      screen.getByText(/No rows were created. Check the selected team/)
    ).toBeVisible();
    expect(
      screen.queryByText(/earlier rows may already have been created/)
    ).not.toBeInTheDocument();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('reports invalid multipart fields as a zero-write rejection without replay guidance', async () => {
    mocks.importCsv.mockRejectedValue({
      response: {
        status: 400,
        data: { code: 'MATCH_CSV_INVALID_FIELDS' },
      },
    });
    const user = userEvent.setup();
    const { invalidate } = renderModal();
    await selectFile(user);
    await user.click(screen.getByRole('button', { name: 'Import matches' }));

    expect(await screen.findByText('Import was not accepted')).toBeVisible();
    expect(
      screen.getByText(/No rows were created. Check the selected team/)
    ).toBeVisible();
    expect(
      screen.queryByText(/earlier rows may already have been created/)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/replay the unchanged file to converge safely/)
    ).not.toBeInTheDocument();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it.each([
    404, 409,
  ])('treats an unrecognized %s after import processing as an ambiguous interruption', async (status) => {
    mocks.importCsv.mockRejectedValue({
      response: { status, data: { code: 'UNRECOGNIZED_IMPORT_ERROR' } },
    });
    const user = userEvent.setup();
    const { invalidate } = renderModal();
    const file = await selectFile(user);
    await user.click(screen.getByRole('button', { name: 'Import matches' }));

    expect(await screen.findByText('Import was interrupted')).toBeVisible();
    expect(
      screen.getByText(/earlier rows may already have been created/)
    ).toBeVisible();
    expect(
      screen.getByText(/replay the unchanged file to converge safely/)
    ).toBeVisible();
    expect(screen.getByText(file.name)).toBeVisible();
    expect(screen.getByRole('combobox')).toHaveValue('team-1');
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['matches', 'list'],
    });
  });

  it('does not infer zero writes from a 4xx status without a recognized code', async () => {
    mocks.importCsv.mockRejectedValue({ response: { status: 400 } });
    const user = userEvent.setup();
    const { invalidate } = renderModal();
    await selectFile(user);
    await user.click(screen.getByRole('button', { name: 'Import matches' }));

    expect(await screen.findByText('Import was interrupted')).toBeVisible();
    expect(screen.queryByText(/No rows were created/)).not.toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['matches', 'list'],
    });
  });

  it('renders localized safe field detail for failed rows without exposing raw messages', async () => {
    mocks.importCsv.mockResolvedValue({
      summary: { input: 3, created: 0, duplicate: 0, failed: 3 },
      outcomes: [
        {
          rowNumber: 2,
          outcome: 'failed',
          code: 'MISSING_REQUIRED_VALUE',
          field: 'Hallenadresse',
          message: 'Hallenadresse is required',
        },
        {
          rowNumber: 3,
          outcome: 'failed',
          code: 'MATCH_VALIDATION_FAILED',
          field: 'location',
          message: 'raw persistence detail must remain hidden',
        },
        {
          rowNumber: 4,
          outcome: 'failed',
          code: 'TEAM_NOT_PRESENT',
          message: 'Selected Team matches neither side',
        },
      ],
    });
    const user = userEvent.setup();
    renderModal();
    await selectFile(user);
    await user.click(screen.getByRole('button', { name: 'Import matches' }));

    expect(
      await screen.findByText(
        'Row 2: Hallenadresse — a required value is missing'
      )
    ).toBeVisible();
    expect(
      screen.getByText(
        'Row 3: Location — the mapped match violates the match contract'
      )
    ).toBeVisible();
    expect(
      screen.getByText('Row 4: the selected team matches neither side')
    ).toBeVisible();
    expect(
      screen.queryByText(/raw persistence detail/)
    ).not.toBeInTheDocument();
  });
});
