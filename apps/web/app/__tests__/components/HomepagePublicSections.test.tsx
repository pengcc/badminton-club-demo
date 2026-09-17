import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const data = vi.hoisted(() => ({
  getHomepageContent: vi.fn(),
  getClubInformation: vi.fn(),
  getPublicContactEntries: vi.fn(),
}));

vi.mock('@app/lib/data/getHomepageContent', () => data);
vi.mock('@app/lib/data/getPublicContactEntries', () => data);
vi.mock('next-intl/server', () => ({
  getTranslations: () => (key: string) => {
    const labels: Record<string, string> = {
      'contact.title': 'Contact',
      'contact.none': 'No contacts',
      'contact.unavailable': 'Contacts unavailable',
      'contact.introductionUnavailable': 'Contact introduction unavailable',
      'homepage.mainMessageUnavailable': 'Welcome unavailable',
    };
    return labels[key] ?? key;
  },
}));

import ContactSection from '@app/components/ContactSection';
import HeroSection from '@app/components/HeroSection';

describe('approved Homepage public copy consumers', () => {
  beforeEach(() => {
    data.getClubInformation.mockResolvedValue({ status: 'unavailable' });
  });

  it('renders the CMS main message in the Hero', async () => {
    data.getHomepageContent.mockResolvedValue({
      status: 'ready',
      data: {
        mainMessage: 'Canonical homepage message',
        visitUsIntroduction: '',
        contactIntroduction: '',
      },
    });
    data.getPublicContactEntries.mockResolvedValue({
      status: 'ready',
      entries: [
        {
          id: 'contact-1',
          category: 'general',
          title: 'General Inquiries',
          description: 'General questions',
          email: 'info@club.invalid',
          qrCode: '',
          qrExplanation: '',
          externalLink: '',
          externalLinkLabel: '',
          order: 0,
        },
      ],
    });

    render(await HeroSection({ locale: 'en' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Canonical homepage message'
    );
  });

  it('uses CMS contact introduction while fixed labels remain i18n-owned', async () => {
    data.getHomepageContent.mockResolvedValue({
      status: 'ready',
      data: {
        mainMessage: 'Required message',
        visitUsIntroduction: '',
        contactIntroduction: 'Canonical contact introduction',
      },
    });

    render(await ContactSection({ locale: 'en' }));

    expect(
      screen.getByText('Canonical contact introduction')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Contact' })
    ).toBeInTheDocument();
    expect(screen.getByText('General questions')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'info@club.invalid' })
    ).toHaveAttribute('href', 'mailto:info@club.invalid');
    expect(
      screen.queryByRole('link', { name: 'Request a Taster Session' })
    ).not.toBeInTheDocument();
  });

  it('keeps ready Contacts visible when Homepage Content is unavailable', async () => {
    data.getHomepageContent.mockResolvedValue({ status: 'unavailable' });
    data.getPublicContactEntries.mockResolvedValue({
      status: 'ready',
      entries: [
        {
          id: 'contact-1',
          category: 'general',
          title: 'General Inquiries',
          description: 'General questions',
          email: 'info@club.invalid',
          qrCode: '',
          qrExplanation: '',
          externalLink: '',
          externalLinkLabel: '',
          order: 0,
        },
      ],
    });

    render(await ContactSection({ locale: 'en' }));

    expect(
      screen.getByText('Contact introduction unavailable')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'info@club.invalid' })
    ).toBeInTheDocument();
  });

  it('never renders a blank Hero for unavailable Homepage Content', async () => {
    data.getHomepageContent.mockResolvedValue({ status: 'unavailable' });

    render(await HeroSection({ locale: 'en' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Welcome unavailable'
    );
  });

  it('keeps the Homepage message and actions when club identity is unavailable', async () => {
    data.getHomepageContent.mockResolvedValue({
      status: 'ready',
      data: {
        mainMessage: 'Welcome',
        visitUsIntroduction: '',
        contactIntroduction: '',
      },
    });

    render(await HeroSection({ locale: 'en' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Welcome'
    );
    expect(
      screen.getByRole('link', { name: 'navigation.training' })
    ).toHaveAttribute('href', '/en#visit-us');
    expect(
      screen.getByRole('link', { name: 'navigation.join' })
    ).toHaveAttribute('href', '/en#participation');
  });

  it('adds the localized club identity without replacing the CMS H1', async () => {
    data.getHomepageContent.mockResolvedValue({
      status: 'ready',
      data: {
        mainMessage: 'Welcome',
        visitUsIntroduction: '',
        contactIntroduction: '',
      },
    });
    data.getClubInformation.mockResolvedValue({
      status: 'ready',
      data: { localizedName: 'Berlin Badminton Club', shortName: 'BBC' },
    });

    render(await HeroSection({ locale: 'en' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Welcome'
    );
    expect(screen.getByText('Berlin Badminton Club (BBC)')).toBeInTheDocument();
  });
});
