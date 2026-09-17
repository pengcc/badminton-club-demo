import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import commonDe from '../../../messages/de/common.json';
import commonEn from '../../../messages/en/common.json';
import commonZh from '../../../messages/zh/common.json';
import { TeamLevel } from '@club/shared-types/core/enums';

vi.mock('next-intl/server', () => ({
  getTranslations: () => (key: string) => key,
}));

import RecruitmentPageContent from '@app/components/RecruitmentPageContent';

const recruitment = {
  status: 'ready' as const,
  content: {
    isOpen: true,
    introduction: 'Competitive players are welcome.',
    requirements: 'Bring competition experience.\nTrain consistently.',
    tryoutGuidance: 'Tell us about your badminton background.',
    contactEntryId: '507f1f77bcf86cd799439011',
  },
};
const teams = {
  status: 'ready' as const,
  data: [
    { shortName: 'DCBV 1', leagueTeamName: 'DCBV', matchLevel: TeamLevel.A },
  ],
};
const locations = {
  status: 'ready' as const,
  data: [
    {
      id: 'location-1',
      name: 'Sports Hall',
      address: 'Club Street 1',
      imageUrl: '',
      timeSlots: [
        {
          id: 'slot-1',
          weekday: 'friday' as const,
          startTime: '19:00',
          endTime: '21:00',
          active: true,
          guestPlayEnabled: false,
          tasterSessionEnabled: false,
          tasterSessionAcceptedLevels: [],
        },
        {
          id: 'slot-2',
          weekday: 'friday' as const,
          startTime: '21:00',
          endTime: '22:00',
          active: true,
          guestPlayEnabled: false,
          tasterSessionEnabled: false,
          tasterSessionAcceptedLevels: [],
        },
      ],
    },
  ],
};
const contacts = {
  status: 'ready' as const,
  entries: [
    {
      id: '507f1f77bcf86cd799439011',
      category: 'sport',
      title: 'Sport contact',
      description: 'Coordinates team conversations.',
      email: 'sport@example.test',
      qrCode: '',
      qrExplanation: '',
      externalLink: '',
      externalLinkLabel: '',
      order: 0,
    },
  ],
};

