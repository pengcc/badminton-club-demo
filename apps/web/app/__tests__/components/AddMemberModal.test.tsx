import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Gender, MembershipStatus } from '@club/shared-types/core/enums';
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

import AddMemberModal from '../../components/Dashboard/modals/AddMemberModal';

function renderModal(onMemberAdded = vi.fn(), onClose = vi.fn()) {
  const view = render(
    <NextIntlClientProvider locale="en" messages={{ dashboard, common }}>
      <AddMemberModal isOpen onClose={onClose} onMemberAdded={onMemberAdded} />
    </NextIntlClientProvider>
  );
  return { ...view, onMemberAdded, onClose };
}

async function fillRequiredFields(
  user: ReturnType<typeof userEvent.setup>,
  options: { gender?: boolean; dateOfBirth?: boolean } = {}
) {
  await user.type(screen.getByLabelText('First Name'), 'New');
  await user.type(screen.getByLabelText('Last Name'), 'Member');
  await user.type(screen.getByLabelText('Email Address'), 'new@example.test');
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
  mocks.randomUUID.mockReturnValue('stable-add-member-key');
  vi.stubGlobal('crypto', { randomUUID: mocks.randomUUID });
});

describe('AddMemberModal Account Onboarding intent', () => {
  it('projects text-field validation through the shared input contract', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Add Member' }));

    const firstName = screen.getByLabelText('First Name');
    expect(firstName).toHaveAttribute('aria-invalid', 'true');
    expect(firstName).toHaveAttribute('aria-describedby', 'firstName-error');
    expect(firstName).not.toHaveClass('border-red-500');
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('shows only active/passive Membership and no Role control', () => {
    renderModal();

    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Guest Player')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Active')).toBeInTheDocument();
    expect(screen.getByLabelText('Passive')).toBeInTheDocument();
    expect(screen.queryByLabelText('Inactive')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Suspended')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Establish a Player now')).not.toBeChecked();
    expect(
      screen.getByLabelText('Send password setup email now')
    ).not.toBeChecked();
    expect(screen.getByText(/Team assignment and ranking/)).toBeInTheDocument();
  });

  it('requires Gender before submitting the backend identity contract', async () => {
    const user = userEvent.setup();
    renderModal();
    await fillRequiredFields(user, { gender: false });

    await user.click(screen.getByRole('button', { name: 'Add Member' }));

    const gender = screen.getByRole('radiogroup', { name: 'Gender' });
    expect(gender).toHaveAttribute('aria-invalid', 'true');
    expect(gender).toHaveAttribute(
      'aria-describedby',
      'add-member-gender-error'
    );
    expect(screen.getByText('Gender is required')).toBeVisible();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('requires Birthday before submitting the backend identity contract', async () => {
    const user = userEvent.setup();
    renderModal();
    await fillRequiredFields(user, { dateOfBirth: false });

    await user.click(screen.getByRole('button', { name: 'Add Member' }));

    const birthday = screen.getByLabelText('Date of Birth');
    expect(birthday).toHaveAttribute('aria-invalid', 'true');
    expect(birthday).toHaveAttribute('aria-describedby');
    expect(screen.getByText('Date of birth is required')).toBeVisible();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it.each([
    [MembershipStatus.ACTIVE, false],
    [MembershipStatus.ACTIVE, true],
    [MembershipStatus.PASSIVE, false],
    [MembershipStatus.PASSIVE, true],
  ] as const)('submits %s Member establishment with establishPlayer=%s', async (initialMembershipStatus, establishPlayer) => {
    const user = userEvent.setup();
    const result = {
      userId: 'user-1',
      playerId: establishPlayer ? 'player-1' : undefined,
      targetKind: AccountOnboardingTargetKind.MEMBER,
      setupRequired: true,
      setupGeneration: 1,
      deliveryStatus: 'uncertain' as const,
      replayed: false,
    };
    mocks.mutateAsync.mockResolvedValue(result);
    const { onMemberAdded } = renderModal();

    await fillRequiredFields(user);
    if (initialMembershipStatus === MembershipStatus.PASSIVE) {
      await user.click(screen.getByLabelText('Passive'));
    }
    if (establishPlayer) {
      await user.click(screen.getByLabelText('Establish a Player now'));
    }
    await user.click(screen.getByRole('button', { name: 'Add Member' }));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledOnce());
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      request: expect.objectContaining({
        email: 'new@example.test',
        gender: Gender.FEMALE,
        dateOfBirth: '2000-01-01',
        targetKind: AccountOnboardingTargetKind.MEMBER,
        establishPlayer,
        initialMembershipStatus,
        setupLocale: 'de',
        sendPasswordSetupEmailNow: false,
      }),
      idempotencyKey: 'stable-add-member-key',
    });
    expect(onMemberAdded).toHaveBeenCalledWith(result);
    expect(mocks.success).toHaveBeenCalledOnce();
    expect(mocks.success).toHaveBeenCalledWith(
      'Member established. No password setup email was sent now.'
    );
    expect(mocks.warning).not.toHaveBeenCalled();
    expect(screen.getByText('Member task completed')).toBeInTheDocument();
    expect(
      screen.getByText(
        establishPlayer
          ? 'A Member Player is associated with this account.'
          : 'No Player was established for this Member.'
      )
    ).toBeInTheDocument();
  });

  it('sends the selected setup language as part of the exact intent', async () => {
    const user = userEvent.setup();
    mocks.mutateAsync.mockResolvedValue({
      userId: 'user-1',
      targetKind: AccountOnboardingTargetKind.MEMBER,
      setupRequired: true,
      setupGeneration: 1,
      deliveryStatus: 'sent',
      replayed: false,
    });
    renderModal();
    await fillRequiredFields(user);
    await selectSharedOption(user, 'Password setup email language', 'Chinese');
    await user.click(screen.getByRole('button', { name: 'Add Member' }));

    expect(mocks.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({ setupLocale: 'zh' }),
      })
    );
  });

  it('rotates the idempotency key when setup language changes after a failed attempt', async () => {
    const user = userEvent.setup();
    mocks.randomUUID
      .mockReturnValueOnce('german-setup-key')
      .mockReturnValueOnce('english-setup-key');
    mocks.mutateAsync.mockRejectedValue(new Error('request failed'));
    renderModal();
    await fillRequiredFields(user);

    await user.click(screen.getByRole('button', { name: 'Add Member' }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledOnce());
    await selectSharedOption(user, 'Password setup email language', 'English');
    await user.click(screen.getByRole('button', { name: 'Add Member' }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2));

    expect(mocks.mutateAsync.mock.calls[0][0]).toMatchObject({
      idempotencyKey: 'german-setup-key',
      request: { setupLocale: 'de' },
    });
    expect(mocks.mutateAsync.mock.calls[1][0]).toMatchObject({
      idempotencyKey: 'english-setup-key',
      request: { setupLocale: 'en' },
    });
  });

  it('preserves identity input and shows bounded review guidance on conflict', async () => {
    const user = userEvent.setup();
    mocks.mutateAsync.mockRejectedValue({ response: { status: 409 } });
    renderModal();
    await fillRequiredFields(user);

    await user.click(screen.getByRole('button', { name: 'Add Member' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A matching account needs administrator review.'
    );
    expect(screen.getByLabelText('Email Address')).toHaveValue(
      'new@example.test'
    );
    expect(screen.queryByText(/existing identity/i)).not.toBeInTheDocument();
  });

  it.each([
    ['sent', 'Password setup email sent.', 'success'],
    [
      'failed',
      'The Member was established, but email delivery failed. Recovery remains available in Member Management.',
      'error',
    ],
    [
      'uncertain',
      'The Member was established, but email delivery could not be confirmed. Check the Member row before reissuing.',
      'warning',
    ],
  ] as const)('reports the committed result separately from %s delivery', async (deliveryStatus, expectedText, toastKind) => {
    const user = userEvent.setup();
    mocks.mutateAsync.mockResolvedValue({
      userId: 'user-1',
      targetKind: AccountOnboardingTargetKind.MEMBER,
      setupRequired: true,
      setupGeneration: 1,
      deliveryStatus,
      replayed: false,
    });
    renderModal();
    await fillRequiredFields(user);
    await user.click(screen.getByLabelText('Send password setup email now'));

    await user.click(screen.getByRole('button', { name: 'Add Member' }));

    expect(await screen.findByText('Member task completed')).toBeVisible();
    expect(screen.getByText(expectedText)).toBeVisible();
    expect(mocks[toastKind]).toHaveBeenCalledOnce();
  });

  it('reports deliberate setup delivery deferral as a successful choice', async () => {
    const user = userEvent.setup();
    mocks.mutateAsync.mockResolvedValue({
      userId: 'user-1',
      targetKind: AccountOnboardingTargetKind.MEMBER,
      setupRequired: true,
      setupGeneration: 0,
      replayed: false,
    });
    renderModal();
    await fillRequiredFields(user);

    await user.click(screen.getByRole('button', { name: 'Add Member' }));

    expect(
      await screen.findByText(
        'No password setup email was sent now. You can send it later from Member Management.'
      )
    ).toBeVisible();
    expect(mocks.success).toHaveBeenCalledWith(
      'Member established. No password setup email was sent now.'
    );
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.warning).not.toHaveBeenCalled();
  });

  it('reports when a reused account does not require setup', async () => {
    const user = userEvent.setup();
    mocks.mutateAsync.mockResolvedValue({
      userId: 'user-1',
      targetKind: AccountOnboardingTargetKind.MEMBER,
      setupRequired: false,
      replayed: false,
    });
    renderModal();
    await fillRequiredFields(user);

    await user.click(screen.getByRole('button', { name: 'Add Member' }));

    expect(
      await screen.findByText(
        'Password setup is already complete for this account.'
      )
    ).toBeVisible();
    expect(mocks.success).toHaveBeenCalledOnce();
  });

  it('keeps the idempotency key for an unchanged retry after failure', async () => {
    const user = userEvent.setup();
    mocks.mutateAsync
      .mockRejectedValueOnce(new Error('request failed'))
      .mockRejectedValueOnce(new Error('request failed again'));
    renderModal();
    await fillRequiredFields(user);

    await user.click(screen.getByRole('button', { name: 'Add Member' }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Add Member' }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2));

    expect(mocks.mutateAsync.mock.calls[0][0].idempotencyKey).toBe(
      'stable-add-member-key'
    );
    expect(mocks.mutateAsync.mock.calls[1][0].idempotencyKey).toBe(
      'stable-add-member-key'
    );
    expect(mocks.randomUUID).toHaveBeenCalledOnce();
  });

  it('uses a new idempotency key after the failed intent is edited', async () => {
    const user = userEvent.setup();
    mocks.randomUUID
      .mockReturnValueOnce('first-add-member-key')
      .mockReturnValueOnce('edited-add-member-key');
    mocks.mutateAsync
      .mockRejectedValueOnce(new Error('request failed'))
      .mockRejectedValueOnce(new Error('edited request failed'));
    renderModal();
    await fillRequiredFields(user);

    await user.click(screen.getByRole('button', { name: 'Add Member' }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    await user.type(screen.getByLabelText('First Name'), 'er');
    await user.click(screen.getByRole('button', { name: 'Add Member' }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2));

    expect(mocks.mutateAsync.mock.calls[0][0].idempotencyKey).toBe(
      'first-add-member-key'
    );
    expect(mocks.mutateAsync.mock.calls[1][0].idempotencyKey).toBe(
      'edited-add-member-key'
    );
  });

  it('uses a new idempotency key when the optional Player choice changes', async () => {
    const user = userEvent.setup();
    mocks.randomUUID
      .mockReturnValueOnce('member-only-key')
      .mockReturnValueOnce('member-player-key');
    mocks.mutateAsync
      .mockRejectedValueOnce(new Error('request failed'))
      .mockRejectedValueOnce(new Error('edited request failed'));
    renderModal();
    await fillRequiredFields(user);

    await user.click(screen.getByRole('button', { name: 'Add Member' }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    await user.click(screen.getByLabelText('Establish a Player now'));
    await user.click(screen.getByRole('button', { name: 'Add Member' }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2));

    expect(mocks.mutateAsync.mock.calls[0][0]).toMatchObject({
      idempotencyKey: 'member-only-key',
      request: { establishPlayer: false },
    });
    expect(mocks.mutateAsync.mock.calls[1][0]).toMatchObject({
      idempotencyKey: 'member-player-key',
      request: { establishPlayer: true },
    });
  });

  it('uses a new idempotency key when the immediate-delivery choice changes', async () => {
    const user = userEvent.setup();
    mocks.randomUUID
      .mockReturnValueOnce('deferred-key')
      .mockReturnValueOnce('send-now-key');
    mocks.mutateAsync.mockRejectedValue(new Error('request failed'));
    renderModal();
    await fillRequiredFields(user);

    await user.click(screen.getByRole('button', { name: 'Add Member' }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledOnce());
    await user.click(screen.getByLabelText('Send password setup email now'));
    await user.click(screen.getByRole('button', { name: 'Add Member' }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2));

    expect(mocks.mutateAsync.mock.calls[0][0]).toMatchObject({
      idempotencyKey: 'deferred-key',
      request: { sendPasswordSetupEmailNow: false },
    });
    expect(mocks.mutateAsync.mock.calls[1][0]).toMatchObject({
      idempotencyKey: 'send-now-key',
      request: { sendPasswordSetupEmailNow: true },
    });
  });

  it('distinguishes an unresolved no-response outcome from received failures', async () => {
    const user = userEvent.setup();
    mocks.mutateAsync.mockRejectedValue(new Error('socket closed'));
    renderModal();
    await fillRequiredFields(user);

    await user.click(screen.getByRole('button', { name: 'Add Member' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The result could not be confirmed after a safe retry.'
    );
    expect(screen.getByLabelText('Email Address')).toHaveValue(
      'new@example.test'
    );
  });

  it('preserves the submitted intent and close boundary through an unresolved retry', async () => {
    const user = userEvent.setup();
    let resolveRetry!: (value: unknown) => void;
    mocks.mutateAsync
      .mockRejectedValueOnce(new Error('socket closed'))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRetry = resolve;
          })
      );
    const { onClose } = renderModal();
    await fillRequiredFields(user);
    await user.click(screen.getByLabelText('Send password setup email now'));

    await user.click(screen.getByRole('button', { name: 'Add Member' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The result could not be confirmed after a safe retry.'
    );
    await user.click(screen.getByRole('button', { name: 'Add Member' }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2));

    const firstName = screen.getByLabelText('First Name');
    const close = screen.getByRole('button', { name: 'Cancel Add New Member' });
    expect(firstName).toBeDisabled();
    expect(close).toBeDisabled();
    await user.type(firstName, 'Changed');
    await user.click(close);
    expect(firstName).toHaveValue('New');
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.mutateAsync.mock.calls[1][0]).toEqual(
      mocks.mutateAsync.mock.calls[0][0]
    );

    resolveRetry({
      userId: 'user-1',
      targetKind: AccountOnboardingTargetKind.MEMBER,
      setupRequired: true,
      setupGeneration: 1,
      deliveryStatus: 'sent',
      replayed: true,
    });

    expect(await screen.findByText('Password setup email sent.')).toBeVisible();
  });

  it('gives truthful guidance for a backend-only name validation rejection', async () => {
    const user = userEvent.setup();
    mocks.mutateAsync.mockRejectedValue({ response: { status: 400 } });
    renderModal();
    await fillRequiredFields(user);
    const firstName = screen.getByLabelText('First Name');
    await user.clear(firstName);
    await user.type(firstName, 'A');

    await user.click(screen.getByRole('button', { name: 'Add Member' }));

    expect(mocks.mutateAsync).toHaveBeenCalledOnce();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The server rejected one or more Member details. Check that first and last names contain 2–50 characters'
    );
    expect(firstName).toHaveAttribute('aria-invalid', 'false');
    expect(firstName).not.toHaveAttribute('aria-describedby');
  });

  it('clears the retained idempotency key when the form is closed', async () => {
    const user = userEvent.setup();
    mocks.mutateAsync.mockRejectedValueOnce(new Error('request failed'));
    const { onClose } = renderModal();
    await fillRequiredFields(user);

    await user.click(screen.getByRole('button', { name: 'Add Member' }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledOnce());
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledOnce();
    mocks.randomUUID.mockReturnValue('new-form-key');
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add Member' }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2));
    expect(mocks.mutateAsync.mock.calls[1][0].idempotencyKey).toBe(
      'new-form-key'
    );
  });
});
