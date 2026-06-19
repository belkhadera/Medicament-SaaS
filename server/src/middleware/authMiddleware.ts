import { Response, NextFunction } from 'express';
import User from '../models/User';
import { verifyToken } from '../modules/auth/auth.tokens';

export const protect = async (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Non autorisé, jeton manquant' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken<{ id: string }>(token);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Non autorisé, utilisateur introuvable' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return res.status(401).json({ message: 'Non autorisé, jeton invalide' });
  }
};

export const admin = (req: any, res: Response, next: NextFunction) => {
  if (req.user && req.user.role === 'Administrator') {
    next();
  } else {
    res.status(401).json({ message: "Non autorisé en tant qu'administrateur" });
  }
};
