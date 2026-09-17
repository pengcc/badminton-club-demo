import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const data = vi.hoisted(() => ({
  getTasterSessionPublicContent: vi.fn(),
  getMembershipPublicContent: vi.fn(),
  getMembershipAvailability: vi.fn(),
  getDemoRuntimeStatus: vi.fn(),
}));

vi.mock('@app/lib/data/getParticipationPublicContent', () => data);
vi.mock('@app/lib/data/getDemoRuntimeStatus', () => data);
vi.mock('@app/components/DiscoveryHeader', () => ({
  default: () => <div>Header</div>,
}));
vi.mock('@app/components/Footer', () => ({ default: () => <div>Footer</div> }));
vi.mock('@app/components/Documents', () => ({
  default: () => <div>Visible Public Documents</div>,
}));
vi.mock('@app/components/TasterSessionFormClient', () => ({
  default: () => <div>Existing Taster request form</div>,
}));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: () => (key: string) => {
    const labels: Record<string, string> = {
      'participation.title': 'Join Us',
      'participation.unavailable': 'Unavailable',
      'participation.informationUnavailable': 'Information unavailable',
      'participation.taster.title': 'Taster Session',
      'participation.taster.action': 'Request a Taster Session',
      'participation.taster.preparation': 'Preparation',
      'participation.taster.guidance': 'Guidance',
      'participation.taster.followUp': 'Follow up',
      'participation.membership.title': 'Become a Member',
      'participation.membership.action': 'Membership Information',
      'participation.recruitment.title': 'Join a Competitive Team',
      'participation.recruitment.summary': 'Experienced players welcome.',
      'participation.recruitment.action': 'Team Recruitment',
      'pages.tasterSession': 'Taster Session information',
      'pages.membershipInformation': 'Membership',
      'tasterSession.title': 'Request form',
      'membershipInformation.open': 'Applications are open',
      'membershipInformation.closed': 'Applications are closed',
      'membershipInformation.statusUnavailable': 'Status unavailable',
      'membershipInformation.types': 'Membership types',
      'membershipInformation.path': 'Membership path',
      'membershipInformation.preparation': 'Application preparation',
      'membershipInformation.studentProof': 'Student proof',
      'membershipInformation.controlledApplication':
        'Formal application access remains controlled.',
      'membershipInformation.recoveryLink': 'View membership application',
      'membershipInformation.tasterLink': 'Taster link',
      'membershipInformation.contactLink': 'Contact link',
    };
    return labels[key] ?? key;
  },
}));
vi.mock('next/server', () => ({ connection: async () => undefined }));

import ParticipationActions from '@app/components/ParticipationActions';
import TasterSessionPage from '@app/[lang]/taster-session/page';
import MembershipPage from '@app/[lang]/membership/page';

const tasterContent = {
  homepageSummary: 'Try the club first.',
  introduction: 'Visitor information.',
  preparation: 'Bring suitable equipment.',
  participationGuidance: '',
  followUpGuidance: 'The club follows up.',
};
const membershipContent = {
  homepageSummary: 'Learn how membership works.',
  introduction: 'Membership introduction.',
  membershipTypes: 'Active and passive membership.',
  membershipPath: 'Taster Session, approval, controlled application.',
  applicationPreparation: '',
  studentProof: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  data.getDemoRuntimeStatus.mockResolvedValue('disabled');
  data.getTasterSessionPublicContent.mockResolvedValue({
    status: 'ready',
    content: tasterContent,
  });
  data.getMembershipPublicContent.mockResolvedValue({
    status: 'ready',
    content: membershipContent,
  });
  data.getMembershipAvailability.mockResolvedValue(false);
});

