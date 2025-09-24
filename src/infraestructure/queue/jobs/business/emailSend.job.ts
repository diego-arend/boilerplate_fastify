/**
 * Email Send Job Handler
 * Handles email sending with template support and delivery validation
 */

import type { FastifyBaseLogger } from 'fastify';
import type { JobResult } from '../../queue.types.js';

/**
 * Email template types with their required variables
 */
export const EmailTemplate = {
  WELCOME: 'welcome',
  PASSWORD_RESET: 'password_reset',
  ORDER_CONFIRMATION: 'order_confirmation',
  INVOICE: 'invoice',
  NEWSLETTER: 'newsletter',
  SYSTEM_ALERT: 'system_alert',
  CUSTOM: 'custom'
} as const;

export type EmailTemplateType = (typeof EmailTemplate)[keyof typeof EmailTemplate];

/**
 * Email job data structure
 */
export interface EmailJobData {
  // Recipients
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];

  // Email content
  subject: string;
  template: EmailTemplateType;
  variables?: Record<string, any>;

  // Optional overrides
  customHtml?: string; // For CUSTOM template
  customText?: string; // Plain text version

  // Attachments
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer | string;
    contentType?: string;
  }>;

  // Delivery options
  priority?: 'high' | 'normal' | 'low';
  sendAt?: Date; // Scheduled sending
  timezone?: string;

  // Tracking
  trackOpens?: boolean;
  trackClicks?: boolean;
  campaignId?: string;

  // Metadata
  userId?: string;
  organizationId?: string;
  metadata?: Record<string, any>;
}

/**
 * Template variable requirements for each template type
 */
const TEMPLATE_VARIABLES: Record<EmailTemplateType, string[]> = {
  [EmailTemplate.WELCOME]: ['userName', 'activationLink'],
  [EmailTemplate.PASSWORD_RESET]: ['userName', 'resetLink', 'expiresIn'],
  [EmailTemplate.ORDER_CONFIRMATION]: ['orderNumber', 'customerName', 'orderItems', 'totalAmount'],
  [EmailTemplate.INVOICE]: ['invoiceNumber', 'customerName', 'amount', 'dueDate', 'downloadLink'],
  [EmailTemplate.NEWSLETTER]: ['unsubscribeLink'],
  [EmailTemplate.SYSTEM_ALERT]: ['alertType', 'message', 'timestamp'],
  [EmailTemplate.CUSTOM]: [] // No required variables for custom templates
};

/**
 * Email template renderer
 */
class EmailTemplateRenderer {
  /**
   * Render email template with variables
   */
  static async renderTemplate(
    template: EmailTemplateType,
    variables: Record<string, any> = {},
    logger: FastifyBaseLogger
  ): Promise<{ html: string; text: string; subject: string }> {
    logger.info({ template, variableKeys: Object.keys(variables) }, 'Rendering email template');

    // Validate required variables
    this.validateTemplateVariables(template, variables);

    switch (template) {
      case EmailTemplate.WELCOME:
        return this.renderWelcomeTemplate(variables);

      case EmailTemplate.PASSWORD_RESET:
        return this.renderPasswordResetTemplate(variables);

      case EmailTemplate.ORDER_CONFIRMATION:
        return this.renderOrderConfirmationTemplate(variables);

      case EmailTemplate.INVOICE:
        return this.renderInvoiceTemplate(variables);

      case EmailTemplate.NEWSLETTER:
        return this.renderNewsletterTemplate(variables);

      case EmailTemplate.SYSTEM_ALERT:
        return this.renderSystemAlertTemplate(variables);

      case EmailTemplate.CUSTOM:
        return this.renderCustomTemplate(variables);

      default:
        throw new Error(`Unsupported email template: ${template}`);
    }
  }

