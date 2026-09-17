import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamLevel } from '@club/shared-types/core/enums';
import dashboard from '../../../messages/en/dashboard.json';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@app/services/teamService', () => ({
  TeamService: {
    useCreateTeam: () => ({ mutateAsync: mocks.create }),
    useUpdateTeam: () => ({ mutateAsync: mocks.update }),
  },
}));

import CreateTeamModal from '@app/components/Dashboard/modals/CreateTeamModal';
import EditTeamModal from '@app/components/Dashboard/modals/EditTeamModal';

function renderCreate() {
  render(
    <NextIntlClientProvider locale="en" messages={{ dashboard }}>
      <CreateTeamModal isOpen onClose={vi.fn()} />
    </NextIntlClientProvider>
  );
}

function renderEdit(matchLevel: unknown) {
  render(
    <NextIntlClientProvider locale="en" messages={{ dashboard }}>
      <EditTeamModal
        isOpen
        onClose={vi.fn()}
        team={{
          id: '507f1f77bcf86cd799439011',
          teamId: 't1',
          shortName: 'DCBV I',
          leagueTeamName: 'DCBV I',
          matchLevel,
        }}
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
  mocks.create.mockResolvedValue({});
  mocks.update.mockResolvedValue({});
});

describe('Team class modals', () => {
  it('requires an explicit canonical class and submits the letter value', async () => {
    const user = userEvent.setup();
    renderCreate();

    const classSelect = screen.getByRole('combobox', { name: 'Match Level' });
    expect(classSelect).toHaveTextContent('Match Level');
    expect(classSelect).toHaveClass('w-full');
    expect(classSelect).toHaveAttribute('aria-required', 'true');

    await user.type(screen.getByLabelText('Team ID'), 't3');
    await user.type(screen.getByLabelText('Team Name'), 'DCBV III');
    await user.type(screen.getByLabelText('Official league name'), 'DCBV III');
    await user.click(screen.getByRole('button', { name: 'Create Team' }));

    expect(screen.getByText('Match level is required')).toBeVisible();
    expect(mocks.create).not.toHaveBeenCalled();

    await user.click(classSelect);
    expect(
      screen.getAllByRole('option').map((option) => option.textContent)
    ).toEqual([
      'A-Klasse',
      'B-Klasse',
      'C-Klasse',
      'D-Klasse',
      'E-Klasse',
      'F-Klasse',
      'G-Klasse',
    ]);
    await user.click(screen.getByRole('option', { name: 'B-Klasse' }));
    await user.click(screen.getByRole('button', { name: 'Create Team' }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create).toHaveBeenCalledWith({
      teamId: 't3',
      shortName: 'DCBV III',
      leagueTeamName: 'DCBV III',
      matchLevel: TeamLevel.B,
    });
  });

  it('shows a persisted canonical class as selected and submits a changed letter', async () => {
    const user = userEvent.setup();
    renderEdit(TeamLevel.B);

    const classSelect = screen.getByRole('combobox', { name: 'Match Level' });
    expect(classSelect).toHaveTextContent('B-Klasse');
    expect(classSelect).toHaveClass('w-full');

    await user.click(classSelect);
    await user.click(screen.getByRole('option', { name: 'D-Klasse' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update).toHaveBeenCalledWith({
      id: '507f1f77bcf86cd799439011',
      formData: {
        shortName: 'DCBV I',
        leagueTeamName: 'DCBV I',
        matchLevel: TeamLevel.D,
      },
    });
  });

  it('does not map a stale persisted class to a canonical selection', async () => {
    const user = userEvent.setup();
    renderEdit('Class C');

    const classSelect = screen.getByRole('combobox', { name: 'Match Level' });
    expect(classSelect).toHaveTextContent('Match Level');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Match level is required')).toBeVisible();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
