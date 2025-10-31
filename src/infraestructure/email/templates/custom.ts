/**
 * Custom Email Template
 */

import type { TemplateResult } from './types';
import { BaseTemplate } from './types';

interface CustomVariables {
  subject: string;
  htmlContent: string;
  textContent: string;
  [key: string]: any; // Allow additional dynamic variables
}

export class CustomTemplate extends BaseTemplate<CustomVariables> {
  getRequiredVariables(): string[] {
    return ['subject', 'htmlContent', 'textContent'];
  }

  private replaceVariables(content: string, variables: CustomVariables): string {
    let result = content;

    // Replace all {{variableName}} placeholders with actual values
    Object.keys(variables).forEach(key => {
      const placeholder = `{{${key}}}`;
      const value = variables[key];

      // Convert value to string and replace all occurrences
      if (value !== undefined && value !== null) {
        result = result.replace(
          new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
          String(value)
        );
      }
    });

    return result;
  }

  render(variables: CustomVariables): TemplateResult {
    this.validateVariables(variables);

    // Process HTML content with variable substitution
    const processedHtml = this.replaceVariables(variables.htmlContent, variables);

    // Process text content with variable substitution
    const processedText = this.replaceVariables(variables.textContent, variables);

    // If HTML content doesn't have proper HTML structure, wrap it
    const html =
      variables.htmlContent.toLowerCase().includes('<!doctype') ||
      variables.htmlContent.toLowerCase().includes('<html')
        ? processedHtml
        : `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${variables.subject}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
          }
          .custom-content { padding: 20px; }
        </style>
      </head>
      <body>
        <div class="custom-content">
          ${processedHtml}
        </div>
      </body>
      </html>
    `;

    return {
      html,
      text: processedText,
      subject: variables.subject
    };
  }
}