  /**
   * Validate that all required variables are provided
   */
  private static validateTemplateVariables(
    template: EmailTemplateType,
    variables: Record<string, any>
  ): void {
    const requiredVars = TEMPLATE_VARIABLES[template];
    const missingVars = requiredVars.filter((varName: string) => !(varName in variables));

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required variables for template ${template}: ${missingVars.join(', ')}`
      );
    }
  }

  /**
   * Welcome email template
   */
  private static renderWelcomeTemplate(vars: Record<string, any>) {
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
            <h1>Welcome ${vars.userName}!</h1>
          </div>
          <div class="content">
            <h2>Thank you for joining us!</h2>
            <p>We're excited to have you on board. To get started, please activate your account by clicking the button below:</p>
            <p style="text-align: center;">
              <a href="${vars.activationLink}" class="button">Activate Account</a>
            </p>
            <p>If you have any questions, feel free to contact our support team.</p>
            <p>Best regards,<br>The Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Welcome ${vars.userName}!

      Thank you for joining us! We're excited to have you on board.

      To get started, please activate your account by visiting this link:
      ${vars.activationLink}

      If you have any questions, feel free to contact our support team.

      Best regards,
      The Team
    `;

    return {
      html,
      text: text.trim(),
      subject: `Welcome ${vars.userName}! Please activate your account`
    };
  }

