import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', async () => {
  const { dashboardTranslator } = await import('../testI18nMock');
  return {
    useLocale: () => 'en',
    useTranslations: dashboardTranslator,
  };
});

const mocks = vi.hoisted(() => ({
  query: {
    data: [] as Array<Record<string, unknown>>,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  create: { mutateAsync: vi.fn(), isPending: false },
  update: { mutateAsync: vi.fn(), isPending: false },
  reorder: { mutateAsync: vi.fn(), isPending: false },
  remove: { mutateAsync: vi.fn(), isPending: false },
  publication: vi.fn(),
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: mocks.toast }));
vi.mock('@app/services/publicDocumentService', () => ({
  PublicDocumentService: {
    useDocuments: () => mocks.query,
    useCreate: () => mocks.create,
    useUpdate: () => mocks.update,
    useReorder: () => mocks.reorder,
    useDelete: () => mocks.remove,
  },
}));
vi.mock('@app/lib/publication', () => ({
  requestPublication: mocks.publication,
}));

import PublicDocumentManager from '@app/components/Dashboard/PublicDocumentManager';

const documents = [
  {
    id: '507f1f77bcf86cd799439011',
    displayName: {
      de: 'Beitragsordnung',
      en: 'Fee regulation',
      zh: '会费条例',
    },
    documentDate: '2024-12-04',
    fileUrl: '/documents/Beitragsordnung.pdf',
    isVisible: true,
    order: 0,
    completeness: { complete: true, missingLanguages: [] },
  },
  {
    id: '507f1f77bcf86cd799439012',
    displayName: { de: 'Satzung', en: 'Statutes', zh: '章程' },
    documentDate: '2012-06-09',
    fileUrl: '/documents/Satzung.pdf',
    isVisible: false,
    order: 1,
    completeness: { complete: true, missingLanguages: [] },
  },
];

describe('PublicDocumentManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.data = documents;
    mocks.query.isPending = false;
    mocks.query.isError = false;
    mocks.query.refetch.mockResolvedValue(undefined);
    mocks.create.mutateAsync.mockResolvedValue({
      document: documents[0],
      mediaCleanupWarning: null,
    });
    mocks.update.mutateAsync.mockResolvedValue({
      document: documents[0],
      mediaCleanupWarning: null,
    });
    mocks.reorder.mutateAsync.mockResolvedValue(documents);
    mocks.remove.mutateAsync.mockResolvedValue({
      deleted: true,
      mediaCleanupWarning: null,
    });
    mocks.publication.mockResolvedValue(undefined);
  });

  it('renders an arbitrary ordered collection and a truthful empty state', () => {
    mocks.query.data = Array.from({ length: 5 }, (_, index) => ({
      ...documents[0],
      id: `507f1f77bcf86cd7994390${index + 20}`,
      displayName: { ...documents[0].displayName, de: `Dokument ${index + 1}` },
      order: index,
    }));
    const { rerender } = render(<PublicDocumentManager />);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Add document' })).toBeEnabled();

    mocks.query.data = [];
    rerender(<PublicDocumentManager />);
    expect(screen.getByText('No Public Documents yet.')).toBeInTheDocument();
  });

  it('keeps cached documents visible when a background refresh fails', () => {
    mocks.query.isError = true;
    render(<PublicDocumentManager />);
    expect(
      screen.getByRole('heading', { level: 3, name: 'Beitragsordnung' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Public Documents could not be refreshed. Previously loaded data remains visible.'
      )
    ).toBeInTheDocument();
  });

  it('creates a third document with a required PDF and publishes after persistence', async () => {
    render(<PublicDocumentManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Add document' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeEnabled();
    fireEvent.change(within(dialog).getByLabelText('Display name'), {
      target: { value: 'Aufnahmeordnung' },
    });
    fireEvent.change(within(dialog).getByLabelText('Document/version date'), {
      target: { value: '2026-08-23' },
    });
    const file = new File(['%PDF-1.7\nmock'], 'aufnahmeordnung.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(within(dialog).getByLabelText('PDF (max 10 MB)'), {
      target: { files: [file] },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Create and publish' })
    );

    await waitFor(() =>
      expect(mocks.create.mutateAsync).toHaveBeenCalledOnce()
    );
    expect(mocks.create.mutateAsync).toHaveBeenCalledWith({
      displayName: { de: 'Aufnahmeordnung', en: '', zh: '' },
      documentDate: '2026-08-23',
      isVisible: true,
      replacement: file,
    });
    expect(mocks.publication).toHaveBeenCalledWith('public-documents');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });

  it('keeps the create dialog open and does not publish after persistence failure', async () => {
    mocks.create.mutateAsync.mockRejectedValue(new Error('create failed'));
    render(<PublicDocumentManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Add document' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Display name'), {
      target: { value: 'Dokument' },
    });
    fireEvent.change(within(dialog).getByLabelText('Document/version date'), {
      target: { value: '2026-08-23' },
    });
    fireEvent.change(within(dialog).getByLabelText('PDF (max 10 MB)'), {
      target: {
        files: [
          new File(['%PDF-1.7'], 'document.pdf', { type: 'application/pdf' }),
        ],
      },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Create and publish' })
    );
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(mocks.publication).not.toHaveBeenCalled();
  });

  it('reorders with the complete ID list including hidden documents', async () => {
    render(<PublicDocumentManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Move Satzung up' }));
    await waitFor(() =>
      expect(mocks.reorder.mutateAsync).toHaveBeenCalledOnce()
    );
    expect(mocks.reorder.mutateAsync).toHaveBeenCalledWith([
      documents[1].id,
      documents[0].id,
    ]);
    expect(mocks.publication).toHaveBeenCalledWith('public-documents');
  });

  it('preserves unsaved editor input when reordering documents', async () => {
    const view = render(<PublicDocumentManager />);
    fireEvent.change(screen.getAllByLabelText('Display name')[0], {
      target: { value: 'Unsaved name' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Move Satzung up' }));
    await waitFor(() =>
      expect(mocks.reorder.mutateAsync).toHaveBeenCalledOnce()
    );

    mocks.query.data = [
      { ...documents[1], order: 0 },
      { ...documents[0], order: 1 },
    ];
    view.rerender(<PublicDocumentManager />);

    expect(screen.getAllByLabelText('Display name')[1]).toHaveValue(
      'Unsaved name'
    );
  });

  it('refetches and does not publish an unconfirmed reorder', async () => {
    mocks.reorder.mutateAsync.mockRejectedValue(new Error('conflict'));
    render(<PublicDocumentManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Move Satzung up' }));
    await waitFor(() => expect(mocks.query.refetch).toHaveBeenCalledOnce());
    expect(mocks.publication).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledWith(
      expect.stringContaining('latest order was reloaded')
    );
  });

  it('keeps remove-current-PDF distinct and permanently deletes with confirmation', async () => {
    render(<PublicDocumentManager />);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Remove current Beitragsordnung PDF and hide',
      })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Save and publish Beitragsordnung' })
    );
    await waitFor(() =>
      expect(mocks.update.mutateAsync).toHaveBeenCalledOnce()
    );
    expect(mocks.update.mutateAsync).toHaveBeenCalledWith({
      id: documents[0].id,
      request: expect.objectContaining({ retainedFile: '', isVisible: false }),
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Permanently delete Satzung' })
    );
    const confirmation = await screen.findByRole('alertdialog');
    expect(
      within(confirmation).getByText(/Delete “Satzung”/)
    ).toBeInTheDocument();
    fireEvent.click(
      within(confirmation).getByRole('button', { name: 'Delete' })
    );
    await waitFor(() =>
      expect(mocks.remove.mutateAsync).toHaveBeenCalledWith(documents[1].id)
    );
  });

  it('retries only named publication without repeating the mutation', async () => {
    mocks.publication
      .mockRejectedValueOnce(new Error('refresh unavailable'))
      .mockResolvedValueOnce(undefined);
    render(<PublicDocumentManager />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Save and publish Beitragsordnung' })
    );
    expect(
      await screen.findByText('Saved, public refresh failed')
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry public refresh' })
    );
    await waitFor(() => expect(mocks.publication).toHaveBeenCalledTimes(2));
    expect(mocks.update.mutateAsync).toHaveBeenCalledOnce();
  });
});
