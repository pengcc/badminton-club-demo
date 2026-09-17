import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Gender } from '@club/shared-types/core/enums';
import { AccountOnboardingTargetKind } from '@club/shared-types/domain/accountOnboarding';
import dashboard from '../../../messages/en/dashboard.json';
import common from '../../../messages/en/common.json';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  randomUUID: vi.fn(),
}));

vi.mock('../../services/userService', () => ({
  UserService: {
    useEstablishAccount: () => ({ mutateAsync: mocks.mutateAsync }),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: mocks.success,
    error: mocks.error,
    warning: mocks.warning,
  },
}));

import AddExternalPlayerModal from '../../components/Dashboard/modals/AddExternalPlayerModal';

function renderModal(onExternalPlayerAdded = vi.fn(), onClose = vi.fn()) {
  const view = render(
    <NextIntlClientProvider locale="en" messages={{ dashboard, common }}>
      <AddExternalPlayerModal
        isOpen
        onClose={onClose}
        onExternalPlayerAdded={onExternalPlayerAdded}
      />
    </NextIntlClientProvider>
  );
  return { ...view, onExternalPlayerAdded, onClose };
}

async function fillIdentity(
  user: ReturnType<typeof userEvent.setup>,
  options: { gender?: boolean; dateOfBirth?: boolean } = {}
) {
  await user.type(screen.getByLabelText('First Name'), 'External');
  await user.type(screen.getByLabelText('Last Name'), 'Player');
  await user.type(
    screen.getByLabelText('Email Address'),
    'external@example.test'
  );
  if (options.gender !== false) {
    await user.click(screen.getByLabelText('Female'));
  }
  if (options.dateOfBirth !== false) {
    await user.click(screen.getByLabelText('Date of Birth'));
    await user.click(screen.getByRole('button', { name: '2000' }));
  }
}

async function selectSharedOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string
) {
  await user.click(screen.getByLabelText(label));
  await user.click(screen.getByRole('option', { name: option }));
}

beforeEach(() => {
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
  vi.clearAllMocks();
  mocks.randomUUID.mockReturnValue('stable-external-player-key');
  vi.stubGlobal('crypto', { randomUUID: mocks.randomUUID });
});

