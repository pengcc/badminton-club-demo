import type { Request, Response } from 'express';
import type { TeamPublicContentValues } from '@club/shared-types/api/teamPublicContent';
import type { Language } from '@club/shared-types/core/enums';
import type { AuthenticatedRequest } from '../middleware/auth';
import { TeamPublicContentService } from '../services/teamPublicContentService';

export class TeamPublicContentController {
  static async getPublicContent(_req: Request, res: Response): Promise<void> {
    const { language } = res.locals.validatedQuery as { language: Language };
    const content = await TeamPublicContentService.getPublicContent(language);
    res.status(200).json({ success: true, data: content });
  }

  static async getAdministrationContent(
    _req: Request,
    res: Response
  ): Promise<void> {
    const content = await TeamPublicContentService.getAdministrationContent();
    res.status(200).json({ success: true, data: content });
  }

  static async updateContent(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const content = await TeamPublicContentService.updateContent(
      req.body.content as TeamPublicContentValues,
      req.user.id
    );
    res.status(200).json({ success: true, data: content });
  }
}
