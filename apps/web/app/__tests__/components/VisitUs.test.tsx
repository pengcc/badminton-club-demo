import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const homepageData = vi.hoisted(() => ({
  getLocations: vi.fn(),
  getHomepageContent: vi.fn(),
}));

vi.mock('@app/lib/data/getHomepageContent', () => homepageData);
vi.mock('next-intl/server', () => ({
  getTranslations: () => (key: string) => key,
}));
vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <div role="img" aria-label={alt} data-src={src} />
  ),
}));

import VisitUs from '@app/components/VisitUs';

const timeSlot = {
  id: '0a0a0a0a-0000-4000-8000-000000000001',
  weekday: 'friday',
  startTime: '19:00',
  endTime: '21:30',
  active: true,
  guestPlayEnabled: true,
  note: { de: 'Ligaspieler', en: 'League players', zh: '联赛球员' },
};

describe('VisitUs', () => {
  it.each([
    ['de', 'Freitag', 'Ligaspieler'],
    ['en', 'Friday', 'League players'],
    ['zh', '星期五', '联赛球员'],
  ])('renders active weekly times in %s', async (locale, weekday, note) => {
    homepageData.getHomepageContent.mockResolvedValue({
      status: 'ready',
      data: { visitUsIntroduction: '' },
    });
    homepageData.getLocations.mockResolvedValue({
      status: 'ready',
      data: [
        {
          id: 'location',
          name: 'Hall',
          address: 'Address',
          imageUrl: '',
          timeSlots: [timeSlot, { ...timeSlot, id: 'inactive', active: false }],
        },
      ],
    });

    render(await VisitUs({ locale }));

    expect(screen.getByText(weekday)).toBeInTheDocument();
    expect(screen.getByText('19:00–21:30')).toBeInTheDocument();
    expect(screen.getByText(note)).toBeInTheDocument();
    expect(screen.queryByText(/inactive/i)).not.toBeInTheDocument();
  });

  it('treats optional empty introduction and zero Locations as valid empty', async () => {
    homepageData.getHomepageContent.mockResolvedValue({
      status: 'ready',
      data: { visitUsIntroduction: '' },
    });
    homepageData.getLocations.mockResolvedValue({ status: 'ready', data: [] });

    render(await VisitUs({ locale: 'en' }));

    expect(screen.getByText('visitUs.none')).toBeInTheDocument();
    expect(
      screen.queryByText('visitUs.introductionUnavailable')
    ).not.toBeInTheDocument();
  });

  it('keeps ready Homepage copy when Locations are unavailable', async () => {
    homepageData.getHomepageContent.mockResolvedValue({
      status: 'ready',
      data: { visitUsIntroduction: 'Visit introduction' },
    });
    homepageData.getLocations.mockResolvedValue({ status: 'unavailable' });

    render(await VisitUs({ locale: 'en' }));

    expect(screen.getByText('Visit introduction')).toBeInTheDocument();
    expect(screen.getByText('visitUs.unavailable')).toBeInTheDocument();
  });

  it('keeps ready Locations when Homepage copy is unavailable', async () => {
    homepageData.getHomepageContent.mockResolvedValue({
      status: 'unavailable',
    });
    homepageData.getLocations.mockResolvedValue({
      status: 'ready',
      data: [
        {
          id: 'location',
          name: 'Hall',
          address: 'Address',
          imageUrl: '',
          timeSlots: [],
        },
      ],
    });

    render(await VisitUs({ locale: 'en' }));

    expect(
      screen.getByText('visitUs.introductionUnavailable')
    ).toBeInTheDocument();
    expect(screen.getByText('Hall')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('location-default.jpeg');
  });

  it('keeps a valid CMS image unchanged', async () => {
    homepageData.getHomepageContent.mockResolvedValue({
      status: 'ready',
      data: { visitUsIntroduction: '' },
    });
    homepageData.getLocations.mockResolvedValue({
      status: 'ready',
      data: [
        {
          id: 'location',
          name: 'Hall',
          address: 'Address',
          imageUrl: '/uploads/hall.jpg',
          timeSlots: [],
        },
      ],
    });

    render(await VisitUs({ locale: 'en' }));

    expect(screen.getAllByRole('img', { name: 'Hall' })).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: 'Hall' })[0]).toHaveAttribute(
      'data-src',
      '/uploads/hall.jpg'
    );
  });
});
