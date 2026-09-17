import type { Request, Response } from 'express';
import type { ClubInformationValues } from '@club/shared-types/api/clubInformation';
import type { Language } from '@club/shared-types/core/enums';
import type { AuthenticatedRequest } from '../middleware/auth';
import { ClubInformationService } from '../services/clubInformationService';

export class ClubInformationController {
  static async getPublicContent(_req: Request, res: Response): Promise<void> {
    const { language } = res.locals.validatedQuery as { language: Language };
    const content = await ClubInformationService.getPublicContent(language);
    res.status(200).json({ success: true, data: content });
  }

  static async getAdministrationContent(
    _req: Request,
    res: Response
  ): Promise<void> {
    const content = await ClubInformationService.getAdministrationContent();
    res.status(200).json({ success: true, data: content });
  }

  static async updateContent(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const content = await ClubInformationService.updateContent(
      req.body.content as ClubInformationValues,
      req.user.id
    );
    res.status(200).json({ success: true, data: content });
  }
}
