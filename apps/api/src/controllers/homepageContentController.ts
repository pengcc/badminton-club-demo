import type { Request, Response } from 'express';
import type { HomepageContentValues } from '@club/shared-types/api/homepageContent';
import type { Language } from '@club/shared-types/core/enums';
import type { AuthenticatedRequest } from '../middleware/auth';
import { HomepageContentService } from '../services/homepageContentService';

export class HomepageContentController {
  static async getPublicContent(_req: Request, res: Response): Promise<void> {
    const { language } = res.locals.validatedQuery as { language: Language };
    const content = await HomepageContentService.getPublicContent(language);
    res.status(200).json({ success: true, data: content });
  }

  static async getAdministrationContent(
    _req: Request,
    res: Response
  ): Promise<void> {
    const content = await HomepageContentService.getAdministrationContent();
    res.status(200).json({ success: true, data: content });
  }

  static async updateContent(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const content = await HomepageContentService.updateContent(
      req.body.content as HomepageContentValues,
      req.user.id
    );
    res.status(200).json({ success: true, data: content });
  }
}
