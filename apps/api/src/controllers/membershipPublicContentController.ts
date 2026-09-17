import type { Request, Response } from 'express';
import type { MembershipPublicContentValues } from '@club/shared-types/api/membershipPublicContent';
import type { Language } from '@club/shared-types/core/enums';
import type { AuthenticatedRequest } from '../middleware/auth';
import { MembershipPublicContentService } from '../services/membershipPublicContentService';

export class MembershipPublicContentController {
  static async getPublicContent(_req: Request, res: Response): Promise<void> {
    const { language } = res.locals.validatedQuery as { language: Language };
    const content =
      await MembershipPublicContentService.getPublicContent(language);
    res.status(200).json({ success: true, data: content });
  }

  static async getAdministrationContent(
    _req: Request,
    res: Response
  ): Promise<void> {
    const content =
      await MembershipPublicContentService.getAdministrationContent();
    res.status(200).json({ success: true, data: content });
  }

  static async updateContent(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const content = await MembershipPublicContentService.updateContent(
      req.body.content as MembershipPublicContentValues,
      req.user.id
    );
    res.status(200).json({ success: true, data: content });
  }
}
