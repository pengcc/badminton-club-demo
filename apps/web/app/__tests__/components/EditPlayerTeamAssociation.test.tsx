import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Gender,
  MembershipStatus,
  PlayerType,
  TeamLevel,
} from '@club/shared-types/core/enums';
import type { PlayerView } from '@club/shared-types/view/player';
import type { TeamView } from '@club/shared-types/view/team';
import dashboard from '../../../messages/en/dashboard.json';

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  batchUpdate: vi.fn(),
  participation: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../services/playerService', () => ({
  PlayerService: {
    useUpdatePlayer: () => ({
      mutateAsync: mocks.update,
      isPending: false,
    }),
    useBatchUpdatePlayers: () => ({
      mutateAsync: mocks.batchUpdate,
      isPending: false,
    }),
    useSetPlayerParticipation: () => ({
      mutateAsync: mocks.participation,
      isPending: false,
    }),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: mocks.success,
    error: mocks.error,
  },
}));

import EditPlayerModal from '../../components/Dashboard/modals/EditPlayerModal';

const currentTeamId = '507f1f77bcf86cd799439013';
const newTeamId = '507f1f77bcf86cd799439014';

const player: PlayerView.PlayerCard = {
  id: '507f1f77bcf86cd799439011',
  userId: '507f1f77bcf86cd799439012',
  type: PlayerType.EXTERNAL,
  userName: 'External Player',
  userEmail: 'external@example.test',
  userGender: Gender.FEMALE,
  singlesRanking: 0,
  doublesRanking: 0,
  rankingDisplay: '0/0',
  isActivePlayer: true,
  isEffectivelyEligible: true,
  teamIds: [currentTeamId],
  matchCount: 0,
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
  displayName: 'External Player',
  teams: [],
};

function team(id: string, shortName: string): TeamView.TeamCard {
  return {
    id,
    teamId: shortName.toLowerCase().replaceAll(' ', ''),
    shortName,
    leagueTeamName: `${shortName} League`,
    matchLevel: TeamLevel.C,
    createdById: '507f1f77bcf86cd799439015',
    playerIds: [],
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
    playerCount: 0,
    players: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
  mocks.batchUpdate.mockResolvedValue({ updatedCount: 1 });
  mocks.participation.mockResolvedValue(player);
});

function renderModal(overrides?: {
  onClose?: () => void;
  onPlayerUpdated?: (updatedPlayer: PlayerView.PlayerCard) => void;
  player?: PlayerView.PlayerCard;
}) {
  const onClose = overrides?.onClose ?? vi.fn();
  const onPlayerUpdated = overrides?.onPlayerUpdated ?? vi.fn();

  render(
    <NextIntlClientProvider locale="en" messages={{ dashboard }}>
      <EditPlayerModal
        isOpen
        onClose={onClose}
        player={overrides?.player ?? player}
        teams={[
          team(currentTeamId, 'Current Team'),
          team(newTeamId, 'New Team'),
        ]}
        onPlayerUpdated={onPlayerUpdated}
      />
    </NextIntlClientProvider>
  );

  return { onClose, onPlayerUpdated };
}

async function stageTeamReplacement(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('button', { name: 'Remove from Current Team' })
  );
  await user.click(screen.getByRole('button', { name: 'Confirm removal' }));
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Remove from Current Team' })
    ).not.toBeInTheDocument()
  );
  await user.click(screen.getByRole('combobox'));
  await user.click(screen.getByRole('option', { name: /New Team/ }));
  await user.click(screen.getByRole('button', { name: 'Add to Team' }));
}

describe('EditPlayerModal Team association command', () => {
  it('gives the header Close action a localized name and decorative icon', () => {
    renderModal();

    const dialog = screen.getByRole('dialog', {
      name: 'Edit player External Player',
    });
    const closeButton = screen.getByRole('button', { name: 'Close' });

    expect(dialog).toContainElement(closeButton);
    expect(closeButton.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
  });

  it('confirms removal and submits the complete Team diff through one batch command', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(
      screen.getByRole('button', { name: 'Remove from Current Team' })
    );
    expect(
      screen.getByText(
        'Remove this Player from Current Team? Existing Match references will be retained.'
      )
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Confirm removal' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Remove from Current Team' })
      ).not.toBeInTheDocument()
    );
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /New Team/ }));
    await user.click(screen.getByRole('button', { name: 'Add to Team' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(mocks.batchUpdate).toHaveBeenCalledOnce());
    expect(mocks.batchUpdate).toHaveBeenCalledWith({
      playerIds: [player.id],
      updates: {
        addToTeams: [newTeamId],
        removeFromTeams: [currentTeamId],
      },
    });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith(
      'Saved Team associations for 1 player(s).'
    );
  });

  it('reports a ranking-only failure as a Player ranking error', async () => {
    const user = userEvent.setup();
    mocks.update.mockRejectedValueOnce(new Error('private transport detail'));
    const { onClose } = renderModal();

    const [singlesRanking] = screen.getAllByRole('spinbutton');
    await user.clear(singlesRanking);
    await user.type(singlesRanking, '1200');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        'Player rankings could not be saved. Your input was kept so you can try again.'
      )
    );
    expect(mocks.batchUpdate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('reports an eligibility-only failure as a Player eligibility error', async () => {
    const user = userEvent.setup();
    mocks.participation.mockRejectedValueOnce(
      new Error('private transport detail')
    );
    const { onClose } = renderModal();

    const statusToggle = screen
      .getAllByRole('button')
      .find((button) => button.querySelector('.lucide-toggle-right'));
    expect(statusToggle).toBeDefined();
    await user.click(statusToggle!);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        'Player eligibility could not be updated. Your input was kept so you can try again.'
      )
    );
    expect(mocks.update).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('reports partial success and retries only the retained Team command', async () => {
    const user = userEvent.setup();
    mocks.update.mockResolvedValueOnce(player);
    mocks.batchUpdate.mockRejectedValueOnce(
      new Error('private transport detail')
    );
    renderModal();

    const [singlesRanking] = screen.getAllByRole('spinbutton');
    await user.clear(singlesRanking);
    await user.type(singlesRanking, '1200');
    await stageTeamReplacement(user);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        'Player rankings were saved, but Team associations could not be updated. Your Team selection was kept so you can try again.'
      )
    );
    expect(
      screen.getByRole('button', { name: 'Remove from New Team' })
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(mocks.batchUpdate).toHaveBeenCalledTimes(2));
    expect(mocks.update).toHaveBeenCalledOnce();
  });

  it('keeps a Team-only selection after the Team command fails', async () => {
    const user = userEvent.setup();
    mocks.batchUpdate.mockRejectedValueOnce({
      response: { status: 409 },
    });
    const { onClose } = renderModal();

    await stageTeamReplacement(user);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        'Team associations changed before this request completed. Your selection was kept; review it and try again.'
      )
    );
    expect(
      screen.getByRole('button', { name: 'Remove from New Team' })
    ).toBeVisible();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
