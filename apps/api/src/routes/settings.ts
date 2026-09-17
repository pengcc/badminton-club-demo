import { Router } from 'express';
import { SettingsController } from '../controllers/settingsController';
import { authorizeCapability, protect } from '../middleware/auth';
import { Capability } from '@club/shared-types/core/enums';

const router: Router = Router();

/**
 * Settings Routes
 * All routes require admin authentication
 */

/**
 * Get the capability-owned administrator alert recipients.
 * @route GET /api/settings/notifications
 */
router.get(
  '/notifications',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  SettingsController.getNotificationRecipients
);

/**
 * Update notification recipients
 * @route PUT /api/settings/notifications/:type
 * @param type - a supported capability-owned notification category
 */
router.put(
  '/notifications/:type',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  SettingsController.updateNotificationRecipients
);

/**
 * Get membership configuration (PUBLIC)
 * @route GET /api/settings/membership
 */
router.get('/membership', SettingsController.getMembershipConfig);

/**
 * Update membership configuration
 * @route PUT /api/settings/membership
 */
router.put(
  '/membership',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  SettingsController.updateMembershipConfig
);

export default router;
