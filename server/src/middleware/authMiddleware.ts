import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { UnauthorizedError } from '../core/errors/AppError';

export const protect = async (req: any, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      req.user = user;
      next();
      return;
    } catch (error) {
      console.error('Auth Middleware Error:', error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

export const admin = (req: any, res: Response, next: NextFunction) => {
  if (req.user && req.user.role === 'Administrator') {
    next();
  } else {
    res.status(401).json({ message: 'Not authorized as an admin' });
  }
};