describe('WP5B public surfaces', () => {
  it('projects owner summaries into fixed homepage actions', async () => {
    render(await ParticipationActions({ locale: 'en' }));

    expect(
      screen.getByRole('heading', { name: 'Join Us' })
    ).toBeInTheDocument();
    expect(screen.getByText('Try the club first.')).toBeInTheDocument();
    expect(screen.getByText('Learn how membership works.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Request a Taster Session/ })
    ).toHaveAttribute('href', '/en/taster-session');
    expect(
      screen.getByRole('link', { name: /Request a Taster Session/ })
    ).toHaveAttribute('data-slot', 'button');
    expect(
      screen.getByRole('link', { name: /Membership Information/ })
    ).toHaveAttribute('href', '/en/membership');
    expect(
      screen.getByRole('link', { name: /Membership Information/ })
    ).toHaveAttribute('data-slot', 'button');
    expect(
      screen.getByText('Experienced players welcome.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Team Recruitment/ })
    ).toHaveAttribute('href', '/en/recruitment');
  });

  it('renders Taster information before the unchanged request form', async () => {
    render(
      await TasterSessionPage({ params: Promise.resolve({ lang: 'en' }) })
    );

    const information = screen.getByText('Visitor information.');
    const form = screen.getByText('Existing Taster request form');
    expect(
      information.compareDocumentPosition(form) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('shows the unavailable message instead of empty Taster information', async () => {
    data.getTasterSessionPublicContent.mockResolvedValue({
      status: 'unavailable',
    });

    render(
      await TasterSessionPage({ params: Promise.resolve({ lang: 'en' }) })
    );

    expect(screen.getByText('Information unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Visitor information.')).not.toBeInTheDocument();
    expect(
      screen.getByText('Existing Taster request form')
    ).toBeInTheDocument();
  });

  it('keeps Membership information visible when intake is closed and exposes only verified application access', async () => {
    render(await MembershipPage({ params: Promise.resolve({ lang: 'en' }) }));

    expect(screen.getByText('Applications are closed')).toBeInTheDocument();
    expect(screen.getByText('Membership introduction.')).toBeInTheDocument();
    expect(screen.getByText('Visible Public Documents')).toBeInTheDocument();
    expect(
      screen.getByText('Formal application access remains controlled.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View membership application' })
    ).toHaveAttribute('href', '/en/apply/access');
  });

  it('keeps the same information-only surface when intake is open', async () => {
    data.getMembershipAvailability.mockResolvedValue(true);

    render(await MembershipPage({ params: Promise.resolve({ lang: 'en' }) }));

    expect(screen.getByText('Applications are open')).toBeInTheDocument();
    expect(screen.getByText('Membership introduction.')).toBeInTheDocument();
    expect(screen.getByText('Visible Public Documents')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View membership application' })
    ).toHaveAttribute('href', '/en/apply/access');
  });

  it('shows the unavailable message instead of empty Membership sections', async () => {
    data.getMembershipPublicContent.mockResolvedValue({
      status: 'unavailable',
    });

    render(await MembershipPage({ params: Promise.resolve({ lang: 'en' }) }));

    expect(screen.getByText('Information unavailable')).toBeInTheDocument();
    expect(
      screen.queryByText('Membership introduction.')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Membership types')).not.toBeInTheDocument();
    expect(screen.queryByText('Membership path')).not.toBeInTheDocument();
  });
});

describe('public demo participation boundaries', () => {
  it.each([
    'enabled',
    'unavailable',
  ])('retains Taster information without a request form when status is %s', async (status) => {
    data.getDemoRuntimeStatus.mockResolvedValue(status);
    render(
      await TasterSessionPage({ params: Promise.resolve({ lang: 'en' }) })
    );
    expect(screen.getByText('Visitor information.')).toBeVisible();
    expect(
      screen.queryByText('Existing Taster request form')
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        status === 'enabled'
          ? 'participation.taster.demoUnavailable'
          : 'participation.taster.requestUnavailable'
      )
    ).toBeVisible();
  });

  it.each([
    'enabled',
    'unavailable',
  ])('retains Membership information and safe navigation when status is %s', async (status) => {
    data.getDemoRuntimeStatus.mockResolvedValue(status);
    render(await MembershipPage({ params: Promise.resolve({ lang: 'en' }) }));
    expect(screen.getByText('Membership introduction.')).toBeVisible();
    expect(screen.getByText('Applications are closed')).toBeVisible();
    expect(screen.getByText('Visible Public Documents')).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'View membership application' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Taster link' })).toHaveAttribute(
      'href',
      '/en/taster-session'
    );
    expect(screen.getByRole('link', { name: 'Contact link' })).toHaveAttribute(
      'href',
      '/en#contact'
    );
  });
});
