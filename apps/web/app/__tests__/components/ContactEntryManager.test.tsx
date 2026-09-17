import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  query: {
    data: [] as any[],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  create: { mutateAsync: vi.fn(), isPending: false },
  update: { mutateAsync: vi.fn(), isPending: false },
  remove: { mutateAsync: vi.fn(), isPending: false },
  publication: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: mocks.success, warning: mocks.warning, error: mocks.error },
}));
vi.mock('@app/services/contactEntryService', () => ({
  ContactEntryService: {
    useEntries: () => mocks.query,
    useCreate: () => mocks.create,
    useUpdate: () => mocks.update,
    useDelete: () => mocks.remove,
  },
}));
vi.mock('@app/lib/publication', () => ({
  requestPublication: mocks.publication,
}));

import ContactEntryManager from '@app/components/Dashboard/ContactEntryManager';

const entry = {
  id: 'contact-1',
  category: 'General inquiries',
  title: { de: 'Kontakt', en: '', zh: '' },
  description: { de: 'Schreib uns.', en: '', zh: '' },
  email: 'info@example.test',
  qrCode: '',
  qrCodeOriginalFilename: '',
  qrExplanation: { de: '', en: '', zh: '' },
  externalLink: '',
  externalLinkLabel: { de: '', en: '', zh: '' },
  isActive: true,
  order: 1,
  completeness: {
    title: { complete: false, missingLanguages: ['en', 'zh'] },
    description: { complete: false, missingLanguages: ['en', 'zh'] },
    qrExplanation: { complete: true, missingLanguages: [] },
    externalLinkLabel: { complete: true, missingLanguages: [] },
  },
};

