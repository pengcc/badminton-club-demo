import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@app/lib/data/getDemoRuntimeStatus', () => ({
  getDemoRuntimeStatus: async () => 'disabled',
}));

const data = vi.hoisted(() => ({
  getMembershipAvailability: vi.fn(),
  getPublicActivities: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
  setRequestLocale: vi.fn(),
}));
vi.mock('next/server', () => ({ connection: async () => undefined }));
vi.mock('next/navigation', () => ({ notFound: vi.fn() }));
vi.mock('@app/components/DiscoveryHeader', () => ({
  default: () => <div data-testid="header" data-discovery="true" />,
}));
vi.mock('@app/components/Footer', () => ({
  default: () => <footer data-testid="footer" />,
}));
vi.mock('@app/components/HeroSection', () => ({
  default: () => <section data-testid="hero" />,
}));
vi.mock('@app/components/VisitUs', () => ({
  default: () => <section data-testid="visit" />,
}));
vi.mock('@app/components/LatestUpdates', () => ({
  default: () => <section data-testid="updates" />,
}));
vi.mock('@app/components/AboutUs', () => ({
  default: () => <section data-testid="about" />,
}));
vi.mock('@app/components/ContactSection', () => ({
  default: () => <section data-testid="contact" />,
}));
vi.mock('@app/components/ParticipationActions', () => ({
  default: () => <section data-testid="participation" />,
}));
vi.mock('@app/components/Documents', () => ({ default: () => null }));
vi.mock('@app/components/TeamsPageContent', () => ({ default: () => null }));
vi.mock('@app/components/ActivitiesPageContent', () => ({
  default: () => null,
}));
vi.mock('@app/components/TasterSessionFormClient', () => ({
  default: () => null,
}));
vi.mock('@app/lib/data/getTeamsPageData', () => ({
  getPublicTeams: async () => ({ status: 'ready', data: [] }),
  getTeamPublicContent: async () => ({
    status: 'ready',
    data: { enabled: false, title: '', description: '' },
  }),
}));
vi.mock('@app/lib/data/getActivitiesPageData', () => ({
  getPublicActivities: data.getPublicActivities,
}));
vi.mock('@app/lib/data/getParticipationPublicContent', () => ({
  getMembershipAvailability: data.getMembershipAvailability,
  getMembershipPublicContent: async () => ({
    status: 'ready',
    content: {
      introduction: 'Membership introduction',
      membershipTypes: 'Membership types',
      membershipPath: 'Membership path',
      applicationPreparation: '',
      studentProof: '',
    },
  }),
  getTasterSessionPublicContent: async () => ({
    status: 'ready',
    content: {
      introduction: 'Taster introduction',
      preparation: '',
      participationGuidance: '',
      followUpGuidance: '',
    },
  }),
}));

import ActivitiesPage from '@app/[lang]/activities/page';
import MembershipPage from '@app/[lang]/membership/page';
import Home from '@app/[lang]/page';
import TasterSessionPage from '@app/[lang]/taster-session/page';
import TeamsPage from '@app/[lang]/teams/page';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  data.getPublicActivities.mockResolvedValue({
    status: 'ready',
    data: {
      activities: [],
      pagination: { page: 1, limit: 6, total: 0, totalPages: 0 },
    },
  });
});

describe('public discovery surfaces', () => {
  it.each([
    ['Homepage', () => Home({ params: Promise.resolve({ lang: 'en' }) })],
    ['Teams', () => TeamsPage({ params: Promise.resolve({ lang: 'en' }) })],
    [
      'Activities',
      () =>
        ActivitiesPage({
          params: Promise.resolve({ lang: 'en' }),
          searchParams: Promise.resolve({}),
        }),
    ],
    [
      'Membership',
      () => MembershipPage({ params: Promise.resolve({ lang: 'en' }) }),
    ],
    [
      'Taster Session',
      () => TasterSessionPage({ params: Promise.resolve({ lang: 'en' }) }),
    ],
  ])('renders the shared discovery Header on %s', async (_name, renderPage) => {
    data.getMembershipAvailability.mockResolvedValue(false);
    render(await renderPage());

    expect(screen.getByTestId('header')).toHaveAttribute(
      'data-discovery',
      'true'
    );
    expect(document.querySelector('main')).toHaveAttribute(
      'id',
      'main-content'
    );
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('uses not-found semantics only for positively disabled Activities', async () => {
    const { notFound } = await import('next/navigation');
    data.getPublicActivities.mockResolvedValueOnce({ status: 'disabled' });

    await ActivitiesPage({
      params: Promise.resolve({ lang: 'en' }),
      searchParams: Promise.resolve({}),
    });

    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it('places visitor orientation before announcements on the Homepage', async () => {
    render(await Home({ params: Promise.resolve({ lang: 'en' }) }));
    const main = document.querySelector('main');

    expect(main).not.toBeNull();
    expect(
      [...main!.querySelectorAll('[data-testid]')].map((node) =>
        node.getAttribute('data-testid')
      )
    ).toEqual([
      'hero',
      'visit',
      'participation',
      'updates',
      'contact',
      'about',
    ]);
  });

  it.each([
    true,
    false,
  ])('keeps existing-application recovery available when intake open is %s', async (membershipOpen) => {
    data.getMembershipAvailability.mockResolvedValue(membershipOpen);
    render(await MembershipPage({ params: Promise.resolve({ lang: 'en' }) }));

    expect(
      screen.getByRole('link', {
        name: 'membershipInformation.recoveryLink',
      })
    ).toHaveAttribute('href', '/en/apply/access');
    expect(
      screen.queryByRole('link', { name: /start|new application/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'membershipInformation.recoveryLink' })
    ).not.toHaveAttribute('href', '/en/apply');
  });
});
