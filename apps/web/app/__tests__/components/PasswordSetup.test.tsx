import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordSetupClient from '@app/components/Login/PasswordSetupClient';
import { renderWithIntl, screen } from '../utils/renderWithIntl';
import * as authApi from '@app/lib/api/authApi';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=2.secret'),
}));

const messages = {
  passwordSetup: {
    title: 'Set your password',
    description: 'Choose a password',
    password: 'Password',
    confirmation: 'Confirm password',
    minimum: 'Minimum eight',
    mismatch: 'Passwords do not match',
    invalid: 'Invalid setup link',
    submit: 'Set password',
    submitting: 'Setting password',
    success: 'Password ready',
    login: 'Go to login',
    checking: 'Checking setup link',
  },
};

describe('PasswordSetupClient', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('requires matching eight-character passwords and ends at normal login', async () => {
    const setup = vi.spyOn(authApi, 'setupPassword').mockResolvedValue();
    vi.spyOn(authApi, 'getPasswordSetupStatus').mockResolvedValue(true);
    renderWithIntl(<PasswordSetupClient />, { messages });
    await screen.findByRole('button', { name: 'Set password' });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Password'), 'password8');
    await user.type(screen.getByLabelText('Confirm password'), 'password8');
    await user.click(screen.getByRole('button', { name: 'Set password' }));
    expect(setup).toHaveBeenCalledWith({
      token: '2.secret',
      password: 'password8',
      passwordConfirmation: 'password8',
    });
    expect(await screen.findByText('Password ready')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to login' })).toHaveAttribute(
      'href',
      '/en/login'
    );
  });

  it('rejects confirmation mismatch locally', async () => {
    const setup = vi.spyOn(authApi, 'setupPassword');
    vi.spyOn(authApi, 'getPasswordSetupStatus').mockResolvedValue(true);
    renderWithIntl(<PasswordSetupClient />, { messages });
    await screen.findByRole('button', { name: 'Set password' });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Password'), 'password8');
    await user.type(screen.getByLabelText('Confirm password'), 'password9');
    await user.click(screen.getByRole('button', { name: 'Set password' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Passwords do not match'
    );
    expect(setup).not.toHaveBeenCalled();
  });

  it('does not render a password form for a consumed, expired, or superseded link', async () => {
    vi.spyOn(authApi, 'getPasswordSetupStatus').mockResolvedValue(false);
    renderWithIntl(<PasswordSetupClient />, { messages });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid setup link'
    );
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });
});
