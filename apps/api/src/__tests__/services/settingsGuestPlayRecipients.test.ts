import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsService } from '../../services/settingsService';
import { SettingsController } from '../../controllers/settingsController';

describe('capability-owned notification recipient settings', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ADMIN_NOTIFICATION_EMAILS;
  });

  it('normalizes, deduplicates, replaces and removes configured recipients', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const settings = {
      notificationRecipients: {
        applicationAlerts: { additional: [] },
        tasterSessionAlerts: { additional: [] },
        guestPlayAlerts: { additional: [] as string[] },
      },
      save,
    };
    vi.spyOn(SettingsService, 'getSettings').mockResolvedValue(
      settings as never
    );

    await SettingsService.updateNotificationRecipients(
      'guestPlayAlerts',
      [' Club@Example.test ', 'club@example.test', 'second@example.test'],
      '507f1f77bcf86cd799439011'
    );
    expect(settings.notificationRecipients.guestPlayAlerts.additional).toEqual([
      'club@example.test',
      'second@example.test',
    ]);

    await SettingsService.updateNotificationRecipients(
      'guestPlayAlerts',
      [],
      '507f1f77bcf86cd799439011'
    );
    expect(settings.notificationRecipients.guestPlayAlerts.additional).toEqual(
      []
    );
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('returns only each capability-owned configured recipient list', async () => {
    process.env.ADMIN_NOTIFICATION_EMAILS = 'hidden@example.test';
    vi.spyOn(SettingsService, 'getSettings').mockResolvedValue({
      notificationRecipients: {
        applicationAlerts: { additional: ['application@example.test'] },
        tasterSessionAlerts: { additional: ['taster@example.test'] },
      },
    } as never);

    await expect(
      SettingsService.getApplicationAlertRecipients()
    ).resolves.toEqual(['application@example.test']);
    await expect(
      SettingsService.getTasterSessionAlertRecipients()
    ).resolves.toEqual(['taster@example.test']);
  });

  it('keeps an empty Membership Application list empty despite legacy environment input', async () => {
    process.env.ADMIN_NOTIFICATION_EMAILS = 'hidden@example.test';
    vi.spyOn(SettingsService, 'getSettings').mockResolvedValue({
      notificationRecipients: {
        applicationAlerts: { additional: [] },
      },
    } as never);

    await expect(
      SettingsService.getApplicationAlertRecipients()
    ).resolves.toEqual([]);
  });

  it('reads a retained missing Taster Session category as empty', async () => {
    process.env.ADMIN_NOTIFICATION_EMAILS = 'hidden@example.test';
    vi.spyOn(SettingsService, 'getSettings').mockResolvedValue({
      notificationRecipients: {
        applicationAlerts: { additional: [] },
      },
    } as never);

    await expect(
      SettingsService.getTasterSessionAlertRecipients()
    ).resolves.toEqual([]);
  });

  it('materializes the retained missing category through a normal settings update', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const settings = {
      notificationRecipients: {
        applicationAlerts: { additional: [] },
      } as any,
      save,
    };
    vi.spyOn(SettingsService, 'getSettings').mockResolvedValue(
      settings as never
    );

    await SettingsService.updateNotificationRecipients(
      'tasterSessionAlerts',
      [' Taster@Example.test '],
      '507f1f77bcf86cd799439011'
    );

    expect(settings.notificationRecipients.tasterSessionAlerts).toEqual({
      additional: ['taster@example.test'],
    });
    expect(save).toHaveBeenCalledOnce();
  });

  it('returns the bounded administrator alert projection without unrelated settings', async () => {
    vi.spyOn(SettingsService, 'getSettings').mockResolvedValue({
      notificationRecipients: {
        applicationAlerts: { additional: ['application@example.test'] },
        guestPlayAlerts: { additional: ['guest@example.test'] },
      },
    } as never);
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);

    await SettingsController.getNotificationRecipients(
      {} as never,
      res as never
    );

    expect(res.json).toHaveBeenCalledWith({
      data: {
        applicationAlerts: ['application@example.test'],
        tasterSessionAlerts: [],
        guestPlayAlerts: ['guest@example.test'],
      },
    });
  });

  it('returns server-normalized selected state after an update', async () => {
    vi.spyOn(SettingsService, 'updateNotificationRecipients').mockResolvedValue(
      {
        notificationRecipients: {
          applicationAlerts: { additional: ['normalized@example.test'] },
          tasterSessionAlerts: { additional: ['taster@example.test'] },
          guestPlayAlerts: { additional: [] },
        },
      } as never
    );
    const req = {
      params: { type: 'applicationAlerts' },
      body: { emails: [' Normalized@Example.test '] },
      user: { id: 'user-1' },
    };
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);

    await SettingsController.updateNotificationRecipients(
      req as never,
      res as never
    );

    expect(res.json).toHaveBeenCalledWith({
      data: {
        applicationAlerts: ['normalized@example.test'],
        tasterSessionAlerts: ['taster@example.test'],
        guestPlayAlerts: [],
      },
    });
  });

  it.each([
    'memberWelcome',
    'systemAlerts',
  ] as const)('rejects the unsupported %s category', async (type) => {
    const update = vi.spyOn(SettingsService, 'updateNotificationRecipients');
    const req = {
      params: { type },
      body: { emails: [' Normalized@Example.test '] },
      user: { id: 'user-1' },
    };
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);

    await SettingsController.updateNotificationRecipients(
      req as never,
      res as never
    );

    expect(update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid notification type',
    });
  });
});
