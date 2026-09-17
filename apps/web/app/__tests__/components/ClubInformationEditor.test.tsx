import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_CLUB_INFORMATION } from '@club/shared-types/api/clubInformation';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  refetch: vi.fn(),
  requestPublication: vi.fn(),
  query: {
    data: { content: null as unknown },
    isPending: false,
    isError: false,
  },
}));

vi.mock('next-intl', async () => {
  const { dashboardTranslator } = await import('../testI18nMock');
  return {
    useLocale: () => 'en',
    useTranslations: dashboardTranslator,
  };
});
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));
vi.mock('@app/lib/publication', () => ({
  requestPublication: mocks.requestPublication,
}));
vi.mock('@app/services/clubInformationService', () => ({
  ClubInformationService: {
    useContent: () => ({ ...mocks.query, refetch: mocks.refetch }),
    useUpdateContent: () => ({
      mutateAsync: mocks.mutateAsync,
      isPending: false,
    }),
  },
}));

import ClubInformationEditor from '@app/components/Dashboard/ClubInformationEditor';

describe('ClubInformationEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.data = { content: structuredClone(EMPTY_CLUB_INFORMATION) };
    mocks.query.isPending = false;
    mocks.query.isError = false;
    mocks.mutateAsync.mockResolvedValue(undefined);
    mocks.requestPublication.mockResolvedValue(undefined);
  });

  it('blocks saving when canonical Club Information failed to load', () => {
    mocks.query.data = { content: null };
    mocks.query.isError = true;

    render(<ClubInformationEditor />);

    expect(
      screen.getByText('Club information could not be loaded')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save and publish' })
    ).not.toBeInTheDocument();
  });

  it('shows missing translations and submits one canonical aggregate', async () => {
    mocks.query.data = {
      content: {
        officialNameGerman: 'Deutsch-Chinesischer Badminton Verein e. V.',
        nameEnglish: '',
        nameChinese: '',
        shortName: 'DCBV',
        foundingYear: 2009,
        introduction: { de: 'Verein', en: '', zh: '' },
      },
    };

    render(<ClubInformationEditor />);

    expect(screen.getAllByText('Missing: English, Chinese')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.requestPublication).toHaveBeenCalledWith('homepage');
  });

  it('retries publication without replaying the Club save', async () => {
    mocks.requestPublication
      .mockRejectedValueOnce(new Error('refresh failed'))
      .mockResolvedValueOnce(undefined);

    render(<ClubInformationEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }));
    expect(
      await screen.findByText('Saved, public refresh failed')
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry public refresh' })
    );

    await waitFor(() =>
      expect(mocks.requestPublication).toHaveBeenCalledTimes(2)
    );
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);
  });
});
