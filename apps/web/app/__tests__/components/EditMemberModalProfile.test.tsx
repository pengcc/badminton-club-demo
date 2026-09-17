import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import commonEn from '../../../messages/en/common.json';
import dashboardEn from '../../../messages/en/dashboard.json';

const mutation = { isPending: false, mutateAsync: vi.fn() };
vi.mock('@app/services/userService', () => ({
  UserService: {
    useUpdateUser: () => mutation,
    useSetAdministratorDesignation: () => mutation,
    useTransitionMembershipActivity: () => mutation,
    useSuspendAccount: () => mutation,
    useUnsuspendAccount: () => mutation,
  },
}));

import EditMemberModal from '../../components/Dashboard/modals/EditMemberModal';

const member = {
  id: 'user-1',
  email: 'member@example.test',
  firstName: 'Current',
  lastName: 'Member',
  fullName: 'Member, Current',
  phone: '+49 30 1234',
  dateOfBirth: '1990-01-01',
  gender: 'female',
  address: {
    street: 'Test 1',
    postalCode: '10115',
    city: 'Berlin',
    country: 'Deutschland',
  },
  accountKind: 'person',
  administratorDesignation: false,
  membershipStatus: 'active',
  accountOnboardingStatus: 'ready',
  isPlayer: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
} as never;

function renderModal(profileOnly = false) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={{ common: commonEn, dashboard: dashboardEn }}
    >
      <EditMemberModal
        isOpen
        member={member}
        onClose={vi.fn()}
        onMemberUpdated={vi.fn()}
        profileOnly={profileOnly}
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mutation.mutateAsync.mockResolvedValue(member);
});

describe('EditMemberModal Person Profile correction', () => {
  it('keeps the External Player fallback bounded to Person profile correction', () => {
    renderModal(true);

    expect(screen.getAllByText('Person profile')).not.toHaveLength(0);
    expect(
      screen.getByRole('button', { name: 'Correct profile data' })
    ).toBeVisible();
    expect(screen.queryByText('Administrator responsibility')).toBeNull();
    expect(screen.queryByText('Account access')).toBeNull();
    expect(screen.queryByText('Membership activity')).toBeNull();
    expect(screen.queryByText(member.email)).toBeNull();
  });

  it('keeps profile correction secondary and exposes complete address controls on demand', async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.getByText('Person profile')).toBeVisible();
    expect(screen.getByText('Female')).toBeVisible();
    expect(screen.getByText('Test 1, 10115 Berlin, Deutschland')).toBeVisible();
    expect(screen.queryByLabelText('Street and house number')).toBeNull();

    await user.click(
      screen.getByRole('button', { name: 'Correct profile data' })
    );
    expect(screen.getByLabelText('Street and house number')).toHaveValue(
      'Test 1'
    );
    expect(screen.getByText('Germany')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Remove address' })
    ).toBeVisible();
  });

  it('submits only the profile field corrected by the administrator', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(
      screen.getByRole('button', { name: 'Correct profile data' })
    );
    await user.clear(screen.getByLabelText('First Name'));
    await user.type(screen.getByLabelText('First Name'), 'Corrected');
    await user.click(
      screen.getByRole('button', { name: 'Save profile corrections' })
    );

    expect(mutation.mutateAsync).toHaveBeenCalledWith({
      id: 'user-1',
      formData: { firstName: 'Corrected' },
    });
  });

  it('keeps phone and address removal as explicit null clears', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(
      screen.getByRole('button', { name: 'Correct profile data' })
    );
    await user.clear(screen.getByLabelText('Phone'));
    await user.click(screen.getByRole('button', { name: 'Remove address' }));
    await user.click(
      screen.getByRole('button', { name: 'Save profile corrections' })
    );

    expect(mutation.mutateAsync).toHaveBeenCalledWith({
      id: 'user-1',
      formData: { phone: null, address: null },
    });
  });

  it('does not submit hidden profile corrections after correction is collapsed', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(
      screen.getByRole('button', { name: 'Correct profile data' })
    );
    await user.clear(screen.getByLabelText('First Name'));
    await user.type(screen.getByLabelText('First Name'), 'Hidden correction');
    await user.click(screen.getByRole('button', { name: 'Stop correcting' }));
    await user.type(
      screen.getByLabelText('Required suspension reason'),
      'Support task{Enter}'
    );

    expect(mutation.mutateAsync).not.toHaveBeenCalled();
  });
});
