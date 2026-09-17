import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));

vi.mock('../../lib/api/client', () => ({ default: client }));

import { settingsApi } from '../../lib/api/settingsApi';

const recipients = {
  applicationAlerts: [],
  tasterSessionAlerts: ['taster@example.test'],
  guestPlayAlerts: [],
};

describe('Notification Settings API adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.get.mockResolvedValue({ data: { data: recipients } });
    client.put.mockResolvedValue({ data: { data: recipients } });
  });

  it('reads the bounded administrator alert projection', async () => {
    await expect(settingsApi.getNotificationRecipients()).resolves.toBe(
      recipients
    );
    expect(client.get).toHaveBeenCalledWith('/settings/notifications');
  });

  it('updates one selected family and returns the server projection', async () => {
    await expect(
      settingsApi.updateNotificationRecipients('tasterSessionAlerts', [
        'taster@example.test',
      ])
    ).resolves.toBe(recipients);
    expect(client.put).toHaveBeenCalledWith(
      '/settings/notifications/tasterSessionAlerts',
      { emails: ['taster@example.test'] }
    );
  });
});
