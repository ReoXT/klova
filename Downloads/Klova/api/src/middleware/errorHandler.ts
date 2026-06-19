import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export interface AppError extends Error {
  status?: number;
  fields?: Record<string, string>; // field-level validation errors
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = err.status ?? 500;
  const message = err.message || 'Internal Server Error';

  if (status >= 500) {
    console.error(
      `[error] ${req.method} ${req.path} → HTTP ${status}: ${message}`,
      err.stack ?? '',
    );
  }

  res.status(status).json({
    error: {
      message,
      ...(err.fields && { fields: err.fields }),
      ...(config.nodeEnv !== 'production' && { stack: err.stack }),
    },
  });
}
