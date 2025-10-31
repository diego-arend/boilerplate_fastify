/**
 * Queue Job handlers registry - Specialized Jobs Only
 * Central registry for specialized job handlers
 */

import {
  handleRegistrationEmailJob,
  type RegistrationEmailData as _RegistrationEmailData
} from './business/registrationEmailJob';

/**
 * Job handler interface
 */
export interface JobHandler {
  (data: any, jobId: string, logger: any, jobInfo: any): Promise<any>;
}

/**
 * Job types for the queue system
 */
export const JobType = {
  REGISTRATION_EMAIL: 'registration:email',
  USER_NOTIFICATION: 'user:notification',
  DATA_EXPORT: 'data:export'
} as const;

/**
 * Job handlers mapping - Each handler is specialized
 */
export const JOB_HANDLERS: Record<string, JobHandler> = {
  [JobType.REGISTRATION_EMAIL]: handleRegistrationEmailJob
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

// Re-export specialized job handlers
export { handleRegistrationEmailJob } from './business/registrationEmailJob';

// Re-export types
export type { RegistrationEmailData } from './business/registrationEmailJob';
