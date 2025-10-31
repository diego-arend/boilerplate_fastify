/**
 * Password Reset Email Template
 */

import type { TemplateResult } from './types';
import { BaseTemplate } from './types';

interface PasswordResetVariables {
  userName: string;
  resetLink: string;
  expiresIn: string;
}

export class PasswordResetTemplate extends BaseTemplate<PasswordResetVariables> {
  getRequiredVariables(): string[] {
    return ['userName', 'resetLink', 'expiresIn'];
  }

  render(variables: PasswordResetVariables): TemplateResult {
    this.validateVariables(variables);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${variables.userName},</h2>
            <p>We received a request to reset your password. If you made this request, click the button below to reset your password:</p>
            <p style="text-align: center;">
              <a href="${variables.resetLink}" class="button">Reset Password</a>
            </p>
            <div class="warning">
              <strong>Important:</strong> This link will expire in ${variables.expiresIn}. If you don't reset your password within this time, you'll need to request a new reset link.
            </div>
            <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            <p>Best regards,<br>The Security Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Password Reset Request

      Hello ${variables.userName},

      We received a request to reset your password. If you made this request, 
      visit this link to reset your password:

      ${variables.resetLink}

      IMPORTANT: This link will expire in ${variables.expiresIn}. 
      If you don't reset your password within this time, you'll need to request a new reset link.

      If you didn't request a password reset, you can safely ignore this email. 
      Your password will remain unchanged.

      Best regards,
      The Security Team
    `;

    return {
      html,
      text: text.trim(),
      subject: `Password Reset Request for ${variables.userName}`
    };
  }
}
