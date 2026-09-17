import type { Response } from 'express';

interface ApiResponse<T> {
  success: true;
  message?: string;
  data?: T;
}

/**
 * Utility class for standardized API responses
 */
export class ResponseHelper {
  /**
   * Send success response
   */
  static success<T>(
    res: Response,
    data?: T,
    message?: string,
    statusCode: number = 200
  ): void {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data,
    };
    res.status(statusCode).json(response);
  }
}
