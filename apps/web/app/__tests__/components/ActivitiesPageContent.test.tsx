import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ActivitiesPageContent from '@app/components/ActivitiesPageContent';
import { renderWithIntl } from '../utils/renderWithIntl';

const pagination = { page: 1, limit: 6, total: 0, totalPages: 0 };

describe('ActivitiesPageContent owner states', () => {
  it('renders ready text-only Activities', () => {
    renderWithIntl(
      <ActivitiesPageContent
        lang="en"
        result={{
          status: 'ready',
          data: {
            activities: [
              {
                id: 'activity-1',
                name: 'Open training day',
                description: 'Meet the club.',
                images: [],
                videoLink: '',
                videoDescription: '',
                isVisible: true,
                order: 1,
                createdAt: '2026-08-08T00:00:00.000Z',
                updatedAt: '2026-08-08T00:00:00.000Z',
              },
            ],
            pagination: { ...pagination, total: 1, totalPages: 1 },
          },
        }}
      />
    );

    expect(screen.getByText('Open training day')).toBeInTheDocument();
    expect(screen.getByText('Meet the club.')).toBeInTheDocument();
  });

  it('distinguishes ready-empty from unavailable without fabricating pagination', () => {
    const readyEmpty = renderWithIntl(
      <ActivitiesPageContent
        lang="en"
        result={{
          status: 'ready',
          data: { activities: [], pagination },
        }}
      />
    );
    expect(
      screen.getByText('common.activities.noActivities')
    ).toBeInTheDocument();
    readyEmpty.unmount();

    renderWithIntl(
      <ActivitiesPageContent lang="en" result={{ status: 'unavailable' }} />
    );
    expect(
      screen.getByText('common.activities.unavailable')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Pagination' })
    ).not.toBeInTheDocument();
  });

  it.each([
    [2, '/en/activities?page=2'],
    [0, '/en/activities'],
  ])('renders one recovery link without pagination controls for an out-of-range ready page with %d total pages', (totalPages, recoveryHref) => {
    renderWithIntl(
      <ActivitiesPageContent
        lang="en"
        result={{
          status: 'ready',
          data: {
            activities: [],
            pagination: {
              ...pagination,
              page: 50,
              totalPages,
            },
          },
        }}
      />,
      {
        messages: {
          common: {
            activities: {
              pageTitle: 'Activities',
              noActivities: 'No activities',
              unavailable: 'Activities unavailable',
              pageOutOfRange: 'Page {page} is not available.',
              returnToAvailable: 'View available activities',
              pagination: 'Activities pages',
              page: 'Page {page}',
              pageStatus: 'Page {page} of {total}',
              previous: 'Previous',
              next: 'Next',
            },
          },
        },
      }
    );

    expect(screen.getByText('Page 50 is not available.')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'View available activities' })
    ).toHaveAttribute('href', recoveryHref);
    expect(
      screen.queryByRole('navigation', { name: 'Activities pages' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Page 1' })
    ).not.toBeInTheDocument();
  });

  it('uses localized semantic gallery controls and restores trigger focus', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <ActivitiesPageContent
        lang="zh"
        result={{
          status: 'ready',
          data: {
            activities: [
              {
                id: 'activity-1',
                name: '开放训练日',
                description: '',
                images: ['/uploads/one.jpg', '/uploads/two.jpg'],
                videoLink: '',
                videoDescription: '',
                isVisible: true,
                order: 1,
                createdAt: '2026-08-08T00:00:00.000Z',
                updatedAt: '2026-08-08T00:00:00.000Z',
              },
            ],
            pagination: { ...pagination, total: 1, totalPages: 1 },
          },
        }}
      />,
      {
        locale: 'zh',
        messages: {
          common: {
            activities: {
              pageTitle: '活动',
              noActivities: '暂无活动',
              unavailable: '无法加载活动',
              watchVideo: '观看视频',
              openImage: '打开{name}的第{number}张图片',
              lightboxTitle: '{name}图片库',
              lightboxImage: '{name}，第{number}张，共{total}张',
              closeGallery: '关闭图片库',
              previousImage: '上一张图片',
              nextImage: '下一张图片',
              pagination: '活动分页',
              page: '第{page}页',
              previous: '上一页',
              next: '下一页',
            },
          },
        },
      }
    );

    const trigger = screen.getByRole('button', {
      name: '打开开放训练日的第1张图片',
    });
    await user.click(trigger);

    expect(
      screen.getByRole('dialog', { name: '开放训练日图片库' })
    ).toBeVisible();
    expect(
      screen.getByRole('img', { name: '开放训练日，第1张，共2张' })
    ).toBeVisible();

    await user.keyboard('{ArrowRight}');
    expect(
      screen.getByRole('img', { name: '开放训练日，第2张，共2张' })
    ).toBeVisible();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('renders compact mobile status and bounded desktop controls for many pages', () => {
    renderWithIntl(
      <ActivitiesPageContent
        lang="en"
        result={{
          status: 'ready',
          data: {
            activities: [],
            pagination: { ...pagination, page: 5, totalPages: 10 },
          },
        }}
      />,
      {
        messages: {
          common: {
            activities: {
              pageTitle: 'Activities',
              noActivities: 'No activities',
              pagination: 'Activities pages',
              page: 'Page {page}',
              pageStatus: 'Page {page} of {total}',
              previous: 'Previous',
              next: 'Next',
            },
          },
        },
      }
    );

    expect(
      screen.getByRole('navigation', { name: 'Activities pages' })
    ).toBeInTheDocument();
    expect(screen.getByText('Page 5 of 10')).toHaveClass('sm:hidden');
    expect(screen.getByRole('link', { name: 'Page 5' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: 'Page 1' })).toHaveAttribute(
      'href',
      '/en/activities'
    );
    expect(
      screen.queryByRole('link', { name: 'Page 2' })
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('…')).toHaveLength(2);
  });
});
