import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { AppError } from '../utils/errors';

const supportedQrMimeTypes = new Set(['image/png', 'image/jpeg']);
const undeterminedMimeTypes = new Set(['', 'application/octet-stream']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
    fields: 1,
    parts: 3,
    fieldSize: 100 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    if (
      supportedQrMimeTypes.has(file.mimetype) ||
      undeterminedMimeTypes.has(file.mimetype)
    ) {
      callback(null, true);
    } else {
      callback(
        new AppError(
          'Only PNG and JPEG Contact QR images are allowed',
          400,
          'INVALID_CONTACT_QR_TYPE'
        )
      );
    }
  },
}).single('qrCode');

export const receiveContactQr: RequestHandler = (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  upload(request, response, (error) => {
    if (!error) return next();
    if (error instanceof AppError) return next(error);
    if (error instanceof multer.MulterError) {
      const isFileSizeError = error.code === 'LIMIT_FILE_SIZE';
      return next(
        new AppError(
          isFileSizeError
            ? 'A Contact QR image must be no larger than 2 MB'
            : error.message,
          400,
          isFileSizeError
            ? 'INVALID_CONTACT_QR_SIZE'
            : 'INVALID_CONTACT_QR_UPLOAD'
        )
      );
    }
    return next(error);
  });
};
