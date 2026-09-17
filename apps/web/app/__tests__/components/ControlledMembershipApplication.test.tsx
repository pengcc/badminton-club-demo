import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithIntl, screen } from '../utils/renderWithIntl';
import ControlledMembershipApplication from '../../components/ControlledMembershipApplication';
import { validateRegistrationAccess } from '../../lib/api/membershipApplicationApi';

vi.mock('../../lib/api/membershipApplicationApi', () => ({
  validateRegistrationAccess: vi.fn(),
}));
vi.mock('../../components/MembershipApplicantEmailEntry', () => ({
  default: ({ accessToken }: { accessToken: string }) => (
    <div>email-entry:{accessToken}</div>
  ),
}));

function renderComponent(accessToken?: string) {
  return renderWithIntl(
    <ControlledMembershipApplication accessToken={accessToken} />
  );
}

const VALID_TEST_TOKEN = ['Test', 'Link', '_123'].join('');
const INVALID_TEST_TOKEN = ['Next', 'Link', '_456'].join('');

describe('ControlledMembershipApplication', () => {
  beforeEach(() => vi.mocked(validateRegistrationAccess).mockReset());

  it('does not expose the form without a token', () => {
    renderComponent();
    expect(
      screen.getByText('registrationAccess.unavailableTitle')
    ).toBeInTheDocument();
    expect(screen.queryByText(/^email-entry:/)).not.toBeInTheDocument();
  });

  it('renders the form only after backend validation', async () => {
    vi.mocked(validateRegistrationAccess).mockResolvedValue(true);
    renderComponent(VALID_TEST_TOKEN);
    expect(
      await screen.findByText(`email-entry:${VALID_TEST_TOKEN}`)
    ).toBeInTheDocument();
    expect(validateRegistrationAccess).toHaveBeenCalledWith(VALID_TEST_TOKEN);
  });

  it('shows a generic unavailable state after invalid validation', async () => {
    vi.mocked(validateRegistrationAccess).mockResolvedValue(false);
    renderComponent(INVALID_TEST_TOKEN);
    expect(
      await screen.findByText('registrationAccess.unavailableTitle')
    ).toBeInTheDocument();
    expect(screen.queryByText(/^email-entry:/)).not.toBeInTheDocument();
  });

  it('revalidates when client navigation supplies a different token', async () => {
    vi.mocked(validateRegistrationAccess)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const view = renderComponent(VALID_TEST_TOKEN);
    expect(
      await screen.findByText(`email-entry:${VALID_TEST_TOKEN}`)
    ).toBeInTheDocument();

    view.rerender(
      <ControlledMembershipApplication accessToken={INVALID_TEST_TOKEN} />
    );

    expect(screen.queryByText(/^email-entry:/)).not.toBeInTheDocument();
    expect(screen.getByText('registrationAccess.checking')).toBeInTheDocument();
    expect(
      await screen.findByText('registrationAccess.unavailableTitle')
    ).toBeInTheDocument();
    expect(screen.queryByText(/^email-entry:/)).not.toBeInTheDocument();
    expect(validateRegistrationAccess).toHaveBeenLastCalledWith(
      INVALID_TEST_TOKEN
    );
  });
});
