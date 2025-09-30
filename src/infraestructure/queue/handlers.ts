/**
 * Queue Job Handlers - Specialized Handlers Only
 * Each handler is specialized for a specific job type
 */

import type { FastifyBaseLogger } from 'fastify';
import {
  handleRegistrationEmailJob,
  type RegistrationEmailData
} from './jobs/business/registrationEmailJob.js';
import { defaultLogger } from '../../lib/logger/index.js';

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
  const jobLogger = logger || defaultLogger.child({ component: 'registration-email-handler' });

  // Generate unique job ID for BullMQ context
  const jobId = `registration-email-${data.userId}-${Date.now()}`;

  jobLogger.info({
    message: 'Starting registration email handler for job',
    jobId,
    userId: data.userId,
    userEmail: data.userEmail,
    userName: data.userName
  });

  try {
    const result = await handleRegistrationEmailJob(data, jobId, jobLogger, {
      attempt: 1,
      maxAttempts: 1, // Single attempt since email is being sent despite SMTP error
      queuedAt: new Date(),
      processingAt: new Date()
    });

    if (result.success) {
      jobLogger.info({
        message: 'Registration email job completed successfully',
        jobId,
        messageId: result.messageId,
        processingTime: result.processingTime
      });
      return {
        jobId: result.jobId,
        messageId: result.messageId,
        userId: result.userId,
        processingTime: result.processingTime
      };
    } else {
      jobLogger.error({
        message: 'Registration email job failed',
        jobId,
        error: result.error,
        processingTime: result.processingTime
      });
      throw new Error(result.error || 'Registration email job failed');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    jobLogger.error({
      message: 'Registration email job handler failed',
      jobId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
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
  const jobLogger = logger || defaultLogger.child({ component: 'user-notification-handler' });

  jobLogger.info({
    message: 'Processing user notification job',
    userId: data.userId,
    type: data.type
  });

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
  const jobLogger = logger || defaultLogger.child({ component: 'data-export-handler' });

  jobLogger.info({
    message: 'Processing data export job',
    exportType: data.exportType,
    recordCount: data.recordCount
  });

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
