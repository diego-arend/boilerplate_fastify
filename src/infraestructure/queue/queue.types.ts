/**
 * Queue system types and interfaces with MongoDB persistence
 */

import type { IJob } from '../../entities/job/index.js';

/**
 * Job types with database persistence support
 */
export const QueueJobType = {
  EMAIL_SEND: 'email_send',
  USER_NOTIFICATION: 'user_notification',
  DATA_EXPORT: 'data_export',
  FILE_PROCESS: 'file_process',
  CACHE_WARM: 'cache_warm',
  CLEANUP: 'cleanup'
} as const;

export type QueueJobType = (typeof QueueJobType)[keyof typeof QueueJobType];

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
 * Job status types
 */
export const JobStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

/**
 * Job batch for memory processing
 */
export interface JobBatch {
  id: string;
  jobs: IJob[];
  priority: number;
  minPriority: number;
  maxPriority: number;
  loadedAt: Date;
  ttl: number;
  size: number;
}

/**
 * Batch loading options
 */
export interface BatchLoadOptions {
  batchSize?: number;
  priorities?: number[];
  useCache?: boolean;
}

/**
 * Concurrency lock information
 */
export interface ConcurrencyLock {
  jobId: string;
  workerId: string;
  acquiredAt: Date;
  expiresAt: Date;
  timeout: number;
}

/**
 * Queue statistics with batch info
 */
export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  batchInfo?: {
    currentBatchSize: number;
    currentBatchPriority: number;
    batchLoadedAt: Date;
  } | null;
  redisConnected: boolean;
  cacheConnected: boolean;
}

/**
 * DLQ statistics by type
 */
export interface DLQStats {
  total: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  oldest?: {
    id: string;
    movedAt: Date;
    daysSince: number;
  };
}

/**
 * Modern job types with database persistence support
 */
export const ModernJobType = {
  EMAIL_SEND: 'email:send',
  USER_NOTIFICATION: 'user:notification',
  DATA_EXPORT: 'data:export',
  FILE_PROCESS: 'file:process',
  CACHE_WARM: 'cache:warm',
  CLEANUP: 'cleanup'
} as const;

export type ModernJobType = (typeof ModernJobType)[keyof typeof ModernJobType];

/**
 * Job batch configuration
 */
export interface BatchConfig {
  size: number; // Number of jobs to load in each batch
  ttl: number; // TTL in seconds for cached jobs
  priorityLevels: {
    critical: { min: 15; max: 20 };
    high: { min: 10; max: 14 };
    normal: { min: 5; max: 9 };
    low: { min: 1; max: 4 };
  };
}

/**
 * Worker lock configuration
 */
export interface WorkerLockConfig {
  lockTimeout: number; // Lock timeout in milliseconds
  heartbeatInterval: number; // Heartbeat interval in milliseconds
  maxRetries: number; // Maximum lock acquisition retries
}

/**
 * Cache configuration for jobs
 */
export interface JobCacheConfig {
  namespace: string; // Cache namespace
  ttl: number; // Default TTL in seconds
  refreshThreshold: number; // When to refresh cache (percentage of TTL)
}

/**
 * DLQ configuration
 */
export interface DLQConfig {
  autoMove: boolean; // Automatically move failed jobs to DLQ
  maxReprocessAttempts: number; // Maximum reprocess attempts from DLQ
  cleanupInterval: number; // Cleanup interval in hours
  retentionDays: number; // How long to keep resolved DLQ entries
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  name: string;

  // Database configuration
  mongodb: {
    enabled: boolean;
    connectionString?: string;
  };

  // Redis cache configuration
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };

  // Batch processing configuration
  batch: BatchConfig;

  // Worker configuration
  worker: WorkerLockConfig;

  // Cache configuration
  cache: JobCacheConfig;

  // DLQ configuration
  dlq: DLQConfig;

  // Legacy BullMQ options (for compatibility)
  defaultJobOptions?: {
    attempts?: number;
    backoff?: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
    removeOnComplete?: number;
    removeOnFail?: number;
  };
}

/**
 * Job processing result with metadata
 */
export interface JobResult {
  success: boolean;
  jobId: string;
  data?: any;
  error?: string;
  processedAt: number;
  processingTime: number;
  workerId: string;

  // Enhanced metadata
  fromCache?: boolean; // Whether job was loaded from cache
  batchId?: string; // ID of the batch this job belonged to
  retryCount?: number; // Current retry count

  // DLQ information (if moved to DLQ)
  movedToDLQ?: boolean;
  dlqReason?: string;
}

/**
 * Batch processing metadata
 */
export interface BatchMetadata {
  batchId: string;
  loadedAt: number;
  expiresAt: number;
  priority: JobPriority;
  jobCount: number;
  processedCount: number;
  source: 'database' | 'cache' | 'hybrid';
}

/**
 * Worker status information
 */
export interface WorkerStatus {
  workerId: string;
  status: 'active' | 'idle' | 'failed' | 'shutdown';
  currentJob?: string;
  lockedAt?: Date;
  heartbeatAt: Date;
  processedJobs: number;
  failedJobs: number;
  uptime: number; // in milliseconds
}

/**
 * Queue statistics
 */
export interface QueueStatistics {
  // Basic counts
  pending: number;
  processing: number;
  completed: number;
  failed: number;

  // Priority breakdown
  priorityBreakdown: Record<string, number>;

  // Cache metrics
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    activeBatches: number;
    totalCachedJobs: number;
  };

  // DLQ metrics
  dlq: {
    total: number;
    pending: number;
    resolved: number;
    reprocessed: number;
    bySeverity: Record<string, number>;
  };

  // Worker metrics
  workers: {
    active: number;
    idle: number;
    failed: number;
    totalJobs: number;
  };

  // Performance metrics
  performance: {
    avgProcessingTime: number;
    jobsPerMinute: number;
    errorRate: number;
  };
}

/**
 * Concurrency control result
 */
export interface ConcurrencyLockResult {
  success: boolean;
  lockId?: string;
  expiresAt?: Date;
  error?: string;
}

/**
 * Job reprocessing options
 */
export interface ReprocessOptions {
  resetAttempts?: boolean;
  resetData?: Record<string, any>;
  increaseMaxAttempts?: boolean;
  priority?: JobPriority;
  reprocessedBy: string;
}

/**
 * DLQ query options
 */
export interface DLQQueryOptions {
  status?: string[];
  severity?: string[];
  jobType?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  limit?: number;
  offset?: number;
  sortBy?: 'movedToDLQAt' | 'severity' | 'jobType';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Job handler function type with metadata
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
  }
) => Promise<JobResult>;

/**
 * Queue health status
 */
export const QueueHealth = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  CRITICAL: 'critical',
  DOWN: 'down'
} as const;

export type QueueHealthStatus = (typeof QueueHealth)[keyof typeof QueueHealth];

/**
 * Queue health information
 */
export interface QueueHealthInfo {
  overall: QueueHealthStatus;
  database: {
    connected: boolean;
    responseTime?: number;
    error?: string;
  };
  cache: {
    connected: boolean;
    responseTime?: number;
    error?: string;
  };
  workers: {
    active: number;
    failed: number;
    lastHeartbeat?: Date;
  };
  queues: {
    backlog: number;
    stalled: number;
    processing: number;
  };
}

/**
 * Cleanup operation result
 */
export interface CleanupResult {
  deleted: number;
  errors: number;
  duration: number;
  details: Array<{
    operation: string;
    count: number;
    error?: string;
  }>;
}
