import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_HOMEPAGE_CONTENT } from '@club/shared-types/api/homepageContent';

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
vi.mock('@app/services/homepageContentService', () => ({
  HomepageContentService: {
    useContent: () => ({ ...mocks.query, refetch: mocks.refetch }),
    useUpdateContent: () => ({
      mutateAsync: mocks.mutateAsync,
      isPending: false,
    }),
  },
}));

import HomepageCopyEditor from '@app/components/Dashboard/HomepageCopyEditor';

describe('HomepageCopyEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.data = { content: structuredClone(EMPTY_HOMEPAGE_CONTENT) };
    mocks.query.isPending = false;
    mocks.query.isError = false;
    mocks.mutateAsync.mockResolvedValue(undefined);
    mocks.requestPublication.mockResolvedValue(undefined);
  });

  it('blocks saving when the current multilingual value failed to load', () => {
    mocks.query.isError = true;
    mocks.query.data = { content: null };

    render(<HomepageCopyEditor />);

    expect(
      screen.getByText('Homepage content could not be loaded')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save and publish' })
    ).not.toBeInTheDocument();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('shows incomplete locales without blocking the coherent save', async () => {
    mocks.query.data = {
      content: {
        ...structuredClone(EMPTY_HOMEPAGE_CONTENT),
        mainMessage: { de: 'Willkommen', en: '', zh: '' },
      },
    };

    render(<HomepageCopyEditor />);

    expect(
      screen.getAllByText('Missing: English, Chinese').length
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.requestPublication).toHaveBeenCalledWith('homepage');
  });

  it('retries a failed public refresh without replaying persistence', async () => {
    mocks.requestPublication
      .mockRejectedValueOnce(new Error('refresh failed'))
      .mockResolvedValueOnce(undefined);

    render(<HomepageCopyEditor />);
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
