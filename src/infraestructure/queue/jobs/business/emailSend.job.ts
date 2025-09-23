import type { FastifyBaseLogger } from 'fastify';
import type { EmailJobData, JobResult } from '../../queue.types.js';

/**
 * Handler for EMAIL_SEND jobs
 * Processes email sending tasks including template rendering and delivery
 *
 * @param data - Email job data containing recipient, subject, body, etc.
 * @param jobId - Unique identifier for the job
 * @param logger - Logger instance with job context
 * @returns Promise<JobResult> - Success/failure result with data or error
 */
export async function handleEmailSend(
  data: EmailJobData,
  jobId: string,
  logger: FastifyBaseLogger
): Promise<JobResult> {
  const startTime = Date.now();

  logger.info({
    to: data.to,
    subject: data.subject,
    template: data.template,
    hasVariables: !!data.variables && Object.keys(data.variables).length > 0
  }, 'Processing email send job');

  try {
    // Validate required email data
    validateEmailData(data);

    // Simulate email template rendering if template provided
    if (data.template) {
      logger.debug({ template: data.template }, 'Rendering email template');
      await simulateTemplateRendering(data.template, data.variables);
    }

    // Simulate email delivery process
    logger.debug('Sending email via provider');
    const deliveryResult = await simulateEmailDelivery(data);

    const processingTime = Date.now() - startTime;

    logger.info({
      messageId: deliveryResult.messageId,
      processingTime,
      to: data.to
    }, 'Email sent successfully');

    return {
      success: true,
      data: {
        messageId: deliveryResult.messageId,
        to: data.to,
        subject: data.subject,
        provider: deliveryResult.provider,
        sentAt: new Date().toISOString(),
        deliveryTime: deliveryResult.deliveryTime
      },
      processedAt: Date.now(),
      processingTime
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown email sending error';

    logger.error({
      error,
      processingTime,
      to: data.to,
      subject: data.subject
    }, 'Failed to send email');

    return {
      success: false,
      error: errorMessage,
      processedAt: Date.now(),
      processingTime
    };
  }
}

/**
 * Validates email job data
 */
function validateEmailData(data: EmailJobData): void {
  if (!data.to || typeof data.to !== 'string') {
    throw new Error('Valid email recipient (to) is required');
  }

  if (!data.subject || typeof data.subject !== 'string') {
    throw new Error('Email subject is required');
  }

  if (!data.body || typeof data.body !== 'string') {
    throw new Error('Email body is required');
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.to)) {
    throw new Error('Invalid email address format');
  }

  // Security validation - prevent potential XSS in email content
  const dangerousPatterns = ['<script', 'javascript:', 'data:text/html'];
  const contentToCheck = [data.subject, data.body];

  for (const content of contentToCheck) {
    for (const pattern of dangerousPatterns) {
      if (content.toLowerCase().includes(pattern)) {
        throw new Error(`Potentially malicious content detected: ${pattern}`);
      }
    }
  }
}

/**
 * Simulates email template rendering
 */
async function simulateTemplateRendering(
  template: string,
  variables?: Record<string, any>
): Promise<void> {
  // Simulate template processing time
  const renderTime = 200 + Math.random() * 300;
  await new Promise(resolve => setTimeout(resolve, renderTime));

  // Validate template variables if provided
  if (variables && typeof variables !== 'object') {
    throw new Error('Template variables must be an object');
  }
}

/**
 * Simulates email delivery through provider
 */
async function simulateEmailDelivery(data: EmailJobData): Promise<{
  messageId: string
  provider: string
  deliveryTime: number
}> {
  const deliveryStart = Date.now();

  // Simulate different delivery times based on email size and attachments
  const baseDeliveryTime = 800;
  const subjectBonus = Math.min(data.subject.length * 2, 100);
  const bodyBonus = Math.min(data.body.length * 0.5, 500);
  const variablesBonus = data.variables ? Object.keys(data.variables).length * 10 : 0;

  const totalDeliveryTime = baseDeliveryTime + subjectBonus + bodyBonus + variablesBonus + Math.random() * 1000;

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, totalDeliveryTime));

  // Simulate rare delivery failures (2% chance)
  if (Math.random() < 0.02) {
    throw new Error('Email provider temporarily unavailable');
  }

  const deliveryTime = Date.now() - deliveryStart;

  return {
    messageId: `email_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
    provider: 'smtp-provider',
    deliveryTime
  };
}
