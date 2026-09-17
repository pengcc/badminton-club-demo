import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TeamsPageContent from '@app/components/TeamsPageContent';
import { renderWithIntl } from '../utils/renderWithIntl';
import { TeamLevel } from '@club/shared-types/core/enums';

const teams = [
  {
    shortName: 'Team 1',
    leagueTeamName: 'DCBV',
    matchLevel: TeamLevel.C,
  },
];

describe('TeamsPageContent', () => {
  it('renders the resolved introduction without replacing team facts', () => {
    renderWithIntl(
      <TeamsPageContent
        teams={{ status: 'ready', data: teams }}
        content={{
          status: 'ready',
          data: {
            enabled: true,
            title: 'Localized introduction',
            description: 'Localized Team copy',
          },
        }}
      />
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Localized introduction' })
    ).toBeInTheDocument();
    expect(screen.getByText('Localized Team copy')).toBeInTheDocument();
    expect(screen.getByText('Team 1')).toBeInTheDocument();
    expect(screen.getByText('DCBV')).toBeInTheDocument();
    expect(screen.getByText(/C-Klasse/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /common.teams.recruitment.action/ })
    ).toHaveAttribute('href', '/en/recruitment');
  });

  it('hides only the introduction when disabled', () => {
    renderWithIntl(
      <TeamsPageContent
        teams={{ status: 'ready', data: teams }}
        content={{
          status: 'ready',
          data: {
            enabled: false,
            title: 'Hidden title',
            description: 'Hidden introduction',
          },
        }}
      />
    );
    expect(screen.queryByText('Hidden title')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden introduction')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'common.teams.pageTitle',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Team 1')).toBeInTheDocument();
  });

  it('keeps ready Teams visible when the introduction is unavailable', () => {
    renderWithIntl(
      <TeamsPageContent
        teams={{ status: 'ready', data: teams }}
        content={{ status: 'unavailable' }}
      />
    );

    expect(
      screen.getByText('common.teams.introductionUnavailable')
    ).toBeInTheDocument();
    expect(screen.getByText('Team 1')).toBeInTheDocument();
  });

  it('keeps an enabled introduction visible when the Team list is unavailable', () => {
    renderWithIntl(
      <TeamsPageContent
        teams={{ status: 'unavailable' }}
        content={{
          status: 'ready',
          data: {
            enabled: true,
            title: 'Localized introduction',
            description: 'Localized Team copy',
          },
        }}
      />
    );

    expect(screen.getByText('Localized Team copy')).toBeInTheDocument();
    expect(screen.getByText('common.teams.unavailable')).toBeInTheDocument();
  });

  it('distinguishes ready-empty Teams from total unavailability', () => {
    const readyEmpty = renderWithIntl(
      <TeamsPageContent
        teams={{ status: 'ready', data: [] }}
        content={{
          status: 'ready',
          data: { enabled: false, title: '', description: '' },
        }}
      />
    );
    expect(screen.getByText('common.teams.noTeams')).toBeInTheDocument();
    readyEmpty.unmount();

    renderWithIntl(
      <TeamsPageContent
        teams={{ status: 'unavailable' }}
        content={{ status: 'unavailable' }}
      />
    );
    expect(screen.getByText('common.teams.unavailable')).toBeInTheDocument();
    expect(
      screen.getByText('common.teams.introductionUnavailable')
    ).toBeInTheDocument();
  });
});
