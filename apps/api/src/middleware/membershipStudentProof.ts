import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import {
  MEMBERSHIP_STUDENT_PROOF_MAX_BYTES,
  MEMBERSHIP_STUDENT_PROOF_MAX_FILES,
} from '../services/membershipStudentProofStore';
import { AppError } from '../utils/errors';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MEMBERSHIP_STUDENT_PROOF_MAX_BYTES,
    files: MEMBERSHIP_STUDENT_PROOF_MAX_FILES,
  },
});

const uploadFiles = upload.array('proofs', MEMBERSHIP_STUDENT_PROOF_MAX_FILES);

export function uploadMembershipStudentProof(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  uploadFiles(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    membershipStudentProofUploadErrors(error, req, res, next);
  });
}

export function membershipStudentProofUploadErrors(
  error: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (error instanceof multer.MulterError) {
    next(
      new AppError(
        error.code === 'LIMIT_FILE_SIZE'
          ? 'Student proof must be no larger than 10 MB'
          : 'At most two student proof files are allowed',
        400,
        error.code === 'LIMIT_FILE_SIZE'
          ? 'INVALID_PROOF_SIZE'
          : 'PROOF_LIMIT_EXCEEDED'
      )
    );
    return;
  }
  next(error);
}
