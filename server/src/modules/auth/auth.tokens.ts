import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || 'fallback_secret';
const ACCESS_EXPIRE = process.env.JWT_ACCESS_EXPIRE || '15m';
const REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '7d';

// ---- JWT (access / refresh) ------------------------------------------------

export function generateAccessToken(userId: string): string {
  return jwt.sign({ id: userId }, SECRET, { expiresIn: ACCESS_EXPIRE } as SignOptions);
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ id: userId }, SECRET, { expiresIn: REFRESH_EXPIRE } as SignOptions);
}

export function verifyToken<T>(token: string): T {
  return jwt.verify(token, SECRET) as T;
}

// ---- One-time link tokens (email verification / password reset) ------------
//
// A high-entropy token is emailed to the user, but only its SHA-256 hash is
// stored in the database, so a leaked DB never exposes usable links.

export interface SecureToken {
  token: string; // raw value to put in the email link
  hashed: string; // hash to store in the database
}

export function createSecureToken(): SecureToken {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hashed: hashToken(token) };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}
