/**
 * Email Send Job Handler
 * Handles email sending with Nodemailer integration and template support
 */

import type { FastifyBaseLogger } from 'fastify';
import type { JobResult } from '../../queue.types.js';
import {
  createTemplate,
  AvailableTemplates,
  type TemplateResult
} from '../../../../lib/templates/index.js';
import { EmailService, type EmailSendOptions } from '../../../email/index.js';

/**
 * Email template types with their required variables
 */
export const EmailTemplate = {
  WELCOME: 'welcome',
  REGISTRATION_SUCCESS: 'registration_success',
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
 * Email template renderer using modular templates from lib/templates
 */
class EmailTemplateRenderer {
  /**
   * Render email template with variables using the new template system
   */
  static async renderTemplate(
    template: EmailTemplateType,
    variables: Record<string, any> = {},
    logger: FastifyBaseLogger
  ): Promise<TemplateResult> {
    logger.info({ template, variableKeys: Object.keys(variables) }, 'Rendering email template');

    try {
      // Create template instance using factory
      const templateInstance = createTemplate(template);

      if (!templateInstance) {
        throw new Error(`Unsupported email template: ${template}`);
      }

      // Render template with variables
      const result = templateInstance.render(variables);

      logger.info(
        {
          template,
          subjectLength: result.subject.length,
          htmlLength: result.html.length,
          textLength: result.text.length
        },
        'Template rendered successfully'
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Template rendering failed';
      logger.error({ template, error: errorMessage }, 'Failed to render email template');
      throw new Error(`Template rendering failed for ${template}: ${errorMessage}`);
    }
  }
}

/**
 * Email delivery service using Nodemailer
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
    logger: FastifyBaseLogger,
    emailService: EmailService
  ): Promise<{ messageId: string; status: 'sent' | 'failed'; error?: string }> {
    const recipientList = Array.isArray(recipients) ? recipients : [recipients];

    logger.info(
      {
        recipients: recipientList.length,
        subject: subject.substring(0, 100),
        hasAttachments: (options.attachments?.length || 0) > 0,
        priority: options.priority || 'normal'
      },
      'Sending email via Nodemailer'
    );

    try {
      // Validate email addresses
      const invalidEmails = recipientList.filter(email => !this.validateEmail(email));
      if (invalidEmails.length > 0) {
        throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`);
      }

      // Prepare email options
      const emailOptions: EmailSendOptions = {
        to: recipients,
        subject,
        html: htmlContent,
        text: textContent,
        priority: (options.priority as 'high' | 'normal' | 'low') || 'normal'
      };

      if (options.cc) emailOptions.cc = options.cc;
      if (options.bcc) emailOptions.bcc = options.bcc;
      if (options.attachments) emailOptions.attachments = options.attachments;

      // Add tracking headers if enabled
      if (options.trackOpens || options.trackClicks || options.campaignId) {
        emailOptions.headers = {
          ...(options.campaignId && { 'X-Campaign-ID': options.campaignId }),
          ...(options.trackOpens && { 'X-Track-Opens': 'true' }),
          ...(options.trackClicks && { 'X-Track-Clicks': 'true' })
        };
      }

      // Send email using EmailService
      const result = await emailService.sendMail(emailOptions);

      logger.info(
        {
          messageId: result.messageId,
          accepted: result.accepted.length,
          rejected: result.rejected.length
        },
        'Email sent successfully via Nodemailer'
      );

      // Check if email was rejected
      if (result.rejected.length > 0) {
        logger.warn(
          { rejected: result.rejected },
          'Some recipients were rejected by the email service'
        );
      }

      return {
        messageId: result.messageId,
        status: 'sent'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown delivery error';
      logger.error(
        { error: errorMessage, recipients: recipientList.length },
        'Email delivery failed via Nodemailer'
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
 * Main email job handler - Updated to match new JobHandler interface
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
  },
  services?: {
    emailService?: EmailService;
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

    // If no email service provided, create a development one
    if (!services?.emailService) {
      logger.error('No email service provided and no SMTP configuration available');
      throw new Error(
        'Email service not available. Please configure SMTP settings or register email plugin.'
      );
    }

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
      logger.child({ component: 'email-delivery' }),
      services.emailService!
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
export { EmailTemplate as EmailTemplateConstants };
