import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { AppError } from '../utils/errors';

const allowedTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const activityImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10,
    fields: 1,
    parts: 11,
    fieldSize: 100 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    if (allowedTypes.has(file.mimetype)) callback(null, true);
    else
      callback(
        new AppError(
          'Only JPEG, PNG, GIF, and WebP Activity images are allowed',
          400
        )
      );
  },
}).array('images', 10);

export const receiveActivityImages: RequestHandler = (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  activityImageUpload(request, response, (error) => {
    if (!error) return next();
    if (error instanceof AppError) return next(error);
    if (error instanceof multer.MulterError) {
      return next(new AppError(error.message, 400, 'INVALID_ACTIVITY_UPLOAD'));
    }
    return next(error);
  });
};
