import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { matchCsvImportFieldsSchema } from '@club/shared-types/schemas';
import { AppError } from '../utils/errors';

export const MATCH_CSV_MAX_FILE_BYTES = 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MATCH_CSV_MAX_FILE_BYTES,
    files: 1,
    fields: 1,
  },
});

export function uploadMatchCsv(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  upload.single('file')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(
          new AppError(
            'Match CSV file is too large',
            413,
            'MATCH_CSV_FILE_TOO_LARGE'
          )
        );
        return;
      }
      if (error.code === 'LIMIT_FIELD_COUNT') {
        next(
          new AppError(
            'Match CSV multipart fields are invalid',
            400,
            'MATCH_CSV_INVALID_FIELDS'
          )
        );
        return;
      }
      next(
        new AppError(
          'Match CSV multipart upload is invalid',
          400,
          'MATCH_CSV_INVALID_STRUCTURE'
        )
      );
      return;
    }
    next(error);
  });
}

export function validateMatchCsvImportFields(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const parsed = matchCsvImportFieldsSchema.safeParse(req.body);

  if (!parsed.success) {
    next(
      new AppError(
        'Match CSV multipart fields are invalid',
        400,
        'MATCH_CSV_INVALID_FIELDS'
      )
    );
    return;
  }

  req.body = parsed.data;
  next();
}