  /**
   * Password reset email template
   */
  private static renderPasswordResetTemplate(vars: Record<string, any>) {
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
            <h1>Password Reset</h1>
          </div>
          <div class="content">
            <h2>Hello ${vars.userName},</h2>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <p style="text-align: center;">
              <a href="${vars.resetLink}" class="button">Reset Password</a>
            </p>
            <div class="warning">
              <strong>⚠️ Important:</strong> This link will expire in ${vars.expiresIn}. If you didn't request this reset, please ignore this email.
            </div>
            <p>For security reasons, if you don't reset your password within the time limit, you'll need to request a new reset.</p>
            <p>Best regards,<br>Security Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Password Reset Request

      Hello ${vars.userName},

      We received a request to reset your password. Visit this link to create a new password:
      ${vars.resetLink}

      ⚠️ Important: This link will expire in ${vars.expiresIn}. If you didn't request this reset, please ignore this email.

      For security reasons, if you don't reset your password within the time limit, you'll need to request a new reset.

      Best regards,
      Security Team
    `;

    return {
      html,
      text: text.trim(),
      subject: 'Password Reset Request - Action Required'
    };
  }

  /**
   * Order confirmation email template
   */
  private static renderOrderConfirmationTemplate(vars: Record<string, any>) {
    const orderItemsHtml = vars.orderItems
      .map(
        (item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.price}</td>
      </tr>
    `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #f8f9fa; padding: 12px; text-align: left; border-bottom: 2px solid #ddd; }
          .total { font-weight: bold; font-size: 1.2em; color: #28a745; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Confirmed!</h1>
            <p>Order #${vars.orderNumber}</p>
          </div>
          <div class="content">
            <h2>Hello ${vars.customerName},</h2>
            <p>Thank you for your order! We've received your payment and are preparing your items for shipment.</p>
            
            <h3>Order Details:</h3>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align: center;">Quantity</th>
                  <th style="text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${orderItemsHtml}
                <tr>
                  <td colspan="2" style="padding: 12px; text-align: right; font-weight: bold;">Total:</td>
                  <td style="padding: 12px; text-align: right;" class="total">$${vars.totalAmount}</td>
                </tr>
              </tbody>
            </table>
            
            <p>You'll receive a shipping notification with tracking information once your order is dispatched.</p>
            <p>Thank you for your business!</p>
            <p>Best regards,<br>Sales Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const orderItemsText = vars.orderItems
      .map((item: any) => `${item.name} x${item.quantity} - $${item.price}`)
      .join('\n');

    const text = `
      Order Confirmed!
      Order #${vars.orderNumber}

      Hello ${vars.customerName},

      Thank you for your order! We've received your payment and are preparing your items for shipment.

      Order Details:
      ${orderItemsText}
      
      Total: $${vars.totalAmount}

      You'll receive a shipping notification with tracking information once your order is dispatched.

      Thank you for your business!

      Best regards,
      Sales Team
    `;

    return {
      html,
      text: text.trim(),
      subject: `Order Confirmation #${vars.orderNumber} - Thank you for your purchase!`
    };
  }

  /**
   * Invoice email template
   */
  private static renderInvoiceTemplate(vars: Record<string, any>) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6f42c1; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .invoice-box { background: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0; }
          .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invoice</h1>
            <p>Invoice #${vars.invoiceNumber}</p>
          </div>
          <div class="content">
            <h2>Hello ${vars.customerName},</h2>
            <p>Please find your invoice attached to this email.</p>
            
            <div class="invoice-box">
              <h3>Invoice Summary</h3>
              <p><strong>Invoice Number:</strong> ${vars.invoiceNumber}</p>
              <p><strong>Amount:</strong> $${vars.amount}</p>
              <p><strong>Due Date:</strong> ${new Date(vars.dueDate).toLocaleDateString()}</p>
            </div>
            
            <p style="text-align: center;">
              <a href="${vars.downloadLink}" class="button">Download Invoice</a>
            </p>
            
            <p>Please ensure payment is made by the due date to avoid any late fees.</p>
            <p>Thank you for your business!</p>
            <p>Best regards,<br>Billing Department</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Invoice #${vars.invoiceNumber}

      Hello ${vars.customerName},

      Please find your invoice information below:

      Invoice Number: ${vars.invoiceNumber}
      Amount: $${vars.amount}
      Due Date: ${new Date(vars.dueDate).toLocaleDateString()}

      Download your invoice: ${vars.downloadLink}

      Please ensure payment is made by the due date to avoid any late fees.

      Thank you for your business!

      Best regards,
      Billing Department
    `;

    return {
      html,
      text: text.trim(),
      subject: `Invoice #${vars.invoiceNumber} - Payment Due ${new Date(vars.dueDate).toLocaleDateString()}`
    };
  }

  /**
   * Newsletter email template
   */
  private static renderNewsletterTemplate(vars: Record<string, any>) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Newsletter</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #17a2b8; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Newsletter</h1>
            <p>${vars.title || 'Weekly Updates'}</p>
          </div>
          <div class="content">
            ${vars.content || '<p>Thank you for subscribing to our newsletter!</p>'}
          </div>
          <div class="footer">
            <p>You received this email because you subscribed to our newsletter.</p>
            <p><a href="${vars.unsubscribeLink}">Unsubscribe</a> | <a href="${vars.preferencesLink || '#'}">Manage Preferences</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Newsletter - ${vars.title || 'Weekly Updates'}

      ${vars.textContent || 'Thank you for subscribing to our newsletter!'}

      ---
      You received this email because you subscribed to our newsletter.
      Unsubscribe: ${vars.unsubscribeLink}
    `;

    return {
      html,
      text: text.trim(),
      subject: vars.subject || `Newsletter - ${vars.title || 'Weekly Updates'}`
    };
  }

  /**
   * System alert email template
   */
  private static renderSystemAlertTemplate(vars: Record<string, any>) {
    const alertColors = {
      critical: '#dc3545',
      warning: '#ffc107',
      info: '#17a2b8',
      success: '#28a745'
    };

    const alertColor = alertColors[vars.alertType as keyof typeof alertColors] || alertColors.info;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>System Alert</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${alertColor}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .alert-box { background: #f8f9fa; border-left: 4px solid ${alertColor}; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>System Alert</h1>
            <p>${vars.alertType.toUpperCase()}</p>
          </div>
          <div class="content">
            <div class="alert-box">
              <h3>Alert Details</h3>
              <p><strong>Type:</strong> ${vars.alertType}</p>
              <p><strong>Time:</strong> ${new Date(vars.timestamp).toLocaleString()}</p>
              <p><strong>Message:</strong></p>
              <p>${vars.message}</p>
            </div>
            
            ${vars.actionRequired ? '<p><strong>Action Required:</strong> Please review and take necessary action.</p>' : ''}
            ${vars.contactInfo ? `<p>If you need assistance, contact: ${vars.contactInfo}</p>` : ''}
            
            <p>Best regards,<br>System Monitoring</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      System Alert - ${vars.alertType.toUpperCase()}

      Alert Details:
      Type: ${vars.alertType}
      Time: ${new Date(vars.timestamp).toLocaleString()}
      Message: ${vars.message}

      ${vars.actionRequired ? 'Action Required: Please review and take necessary action.' : ''}
      ${vars.contactInfo ? `If you need assistance, contact: ${vars.contactInfo}` : ''}

      Best regards,
      System Monitoring
    `;

    return {
      html,
      text: text.trim(),
      subject: `System Alert - ${vars.alertType.toUpperCase()}: ${vars.message.substring(0, 50)}...`
    };
  }

  /**
   * Custom email template
   */
  private static renderCustomTemplate(vars: Record<string, any>) {
    return {
      html: vars.customHtml || '<p>Custom email content</p>',
      text: vars.customText || 'Custom email content',
      subject: vars.subject || 'Custom Email'
    };
  }
}

