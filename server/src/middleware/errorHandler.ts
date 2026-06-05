import { NextFunction, Request, Response } from 'express';
import { AppError } from '../core/errors/AppError';
import { ZodError } from 'zod';

export function notFound(req: Request, res: Response) {
  res.status(404).json({ error: 'Not Found' });
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  console.error(err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid input data',
      details: err.issues.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }))
    });
  }

  const statusCode = err.status || err.statusCode || 500;

  res.status(statusCode).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? (err instanceof Error ? err.message : String(err)) : 'Something went wrong',
  });
}
