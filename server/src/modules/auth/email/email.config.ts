import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Gmail SMTP transport (nodemailer), modelled on the reference emails.js.
 *
 * Uses a Google "App Password" — NOT your normal Gmail password. Requirements:
 *   1. Enable 2-Step Verification on the Google account.
 *   2. Create an App Password at https://myaccount.google.com/apppasswords
 *   3. Put the account address in GMAIL_USER and the 16-char app password in
 *      GMAIL_PASS (spaces are fine; they're stripped here).
 */

const user = (process.env.GMAIL_USER || '').trim();
// App passwords are shown grouped as "abcd efgh ijkl mnop" — strip spaces.
const pass = (process.env.GMAIL_PASS || '').replace(/\s+/g, '');

if (!user || !pass) {
  console.warn(
    '⚠️  GMAIL_USER / GMAIL_PASS are not set — emails will fail. ' +
      'Set them in server/.env (use a Gmail App Password, not your login password).'
  );
}

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user, pass },
});

export const senderName = (process.env.EMAIL_SENDER_NAME || 'MediTrack Healthcare').trim();
export const senderEmail = user;
