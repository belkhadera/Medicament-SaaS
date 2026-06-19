import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Le nom doit comporter au moins 2 caractères'),
  email: z.string().email('Adresse e-mail invalide'),
  password: z.string().min(6, 'Le mot de passe doit comporter au moins 6 caractères'),
  role: z.enum(['Administrator', 'Pharmacist', 'Inventory Manager', 'Pharmacy Tech', 'Viewer']).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Adresse e-mail invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Le mot de passe actuel est requis'),
  newPassword: z.string().min(6, 'Le nouveau mot de passe doit comporter au moins 6 caractères'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Adresse e-mail invalide'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Le jeton de réinitialisation est requis'),
  password: z.string().min(6, 'Le mot de passe doit comporter au moins 6 caractères'),
});

export const resendVerificationSchema = z.object({
  email: z.string().email('Adresse e-mail invalide'),
});

// Admin-only edit of another user's account (role / activation / display name).
export const adminUpdateUserSchema = z.object({
  name: z.string().min(2, 'Le nom doit comporter au moins 2 caractères').optional(),
  role: z.enum(['Administrator', 'Pharmacist', 'Inventory Manager', 'Pharmacy Tech', 'Viewer']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
