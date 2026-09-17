import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const data = vi.hoisted(() => ({ getPublicDocuments: vi.fn() }));
vi.mock('@app/lib/data/getPublicDocuments', () => data);
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, values?: { date?: string }) =>
    values?.date ? `${key}:${values.date}` : key,
}));

import Documents from '@app/components/Documents';

describe('Public Documents consumer', () => {
  it('renders only the ordered localized projection returned by its owner', async () => {
    data.getPublicDocuments.mockResolvedValue({
      status: 'ready',
      documents: [
        {
          id: '507f1f77bcf86cd799439011',
          displayName: 'Fee regulation',
          documentDate: '2024-12-04',
          fileUrl: '/documents/Beitragsordnung.pdf',
        },
        {
          id: '507f1f77bcf86cd799439012',
          displayName: 'Statutes',
          documentDate: '2012-06-09',
          fileUrl: '/uploads/public-documents/id/statutes.pdf',
        },
      ],
    });
    render(await Documents({ locale: 'en' }));

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(
      ['Fee regulation', 'Statutes']
    );
    expect(
      screen.getByText('document_version_date:2024-12-04')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Statutes' })).toHaveAttribute(
      'href',
      '/uploads/public-documents/id/statutes.pdf'
    );
  });

  it('renders the truthful empty state when every slot is hidden', async () => {
    data.getPublicDocuments.mockResolvedValue({
      status: 'ready',
      documents: [],
    });
    render(await Documents({ locale: 'de' }));
    expect(screen.getByText('documents_none')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders an unavailable state when the owner API cannot be read', async () => {
    data.getPublicDocuments.mockResolvedValue({ status: 'unavailable' });
    render(await Documents({ locale: 'zh' }));
    expect(screen.getByText('documents_unavailable')).toBeInTheDocument();
    expect(screen.queryByText('documents_none')).not.toBeInTheDocument();
  });
});
