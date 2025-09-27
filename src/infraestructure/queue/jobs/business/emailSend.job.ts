/**
 * Email Send Job Handler - Simplified Version
 * Handles email sending with basic data and template support via email/templates
 */

import type { FastifyBaseLogger } from 'fastify';
import type { JobResult } from '../../queue.types.js';
import { createTemplate, type TemplateResult } from '../../../email/templates/index.js';
import { EmailService, type EmailSendOptions } from '../../../email/index.js';

/**
 * Simple email job data structure - only essential fields
 */
export interface EmailJobData {
  // Recipients (required)
  to: string | string[];

  // Email content
  template: string; // Template name from email/templates
  variables?: Record<string, any>; // Variables for template rendering

  // Optional basic fields
  subject?: string; // Override template subject if needed
  cc?: string | string[];
  bcc?: string | string[];
  from?: string; // Override default sender
  replyTo?: string;

  // Simple priority
  priority?: 'high' | 'normal' | 'low';
}

/**
 * Simple email job handler
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
      attempt: metadata?.attempt || 1
    },
    'Processing email job'
  );

  try {
    // Basic validation
    if (!data.to) {
      throw new Error('Recipients (to) are required');
    }

    if (!data.template) {
      throw new Error('Template is required');
    }

    // Check EmailService availability
    if (!services?.emailService) {
      throw new Error('EmailService not available');
    }

    // Render template using email/templates system
    const templateInstance = createTemplate(data.template);
    if (!templateInstance) {
      throw new Error(`Template '${data.template}' not found`);
    }

    const renderedContent: TemplateResult = templateInstance.render(data.variables || {});

    // Prepare email options for EmailService
    const emailOptions: EmailSendOptions = {
      to: data.to,
      subject: data.subject || renderedContent.subject, // Allow subject override
      html: renderedContent.html,
      text: renderedContent.text,
      priority: data.priority || 'normal'
    };

    // Add optional fields
    if (data.cc) emailOptions.cc = data.cc;
    if (data.bcc) emailOptions.bcc = data.bcc;
    if (data.from) emailOptions.from = data.from;
    if (data.replyTo) emailOptions.replyTo = data.replyTo;

    // Send email via EmailService
    const result = await services.emailService.sendMail(emailOptions);
    const processingTime = Date.now() - startTime;

    logger.info(
      {
        jobId,
        messageId: result.messageId,
        accepted: result.accepted.length,
        rejected: result.rejected.length,
        processingTime
      },
      'Email sent successfully'
    );

    return {
      success: true,
      jobId,
      data: {
        messageId: result.messageId,
        template: data.template,
        recipients: Array.isArray(data.to) ? data.to.length : 1
      },
      processedAt: Date.now(),
      processingTime,
      workerId: process.env.WORKER_ID || 'unknown',
      retryCount: (metadata?.attempt || 1) - 1
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error(
      {
        jobId,
        error: errorMessage,
        processingTime,
        template: data.template,
        attempt: metadata?.attempt || 1
      },
      'Email job failed'
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
        dlqReason: `Max attempts reached: ${errorMessage}`
      })
    };
  }
}
