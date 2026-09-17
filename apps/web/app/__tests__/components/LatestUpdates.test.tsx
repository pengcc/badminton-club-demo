import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const data = vi.hoisted(() => ({ getAnnouncements: vi.fn() }));

vi.mock('@app/lib/data/getHomepageContent', () => data);
vi.mock('next-intl/server', () => ({
  getTranslations: () => (key: string) => key,
}));

import LatestUpdates from '@app/components/LatestUpdates';

describe('LatestUpdates owner states', () => {
  it('renders ready announcements', async () => {
    data.getAnnouncements.mockResolvedValue({
      status: 'ready',
      data: [
        {
          id: 'announcement-1',
          title: 'Open training day',
          content: 'Come and meet the club.',
          displayDate: '2026.08.08',
          type: 'info',
          externalLink: 'https://example.test/update',
        },
      ],
    });

    render(await LatestUpdates({ locale: 'en' }));

    expect(screen.getByText('Open training day')).toBeInTheDocument();
    expect(screen.getByText('Come and meet the club.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'updates.externalLink' })
    ).toHaveAttribute('href', 'https://example.test/update');
  });

  it('keeps successful zero announcements as valid empty', async () => {
    data.getAnnouncements.mockResolvedValue({ status: 'ready', data: [] });

    const { container } = render(await LatestUpdates({ locale: 'en' }));

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('updates.empty.title')).not.toBeInTheDocument();
    expect(screen.queryByText('updates.unavailable')).not.toBeInTheDocument();
  });

  it('distinguishes unavailable from valid empty', async () => {
    data.getAnnouncements.mockResolvedValue({ status: 'unavailable' });

    render(await LatestUpdates({ locale: 'en' }));

    expect(screen.getByText('updates.unavailable')).toBeInTheDocument();
    expect(screen.queryByText('updates.empty.title')).not.toBeInTheDocument();
  });
});
