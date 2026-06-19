import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
  adminUpdateUserSchema,
} from './auth.validators';
import { BadRequestError } from '../../core/errors/AppError';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = (req.query.token as string) || req.body.token;
    const result = await authService.verifyEmail(token);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const resendVerification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = resendVerificationSchema.parse(req.body);
    const result = await authService.resendVerification(email);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Le jeton de rafraîchissement est requis' });
    }
    const result = await authService.refresh(refreshToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: any, res: Response, next: NextFunction) => {
  try {
    await authService.logout(req.user._id);
    res.json({ message: 'Déconnexion réussie' });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const result = await authService.forgotPassword(email);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const result = await authService.resetPassword(token, password);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req: any, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getProfile(req.user._id);
    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = updateProfileSchema.parse(req.body);
    const user = await authService.updateProfile(req.user._id, data);
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      message: 'Profil mis à jour avec succès',
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.user._id, data);
    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    next(error);
  }
};

// ---- admin user management --------------------------------------------------

export const listUsers = async (_req: any, res: Response, next: NextFunction) => {
  try {
    const users = await authService.listUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
};

export const adminUpdateUser = async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = adminUpdateUserSchema.parse(req.body);
    // An admin must not be able to lock themselves out of admin access.
    if (String(req.user._id) === req.params.id) {
      if (data.role && data.role !== 'Administrator') {
        throw new BadRequestError("Vous ne pouvez pas changer votre propre rôle d'administrateur.");
      }
      if (data.status && data.status !== 'active') {
        throw new BadRequestError('Vous ne pouvez pas désactiver votre propre compte.');
      }
    }
    const user = await authService.adminUpdateUser(req.params.id, data);
    res.json(user);
  } catch (error) {
    next(error);
  }
};
