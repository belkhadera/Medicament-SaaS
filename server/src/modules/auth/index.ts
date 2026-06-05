import express from 'express';
import { AuthController } from './controllers/AuthController';
import { AuthService } from './services/AuthService';
import { MongooseUserRepository } from './repositories/MongooseUserRepository';
import { JWTTokenProvider } from './providers/JWTTokenProvider';
import { BCryptHashProvider } from './providers/BCryptHashProvider';
import { GmailEmailProvider } from './providers/GmailEmailProvider';
import { protect } from '../../middleware/authMiddleware';

// Instantiate Providers
const tokenProvider = new JWTTokenProvider();
const hashProvider = new BCryptHashProvider();
const emailProvider = new GmailEmailProvider();

// Instantiate Repository
const userRepository = new MongooseUserRepository();

// Instantiate Service
const authService = new AuthService(
  userRepository,
  tokenProvider,
  hashProvider,
  emailProvider
);

// Instantiate Controller
const authController = new AuthController(authService);

// Setup Routes
const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.get('/profile', protect, authController.getProfile);
router.put('/profile', protect, authController.updateProfile);
router.post('/change-password', protect, authController.changePassword);

export { router as authRoutes, authController, authService };
