import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import dashboardEn from '../../../messages/en/dashboard.json';
import dashboardZh from '../../../messages/zh/dashboard.json';
import { notificationRecipientsQueryKey } from '@app/services/notificationSettingsService';

const api = vi.hoisted(() => ({
  getNotificationRecipients: vi.fn(),
  updateNotificationRecipients: vi.fn(),
}));

vi.mock('@app/lib/api/settingsApi', () => ({ settingsApi: api }));

import NotificationSettings from '@app/components/Dashboard/NotificationSettings';

const loadedRecipients = {
  applicationAlerts: [] as string[],
  tasterSessionAlerts: [] as string[],
  guestPlayAlerts: ['existing@example.test'],
};

function renderSettings(locale: 'en' | 'zh' = 'en') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  const dashboard = locale === 'en' ? dashboardEn : dashboardZh;

  render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale={locale} messages={{ dashboard }}>
        <NotificationSettings />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );

  return queryClient;
}

function addEmail(cardTitle: string, email: string) {
  const card = screen
    .getByText(cardTitle)
    .closest('[data-slot="card"]') as HTMLElement;
  const input = within(card).getByRole('textbox');
  fireEvent.change(input, { target: { value: email } });
  fireEvent.keyDown(input, { key: 'Enter' });
  return card;
}

describe('Notification Settings state convergence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getNotificationRecipients.mockResolvedValue(loadedRecipients);
    api.updateNotificationRecipients.mockResolvedValue(loadedRecipients);
  });

  it('shows only the three owned families and treats loaded empty as saveable truth', async () => {
    const user = userEvent.setup();
    renderSettings();

    expect(
      await screen.findByText('Membership Application alerts')
    ).toBeVisible();
    expect(screen.getByText('Taster Session alerts')).toBeVisible();
    expect(screen.getByText('Guest Play alerts')).toBeVisible();
    expect(screen.queryByText(/Member Welcome/)).not.toBeInTheDocument();
    expect(screen.queryByText(/System Alert/)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Save Membership Application recipients',
      })
    );

    expect(api.updateNotificationRecipients).toHaveBeenCalledWith(
      'applicationAlerts',
      []
    );
  });

  it('blocks editing on initial failure and retries into authoritative data', async () => {
    const user = userEvent.setup();
    api.getNotificationRecipients.mockRejectedValueOnce(new Error('offline'));
    renderSettings();

    expect(
      await screen.findByText('Notification settings could not be loaded.')
    ).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Save Guest Play recipients')
    ).not.toBeInTheDocument();

    api.getNotificationRecipients.mockResolvedValueOnce(loadedRecipients);
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Guest Play alerts')).toBeVisible();
    expect(screen.getByText('existing@example.test')).toBeVisible();
  });

  it('retains loaded data and exposes retry when a background refresh fails', async () => {
    const queryClient = renderSettings();
    expect(await screen.findByText('existing@example.test')).toBeVisible();

    api.getNotificationRecipients.mockRejectedValueOnce(new Error('offline'));
    await queryClient.refetchQueries({
      queryKey: notificationRecipientsQueryKey,
    });

    expect(
      await screen.findByText(
        /latest recipient settings could not be refreshed/i
      )
    ).toBeVisible();
    expect(screen.getByText('existing@example.test')).toBeVisible();
  });

  it('does not overwrite a dirty draft when remote data changes', async () => {
    const queryClient = renderSettings();
    await screen.findByText('Membership Application alerts');
    addEmail('Membership Application alerts', 'draft@example.test');

    queryClient.setQueryData(notificationRecipientsQueryKey, {
      ...loadedRecipients,
      applicationAlerts: ['server@example.test'],
    });

    expect(await screen.findByText('draft@example.test')).toBeVisible();
    expect(screen.queryByText('server@example.test')).not.toBeInTheDocument();
  });

  it('converges the saved family to server data without losing another dirty draft', async () => {
    const user = userEvent.setup();
    renderSettings();
    await screen.findByText('Membership Application alerts');
    const applicationCard = addEmail(
      'Membership Application alerts',
      'application@example.test'
    );
    addEmail('Taster Session alerts', 'draft-taster@example.test');
    api.updateNotificationRecipients.mockResolvedValueOnce({
      applicationAlerts: ['server-normalized@example.test'],
      tasterSessionAlerts: [],
      guestPlayAlerts: ['existing@example.test'],
    });

    await user.click(
      within(applicationCard).getByRole('button', {
        name: 'Save Membership Application recipients',
      })
    );

    expect(
      await screen.findByText('server-normalized@example.test')
    ).toBeVisible();
    expect(
      screen.queryByText('application@example.test')
    ).not.toBeInTheDocument();
    expect(screen.getByText('draft-taster@example.test')).toBeVisible();
  });

  it('preserves the dirty draft when saving fails', async () => {
    const user = userEvent.setup();
    renderSettings();
    await screen.findByText('Guest Play alerts');
    const guestCard = addEmail('Guest Play alerts', 'draft@example.test');
    api.updateNotificationRecipients.mockRejectedValueOnce(
      new Error('offline')
    );

    await user.click(
      within(guestCard).getByRole('button', {
        name: 'Save Guest Play recipients',
      })
    );

    expect(
      await screen.findByText('Notification recipients could not be saved.')
    ).toBeVisible();
    expect(screen.getByText('draft@example.test')).toBeVisible();
  });

  it('localizes email validation, duplicate guidance, instructions, and remove labels', async () => {
    renderSettings('zh');
    await screen.findByText('会员申请提醒');
    const card = screen
      .getByText('会员申请提醒')
      .closest('[data-slot="card"]') as HTMLElement;
    const input = within(card).getByRole('textbox');

    fireEvent.change(input, { target: { value: 'invalid' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('请输入有效的电子邮件地址。')).toBeVisible();

    fireEvent.change(input, { target: { value: 'admin@example.test' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(
      screen.getByRole('button', { name: '移除 admin@example.test' })
    ).toBeVisible();
    expect(
      within(card).getByText('按回车键或离开输入框以添加电子邮件地址。')
    ).toBeVisible();

    fireEvent.change(input, { target: { value: 'admin@example.test' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('此电子邮件地址已添加。')).toBeVisible();
  });
});
