/**
 * System Alert Email Template
 */

import type { TemplateResult } from './types.js';
import { BaseTemplate } from './types.js';

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

interface SystemAlertVariables {
  alertTitle: string;
  alertMessage: string;
  severity: AlertSeverity;
  timestamp: string;
  systemName: string;
  actionRequired?: string;
  contactInfo?: string;
}

export class SystemAlertTemplate extends BaseTemplate<SystemAlertVariables> {
  getRequiredVariables(): string[] {
    return ['alertTitle', 'alertMessage', 'severity', 'timestamp', 'systemName'];
  }

  private getSeverityConfig(severity: AlertSeverity) {
    const configs = {
      [AlertSeverity.LOW]: {
        color: '#28a745',
        icon: 'ℹ️',
        label: 'Low Priority'
      },
      [AlertSeverity.MEDIUM]: {
        color: '#ffc107',
        icon: '⚠️',
        label: 'Medium Priority'
      },
      [AlertSeverity.HIGH]: {
        color: '#fd7e14',
        icon: '🔶',
        label: 'High Priority'
      },
      [AlertSeverity.CRITICAL]: {
        color: '#dc3545',
        icon: '🚨',
        label: 'CRITICAL'
      }
    };
    return configs[severity];
  }

  render(variables: SystemAlertVariables): TemplateResult {
    this.validateVariables(variables);

    const severityConfig = this.getSeverityConfig(variables.severity);

    const actionSection = variables.actionRequired
      ? `
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <strong>Action Required:</strong><br>
          ${variables.actionRequired}
        </div>
      `
      : '';

    const contactSection = variables.contactInfo
      ? `
        <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <strong>Need Help?</strong><br>
          ${variables.contactInfo}
        </div>
      `
      : '';

    const actionTextSection = variables.actionRequired
      ? `\nAction Required:\n${variables.actionRequired}\n`
      : '';

    const contactTextSection = variables.contactInfo
      ? `\nNeed Help?\n${variables.contactInfo}\n`
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>System Alert: ${variables.alertTitle}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${severityConfig.color}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .alert-info { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .severity { display: inline-block; background: ${severityConfig.color}; color: white; padding: 5px 10px; border-radius: 3px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${severityConfig.icon} System Alert</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${variables.systemName}</p>
          </div>
          <div class="content">
            <div class="alert-info">
              <p><strong>Alert:</strong> ${variables.alertTitle}</p>
              <p><strong>Severity:</strong> <span class="severity">${severityConfig.label}</span></p>
              <p><strong>Time:</strong> ${variables.timestamp}</p>
              <p><strong>System:</strong> ${variables.systemName}</p>
            </div>

            <h3>Alert Details</h3>
            <p>${variables.alertMessage}</p>

            ${actionSection}
            ${contactSection}

            <p style="margin-top: 30px; font-size: 12px; color: #666;">
              This is an automated system alert. Please do not reply to this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      ${severityConfig.icon} SYSTEM ALERT ${severityConfig.icon}

      Alert: ${variables.alertTitle}
      Severity: ${severityConfig.label}
      Time: ${variables.timestamp}
      System: ${variables.systemName}

      Alert Details:
      ${variables.alertMessage}
      ${actionTextSection}${contactTextSection}
      ---
      This is an automated system alert. Please do not reply to this email.
    `;

    return {
      html,
      text: text.trim(),
      subject: `[${severityConfig.label}] ${variables.alertTitle} - ${variables.systemName}`
    };
  }
}
