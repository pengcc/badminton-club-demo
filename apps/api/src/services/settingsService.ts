import type { NotificationRecipientType } from '@club/shared-types/api/notificationSettings';
import { Settings } from '../models/Settings';
import type { ISettings } from '../models/Settings';

/**
 * Settings Service
 *
 * Manages the shared storage aggregate through owner-specific operations.
 * Uses singleton pattern - only one settings document exists.
 */
export class SettingsService {
  /**
   * Get or create settings (singleton)
   */
  static async getSettings(): Promise<ISettings> {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({
        notificationRecipients: {
          applicationAlerts: { additional: [] },
          tasterSessionAlerts: { additional: [] },
          guestPlayAlerts: { additional: [] },
        },
      });
    }

    return settings;
  }

  /**
   * Update notification recipients for a specific type
   */
  static async updateNotificationRecipients(
    type: NotificationRecipientType,
    emails: string[],
    updatedBy: string
  ): Promise<ISettings> {
    const settings = await this.getSettings();

    const recipients = settings.notificationRecipients[type] ?? {
      additional: [],
    };
    recipients.additional = [
      ...new Set(
        emails.map((email) => email.trim().toLowerCase()).filter(Boolean)
      ),
    ];
    settings.notificationRecipients[type] = recipients;
    settings.updatedBy = updatedBy as any;

    await settings.save();
    return settings;
  }

  /**
   * Get the explicitly configured Membership Application alert recipients.
   */
  static async getApplicationAlertRecipients(): Promise<string[]> {
    const settings = await this.getSettings();
    return settings.notificationRecipients.applicationAlerts.additional ?? [];
  }

  /**
   * Get the explicitly configured Taster Session alert recipients.
   */
  static async getTasterSessionAlertRecipients(): Promise<string[]> {
    const settings = await this.getSettings();
    return (
      settings.notificationRecipients.tasterSessionAlerts?.additional ?? []
    );
  }

  /**
   * Get membership configuration (public)
   */
  static async getMembershipConfig(): Promise<{ membershipOpen: boolean }> {
    const settings = await this.getSettings();
    return { membershipOpen: settings.membershipOpen ?? false };
  }

  /**
   * Update membership configuration
   */
  static async updateMembershipConfig(
    membershipOpen: boolean,
    updatedBy: string
  ): Promise<ISettings> {
    const settings = await this.getSettings();
    settings.membershipOpen = membershipOpen;
    settings.updatedBy = updatedBy as any;
    await settings.save();
    return settings;
  }
}
