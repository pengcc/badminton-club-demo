import type { Request, Response } from 'express';
import type { RecruitmentPublicContentValues } from '@club/shared-types/api/recruitmentPublicContent';
import type { Language } from '@club/shared-types/core/enums';
import type { AuthenticatedRequest } from '../middleware/auth';
import { RecruitmentPublicContentService } from '../services/recruitmentPublicContentService';

export class RecruitmentPublicContentController {
  static async getPublicContent(_req: Request, res: Response): Promise<void> {
    const { language } = res.locals.validatedQuery as { language: Language };
    const content =
      await RecruitmentPublicContentService.getPublicContent(language);
    res.status(200).json({ success: true, data: content });
  }

  static async getAdministrationContent(
    _req: Request,
    res: Response
  ): Promise<void> {
    const content =
      await RecruitmentPublicContentService.getAdministrationContent();
    res.status(200).json({ success: true, data: content });
  }

  static async updateContent(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const content = await RecruitmentPublicContentService.updateContent(
      req.body.content as RecruitmentPublicContentValues,
      req.user.id
    );
    res.status(200).json({ success: true, data: content });
  }
}
