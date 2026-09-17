import { Router } from 'express';
import { EmailTemplateController } from '../controllers/emailTemplateController';
import { authorizeCapability, protect } from '../middleware/auth';
import { Capability } from '@club/shared-types/core/enums';

const router: Router = Router();

// Get all email templates (admin only)
router.get(
  '/email-templates',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  EmailTemplateController.getAllTemplates as any
);

// Get specific email template (admin only)
router.get(
  '/email-templates/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  EmailTemplateController.getTemplateById as any
);

// Update email template (admin only)
router.put(
  '/email-templates/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  EmailTemplateController.updateTemplate as any
);

// Preview email template (admin only)
router.post(
  '/email-templates/:id/preview',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  EmailTemplateController.previewTemplate as any
);

export default router;