describe('RecruitmentPageContent', () => {
  it('preserves the approved tryout-process meaning in every locale', () => {
    expect(commonZh.recruitment.process.responsible.description).toBe(
      '通过微信或邮件与负责人取得联系，简单介绍自己，表达试打意向。'
    );
    expect(commonZh.recruitment.process.tryout.description).toBe(
      '负责人了解情况后，为你安排合适的试打时间与训练参与。'
    );
    expect(commonZh.recruitment.process.evaluation.description).toBe(
      '通过试打与交流，教练组综合评估，双方合适即可正式加入球队。'
    );
    expect(commonDe.recruitment.process.responsible.description).toContain(
      'WeChat oder E-Mail'
    );
    expect(commonDe.recruitment.process.tryout.description).toContain(
      'und die Teilnahme am Mannschaftstraining'
    );
    expect(commonEn.recruitment.process.responsible.description).toContain(
      'WeChat or email'
    );
    expect(commonEn.recruitment.process.tryout.description).toContain(
      'and participation in team training'
    );
  });

  it('composes owner facts and exposes only the selected Contact in open state', async () => {
    render(
      await RecruitmentPageContent({
        locale: 'en',
        recruitment,
        teams,
        locations,
        contacts,
      })
    );

    expect(
      screen.getByText('Competitive players are welcome.')
    ).toBeInTheDocument();
    expect(screen.getByText('DCBV 1')).toBeInTheDocument();
    expect(screen.getByText('A-Klasse')).toBeInTheDocument();
    expect(
      screen.getByText('Bring competition experience.')
    ).toBeInTheDocument();
    expect(screen.getByText('Train consistently.')).toBeInTheDocument();
    expect(screen.getByText('Friday')).toBeInTheDocument();
    expect(screen.queryByText('Club Street 1')).not.toBeInTheDocument();
    expect(screen.queryByText(/19:00/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'teams.detailLink' })
    ).toHaveAttribute('href', '/en/teams');
    expect(
      screen.getByRole('link', { name: 'training.detailLink' })
    ).toHaveAttribute('href', '/en#visit-us');
    const emailChannel = screen.getByRole('article', {
      name: 'contact.emailLabel',
    });
    expect(emailChannel).toHaveTextContent(
      'Tell us about your badminton background.'
    );
    expect(
      screen.getByRole('article', { name: 'contact.wechatLabel' })
    ).toHaveTextContent('contact.wechatUnavailable');
    expect(
      [...document.querySelectorAll('img')].some((image) =>
        image.getAttribute('src')?.includes('wechat.png')
      )
    ).toBe(true);
    expect(
      screen.getByRole('link', { name: /sport@example.test/ })
    ).toHaveAttribute('href', 'mailto:sport@example.test');
    expect(screen.queryByText('Sport contact')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Coordinates team conversations.')
    ).not.toBeInTheDocument();
    expect(screen.getByText('process.responsible.title')).toBeInTheDocument();
    expect(screen.getByText('process.tryout.title')).toBeInTheDocument();
    expect(screen.getByText('process.evaluation.title')).toBeInTheDocument();
    expect(screen.queryByText(/Taster Session/i)).not.toBeInTheDocument();
    expect(screen.queryByText('status.open')).not.toBeInTheDocument();
    expect(screen.getByText('closing.title')).toBeInTheDocument();
    expect(screen.getByText('closing.description')).toBeInTheDocument();
  });

  it('renders real selected Contact QR data in the fixed WeChat region', async () => {
    render(
      await RecruitmentPageContent({
        locale: 'en',
        recruitment,
        teams,
        locations,
        contacts: {
          status: 'ready',
          entries: [
            {
              ...contacts.entries[0],
              qrCode: '/uploads/contact/recruitment-qr.png',
              qrExplanation: 'Scan the maintained contact QR code.',
            },
          ],
        },
      })
    );

    const wechatRegion = screen.getByRole('article', {
      name: 'contact.wechatLabel',
    });
    expect(wechatRegion).toHaveTextContent(
      'Scan the maintained contact QR code.'
    );
    expect(
      screen
        .getByRole('img', {
          name: 'Scan the maintained contact QR code.',
        })
        .getAttribute('src')
    ).toContain('%2Fuploads%2Fcontact%2Frecruitment-qr.png');
  });

  it('does not call a real selected Contact QR unavailable when its explanation is empty', async () => {
    render(
      await RecruitmentPageContent({
        locale: 'en',
        recruitment,
        teams,
        locations,
        contacts: {
          status: 'ready',
          entries: [
            {
              ...contacts.entries[0],
              qrCode: '/uploads/contact/recruitment-qr.png',
              qrExplanation: '',
            },
          ],
        },
      })
    );

    const wechatRegion = screen.getByRole('article', {
      name: 'contact.wechatLabel',
    });
    expect(wechatRegion).not.toHaveTextContent('contact.wechatUnavailable');
    expect(
      screen.getByRole('img', { name: 'contact.wechatLabel' })
    ).toBeInTheDocument();
  });

  it('keeps paused content stable without a Contact action or process', async () => {
    render(
      await RecruitmentPageContent({
        locale: 'en',
        recruitment: {
          ...recruitment,
          content: { ...recruitment.content, isOpen: false },
        },
        teams,
        locations,
        contacts,
      })
    );

    expect(screen.getByText('status.paused')).toBeInTheDocument();
    expect(screen.getByText('DCBV 1')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /sport@example.test/ })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('process.title')).not.toBeInTheDocument();
  });

  it('does not fall back when the selected Contact is unavailable', async () => {
    render(
      await RecruitmentPageContent({
        locale: 'en',
        recruitment,
        teams: { status: 'unavailable' },
        locations,
        contacts: {
          status: 'ready',
          entries: [{ ...contacts.entries[0], id: '507f1f77bcf86cd799439012' }],
        },
      })
    );

    expect(screen.getByText('teams.unavailable')).toBeInTheDocument();
    expect(screen.getByText('contact.unavailable')).toBeInTheDocument();
    expect(screen.getByText('closing.description')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /sport@example.test/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /taster/i })
    ).not.toBeInTheDocument();
  });

  it('shows a neutral unavailable state rather than false open or paused status', async () => {
    render(
      await RecruitmentPageContent({
        locale: 'en',
        recruitment: { status: 'unavailable' },
        teams,
        locations: { status: 'unavailable' },
        contacts: { status: 'unavailable' },
      })
    );

    expect(screen.getByText('unavailable')).toBeInTheDocument();
    expect(screen.getByText('closing.description')).toBeInTheDocument();
    expect(screen.queryByText('status.open')).not.toBeInTheDocument();
    expect(screen.queryByText('status.paused')).not.toBeInTheDocument();
  });
});
