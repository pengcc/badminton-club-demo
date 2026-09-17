import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { AppError } from '../utils/errors';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
    fields: 1,
    parts: 3,
    fieldSize: 50 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    if (file.mimetype === 'application/pdf') callback(null, true);
    else callback(new AppError('Only PDF Public Documents are allowed', 400));
  },
}).single('document');

export const receivePublicDocumentPdf: RequestHandler = (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  upload(request, response, (error) => {
    if (!error) return next();
    if (error instanceof AppError) return next(error);
    if (error instanceof multer.MulterError) {
      return next(
        new AppError(error.message, 400, 'INVALID_PUBLIC_DOCUMENT_UPLOAD')
      );
    }
    return next(error);
  });
};
