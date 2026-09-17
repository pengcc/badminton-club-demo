import React, { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api } from '@club/shared-types/api/match';
import {
  Gender,
  MatchAvailabilityParticipation,
  MatchDirection,
} from '@club/shared-types/core/enums';
import type { MatchView } from '@club/shared-types/view/match';
import type { Player } from '../../lib/types';
import matchMessages from '../../../messages/en/match.json';

const matchId = '507f1f77bcf86cd799439011';
const playerId = '507f1f77bcf86cd799439012';

const mocks = vi.hoisted(() => ({
  match: null as MatchView.MatchDetails | null,
  context: null as Api.LineupContextResponse | null,
  closeDetails: vi.fn(),
}));

vi.mock('../../services/matchService', () => ({
  MatchService: {
    useMatchDetails: () => ({
      data: mocks.match,
      isLoading: false,
      isError: false,
      isRefetchError: false,
      isFetching: false,
      refetch: vi.fn(),
    }),
    useLineupContext: () => ({
      data: mocks.context,
      isLoading: false,
      isError: false,
      isRefetchError: false,
      isFetching: false,
      refetch: vi.fn(),
    }),
    useUpdateLineup: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
    useSetMatchAvailability: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
  },
}));

vi.mock('../../components/Dashboard/PlayerAvailability', () => ({
  default: () => <div>Availability</div>,
}));

vi.mock('../../components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
  }) => (
    <select
      aria-label="Lineup slot"
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      <option value="__empty__">Empty slot</option>
      <option value={playerId}>Eligible Player</option>
    </select>
  ),
  SelectContent: () => null,
  SelectItem: () => null,
  SelectTrigger: () => null,
  SelectValue: () => null,
}));

import MatchDetailsModal from '../../components/Dashboard/modals/MatchDetailsModal';

function match(): MatchView.MatchDetails {
  return {
    id: matchId,
    version: 0,
    teamId: '507f1f77bcf86cd799439013',
    opponentName: 'Visitors',
    direction: MatchDirection.HOME,
    startAt: '2099-08-01T10:00:00.000Z',
    localStart: {
      date: '2099-08-01',
      time: '12:00',
      timeZone: 'Europe/Berlin',
    },
    location: 'Hall',
    lineup: [],
    lineupWarnings: [],
    availability: [],
    createdById: '507f1f77bcf86cd799439014',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    clubTeamName: 'Home Team',
    scoreDisplay: '—',
  };
}

function context(): Api.LineupContextResponse {
  return {
    matchId,
    version: 0,
    lineup: [],
    lineupWarnings: [],
    candidates: [
      {
        playerId,
        playerName: 'Eligible Player',
        gender: Gender.MALE,
        singlesRanking: 1,
        doublesRanking: 2,
        participation: MatchAvailabilityParticipation.AVAILABLE,
      },
    ],
  };
}

function Harness() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open match details
      </button>
      <MatchDetailsModal
        isOpen={isOpen}
        onClose={() => {
          mocks.closeDetails();
          setIsOpen(false);
        }}
        matchId={matchId}
        players={[] as Player[]}
        teams={[]}
        isAdmin
      />
    </>
  );
}

function openModalCount(): number {
  return screen.queryAllByRole('dialog').length;
}

describe('Match Lineup modal flow', () => {
  beforeEach(() => {
    mocks.match = match();
    mocks.context = context();
    mocks.closeDetails.mockReset();
  });

  it('keeps one real Modal owner and lets the editor handle Escape before Match Details', async () => {
    const user = userEvent.setup();
    const confirmDiscard = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <NextIntlClientProvider locale="en" messages={{ match: matchMessages }}>
        <Harness />
      </NextIntlClientProvider>
    );

    const trigger = screen.getByRole('button', { name: 'Open match details' });
    trigger.focus();
    await user.click(trigger);

    const detailsDialog = screen.getByRole('dialog', {
      name: 'Unknown Team vs Visitors',
    });
    expect(openModalCount()).toBe(1);
    expect(detailsDialog).toBeVisible();
    expect(detailsDialog).toContainElement(
      document.activeElement as HTMLElement
    );

    for (let step = 0; step < 6; step += 1) {
      await user.tab();
      expect(detailsDialog).toContainElement(
        document.activeElement as HTMLElement
      );
    }

    await user.click(screen.getByRole('button', { name: 'Edit Lineup' }));

    expect(openModalCount()).toBe(1);
    expect(
      screen.queryByRole('button', { name: 'Edit Lineup' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Match Lineup' })).toBeVisible();

    await user.selectOptions(screen.getAllByRole('combobox')[0], playerId);
    await user.keyboard('{Escape}');

    expect(confirmDiscard).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: 'Match Lineup' })).toBeVisible();
    expect(mocks.closeDetails).not.toHaveBeenCalled();
    expect(openModalCount()).toBe(1);

    confirmDiscard.mockReturnValue(true);
    await user.keyboard('{Escape}');

    expect(
      screen.queryByRole('dialog', { name: 'Match Lineup' })
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Edit Lineup' })).toHaveFocus()
    );
    expect(mocks.closeDetails).not.toHaveBeenCalled();
    expect(openModalCount()).toBe(1);
    expect(
      screen.getByRole('dialog', { name: 'Unknown Team vs Visitors' })
    ).toBeVisible();

    await user.keyboard('{Escape}');

    expect(mocks.closeDetails).toHaveBeenCalledTimes(1);
    expect(openModalCount()).toBe(0);
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