describe('ContactEntryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.data = [entry];
    mocks.query.isPending = false;
    mocks.query.isError = false;
    mocks.create.mutateAsync.mockResolvedValue(entry);
    mocks.update.mutateAsync.mockResolvedValue({
      entry,
      mediaCleanupWarning: null,
    });
    mocks.remove.mutateAsync.mockResolvedValue({
      deleted: true,
      mediaCleanupWarning: null,
    });
    mocks.publication.mockResolvedValue(undefined);
  });

  it('shows locale completeness and uniquely named row actions', () => {
    render(<ContactEntryManager />);
    expect(
      screen.getByText('Missing title: English, Chinese')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit Contact entry Kontakt' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Hide Contact entry Kontakt' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete Contact entry Kontakt' })
    ).toBeInTheDocument();
  });

  it('creates through the Contact owner and publishes every bounded Contact consumer', async () => {
    mocks.query.data = [];
    render(<ContactEntryManager />);
    fireEvent.click(screen.getByRole('button', { name: 'New Contact entry' }));
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'General' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'info@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Kontakt' },
    });
    fireEvent.change(screen.getByLabelText('Short description'), {
      target: { value: 'Schreib uns.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Contact entry' }));

    await waitFor(() =>
      expect(mocks.create.mutateAsync).toHaveBeenCalledTimes(1)
    );
    expect(mocks.success).toHaveBeenCalledWith(
      'Contact entry saved and published'
    );
    expect(mocks.publication).toHaveBeenCalledWith('contact');
    expect(screen.queryByText(/public refresh/i)).not.toBeInTheDocument();
  });

  it('reveals and focuses a hidden German blocker with persistent field feedback', async () => {
    const user = userEvent.setup();
    mocks.query.data = [];
    render(<ContactEntryManager />);
    fireEvent.click(screen.getByRole('button', { name: 'New Contact entry' }));
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'General' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'info@example.test' },
    });
    await user.click(screen.getByRole('tab', { name: 'English' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Contact entry' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Title — German: This field is required.'
    );
    const germanTab = screen.getByRole('tab', { name: 'German' });
    expect(germanTab).toHaveAttribute('aria-invalid', 'true');
    expect(germanTab).toHaveAttribute('aria-selected', 'true');
    const title = screen.getByLabelText('Title');
    expect(title).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(title).toHaveFocus());
    expect(mocks.create.mutateAsync).not.toHaveBeenCalled();
  });

  it('re-derives cross-field blockers from the current draft', async () => {
    mocks.query.data = [];
    render(<ContactEntryManager />);
    fireEvent.click(screen.getByRole('button', { name: 'New Contact entry' }));
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'General' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'info@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Kontakt' },
    });
    fireEvent.change(screen.getByLabelText('Short description'), {
      target: { value: 'Schreib uns.' },
    });
    fireEvent.change(screen.getByLabelText('External link (optional)'), {
      target: { value: 'https://example.test' },
    });
    expect(screen.getByText('Required content needs attention')).toHaveClass(
      'text-destructive'
    );
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' &&
          element.textContent ===
            'External-link label: Missing: German, English, Chinese'
      )
    ).toHaveClass('text-destructive');
    fireEvent.click(screen.getByRole('button', { name: 'Save Contact entry' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Add a German label when an external link is set.'
    );
    fireEvent.change(screen.getByLabelText('External link (optional)'), {
      target: { value: '' },
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('maps only bounded user-correctable QR codes to the QR control', async () => {
    mocks.update.mutateAsync.mockRejectedValueOnce({
      response: {
        data: {
          code: 'INVALID_CONTACT_QR_TYPE',
          error: 'unsafe backend detail',
        },
      },
    });
    render(<ContactEntryManager />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Contact entry Kontakt' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save Contact entry' }));

    const summary = await screen.findByRole('alert');
    expect(summary).toHaveTextContent('Choose a PNG or JPEG QR image.');
    expect(summary).not.toHaveTextContent('unsafe backend detail');
    expect(
      screen.getByLabelText('QR image (PNG or JPEG, max 2 MB)')
    ).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'Updated category' },
    });
    expect(
      screen.getByLabelText('QR image (PNG or JPEG, max 2 MB)')
    ).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(
      screen.getByLabelText('QR image (PNG or JPEG, max 2 MB)'),
      {
        target: {
          files: [new File(['qr'], 'qr.png', { type: 'image/png' })],
        },
      }
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears a failed local QR selection without deleting the saved QR or other edits', async () => {
    const qrCode = '/uploads/contact-qr/contact-1/current.png';
    mocks.query.data = [{ ...entry, qrCode }];
    mocks.update.mutateAsync.mockRejectedValueOnce({
      response: { data: { code: 'INVALID_CONTACT_QR_UPLOAD' } },
    });
    render(<ContactEntryManager />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Contact entry Kontakt' })
    );
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'Updated category' },
    });
    const qrInput = screen.getByLabelText('QR image (PNG or JPEG, max 2 MB)');
    fireEvent.change(qrInput, {
      target: {
        files: [new File(['qr'], 'replacement.png', { type: 'image/png' })],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Contact entry' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The QR image could not be uploaded. Try again.'
    );
    expect(
      screen.getByRole('button', { name: 'Clear selected QR image' })
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Remove current QR' })
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', { name: 'Clear selected QR image' })
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(qrInput).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Remove current QR' })
    ).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Save Contact entry' }));
    await waitFor(() =>
      expect(mocks.update.mutateAsync).toHaveBeenCalledTimes(2)
    );
    expect(mocks.update.mutateAsync.mock.calls[1]?.[0]).toMatchObject({
      request: {
        category: 'Updated category',
        retainedQrCode: qrCode,
        newQrCode: undefined,
      },
    });
  });

  it('shows the retained original QR filename when reopening the editor', () => {
    mocks.query.data = [
      {
        ...entry,
        qrCode: '/uploads/contact-qr/contact-1/generated-uuid.png',
        qrCodeOriginalFilename: 'club-wechat.png',
      },
    ];

    render(<ContactEntryManager />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Contact entry Kontakt' })
    );

    expect(screen.getByText('Current file: club-wechat.png')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Remove current QR' })
    ).toBeVisible();
  });

  it('shows a truthful fallback for a legacy retained QR without filename metadata', () => {
    mocks.query.data = [
      {
        ...entry,
        qrCode: '/uploads/contact-qr/contact-1/generated-uuid.png',
        qrCodeOriginalFilename: '',
      },
    ];

    render(<ContactEntryManager />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Contact entry Kontakt' })
    );

    expect(
      screen.getByText('Current file: filename unavailable')
    ).toBeVisible();
    expect(screen.queryByText(/generated-uuid\.png/)).not.toBeInTheDocument();
  });

  it('shows readable required and optional translation-completeness states', async () => {
    const user = userEvent.setup();
    render(<ContactEntryManager />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Contact entry Kontakt' })
    );
    expect(
      screen.getByText('Language and translation completeness')
    ).toBeInTheDocument();
    expect(screen.getByText('Required content complete')).toHaveClass(
      'text-green-700'
    );
    expect(screen.getByText('2 optional fields not filled')).toBeVisible();
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' &&
          element.textContent === 'QR explanation: not provided (optional)'
      )
    ).toHaveClass('text-muted-foreground');

    await user.click(screen.getByRole('tab', { name: 'English' }));
    fireEvent.change(screen.getByLabelText('QR explanation (optional)'), {
      target: { value: 'Scan the code' },
    });
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' &&
          element.textContent === 'QR explanation: Missing: German, Chinese'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('makes missing required German content prominent in completeness feedback', () => {
    mocks.query.data = [];
    render(<ContactEntryManager />);
    fireEvent.click(screen.getByRole('button', { name: 'New Contact entry' }));

    expect(screen.getByText('Required content needs attention')).toHaveClass(
      'text-destructive'
    );
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' &&
          element.textContent === 'Title: Missing: German, English, Chinese'
      )
    ).toHaveClass('text-destructive');
  });

  it('requires removing an invalid retained QR reference before replacement', async () => {
    mocks.query.data = [
      { ...entry, qrCode: '/uploads/contact/contact-1/current.png' },
    ];
    mocks.update.mutateAsync.mockRejectedValueOnce({
      response: { data: { code: 'INVALID_RETAINED_CONTACT_QR' } },
    });
    render(<ContactEntryManager />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Contact entry Kontakt' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save Contact entry' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The current QR reference is no longer valid. Remove it before saving without a QR image or choosing a replacement.'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove current QR' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Contact entry' }));

    await waitFor(() =>
      expect(mocks.update.mutateAsync).toHaveBeenCalledTimes(2)
    );
    expect(mocks.update.mutateAsync.mock.calls[1]?.[0]).toMatchObject({
      request: { retainedQrCode: '', newQrCode: undefined },
    });
  });

  it('keeps an ownership-unverified QR unchanged unless support removes it', async () => {
    const qrCode = '/uploads/contact/contact-1/current.png';
    mocks.query.data = [{ ...entry, qrCode }];
    mocks.update.mutateAsync.mockRejectedValueOnce({
      response: { data: { code: 'CONTACT_QR_OWNERSHIP_UNVERIFIED' } },
    });
    render(<ContactEntryManager />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Contact entry Kontakt' })
    );
    const qrInput = screen.getByLabelText('QR image (PNG or JPEG, max 2 MB)');
    fireEvent.change(qrInput, {
      target: {
        files: [new File(['qr'], 'replacement.png', { type: 'image/png' })],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Contact entry' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The current QR image could not be verified. Leave it unchanged to save other fields, or contact support to remove or replace it.'
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Clear selected QR image' })
    );
    expect(
      screen.getByRole('button', { name: 'Remove current QR' })
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'Updated category' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Contact entry' }));

    await waitFor(() =>
      expect(mocks.update.mutateAsync).toHaveBeenCalledTimes(2)
    );
    expect(mocks.update.mutateAsync.mock.calls[1]?.[0]).toMatchObject({
      request: { retainedQrCode: qrCode, newQrCode: undefined },
    });
  });

  it('prevents an executable fifth Contact entry command', () => {
    mocks.query.data = Array.from({ length: 4 }, (_, index) => ({
      ...entry,
      id: `contact-${index + 1}`,
      title: { ...entry.title, de: `Kontakt ${index + 1}` },
    }));
    render(<ContactEntryManager />);

    expect(
      screen.getByRole('button', { name: 'New Contact entry' })
    ).toBeDisabled();
    expect(
      screen.getByText('Maximum of 4 Contact entries reached.')
    ).toBeInTheDocument();
  });

  it('reports saved-but-refresh-failed and retries only publication', async () => {
    mocks.publication
      .mockRejectedValueOnce(new Error('refresh failed'))
      .mockResolvedValueOnce(undefined);
    render(<ContactEntryManager />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Hide Contact entry Kontakt' })
    );

    expect(
      await screen.findByText('Saved, public refresh failed')
    ).toBeInTheDocument();
    expect(mocks.update.mutateAsync).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry public refresh' })
    );
    await waitFor(() => expect(mocks.publication).toHaveBeenCalledTimes(2));
    expect(mocks.update.mutateAsync).toHaveBeenCalledTimes(1);
  });
});
