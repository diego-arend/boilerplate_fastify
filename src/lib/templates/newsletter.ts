/**
 * Newsletter Email Template
 */

import type { TemplateResult } from './types.js';
import { BaseTemplate } from './types.js';

interface NewsletterArticle {
  title: string;
  summary: string;
  link: string;
}

interface NewsletterVariables {
  subscriberName: string;
  newsletterTitle: string;
  edition: string;
  date: string;
  articles: NewsletterArticle[];
  unsubscribeLink: string;
}

export class NewsletterTemplate extends BaseTemplate<NewsletterVariables> {
  getRequiredVariables(): string[] {
    return ['subscriberName', 'newsletterTitle', 'edition', 'date', 'articles', 'unsubscribeLink'];
  }

  render(variables: NewsletterVariables): TemplateResult {
    this.validateVariables(variables);

    const articlesHtml = variables.articles
      .map(
        article => `
      <div style="margin: 30px 0; padding: 20px; border-left: 4px solid #007bff; background: #f8f9fa;">
        <h3 style="margin-top: 0; color: #007bff;">
          <a href="${article.link}" style="color: #007bff; text-decoration: none;">${article.title}</a>
        </h3>
        <p style="margin-bottom: 15px; color: #666;">${article.summary}</p>
        <a href="${article.link}" style="color: #007bff; font-weight: bold;">Read More →</a>
      </div>
    `
      )
      .join('');

    const articlesText = variables.articles
      .map(
        article => `
${article.title}
${article.summary}
Read more: ${article.link}
`
      )
      .join('\n---\n');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${variables.newsletterTitle} - ${variables.edition}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 30px 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .edition-info { background: #e9ecef; padding: 15px; border-radius: 4px; margin: 20px 0; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📰 ${variables.newsletterTitle}</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${variables.edition}</p>
          </div>
          <div class="content">
            <div class="edition-info">
              <p><strong>${variables.date}</strong></p>
            </div>
            
            <h2>Hello ${variables.subscriberName}!</h2>
            <p>Welcome to this edition of ${variables.newsletterTitle}. Here's what we have for you this time:</p>

            ${articlesHtml}

            <p style="margin-top: 40px;">That's all for this edition! Thank you for reading.</p>
            <p>Best regards,<br>The ${variables.newsletterTitle} Team</p>
          </div>
          <div class="footer">
            <p>You're receiving this email because you subscribed to ${variables.newsletterTitle}.</p>
            <p><a href="${variables.unsubscribeLink}" style="color: #666;">Unsubscribe</a> | <a href="#" style="color: #666;">Update Preferences</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      ${variables.newsletterTitle} - ${variables.edition}
      ${variables.date}

      Hello ${variables.subscriberName}!

      Welcome to this edition of ${variables.newsletterTitle}. Here's what we have for you this time:

      ${articlesText}

      That's all for this edition! Thank you for reading.

      Best regards,
      The ${variables.newsletterTitle} Team

      ---
      You're receiving this email because you subscribed to ${variables.newsletterTitle}.
      Unsubscribe: ${variables.unsubscribeLink}
    `;

    return {
      html,
      text: text.trim(),
      subject: `${variables.newsletterTitle} - ${variables.edition}`
    };
  }
}
