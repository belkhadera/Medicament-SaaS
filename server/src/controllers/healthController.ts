import { Request, Response } from 'express';

export function getHealth(req: Request, res: Response) {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV ?? 'development',
    timestamp: new Date().toISOString(),
  });
}
