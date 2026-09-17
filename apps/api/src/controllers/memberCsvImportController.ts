import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { MemberCsvImportService } from '../services/memberCsvImportService';
import { AppError } from '../utils/errors';

export function memberCsvImportController(apply: boolean) {
  return async (request: Request, res: Response): Promise<void> => {
    const req = request as AuthenticatedRequest;
    if (!req.file) throw AppError.validation('Member CSV file is required');
    const actor = {
      id: req.user.id,
      email: req.user.email,
      accountKind: req.user.accountKind,
      displayName: req.user.displayName,
      capabilities: req.user.capabilities,
    };
    const data = apply
      ? await MemberCsvImportService.apply(
          req.file.buffer,
          req.body.previewContext,
          actor
        )
      : await MemberCsvImportService.preview(req.file.buffer, actor);
    res.json({ success: true, data });
  };
}
