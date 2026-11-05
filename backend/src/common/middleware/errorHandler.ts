import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { AppError } from '../errors/AppError.js';

type ErrorBody = {
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
};

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    const body: ErrorBody = {
      code: err.code,
      message: err.message,
      retryable: err.retryable,
    };
    if (err.details !== undefined) {
      body.details = err.details;
    }
    res.status(err.statusCode).json(body);
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      code: 'VALIDATION',
      message: err.issues[0]?.message ?? 'Invalid request',
      retryable: false,
      details: err.issues,
    } satisfies ErrorBody);
    return;
  }

  console.error(err);
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Unexpected server error',
    retryable: true,
  } satisfies ErrorBody);
}