describe('AddExternalPlayerModal Account Onboarding intent', () => {
  it('exposes only the External Player identity task', () => {
    renderModal();

    expect(screen.getAllByText('Add External Player')).not.toHaveLength(0);
    expect(screen.getByText(/without Membership/)).toBeVisible();
    expect(screen.queryByText('Membership Details')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Active')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Passive')).not.toBeInTheDocument();
    expect(screen.queryByText('Role')).not.toBeInTheDocument();
    expect(screen.queryByText('Teams')).not.toBeInTheDocument();
    expect(screen.queryByText('Ranking')).not.toBeInTheDocument();
  });

  it.each([
    ['Gender', { gender: false }, 'Gender is required'],
    ['Date of Birth', { dateOfBirth: false }, 'Date of birth is required'],
  ] as const)('requires %s before calling the command', async (_field, options, message) => {
    const user = userEvent.setup();
    renderModal();
    await fillIdentity(user, options);

    await user.click(
      screen.getByRole('button', { name: 'Add External Player' })
    );

    expect(screen.getByText(message)).toBeVisible();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('submits the exact fixed External Player intent', async () => {
    const user = userEvent.setup();
    const result = {
      userId: 'user-1',
      playerId: 'player-1',
      targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
      setupRequired: true,
      setupGeneration: 1,
      deliveryStatus: 'sent' as const,
      replayed: false,
    };
    mocks.mutateAsync.mockResolvedValue(result);
    const { onExternalPlayerAdded } = renderModal();
    await fillIdentity(user);

    await user.click(
      screen.getByRole('button', { name: 'Add External Player' })
    );

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledOnce());
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      request: {
        firstName: 'External',
        lastName: 'Player',
        email: 'external@example.test',
        gender: Gender.FEMALE,
        dateOfBirth: '2000-01-01',
        targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
        establishPlayer: true,
        setupLocale: 'de',
      },
      idempotencyKey: 'stable-external-player-key',
    });
    expect(onExternalPlayerAdded).toHaveBeenCalledWith(result);
    expect(screen.getByText('External Player task completed')).toBeVisible();
    expect(screen.getByText(/without Membership/)).toBeVisible();
  });

  it('preserves the full identity intent and idempotency key for an unchanged retry', async () => {
    const user = userEvent.setup();
    mocks.mutateAsync
      .mockRejectedValueOnce({ response: { status: 409 } })
      .mockRejectedValueOnce(new Error('request failed'));
    renderModal();
    await fillIdentity(user);

    await user.click(
      screen.getByRole('button', { name: 'Add External Player' })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'needs administrator review'
    );
    expect(screen.getByLabelText('Email Address')).toHaveValue(
      'external@example.test'
    );
    await user.click(
      screen.getByRole('button', { name: 'Add External Player' })
    );
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2));

    expect(mocks.mutateAsync.mock.calls[0][0].idempotencyKey).toBe(
      'stable-external-player-key'
    );
    expect(mocks.mutateAsync.mock.calls[1][0].idempotencyKey).toBe(
      'stable-external-player-key'
    );
  });

  it('sends setup language and rotates the key when that failed intent changes', async () => {
    const user = userEvent.setup();
    mocks.randomUUID
      .mockReturnValueOnce('german-external-key')
      .mockReturnValueOnce('chinese-external-key');
    mocks.mutateAsync.mockRejectedValue(new Error('request failed'));
    renderModal();
    await fillIdentity(user);

    await user.click(
      screen.getByRole('button', { name: 'Add External Player' })
    );
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledOnce());
    await selectSharedOption(user, 'Password setup email language', 'Chinese');
    await user.click(
      screen.getByRole('button', { name: 'Add External Player' })
    );
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2));

    expect(mocks.mutateAsync.mock.calls[0][0]).toMatchObject({
      idempotencyKey: 'german-external-key',
      request: { setupLocale: 'de' },
    });
    expect(mocks.mutateAsync.mock.calls[1][0]).toMatchObject({
      idempotencyKey: 'chinese-external-key',
      request: { setupLocale: 'zh' },
    });
  });

  it('rotates the idempotency key when the failed identity intent changes', async () => {
    const user = userEvent.setup();
    mocks.randomUUID
      .mockReturnValueOnce('first-external-player-key')
      .mockReturnValueOnce('edited-external-player-key');
    mocks.mutateAsync.mockRejectedValue(new Error('request failed'));
    renderModal();
    await fillIdentity(user);

    await user.click(
      screen.getByRole('button', { name: 'Add External Player' })
    );
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.getByLabelText('First Name')).toBeEnabled()
    );
    await user.type(screen.getByLabelText('First Name'), ' Updated');
    await user.click(
      screen.getByRole('button', { name: 'Add External Player' })
    );
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2));

    expect(mocks.mutateAsync.mock.calls[1][0].idempotencyKey).toBe(
      'edited-external-player-key'
    );
  });

  it('does not imply cancellation by closing while establishment is pending', async () => {
    const user = userEvent.setup();
    mocks.mutateAsync.mockReturnValue(new Promise(() => {}));
    const { onClose } = renderModal();
    await fillIdentity(user);

    await user.click(
      screen.getByRole('button', { name: 'Add External Player' })
    );
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledOnce());

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Cancel Add External Player' })
    ).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('freezes the submitted identity and retains its idempotency key while pending', async () => {
    const user = userEvent.setup();
    let rejectPending: (reason?: unknown) => void = () => {};
    mocks.mutateAsync
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectPending = reject;
          })
      )
      .mockRejectedValueOnce(new Error('retry failed'));
    renderModal();
    await fillIdentity(user);

    await user.click(
      screen.getByRole('button', { name: 'Add External Player' })
    );
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledOnce());

    const firstName = screen.getByLabelText('First Name');
    const female = screen.getByLabelText('Female');
    const male = screen.getByLabelText('Male');
    const birthdayYear = screen.getByRole('combobox', {
      name: 'Date of Birth',
    });

    expect(firstName).toBeDisabled();
    expect(female).toBeDisabled();
    expect(male).toBeDisabled();
    expect(birthdayYear).toBeDisabled();
    await user.type(firstName, ' Changed');
    await user.click(male);
    await user.click(birthdayYear);
    expect(firstName).toHaveValue('External');
    expect(female).toBeChecked();
    expect(male).not.toBeChecked();
    expect(birthdayYear).toHaveTextContent('2000');

    await act(async () => rejectPending(new Error('request failed')));
    await screen.findByRole('alert');
    await user.click(
      screen.getByRole('button', { name: 'Add External Player' })
    );
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2));

    expect(mocks.randomUUID).toHaveBeenCalledOnce();
    expect(mocks.mutateAsync.mock.calls[0][0].idempotencyKey).toBe(
      'stable-external-player-key'
    );
    expect(mocks.mutateAsync.mock.calls[1][0].idempotencyKey).toBe(
      'stable-external-player-key'
    );
  });

  it.each([
    ['sent', 'Password setup email sent.', 'success'],
    [
      'failed',
      'The External Player was established, but email delivery failed. Recovery remains available in Player Management.',
      'error',
    ],
    [
      'uncertain',
      'The External Player was established, but email delivery could not be confirmed. Check the Player row before reissuing.',
      'warning',
    ],
  ] as const)('reports the durable result separately from %s delivery', async (deliveryStatus, expectedText, toastKind) => {
    const user = userEvent.setup();
    mocks.mutateAsync.mockResolvedValue({
      userId: 'user-1',
      playerId: 'player-1',
      targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
      setupRequired: true,
      setupGeneration: 1,
      deliveryStatus,
      replayed: false,
    });
    renderModal();
    await fillIdentity(user);

    await user.click(
      screen.getByRole('button', { name: 'Add External Player' })
    );

    expect(await screen.findByText(expectedText)).toBeVisible();
    expect(mocks[toastKind]).toHaveBeenCalledOnce();
  });

  it('reports compatible canonical User reuse without promising setup delivery', async () => {
    const user = userEvent.setup();
    mocks.mutateAsync.mockResolvedValue({
      userId: 'user-1',
      playerId: 'player-1',
      targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
      setupRequired: false,
      setupGeneration: 2,
      replayed: false,
    });
    renderModal();
    await fillIdentity(user);

    await user.click(
      screen.getByRole('button', { name: 'Add External Player' })
    );

    expect(
      await screen.findByText(
        'Password setup is already complete for this account.'
      )
    ).toBeVisible();
    expect(mocks.success).toHaveBeenCalledWith(
      'External Player established. The existing account credentials remain active.'
    );
  });
});
