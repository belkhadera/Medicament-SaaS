import { NextFunction, Request, Response } from 'express';
import { AppError } from '../core/errors/AppError';
import { ZodError } from 'zod';

export function notFound(req: Request, res: Response) {
  res.status(404).json({ error: 'Ressource introuvable' });
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
      error: 'Erreur de validation',
      message: 'Données saisies invalides',
      details: err.issues.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }))
    });
  }

  const statusCode = err.status || err.statusCode || 500;

  res.status(statusCode).json({
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? (err instanceof Error ? err.message : String(err)) : 'Une erreur est survenue',
  });
}
