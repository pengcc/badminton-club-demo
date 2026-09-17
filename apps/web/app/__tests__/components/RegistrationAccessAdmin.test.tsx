import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithIntl, screen } from '../utils/renderWithIntl';
import MembershipSettings from '../../components/Dashboard/MembershipSettings';
import {
  generateRegistrationAccess,
  getRegistrationAccess,
  rotateRegistrationAccess,
} from '../../lib/api/membershipApplicationApi';

vi.mock('../../lib/api/membershipApplicationApi', () => ({
  getRegistrationAccess: vi.fn(),
  generateRegistrationAccess: vi.fn(),
  rotateRegistrationAccess: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const TEST_REGISTRATION_ACCESS_TOKEN = ['Test', 'Link', '_123'].join('');
const TEST_PATH = `/apply?k=${TEST_REGISTRATION_ACCESS_TOKEN}`;
const REPLACEMENT_PATH = '/apply?k=FreshLink456';

function renderComponent() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return renderWithIntl(
    <QueryClientProvider client={client}>
      <MembershipSettings />
    </QueryClientProvider>
  );
}

describe('RegistrationAccessAdmin', () => {
  beforeEach(() => {
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
    HTMLElement.prototype.scrollIntoView = () => {};
    vi.mocked(getRegistrationAccess).mockReset();
    vi.mocked(generateRegistrationAccess).mockReset();
    vi.mocked(rotateRegistrationAccess).mockReset();
  });

  it('shows an already-current link for copy on the initial protected read', async () => {
    vi.mocked(getRegistrationAccess).mockResolvedValue({
      hasCurrentLink: true,
      isValid: true,
      expiryMode: '30_days',
      expiresAt: '2026-10-10T12:00:00.000Z',
      generation: 4,
      path: TEST_PATH,
    });
    renderComponent();

    expect(await screen.findByText('Current version 4')).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.endsWith(`/en${TEST_PATH}`))
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy registration link' })
    ).toBeInTheDocument();
    expect(generateRegistrationAccess).not.toHaveBeenCalled();
    expect(rotateRegistrationAccess).not.toHaveBeenCalled();
  });

  it('uses 30 days by default and reloads the persisted current state after issuance', async () => {
    vi.mocked(getRegistrationAccess)
      .mockResolvedValueOnce({ hasCurrentLink: false, isValid: false })
      .mockResolvedValueOnce({
        hasCurrentLink: true,
        isValid: true,
        expiryMode: '30_days',
        generation: 1,
        path: TEST_PATH,
      });
    vi.mocked(generateRegistrationAccess).mockResolvedValue({
      hasCurrentLink: true,
      isValid: true,
      expiryMode: '30_days',
      generation: 1,
    });
    renderComponent();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole('button', { name: 'Generate registration link' })
    );

    expect(generateRegistrationAccess).toHaveBeenCalledWith({
      expiryMode: '30_days',
    });
    expect(
      await screen.findByText('Current registration link')
    ).toBeInTheDocument();
    expect(getRegistrationAccess).toHaveBeenCalledTimes(2);
  });

  it('changes only the locale-qualified URL when link language changes', async () => {
    vi.mocked(getRegistrationAccess).mockResolvedValue({
      hasCurrentLink: true,
      isValid: true,
      expiryMode: '30_days',
      generation: 2,
      path: TEST_PATH,
    });
    renderComponent();
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    expect(
      await screen.findByText((content) => content.endsWith(`/en${TEST_PATH}`))
    ).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Link language' }));
    await user.click(await screen.findByRole('option', { name: 'ZH' }));

    expect(
      screen.getByText((content) => content.endsWith(`/zh${TEST_PATH}`))
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Copy registration link' })
    );
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/zh${TEST_PATH}`
    );
    expect(getRegistrationAccess).toHaveBeenCalledTimes(1);
    expect(generateRegistrationAccess).not.toHaveBeenCalled();
    expect(rotateRegistrationAccess).not.toHaveBeenCalled();
  });

  it('removes an invalidated cached path when rotation succeeds but refresh fails', async () => {
    vi.mocked(getRegistrationAccess)
      .mockResolvedValueOnce({
        hasCurrentLink: true,
        isValid: true,
        expiryMode: '30_days',
        generation: 1,
        path: TEST_PATH,
      })
      .mockRejectedValueOnce(new Error('registration access unavailable'))
      .mockResolvedValueOnce({
        hasCurrentLink: true,
        isValid: true,
        expiryMode: '30_days',
        generation: 2,
        path: REPLACEMENT_PATH,
      });
    vi.mocked(rotateRegistrationAccess).mockResolvedValue({
      hasCurrentLink: true,
      isValid: true,
      expiryMode: '30_days',
      generation: 2,
    });
    renderComponent();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole('button', {
        name: 'Invalidate and generate new link',
      })
    );

    expect(
      await screen.findByText(
        'The current link could not be refreshed. The last loaded state remains visible.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Current version 2')).toBeInTheDocument();
    expect(
      screen.queryByText((content) => content.endsWith(`/en${TEST_PATH}`))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Copy registration link' })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(
      await screen.findByText((content) =>
        content.endsWith(`/en${REPLACEMENT_PATH}`)
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy registration link' })
    ).toBeInTheDocument();
    expect(getRegistrationAccess).toHaveBeenCalledTimes(3);
  });

  it('explains an active legacy-unrecoverable version without replacing it', async () => {
    vi.mocked(getRegistrationAccess).mockResolvedValue({
      hasCurrentLink: true,
      isValid: true,
      expiryMode: '90_days',
      generation: 2,
    });
    renderComponent();

    expect(
      await screen.findByText('Current link cannot be displayed')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Invalidate and generate new link',
      })
    ).toBeInTheDocument();
    expect(rotateRegistrationAccess).not.toHaveBeenCalled();
  });

  it('represents non-expiring, expired, and no-current states distinctly', async () => {
    vi.mocked(getRegistrationAccess).mockResolvedValue({
      hasCurrentLink: true,
      isValid: true,
      expiryMode: 'none',
      generation: 3,
      path: TEST_PATH,
    });
    const first = renderComponent();
    expect(await screen.findByText('No automatic expiry')).toBeInTheDocument();

    first.unmount();
    vi.mocked(getRegistrationAccess).mockResolvedValue({
      hasCurrentLink: true,
      isValid: false,
      expiryMode: '30_days',
      generation: 3,
    });
    const second = renderComponent();
    expect(
      await screen.findByText('No active link. The previous link is expired.')
    ).toBeInTheDocument();

    second.unmount();
    vi.mocked(getRegistrationAccess).mockResolvedValue({
      hasCurrentLink: false,
      isValid: false,
    });
    renderComponent();
    expect(
      await screen.findByText('No link has been generated.')
    ).toBeInTheDocument();
  });

  it('shows an explicit load error and retries current-link loading', async () => {
    vi.mocked(getRegistrationAccess)
      .mockRejectedValueOnce(new Error('registration access unavailable'))
      .mockResolvedValueOnce({ hasCurrentLink: false, isValid: false });
    renderComponent();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(
      await screen.findByRole('button', { name: 'Generate registration link' })
    ).toBeInTheDocument();
    expect(getRegistrationAccess).toHaveBeenCalledTimes(2);
  });
});
