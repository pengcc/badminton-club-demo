import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { MEMBER_CSV_MAX_BYTES } from '../lib/memberCsvImport';
import { AppError } from '../utils/errors';

export function memberCsvUpload(apply: boolean) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MEMBER_CSV_MAX_BYTES,
      files: 1,
      fields: apply ? 1 : 0,
      fieldSize: 512 * 1024,
      parts: apply ? 3 : 2,
    },
  });
  return (req: Request, res: Response, next: NextFunction): void => {
    upload.single('file')(req, res, (error: unknown) => {
      if (error) {
        next(
          new AppError(
            'Member CSV upload is invalid',
            error instanceof multer.MulterError &&
              error.code === 'LIMIT_FILE_SIZE'
              ? 413
              : 400,
            'MEMBER_CSV_INVALID_FILE'
          )
        );
        return;
      }
      const keys = Object.keys(req.body ?? {});
      if (
        !req.file ||
        (apply
          ? keys.length !== 1 ||
            keys[0] !== 'previewContext' ||
            typeof req.body.previewContext !== 'string'
          : keys.length !== 0)
      ) {
        next(AppError.validation('Member CSV upload fields are invalid'));
        return;
      }
      next();
    });
  };
}