/**
 * Email delivery service (mock implementation)
 * In production, integrate with services like SendGrid, SES, Mailgun, etc.
 */
class EmailDeliveryService {
  static async sendEmail(
    recipients: string | string[],
    subject: string,
    htmlContent: string,
    textContent: string,
    options: {
      cc?: string | string[];
      bcc?: string | string[];
      attachments?: any[];
      priority?: string;
      trackOpens?: boolean;
      trackClicks?: boolean;
      campaignId?: string;
    } = {},
    logger: FastifyBaseLogger
  ): Promise<{ messageId: string; status: 'sent' | 'failed'; error?: string }> {
    const recipientList = Array.isArray(recipients) ? recipients : [recipients];

    logger.info(
      {
        recipients: recipientList.length,
        subject: subject.substring(0, 100),
        hasAttachments: (options.attachments?.length || 0) > 0,
        priority: options.priority || 'normal'
      },
      'Sending email via delivery service'
    );

    try {
      // Simulate email delivery delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

      // Mock email validation
      const invalidEmails = recipientList.filter(email => !this.validateEmail(email));
      if (invalidEmails.length > 0) {
        throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`);
      }

      // Mock delivery service call
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Simulate occasional failures (5% failure rate for testing)
      if (Math.random() < 0.05) {
        throw new Error('Email delivery service temporarily unavailable');
      }

      logger.info({ messageId, recipients: recipientList.length }, 'Email sent successfully');

      return {
        messageId,
        status: 'sent'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown delivery error';
      logger.error(
        { error: errorMessage, recipients: recipientList.length },
        'Email delivery failed'
      );

      return {
        messageId: `failed_${Date.now()}`,
        status: 'failed',
        error: errorMessage
      };
    }
  }

  private static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

/**
 * Main email job handler
 */
export async function handleEmailSend(
  data: EmailJobData,
  jobId: string,
  logger: FastifyBaseLogger,
  metadata?: {
    attempt: number;
    maxAttempts: number;
    queuedAt: Date;
    processingAt: Date;
  }
): Promise<JobResult> {
  const startTime = Date.now();

  logger.info(
    {
      jobId,
      template: data.template,
      recipients: Array.isArray(data.to) ? data.to.length : 1,
      attempt: metadata?.attempt || 1,
      maxAttempts: metadata?.maxAttempts || 1
    },
    'Processing email send job'
  );

  try {
    // Validate email job data
    validateEmailJobData(data);

    // Render email template
    const renderedContent = await EmailTemplateRenderer.renderTemplate(
      data.template,
      data.variables || {},
      logger.child({ component: 'email-renderer' })
    );

    // Use custom subject if provided, otherwise use template subject
    const finalSubject = data.subject || renderedContent.subject;

    // Use custom content if provided (for CUSTOM template)
    const finalHtmlContent = data.customHtml || renderedContent.html;
    const finalTextContent = data.customText || renderedContent.text;

    // Send email via delivery service
    const emailOptions: {
      cc?: string | string[];
      bcc?: string | string[];
      attachments?: any[];
      priority?: string;
      trackOpens?: boolean;
      trackClicks?: boolean;
      campaignId?: string;
    } = {};

    if (data.cc) emailOptions.cc = data.cc;
    if (data.bcc) emailOptions.bcc = data.bcc;
    if (data.attachments) emailOptions.attachments = data.attachments;
    if (data.priority) emailOptions.priority = data.priority;
    if (data.trackOpens !== undefined) emailOptions.trackOpens = data.trackOpens;
    if (data.trackClicks !== undefined) emailOptions.trackClicks = data.trackClicks;
    if (data.campaignId) emailOptions.campaignId = data.campaignId;

    const deliveryResult = await EmailDeliveryService.sendEmail(
      data.to,
      finalSubject,
      finalHtmlContent,
      finalTextContent,
      emailOptions,
      logger.child({ component: 'email-delivery' })
    );

    const processingTime = Date.now() - startTime;

    if (deliveryResult.status === 'sent') {
      logger.info(
        {
          jobId,
          messageId: deliveryResult.messageId,
          processingTime,
          template: data.template
        },
        'Email job completed successfully'
      );

      return {
        success: true,
        jobId,
        data: {
          messageId: deliveryResult.messageId,
          template: data.template,
          recipients: Array.isArray(data.to) ? data.to.length : 1,
          subject: finalSubject
        },
        processedAt: Date.now(),
        processingTime,
        workerId: process.env.WORKER_ID || 'unknown',
        retryCount: (metadata?.attempt || 1) - 1
      };
    } else {
      throw new Error(deliveryResult.error || 'Email delivery failed');
    }
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error(
      {
        jobId,
        error: errorMessage,
        processingTime,
        attempt: metadata?.attempt || 1,
        maxAttempts: metadata?.maxAttempts || 1,
        template: data.template
      },
      'Email job processing failed'
    );

    const shouldMoveToDLQ = (metadata?.attempt || 1) >= (metadata?.maxAttempts || 1);

    return {
      success: false,
      jobId,
      error: errorMessage,
      processedAt: Date.now(),
      processingTime,
      workerId: process.env.WORKER_ID || 'unknown',
      retryCount: (metadata?.attempt || 1) - 1,
      movedToDLQ: shouldMoveToDLQ,
      ...(shouldMoveToDLQ && {
        dlqReason: `Max attempts (${metadata?.maxAttempts}) reached: ${errorMessage}`
      })
    };
  }
}

/**
 * Validate email job data
 */
function validateEmailJobData(data: EmailJobData): void {
  // Validate recipients
  if (!data.to || (Array.isArray(data.to) && data.to.length === 0)) {
    throw new Error('Email recipients (to) are required');
  }

  // Validate email addresses
  const allRecipients = [
    ...(Array.isArray(data.to) ? data.to : [data.to]),
    ...(Array.isArray(data.cc) ? data.cc : data.cc ? [data.cc] : []),
    ...(Array.isArray(data.bcc) ? data.bcc : data.bcc ? [data.bcc] : [])
  ];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalidEmails = allRecipients.filter(email => !emailRegex.test(email));

  if (invalidEmails.length > 0) {
    throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`);
  }

  // Validate template
  if (!data.template || !Object.values(EmailTemplate).includes(data.template)) {
    throw new Error(
      `Invalid email template: ${data.template}. Must be one of: ${Object.values(EmailTemplate).join(', ')}`
    );
  }

  // Validate subject
  if (!data.subject && data.template === EmailTemplate.CUSTOM) {
    throw new Error('Subject is required for custom email templates');
  }

  // Validate custom content for CUSTOM template
  if (data.template === EmailTemplate.CUSTOM && !data.customHtml && !data.customText) {
    throw new Error('Custom HTML or text content is required for custom email templates');
  }

  // Validate scheduled sending
  if (data.sendAt && new Date(data.sendAt) < new Date()) {
    throw new Error('Scheduled send time cannot be in the past');
  }

  // Validate attachments
  if (data.attachments && data.attachments.length > 10) {
    throw new Error('Maximum of 10 attachments allowed per email');
  }

  const totalAttachmentSize =
    data.attachments?.reduce((total, attachment) => {
      const size = attachment.content
        ? Buffer.isBuffer(attachment.content)
          ? attachment.content.length
          : Buffer.byteLength(attachment.content)
        : 0;
      return total + size;
    }, 0) || 0;

  // Limit total attachment size to 25MB
  if (totalAttachmentSize > 25 * 1024 * 1024) {
    throw new Error('Total attachment size cannot exceed 25MB');
  }
}

// Export template constants for external usage
export { TEMPLATE_VARIABLES, EmailTemplate as EmailTemplateConstants };
