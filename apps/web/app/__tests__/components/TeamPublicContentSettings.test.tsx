import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_TEAM_PUBLIC_CONTENT } from '@club/shared-types/api/teamPublicContent';

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
vi.mock('@app/services/teamPublicContentService', () => ({
  TeamPublicContentService: {
    useContent: () => ({ ...mocks.query, refetch: mocks.refetch }),
    useUpdateContent: () => ({
      mutateAsync: mocks.mutateAsync,
      isPending: false,
    }),
  },
}));

import TeamPublicContentSettings from '@app/components/Dashboard/TeamPublicContentSettings';

describe('TeamPublicContentSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.data = {
      content: structuredClone(EMPTY_TEAM_PUBLIC_CONTENT),
    };
    mocks.query.isPending = false;
    mocks.query.isError = false;
    mocks.mutateAsync.mockResolvedValue(undefined);
    mocks.requestPublication.mockResolvedValue(undefined);
  });

  it('blocks saving when the multilingual content failed to load', () => {
    mocks.query.data = { content: null };
    mocks.query.isError = true;
    render(<TeamPublicContentSettings />);
    expect(
      screen.getByText('Teams introduction could not be loaded')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save and publish' })
    ).not.toBeInTheDocument();
  });

  it('shows completeness and publishes the one localized aggregate', async () => {
    mocks.query.data = {
      content: {
        enabled: true,
        title: { de: 'Mannschaften', en: '', zh: '' },
        description: { de: 'Unsere Mannschaften', en: '', zh: '' },
      },
    };
    render(<TeamPublicContentSettings />);
    expect(
      screen.getAllByText('Missing: English, Chinese').length
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.requestPublication).toHaveBeenCalledWith('teams');
  });

  it('retries publication without replaying the Settings mutation', async () => {
    mocks.requestPublication
      .mockRejectedValueOnce(new Error('refresh failed'))
      .mockResolvedValueOnce(undefined);
    render(<TeamPublicContentSettings />);
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
