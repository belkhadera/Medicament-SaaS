import express from 'express';
import * as authController from './auth.controller';
import { protect, admin } from '../../middleware/authMiddleware';

const router = express.Router();

// Public
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Protected
router.post('/logout', protect, authController.logout);
router.get('/profile', protect, authController.getProfile);
router.put('/profile', protect, authController.updateProfile);
router.post('/change-password', protect, authController.changePassword);

// Admin-only user management
router.get('/users', protect, admin, authController.listUsers);
router.put('/users/:id', protect, admin, authController.adminUpdateUser);

export { router as authRoutes };
