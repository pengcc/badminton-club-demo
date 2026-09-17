import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordRecoveryRequestClient from '@app/components/Login/PasswordRecoveryRequestClient';
import ResetPasswordClient from '@app/components/Login/ResetPasswordClient';
import { renderWithIntl, screen } from '../utils/renderWithIntl';
import * as authApi from '@app/lib/api/authApi';
import passwordRecovery from '../../../messages/en/passwordRecovery.json';

const messages = { passwordRecovery };

describe('password recovery UI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/en/forgot-password');
  });

  it.each([
    false,
    true,
  ])('presents the same public confirmation regardless of request outcome', async (fails) => {
    const requestRecovery = vi.spyOn(authApi, 'requestPasswordRecovery');
    if (fails) requestRecovery.mockRejectedValue(new Error('delivery failed'));
    else requestRecovery.mockResolvedValue();
    renderWithIntl(<PasswordRecoveryRequestClient />, { messages });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'member@example.test');
    await user.click(
      screen.getByRole('button', { name: 'Request recovery link' })
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      passwordRecovery.genericConfirmation
    );
    expect(requestRecovery).toHaveBeenCalledWith({
      email: 'member@example.test',
      locale: 'en',
    });
  });

  it('reads the fragment token, validates it, resets once, and returns to normal login', async () => {
    window.history.replaceState(
      null,
      '',
      '/en/reset-password#token=test-token'
    );
    vi.spyOn(authApi, 'getPasswordRecoveryStatus').mockResolvedValue(true);
    const reset = vi
      .spyOn(authApi, 'resetRecoveredPassword')
      .mockResolvedValue();
    renderWithIntl(<ResetPasswordClient />, { messages });
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Reset password' });
    await user.type(screen.getByLabelText('New password'), 'Password1!');
    await user.type(screen.getByLabelText('Confirm password'), 'Password1!');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(reset).toHaveBeenCalledWith({
      token: 'test-token',
      password: 'Password1!',
      passwordConfirmation: 'Password1!',
    });
    expect(
      await screen.findByRole('link', { name: 'Go to login' })
    ).toHaveAttribute('href', '/en/login');
    expect(window.location.hash).toBe('');
  });

  it('never presents the form for an invalid link', async () => {
    window.history.replaceState(
      null,
      '',
      '/en/reset-password#token=test-stale-token'
    );
    vi.spyOn(authApi, 'getPasswordRecoveryStatus').mockResolvedValue(false);
    renderWithIntl(<ResetPasswordClient />, { messages });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      passwordRecovery.invalid
    );
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('moves to invalid guidance when the token changes after status validation', async () => {
    window.history.replaceState(
      null,
      '',
      '/en/reset-password#token=test-racing-token'
    );
    vi.spyOn(authApi, 'getPasswordRecoveryStatus').mockResolvedValue(true);
    vi.spyOn(authApi, 'resetRecoveredPassword').mockRejectedValue(
      new Error('stale')
    );
    renderWithIntl(<ResetPasswordClient />, { messages });
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Reset password' });
    await user.type(screen.getByLabelText('New password'), 'Password1!');
    await user.type(screen.getByLabelText('Confirm password'), 'Password1!');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      passwordRecovery.invalid
    );
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });
});
