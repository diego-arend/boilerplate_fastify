/**
 * Job handlers index file
 * Centralizes all job handler imports for easy management
 */

export { handleEmailSend } from './emailSend.job.js';
export { handleUserNotification } from './userNotification.job.js';
export { handleDataExport } from './dataExport.job.js';
export { handleFileProcess } from './fileProcess.job.js';
export { handleCacheWarm } from './cacheWarm.job.js';
export { handleCleanup } from './cleanup.job.js';

/**
 * Job handler registry for easy mapping
 * Maps job types to their corresponding handlers
 */
import { JobType } from '../queue.types.js';
import type { FastifyBaseLogger } from 'fastify';
import type { JobResult } from '../queue.types.js';

import { handleEmailSend } from './emailSend.job.js';
import { handleUserNotification } from './userNotification.job.js';
import { handleDataExport } from './dataExport.job.js';
import { handleFileProcess } from './fileProcess.job.js';
import { handleCacheWarm } from './cacheWarm.job.js';
import { handleCleanup } from './cleanup.job.js';

/**
 * Type for job handler functions
 */
export type JobHandler = (
  data: any,
  jobId: string,
  logger: FastifyBaseLogger
) => Promise<JobResult>;

/**
 * Registry of all job handlers mapped by job type
 * This makes it easy to add new handlers or modify existing ones
 */
export const JOB_HANDLERS: Record<string, JobHandler> = {
  [JobType.EMAIL_SEND]: handleEmailSend,
  [JobType.USER_NOTIFICATION]: handleUserNotification,
  [JobType.DATA_EXPORT]: handleDataExport,
  [JobType.FILE_PROCESS]: handleFileProcess,
  [JobType.CACHE_WARM]: handleCacheWarm,
  [JobType.CLEANUP]: handleCleanup,
} as const;

/**
 * Gets a handler for a specific job type
 * 
 * @param jobType - The type of job to get a handler for
 * @returns The handler function or undefined if not found
 */
export function getJobHandler(jobType: string): JobHandler | undefined {
  return JOB_HANDLERS[jobType];
}

/**
 * Gets all registered job types
 * 
 * @returns Array of all registered job type keys
 */
export function getRegisteredJobTypes(): string[] {
  return Object.keys(JOB_HANDLERS);
}

/**
 * Validates if a job type has a registered handler
 * 
 * @param jobType - The job type to validate
 * @returns True if handler exists, false otherwise
 */
export function hasJobHandler(jobType: string): boolean {
  return jobType in JOB_HANDLERS;
}