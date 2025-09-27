/**
 * Queue Job Handlers - Specialized Handlers Only
 * Each handler is specialized for a specific job type
 */

import type { FastifyBaseLogger } from 'fastify';
import {
  handleRegistrationEmailJob,
  type RegistrationEmailData
} from './jobs/business/registrationEmailJob.js';

export interface QueueJobHandler {
  (data: any, logger?: FastifyBaseLogger): Promise<any>;
}

/**
 * Registration email job handler adapted for BullMQ
 */
export async function bullmqRegistrationEmailHandler(
  data: RegistrationEmailData,
  logger?: FastifyBaseLogger
): Promise<any> {
  const jobLogger =
    logger ||
    ({
      info: console.log,
      error: console.error,
      warn: console.warn,
      debug: console.log
    } as FastifyBaseLogger);

  // Generate unique job ID for BullMQ context
  const jobId = `registration-email-${data.userId}-${Date.now()}`;

  try {
    const result = await handleRegistrationEmailJob(data, jobId, jobLogger, {
      attempt: 1,
      maxAttempts: 1, // Single attempt since email is being sent despite SMTP error
      queuedAt: new Date(),
      processingAt: new Date()
    });

    if (result.success) {
      jobLogger.info(`Registration email job completed: ${jobId}`);
      return {
        jobId: result.jobId,
        messageId: result.messageId,
        userId: result.userId,
        processingTime: result.processingTime
      };
    } else {
      throw new Error(result.error || 'Registration email job failed');
    }
  } catch (error) {
    jobLogger.error(`Registration email job failed: ${jobId} - ${error}`);
    throw error;
  }
}

/**
 * User notification handler (specialized placeholder)
 */
export async function bullmqUserNotificationHandler(
  data: any,
  logger?: FastifyBaseLogger
): Promise<any> {
  const jobLogger =
    logger ||
    ({
      info: console.log,
      error: console.error
    } as FastifyBaseLogger);

  jobLogger.info('Processing user notification job', data);

  // Simulate processing - replace with actual notification logic
  await new Promise(resolve => setTimeout(resolve, 500));

  return {
    status: 'completed',
    message: 'User notification sent successfully',
    userId: data.userId,
    type: data.type || 'info'
  };
}

/**
 * Data export handler (specialized placeholder)
 */
export async function bullmqDataExportHandler(data: any, logger?: FastifyBaseLogger): Promise<any> {
  const jobLogger =
    logger ||
    ({
      info: console.log,
      error: console.error
    } as FastifyBaseLogger);

  jobLogger.info('Processing data export job', data);

  // Simulate processing - replace with actual export logic
  await new Promise(resolve => setTimeout(resolve, 2000));

  return {
    status: 'completed',
    message: 'Data export completed successfully',
    exportType: data.exportType,
    recordsProcessed: data.recordCount || 0
  };
}

/**
 * Registry of specialized Queue handlers
 */
export const QUEUE_HANDLERS: Record<string, QueueJobHandler> = {
  'registration:email': bullmqRegistrationEmailHandler,
  'user:notification': bullmqUserNotificationHandler,
  'data:export': bullmqDataExportHandler
};

/**
 * Get handler by type
 */
export function getQueueHandler(type: string): QueueJobHandler | null {
  return QUEUE_HANDLERS[type] || null;
}
