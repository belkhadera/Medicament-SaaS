import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { 
  registerSchema, 
  loginSchema, 
  changePasswordSchema, 
  updateProfileSchema 
} from '../validators/AuthValidator';

export class AuthController {
  constructor(private authService: AuthService) {}

  public register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = registerSchema.parse(req.body);
      const result = await this.authService.register(validatedData);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  public login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      const result = await this.authService.login(validatedData);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  public refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token is required' });
      }
      const result = await this.authService.refresh(refreshToken);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  public getProfile = async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id;
      const user = await this.authService.getProfile(userId);
      res.json(user);
    } catch (error) {
      next(error);
    }
  };

  public updateProfile = async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id;
      const validatedData = updateProfileSchema.parse(req.body);
      const user = await this.authService.updateProfile(userId, validatedData);
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        message: 'Profile updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  public changePassword = async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id;
      const validatedData = changePasswordSchema.parse(req.body);
      await this.authService.changePassword(userId, validatedData);
      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  };
}
