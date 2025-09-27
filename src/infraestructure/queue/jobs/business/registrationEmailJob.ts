/**
 * Registration Email Job Handler - Specialized & Self-Contained
 * Sends registration success email directly without delegation
 */

import type { FastifyBaseLogger } from 'fastify';
import { EmailService, type EmailConfig } from '../../../email/index.js';

/**
 * Registration email job data
 */
export interface RegistrationEmailData {
  userId: string;
  userName: string;
  userEmail: string;
}

/**
 * Registration email job result
 */
export interface RegistrationEmailJobResult {
  success: boolean;
  jobId: string;
  messageId?: string;
  error?: string;
  processingTime: number;
  userId: string;
  movedToDLQ?: boolean;
  dlqReason?: string;
}

/**
 * Specialized registration email job handler - handles everything internally
 */
export async function handleRegistrationEmailJob(
  data: RegistrationEmailData,
  jobId: string,
  logger: FastifyBaseLogger,
  metadata?: {
    attempt: number;
    maxAttempts: number;
    queuedAt: Date;
    processingAt: Date;
  }
): Promise<RegistrationEmailJobResult> {
  const startTime = Date.now();

  logger.info(
    {
      jobId,
      userId: data.userId,
      userEmail: data.userEmail,
      attempt: metadata?.attempt || 1
    },
    'Processing registration email job'
  );

  try {
    // Validate required data
    if (!data.userName || !data.userEmail || !data.userId) {
      throw new Error('Missing required registration email data');
    }

    // Create EmailService with current environment configuration
    const emailConfig: EmailConfig = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      from: process.env.EMAIL_FROM || 'noreply@boilerplate.com'
    };

    const emailService = new EmailService(emailConfig, logger);

    // Render registration success template
    const { createTemplate } = await import('../../../email/templates/index.js');
    const template = createTemplate('registration_success');

    if (!template) {
      throw new Error('Registration success template not found');
    }

    const templateResult = template.render({ userName: data.userName });

    // Send registration success email directly
    const emailResult = await emailService.sendMail({
      to: data.userEmail,
      subject: templateResult.subject,
      html: templateResult.html,
      text: templateResult.text
    });

    const processingTime = Date.now() - startTime;

    logger.info(
      {
        jobId,
        userId: data.userId,
        userEmail: data.userEmail,
        messageId: emailResult.messageId,
        processingTime,
        template: 'registration_success'
      },
      'Registration email sent successfully'
    );

    return {
      success: true,
      jobId,
      messageId: emailResult.messageId,
      processingTime,
      userId: data.userId
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error(
      {
        jobId,
        userId: data.userId,
        userEmail: data.userEmail,
        error: errorMessage,
        processingTime,
        attempt: metadata?.attempt || 1
      },
      'Registration email job failed'
    );

    const shouldMoveToDLQ = (metadata?.attempt || 1) >= (metadata?.maxAttempts || 1);

    return {
      success: false,
      jobId,
      error: errorMessage,
      processingTime,
      userId: data.userId,
      movedToDLQ: shouldMoveToDLQ,
      ...(shouldMoveToDLQ && { dlqReason: `Max attempts reached: ${errorMessage}` })
    };
  }
}
