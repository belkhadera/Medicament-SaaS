import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { IEmailProvider } from '../interfaces';

export class GmailEmailProvider implements IEmailProvider {
  private async createTransporter() {
    const OAuth2 = google.auth.OAuth2;

    const oauth2Client = new OAuth2(
      (process.env.GMAIL_CLIENT_ID || '').trim(),
      (process.env.GMAIL_CLIENT_SECRET || '').trim(),
      "https://developers.google.com/oauthplayground"
    );

    oauth2Client.setCredentials({
      refresh_token: (process.env.GMAIL_REFRESH_TOKEN || '').trim()
    });

    const accessToken = await new Promise((resolve, reject) => {
      oauth2Client.getAccessToken((err, token) => {
        if (err) {
          reject("Failed to create access token :(");
        }
        resolve(token);
      });
    });

    const gmailUser = (process.env.GMAIL_USER || '').trim();

    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: gmailUser,
        accessToken: accessToken as string,
        clientId: (process.env.GMAIL_CLIENT_ID || '').trim(),
        clientSecret: (process.env.GMAIL_CLIENT_SECRET || '').trim(),
        refreshToken: (process.env.GMAIL_REFRESH_TOKEN || '').trim()
      }
    } as any);
  }

  public async sendEmail(to: string, subject: string, body: string): Promise<void> {
    try {
      const transporter = await this.createTransporter();
      const gmailUser = (process.env.GMAIL_USER || '').trim();
      
      await transporter.sendMail({
        from: gmailUser,
        to,
        subject,
        html: body,
      });
    } catch (error) {
      console.error('Error sending email via Gmail API:', error);
      // In a real application, we might want to throw an error or handle it differently
      // For now, we'll log it to avoid breaking the auth flow if email fails
    }
  }
}
