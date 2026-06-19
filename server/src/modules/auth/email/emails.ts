import { transporter, senderName, senderEmail } from './email.config';
import {
  VERIFICATION_EMAIL_TEMPLATE,
  WELCOME_EMAIL_TEMPLATE,
  PASSWORD_RESET_TEMPLATE,
  PASSWORD_RESET_SUCCESS_TEMPLATE,
} from './emailTemplates';
import { EXPIRATION_DIGEST_TEMPLATE, type AlertDigest } from './expirationTemplates';

/**
 * Thin send helpers over Gmail SMTP (nodemailer), modelled on the reference
 * emails.js. Each throws on failure; callers decide whether a mail failure
 * should break the surrounding request.
 */
async function send(to: string, subject: string, html: string): Promise<void> {
  await transporter.sendMail({
    from: `${senderName} <${senderEmail}>`,
    to,
    subject,
    html,
  });
}

export async function sendVerificationEmail(
  email: string,
  name: string,
  verifyUrl: string,
  expiresMinutes: number
): Promise<void> {
  await send(email, 'Vérifiez votre compte MediTrack', VERIFICATION_EMAIL_TEMPLATE(name, verifyUrl, expiresMinutes));
}

export async function sendWelcomeEmail(email: string, name: string, loginUrl: string): Promise<void> {
  await send(email, 'Bienvenue sur MediTrack Santé', WELCOME_EMAIL_TEMPLATE(name, loginUrl));
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetUrl: string,
  expiresMinutes: number
): Promise<void> {
  await send(email, 'Réinitialisez votre mot de passe MediTrack', PASSWORD_RESET_TEMPLATE(name, resetUrl, expiresMinutes));
}

export async function sendPasswordResetSuccessEmail(
  email: string,
  name: string,
  loginUrl: string
): Promise<void> {
  await send(email, 'Votre mot de passe MediTrack a été modifié', PASSWORD_RESET_SUCCESS_TEMPLATE(name, loginUrl));
}

/** Inventory expiry / low-stock digest. Each row names the specific lot + expiry. */
export async function sendExpirationAlert(to: string, digest: AlertDigest): Promise<void> {
  const total = digest.expired.length + digest.expiringSoon.length + digest.lowStock.length;
  await send(to, `MediTrack — ${total} alerte(s) d'inventaire`, EXPIRATION_DIGEST_TEMPLATE(digest));
}
