import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import dashboardDe from '../../../messages/de/dashboard.json';
import dashboardEn from '../../../messages/en/dashboard.json';
import dashboardZh from '../../../messages/zh/dashboard.json';

vi.mock('next-intl', async () => {
  const { dashboardTranslator } = await import('../testI18nMock');
  return {
    useLocale: () => 'en',
    useTranslations: dashboardTranslator,
  };
});

vi.mock('@app/components/Dashboard/AnnouncementManager', () => ({
  default: () => <div>announcement-owner</div>,
}));
vi.mock('@app/components/Dashboard/ActivityManager', () => ({
  default: () => <div>activity-owner</div>,
}));
vi.mock('@app/components/Dashboard/ClubInformationEditor', () => ({
  default: () => <div>club-profile-owner</div>,
}));
vi.mock('@app/components/Dashboard/LocationManager', () => ({
  default: () => <div>location-owner</div>,
}));
vi.mock('@app/components/Dashboard/ContactEntryManager', () => ({
  default: () => <div>contact-owner</div>,
}));

import ClubInformationContentEditor from '@app/components/Dashboard/content/ClubInformationContentEditor';
import CommunicationContentEditor from '@app/components/Dashboard/content/CommunicationContentEditor';
import ContentOverview from '@app/components/Dashboard/content/ContentOverview';

describe('Content administration information architecture', () => {
  it('describes Governance as document work in every locale', () => {
    expect([
      dashboardEn.cms.content.groups.governance.description,
      dashboardDe.cms.content.groups.governance.description,
      dashboardZh.cms.content.groups.governance.description,
    ]).toEqual([
      'Public club governance documents and policies.',
      'Öffentliche Dokumente und Richtlinien zur Vereinsführung.',
      '俱乐部治理的公开文件和规章。',
    ]);
  });

  it('shows exactly three responsibility groups and six locale-preserving destinations', () => {
    render(<ContentOverview />);

    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent)
    ).toEqual([
      'Website & Communication',
      'Membership & Recruitment',
      'Governance',
    ]);

    const destinations = [
      ['Homepage', '/en/dashboard/content/homepage'],
      ['Club communication', '/en/dashboard/content/communication'],
      ['Club basic information', '/en/dashboard/content/club-information'],
      [
        'Membership / Participation',
        '/en/dashboard/content/membership-participation',
      ],
      ['Recruitment', '/en/dashboard/content/recruitment'],
      ['Club governance / Documents', '/en/dashboard/content/documents'],
    ] as const;

    for (const [name, href] of destinations) {
      expect(
        screen.getByRole('link', { name: new RegExp(name) })
      ).toHaveAttribute('href', href);
    }
    expect(screen.getAllByRole('link')).toHaveLength(6);
  });

  it('keeps Announcements and Activities as local Club communication tasks', async () => {
    const user = userEvent.setup();
    render(<CommunicationContentEditor />);

    expect(screen.getByRole('tablist')).toHaveClass(
      'grid-cols-2',
      'items-stretch',
      'group-data-[orientation=horizontal]/tabs:h-auto'
    );
    expect(screen.getByRole('tablist')).toHaveAttribute(
      'aria-orientation',
      'horizontal'
    );
    expect(
      screen
        .getAllByRole('tab')
        .every(
          (tab) =>
            tab.classList.contains('min-w-0') &&
            tab.classList.contains('break-all')
        )
    ).toBe(true);

    expect(screen.getByText('announcement-owner')).toBeVisible();
    expect(screen.queryByText('activity-owner')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Activities' }));
    expect(screen.getByText('activity-owner')).toBeVisible();
  });

  it('keeps Club profile, Locations, and Contact inside Club basic information', async () => {
    const user = userEvent.setup();
    render(<ClubInformationContentEditor />);

    expect(screen.getByRole('tablist')).toHaveClass(
      'grid-cols-3',
      'items-stretch',
      'group-data-[orientation=horizontal]/tabs:h-auto'
    );
    expect(screen.getByRole('tablist')).toHaveAttribute(
      'aria-orientation',
      'horizontal'
    );
    expect(
      screen
        .getAllByRole('tab')
        .every(
          (tab) =>
            tab.classList.contains('min-w-0') &&
            tab.classList.contains('break-all')
        )
    ).toBe(true);

    expect(screen.getByText('club-profile-owner')).toBeVisible();
    await user.click(screen.getByRole('tab', { name: 'Locations' }));
    expect(screen.getByText('location-owner')).toBeVisible();
    await user.click(screen.getByRole('tab', { name: 'Contact' }));
    expect(screen.getByText('contact-owner')).toBeVisible();
  });
});
