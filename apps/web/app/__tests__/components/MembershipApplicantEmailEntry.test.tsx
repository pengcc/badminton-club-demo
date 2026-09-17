import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '../utils/renderWithIntl';
import MembershipApplicantEmailEntry from '@app/components/MembershipApplicantEmailEntry';
import { requestApplicantAccess } from '@app/lib/api/membershipApplicationApi';

vi.mock('@app/lib/api/membershipApplicationApi', () => ({
  requestApplicantAccess: vi.fn(),
  requestApplicantVerification: vi.fn(),
}));

describe('MembershipApplicantEmailEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows one generic retryable failure without changing the email', async () => {
    vi.mocked(requestApplicantAccess)
      .mockRejectedValueOnce(new Error('transport detail'))
      .mockResolvedValueOnce();
    renderWithIntl(<MembershipApplicantEmailEntry mode="access" />);

    const email = screen.getByRole('textbox', { name: 'Email address' });
    fireEvent.change(email, { target: { value: 'applicant@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send secure link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The secure link could not be requested. Please try again.'
    );
    expect(screen.queryByText('transport detail')).not.toBeInTheDocument();
    expect(email).toHaveValue('applicant@example.test');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(requestApplicantAccess).toHaveBeenCalledTimes(2)
    );
    expect(
      await screen.findByText(/single-use link will arrive shortly/)
    ).toBeInTheDocument();
  });
});
