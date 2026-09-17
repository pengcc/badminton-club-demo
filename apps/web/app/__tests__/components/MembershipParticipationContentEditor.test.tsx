import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', async () => {
  const { dashboardTranslator } = await import('../testI18nMock');
  return {
    useLocale: () => 'en',
    useTranslations: dashboardTranslator,
  };
});

const mocks = vi.hoisted(() => ({
  tasterQuery: {
    data: undefined as any,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  membershipQuery: {
    data: undefined as any,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  tasterUpdate: { mutateAsync: vi.fn(), isPending: false },
  membershipUpdate: { mutateAsync: vi.fn(), isPending: false },
  publish: vi.fn(),
  retry: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mocks.success,
    warning: mocks.warning,
    error: mocks.error,
  },
}));
vi.mock('@app/services/tasterSessionPublicContentService', () => ({
  TasterSessionPublicContentService: {
    useContent: () => mocks.tasterQuery,
    useUpdateContent: () => mocks.tasterUpdate,
  },
}));
vi.mock('@app/services/membershipPublicContentService', () => ({
  MembershipPublicContentService: {
    useContent: () => mocks.membershipQuery,
    useUpdateContent: () => mocks.membershipUpdate,
  },
}));
vi.mock('@app/hooks/usePublication', () => ({
  usePublication: () => ({
    hasPublicationFailure: false,
    isRetrying: false,
    publish: mocks.publish,
    retry: mocks.retry,
  }),
}));

import MembershipParticipationContentEditor from '@app/components/Dashboard/content/MembershipParticipationContentEditor';

const localized = (de: string, en = '', zh = '') => ({ de, en, zh });
const taster = {
  homepageSummary: localized('Schnuppern'),
  introduction: localized('Einführung'),
  preparation: localized(''),
  participationGuidance: localized(''),
  followUpGuidance: localized(''),
};
const membership = {
  homepageSummary: localized('Mitglied werden'),
  introduction: localized('Einführung'),
  membershipTypes: localized('Arten'),
  membershipPath: localized('Weg'),
  applicationPreparation: localized(''),
  studentProof: localized(''),
};

describe('MembershipParticipationContentEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tasterQuery.data = {
      content: taster,
      completeness: {},
      updatedAt: null,
    };
    mocks.membershipQuery.data = {
      content: membership,
      completeness: {},
      updatedAt: null,
    };
    mocks.tasterUpdate.mutateAsync.mockResolvedValue({ content: taster });
    mocks.membershipUpdate.mutateAsync.mockResolvedValue({
      content: membership,
    });
    mocks.publish.mockResolvedValue(true);
  });

  it('contains only Membership and Taster information as local tasks', async () => {
    const user = userEvent.setup();
    render(<MembershipParticipationContentEditor />);

    expect(screen.getAllByRole('tablist')[0]).toHaveClass(
      'grid-cols-2',
      'items-stretch',
      'group-data-[orientation=horizontal]/tabs:h-auto'
    );
    expect(screen.getAllByRole('tablist')[0]).toHaveAttribute(
      'aria-orientation',
      'horizontal'
    );
    expect(
      within(screen.getAllByRole('tablist')[0])
        .getAllByRole('tab')
        .every(
          (tab) =>
            tab.classList.contains('min-w-0') &&
            tab.classList.contains('break-all')
        )
    ).toBe(true);
    expect(
      within(screen.getAllByRole('tablist')[0])
        .getAllByRole('tab')
        .map((tab) => tab.textContent)
    ).toEqual(['Membership information', 'Taster information']);
    expect(screen.getByText('Membership public information')).toBeVisible();
    expect(screen.getByLabelText('Translation completeness')).toBeVisible();
    expect(
      screen.getByText('Homepage summary: Missing: English, Chinese')
    ).toBeVisible();
    expect(
      screen.queryByText('Team recruitment public information')
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Taster information' }));
    expect(screen.getByText('Taster Session public information')).toBeVisible();
    expect(screen.getByLabelText('Translation completeness')).toBeVisible();
    expect(
      screen.getByText('Preparation guidance: not provided (optional)')
    ).toBeVisible();
  });

  it('reveals and focuses the hidden German blocker for the selected owner', async () => {
    const user = userEvent.setup();
    render(<MembershipParticipationContentEditor />);
    const card = screen
      .getByText('Membership public information')
      .closest('[data-slot="card"]');
    if (!card) throw new Error('Membership editor card missing');

    fireEvent.change(
      within(card as HTMLElement).getByLabelText('Homepage summary'),
      { target: { value: '' } }
    );
    await user.click(
      within(card as HTMLElement).getByRole('tab', { name: 'English' })
    );
    await user.click(
      within(card as HTMLElement).getByRole('button', {
        name: 'Save and publish',
      })
    );

    expect(within(card as HTMLElement).getByRole('alert')).toHaveTextContent(
      'Homepage summary — German: This field is required.'
    );
    await waitFor(() =>
      expect(
        within(card as HTMLElement).getByLabelText('Homepage summary')
      ).toHaveFocus()
    );
    expect(mocks.membershipUpdate.mutateAsync).not.toHaveBeenCalled();
  });

  it('saves and publishes Taster content without replaying Membership', async () => {
    const user = userEvent.setup();
    render(<MembershipParticipationContentEditor />);
    await user.click(screen.getByRole('tab', { name: 'Taster information' }));
    const card = screen
      .getByText('Taster Session public information')
      .closest('[data-slot="card"]');
    if (!card) throw new Error('Taster editor card missing');

    fireEvent.click(
      within(card as HTMLElement).getByRole('button', {
        name: 'Save and publish',
      })
    );

    await waitFor(() =>
      expect(mocks.tasterUpdate.mutateAsync).toHaveBeenCalledWith(taster)
    );
    expect(mocks.membershipUpdate.mutateAsync).not.toHaveBeenCalled();
    expect(mocks.publish).toHaveBeenCalledWith('taster-information');
  });
});
