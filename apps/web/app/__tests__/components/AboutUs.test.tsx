import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const data = vi.hoisted(() => ({ getClubInformation: vi.fn() }));

vi.mock('@app/lib/data/getHomepageContent', () => data);
vi.mock('next-intl/server', () => ({
  getTranslations: () => (key: string, values?: { year: number }) => {
    if (key === 'about.title') return 'About Our Club';
    if (key === 'about.founded') return `Founded in ${values?.year}`;
    if (key === 'about.unavailable') return 'Club information unavailable';
    return key;
  },
}));

import AboutUs from '@app/components/AboutUs';

describe('AboutUs canonical Club consumer', () => {
  it('renders localized identity and introduction from Club Information', async () => {
    data.getClubInformation.mockResolvedValue({
      status: 'ready',
      data: {
        localizedName: 'German-Chinese Badminton Club',
        shortName: 'DCBV',
        foundingYear: 2009,
        introduction: 'Canonical club introduction',
      },
    });

    render(await AboutUs({ locale: 'en' }));

    expect(screen.getByText('About Our Club')).toBeInTheDocument();
    expect(
      screen.getByText('German-Chinese Badminton Club (DCBV)')
    ).toBeInTheDocument();
    expect(screen.getByText('Canonical club introduction')).toBeInTheDocument();
    expect(screen.getByText('Founded in 2009')).toBeInTheDocument();
  });

  it('renders the owner-local unavailable state', async () => {
    data.getClubInformation.mockResolvedValue({ status: 'unavailable' });

    render(await AboutUs({ locale: 'en' }));

    expect(
      screen.getByText('Club information unavailable')
    ).toBeInTheDocument();
  });
});
