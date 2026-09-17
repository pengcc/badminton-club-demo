import { AxiosError } from 'axios';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: {} as Record<string, unknown>,
  logout: vi.fn(),
  reload: vi.fn(),
  assign: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ lang: 'en' }),
}));
vi.mock('@app/services/authService', () => ({
  AuthService: {
    useSession: () => mocks.session,
    useLogout: () => ({ mutateAsync: mocks.logout }),
  },
}));
vi.mock('@app/lib/navigation/documentNavigation', () => ({
  reloadCurrentDocument: mocks.reload,
  navigateToDocument: mocks.assign,
}));

import { ProtectedAuthProvider, useAuth } from '@app/hooks/useAuth';

function Consumer() {
  const { user, logout, sessionRefreshFailed } = useAuth();
  return (
    <>
      <span>{user.id}</span>
      <span>{sessionRefreshFailed ? 'refresh failed' : 'current'}</span>
      <button
        type="button"
        onClick={() => void logout().catch(() => undefined)}
      >
        Logout
      </button>
    </>
  );
}

function invalidSessionError() {
  return new AxiosError('invalid', 'ERR_BAD_RESPONSE', undefined, undefined, {
    data: { code: 'SESSION_INVALID' },
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config: {} as never,
  });
}

describe('ProtectedAuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = {
      data: { id: 'verified-user' },
      isError: false,
      error: null,
      isBootstrapPending: false,
      isRefetchError: false,
      refetch: vi.fn(),
    };
  });

  it('projects the verified user and keeps background failure non-destructive', () => {
    mocks.session.isRefetchError = true;

    render(
      <ProtectedAuthProvider initialUser={{ id: 'server-user' } as never}>
        <Consumer />
      </ProtectedAuthProvider>
    );

    expect(screen.getByText('verified-user')).toBeVisible();
    expect(screen.getByText('refresh failed')).toBeVisible();
    expect(mocks.reload).not.toHaveBeenCalled();
  });

  it('reloads current document when protected verification is session-invalid', async () => {
    mocks.session.isError = true;
    mocks.session.error = invalidSessionError();

    render(
      <ProtectedAuthProvider initialUser={{ id: 'server-user' } as never}>
        <Consumer />
      </ProtectedAuthProvider>
    );

    expect(mocks.reload).toHaveBeenCalledOnce();
    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it('navigates only after server logout succeeds', async () => {
    let rejectLogout = true;
    mocks.logout.mockImplementation(() =>
      rejectLogout
        ? Promise.reject(new Error('storage unavailable'))
        : Promise.resolve()
    );
    const { rerender } = render(
      <ProtectedAuthProvider initialUser={{ id: 'server-user' } as never}>
        <Consumer />
      </ProtectedAuthProvider>
    );

    await act(async () => {
      screen.getByRole('button', { name: 'Logout' }).click();
      await Promise.resolve();
    });
    expect(mocks.assign).not.toHaveBeenCalled();

    rejectLogout = false;
    rerender(
      <ProtectedAuthProvider initialUser={{ id: 'server-user' } as never}>
        <Consumer />
      </ProtectedAuthProvider>
    );
    await act(async () => {
      screen.getByRole('button', { name: 'Logout' }).click();
      await Promise.resolve();
    });
    expect(mocks.assign).toHaveBeenCalledWith('/en/login');
  });
});
