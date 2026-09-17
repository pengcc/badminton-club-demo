import type { Request, Response } from 'express';
import {
  notificationRecipientTypes,
  type NotificationRecipientSettings,
  type NotificationRecipientType,
} from '@club/shared-types/api/notificationSettings';
import { SettingsService } from '../services/settingsService';

function isSelectedNotificationRecipientType(
  type: string
): type is NotificationRecipientType {
  return notificationRecipientTypes.some(
    (notificationRecipientType) => notificationRecipientType === type
  );
}

function projectNotificationRecipients(settings: {
  notificationRecipients: {
    applicationAlerts?: { additional?: string[] };
    tasterSessionAlerts?: { additional?: string[] };
    guestPlayAlerts?: { additional?: string[] };
  };
}): NotificationRecipientSettings {
  return {
    applicationAlerts:
      settings.notificationRecipients.applicationAlerts?.additional ?? [],
    tasterSessionAlerts:
      settings.notificationRecipients.tasterSessionAlerts?.additional ?? [],
    guestPlayAlerts:
      settings.notificationRecipients.guestPlayAlerts?.additional ?? [],
  };
}

/**
 * Settings Controller
 * Handles owner-specific configuration requests backed by Settings storage.
 */
export class SettingsController {
  /**
   * Get the bounded capability-owned administrator alert projection.
   * @route GET /api/settings/notifications
   */
  static async getNotificationRecipients(
    _req: Request,
    res: Response
  ): Promise<void> {
    try {
      const settings = await SettingsService.getSettings();
      res.status(200).json({ data: projectNotificationRecipients(settings) });
    } catch {
      console.error('Notification recipient retrieval failed');
      res
        .status(500)
        .json({ error: 'Failed to fetch notification recipients' });
    }
  }

  /**
   * Update notification recipients
   * @route PUT /api/settings/notifications/:type
   */
  static async updateNotificationRecipients(
    req: Request<{ type: string }>,
    res: Response
  ): Promise<void> {
    try {
      const { type } = req.params;
      const { emails } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!isSelectedNotificationRecipientType(type)) {
        res.status(400).json({ error: 'Invalid notification type' });
        return;
      }

      if (!Array.isArray(emails)) {
        res.status(400).json({ error: 'Emails must be an array' });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = emails.filter(
        (email) => typeof email !== 'string' || !emailRegex.test(email.trim())
      );
      if (invalidEmails.length > 0) {
        res.status(400).json({
          error: 'Invalid email addresses',
          invalidEmails,
        });
        return;
      }

      const settings = await SettingsService.updateNotificationRecipients(
        type,
        emails,
        userId
      );

      res.status(200).json({ data: projectNotificationRecipients(settings) });
    } catch {
      console.error('Notification recipient update failed');
      res.status(500).json({
        error: 'Failed to update notification recipients',
      });
    }
  }

  /**
   * Get membership configuration (PUBLIC)
   * @route GET /api/settings/membership
   */
  static async getMembershipConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = await SettingsService.getMembershipConfig();
      res.status(200).json({ data: config });
    } catch {
      console.error('Membership configuration retrieval failed');
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
      });
    }
  }

  /**
   * Update membership configuration
   * @route PUT /api/settings/membership
   */
  static async updateMembershipConfig(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { membershipOpen } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (typeof membershipOpen !== 'boolean') {
        res.status(400).json({ error: 'membershipOpen must be a boolean' });
        return;
      }

      const settings = await SettingsService.updateMembershipConfig(
        membershipOpen,
        userId
      );
      res
        .status(200)
        .json({ data: { membershipOpen: settings.membershipOpen } });
    } catch (error) {
      console.error('Membership configuration update failed');
      res.status(500).json({
        error: 'Failed to update membership configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
