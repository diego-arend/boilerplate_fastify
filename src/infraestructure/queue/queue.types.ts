/**
 * Simplified Queue System Types
 *
 * Architecture:
 * 1. Jobs persisted in MongoDB
 * 2. Batch processing through memory cache (QueueCache - Redis db1)
 * 3. Failed jobs moved to Dead Letter Queue (DLQ) in MongoDB
 * 4. Independent worker process for Docker deployment
 */

import type { IJob } from '../../entities/job/index.js';

/**
 * Job types
 */
export const JobType = {
  EMAIL_SEND: 'email:send',
  USER_NOTIFICATION: 'user:notification',
  DATA_EXPORT: 'data:export',
  FILE_PROCESS: 'file:process',
  CACHE_WARM: 'cache:warm',
  CLEANUP: 'cleanup'
} as const;

export type JobType = (typeof JobType)[keyof typeof JobType];

/**
 * Job priority levels
 */
export const JobPriority = {
  CRITICAL: 20,
  HIGH: 15,
  NORMAL: 10,
  LOW: 5
} as const;

export type JobPriority = (typeof JobPriority)[keyof typeof JobPriority];

/**
 * Job status
 */
export const JobStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

/**
 * Job batch for memory processing
 */
export interface JobBatch {
  id: string;
  jobs: IJob[];
  priority: JobPriority;
  loadedAt: Date;
  ttl: number; // Cache TTL in seconds
}

/**
 * Queue statistics
 */
export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  currentBatch: {
    id: string | null;
    size: number;
    priority: JobPriority | null;
    loadedAt: Date | null;
  };
}

/**
 * Dead Letter Queue statistics
 */
export interface DLQStats {
  total: number;
  byType: Record<JobType, number>;
  oldest: {
    id: string;
    failedAt: Date;
    daysSince: number;
  } | null;
}

/**
 * Job processing result
 */
export interface JobResult {
  success: boolean;
  jobId: string;
  data?: any;
  error?: string;
  processedAt: number;
  processingTime: number; // milliseconds
  workerId?: string; // Optional worker identifier
  retryCount?: number; // Optional retry count
  movedToDLQ?: boolean; // Optional DLQ flag
}

/**
 * Worker configuration
 */
export interface WorkerConfig {
  batchSize: number;
  batchTTL: number; // seconds
  maxRetries: number;
  retryDelay: number; // milliseconds
  concurrency: number; // max concurrent jobs
}

/**
 * Queue health status
 */
export const QueueHealth = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  DOWN: 'down'
} as const;

export type QueueHealthStatus = (typeof QueueHealth)[keyof typeof QueueHealth];

/**
 * Queue health information
 */
export interface QueueHealthInfo {
  status: QueueHealthStatus;
  database: {
    connected: boolean;
    responseTime: number;
  };
  cache: {
    connected: boolean;
    responseTime: number;
  };
  stats: QueueStats;
}

/**
 * Job handler function with optional metadata and services
 */
export type JobHandler<T = any> = (
  data: T,
  jobId: string,
  logger: any,
  metadata?: {
    attempt: number;
    maxAttempts: number;
    queuedAt: Date;
    processingAt: Date;
  },
  services?: any
) => Promise<JobResult>;
