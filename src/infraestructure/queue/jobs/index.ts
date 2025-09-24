/**
 * Job handlers registry
 * Central registry for all job handlers in the queue system
 */

import type { JobHandler } from '../queue.types.js';
import { QueueJobType } from '../queue.types.js';
import { handleEmailSend } from './business/emailSend.job.js';

/**
 * Job handlers mapping
 * Maps job types to their corresponding handler functions
 */
export const JOB_HANDLERS: Record<string, JobHandler> = {
  [QueueJobType.EMAIL_SEND]: handleEmailSend
} as const;

/**
 * Available job types for validation
 */
export const AVAILABLE_JOB_TYPES = Object.keys(JOB_HANDLERS);

/**
 * Validate if a job type is supported
 */
export function isValidJobType(jobType: string): boolean {
  return jobType in JOB_HANDLERS;
}

/**
 * Get job handler by type
 */
export function getJobHandler(jobType: string): JobHandler | null {
  return JOB_HANDLERS[jobType] || null;
}

// Re-export job handlers for convenience
export { handleEmailSend } from './business/emailSend.job.js';

// Re-export types and constants from email job
export { EmailTemplateConstants, TEMPLATE_VARIABLES } from './business/emailSend.job.js';

export type { EmailTemplateType, EmailJobData } from './business/emailSend.job.js';
