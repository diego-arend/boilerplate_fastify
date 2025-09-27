/**
 * Welcome Email Template
 */

import type { TemplateResult } from './types.js';
import { BaseTemplate } from './types.js';

interface WelcomeVariables {
  userName: string;
  activationLink: string;
}

export class WelcomeTemplate extends BaseTemplate<WelcomeVariables> {
  getRequiredVariables(): string[] {
    return ['userName', 'activationLink'];
  }

  render(variables: WelcomeVariables): TemplateResult {
    this.validateVariables(variables);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to Our Platform</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .button { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome ${variables.userName}!</h1>
          </div>
          <div class="content">
            <h2>Thank you for joining us!</h2>
            <p>We're excited to have you on board. To get started, please activate your account by clicking the button below:</p>
            <p style="text-align: center;">
              <a href="${variables.activationLink}" class="button">Activate Account</a>
            </p>
            <p>If you have any questions, feel free to contact our support team.</p>
            <p>Best regards,<br>The Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Welcome ${variables.userName}!

      Thank you for joining us! We're excited to have you on board.

      To get started, please activate your account by visiting this link:
      ${variables.activationLink}

      If you have any questions, feel free to contact our support team.

      Best regards,
      The Team
    `;

    return {
      html,
      text: text.trim(),
      subject: `Welcome ${variables.userName}! Please activate your account`
    };
  }
}
