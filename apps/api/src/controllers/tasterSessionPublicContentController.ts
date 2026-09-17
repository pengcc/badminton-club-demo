import type { Request, Response } from 'express';
import type { TasterSessionPublicContentValues } from '@club/shared-types/api/tasterSessionPublicContent';
import type { Language } from '@club/shared-types/core/enums';
import type { AuthenticatedRequest } from '../middleware/auth';
import { TasterSessionPublicContentService } from '../services/tasterSessionPublicContentService';

export class TasterSessionPublicContentController {
  static async getPublicContent(_req: Request, res: Response): Promise<void> {
    const { language } = res.locals.validatedQuery as { language: Language };
    const content =
      await TasterSessionPublicContentService.getPublicContent(language);
    res.status(200).json({ success: true, data: content });
  }

  static async getAdministrationContent(
    _req: Request,
    res: Response
  ): Promise<void> {
    const content =
      await TasterSessionPublicContentService.getAdministrationContent();
    res.status(200).json({ success: true, data: content });
  }

  static async updateContent(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const content = await TasterSessionPublicContentService.updateContent(
      req.body.content as TasterSessionPublicContentValues,
      req.user.id
    );
    res.status(200).json({ success: true, data: content });
  }
}
