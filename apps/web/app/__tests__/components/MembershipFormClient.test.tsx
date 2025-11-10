import React from 'react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl, screen, waitFor } from '../utils/renderWithIntl';
import MembershipFormClient from '../../components/MembershipFormClient';

describe('MembershipFormClient', () => {
  it('renders submission mode controls and personal info section', async () => {
    renderWithIntl(<MembershipFormClient lang="en" />);

    // Wait for stable UI
    await screen.findByText('applicationForm.submissionMode');

    expect(screen.getByText('applicationForm.submissionModes.full')).toBeInTheDocument();
    expect(screen.getByText('applicationForm.personalInfo')).toBeInTheDocument();
    expect(screen.getByText('applicationForm.submit')).toBeInTheDocument();
  });

  it('marks required fields as touched when switching to sepa-only', async () => {
    const user = userEvent.setup();
    renderWithIntl(<MembershipFormClient lang="en" />);

    const sepaRadio = await screen.findByLabelText('applicationForm.submissionModes.sepaOnly');
    await user.click(sepaRadio);

    // Wait for any state updates to complete
    await waitFor(() => {
      const debitError = document.getElementById('debit-error');
      expect(debitError).toBeTruthy();
      expect(debitError?.textContent).toBe('validation.required');
    });
  });

  it('hides SEPA section and clears SEPA errors when switching to membership-only', async () => {
    const user = userEvent.setup();
    renderWithIntl(<MembershipFormClient lang="en" />);

    const sepaRadio = await screen.findByLabelText('applicationForm.submissionModes.sepaOnly');
    await user.click(sepaRadio);

    // Wait for SEPA error to appear
    await waitFor(() => {
      expect(document.getElementById('debit-error')).toBeTruthy();
    });

    const membershipOnlyRadio = screen.getByLabelText('applicationForm.submissionModes.membershipOnly');
    await user.click(membershipOnlyRadio);

    // Wait for state updates to complete
    await waitFor(() => {
      expect(screen.queryByText('applicationForm.sepaTitle')).not.toBeInTheDocument();
      expect(document.getElementById('debit-error')).toBeNull();
      expect(screen.getByText('applicationForm.membershipType')).toBeInTheDocument();
    });
  });
});
