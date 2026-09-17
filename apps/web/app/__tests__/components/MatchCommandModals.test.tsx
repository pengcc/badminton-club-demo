import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchDirection } from '@club/shared-types/core/enums';
import type { Match, Team } from '../../lib/types';
import dashboardMessages from '../../../messages/en/dashboard.json';
import matchMessages from '../../../messages/en/match.json';

const mocks = vi.hoisted(() => ({
  createMatch: vi.fn(),
  updateMatch: vi.fn(),
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
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock('@app/components/ui/confirm-dialog', () => ({
  ConfirmDialog: () => null,
  useConfirmDialog: () => ({
    confirm: vi.fn(),
    confirmProps: {
      open: false,
      onOpenChange: vi.fn(),
      title: '',
      description: '',
      onConfirm: vi.fn(),
    },
  }),
}));

vi.mock('@app/services/matchService', () => ({
  MatchService: {
    useCreateMatch: () => ({ mutateAsync: mocks.createMatch }),
    useUpdateMatch: () => ({
      mutateAsync: mocks.updateMatch,
      isPending: false,
    }),
    useMatchDetails: () => ({ data: undefined }),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: mocks.error,
  },
}));

import EditMatchModal from '../../components/Dashboard/modals/EditMatchModal';
import ScheduleMatchModal from '../../components/Dashboard/modals/ScheduleMatchModal';

const teams = [
  {
    id: 'team-1',
    shortName: 'Club I',
    leagueTeamName: 'Club League Team I',
  },
] as Team[];

const match = {
  id: 'match-1',
  version: 4,
  teamId: 'team-1',
  opponentName: 'Original Visitors',
  direction: MatchDirection.HOME,
  startAt: '2026-08-15T17:30:00.000Z',
  localStart: {
    date: '2026-08-15',
    time: '19:30',
    timeZone: 'Europe/Berlin',
  },
  location: 'Original Hall',
  lineup: [],
  availability: [],
  createdById: 'admin-1',
  createdAt: '2026-07-30T10:00:00.000Z',
  updatedAt: '2026-07-30T10:00:00.000Z',
  clubTeamName: 'Club I',
  scoreDisplay: '',
  dateTimeDisplay: '',
  isUpcoming: true,
  isToday: false,
  isTomorrow: false,
  daysRemaining: 16,
} as Match;

function renderWithMessages(children: React.ReactNode) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={{ match: matchMessages, dashboard: dashboardMessages }}
    >
      {children}
    </NextIntlClientProvider>
  );
}

async function fillAndSubmitSchedule(onClose: ReturnType<typeof vi.fn>) {
  const user = userEvent.setup();
  renderWithMessages(
    <ScheduleMatchModal
      isOpen
      onClose={onClose}
      onMatchCreated={vi.fn()}
      teams={teams}
    />
  );

  fireEvent.change(screen.getByLabelText('Date'), {
    target: { value: '2026-08-15' },
  });
  fireEvent.change(screen.getByLabelText('Time'), {
    target: { value: '19:30' },
  });
  fireEvent.change(document.getElementById('location-title') as HTMLElement, {
    target: { value: 'Draft Hall' },
  });
  await user.selectOptions(screen.getAllByRole('combobox')[1], 'team-1');
  await user.type(screen.getByLabelText('Opponent Team'), 'Draft Visitors');
  await user.click(screen.getByRole('button', { name: 'Schedule Match' }));
}

async function editAndSubmitMatch(onClose: ReturnType<typeof vi.fn>) {
  const user = userEvent.setup();
  renderWithMessages(
    <EditMatchModal
      isOpen
      onClose={onClose}
      onMatchUpdated={vi.fn()}
      match={match}
      teams={teams}
    />
  );

  await waitFor(() =>
    expect(screen.getByLabelText('Opponent')).toHaveValue('Original Visitors')
  );
  await user.clear(screen.getByLabelText('Opponent'));
  await user.type(screen.getByLabelText('Opponent'), 'Draft Visitors');
  await user.click(screen.getByRole('button', { name: 'Update Match' }));
}

describe('manual Match command conflict feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the Schedule Match form open and populated after a duplicate conflict', async () => {
    mocks.createMatch.mockRejectedValue({
      response: {
        status: 409,
        data: { code: 'MATCH_SCHEDULE_DUPLICATE' },
      },
    });
    const onClose = vi.fn();

    await fillAndSubmitSchedule(onClose);

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        matchMessages.errors.duplicateSchedule
      )
    );
    expect(screen.getByLabelText('Date')).toHaveValue('2026-08-15');
    expect(screen.getByLabelText('Time')).toHaveValue('19:30');
    expect(document.getElementById('location-title')).toHaveValue('Draft Hall');
    expect(screen.getByLabelText('Opponent Team')).toHaveValue(
      'Draft Visitors'
    );
    expect(screen.getByText('Schedule New Match')).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the Schedule Match form open and uses stale-version feedback for an ordinary conflict', async () => {
    mocks.createMatch.mockRejectedValue({
      response: { status: 409, data: { code: 'CONFLICT' } },
    });
    const onClose = vi.fn();

    await fillAndSubmitSchedule(onClose);

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(matchMessages.errors.conflict)
    );
    expect(screen.getByLabelText('Opponent Team')).toHaveValue(
      'Draft Visitors'
    );
    expect(screen.getByText('Schedule New Match')).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the Edit Match draft open and populated after a duplicate conflict', async () => {
    mocks.updateMatch.mockRejectedValue({
      response: {
        status: 409,
        data: { code: 'MATCH_SCHEDULE_DUPLICATE' },
      },
    });
    const onClose = vi.fn();

    await editAndSubmitMatch(onClose);

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        matchMessages.errors.duplicateSchedule
      )
    );
    expect(screen.getByLabelText('Opponent')).toHaveValue('Draft Visitors');
    expect(screen.getByText('Edit Match')).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the Edit Match draft open and uses stale-version feedback for an ordinary conflict', async () => {
    mocks.updateMatch.mockRejectedValue({
      response: { status: 409, data: { code: 'CONFLICT' } },
    });
    const onClose = vi.fn();

    await editAndSubmitMatch(onClose);

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(matchMessages.errors.conflict)
    );
    expect(screen.getByLabelText('Opponent')).toHaveValue('Draft Visitors');
    expect(screen.getByText('Edit Match')).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });
});
