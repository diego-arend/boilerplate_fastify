/**
 * Queue system types and interfaces for BullMQ integration
 */

/**
 * Available job types in the queue system
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
export enum JobPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 15
}

/**
 * Job status for tracking
 */
export enum JobStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELAYED = 'delayed',
  PAUSED = 'paused'
}

/**
 * Base job data interface
 */
export interface BaseJobData {
  userId?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Email job data
 */
export interface EmailJobData extends BaseJobData {
  to: string;
  subject: string;
  body: string;
  template?: string;
  variables?: Record<string, any>;
}

/**
 * User notification job data
 */
export interface UserNotificationJobData extends BaseJobData {
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  channels?: ('push' | 'email' | 'sms')[];
}

/**
 * Data export job data
 */
export interface DataExportJobData extends BaseJobData {
  userId: string;
  format: 'csv' | 'json' | 'xlsx';
  filters?: Record<string, any>;
  outputPath?: string;
}

/**
 * File processing job data
 */
export interface FileProcessJobData extends BaseJobData {
  fileId: string;
  filePath: string;
  operation: 'compress' | 'resize' | 'convert' | 'analyze';
  options?: Record<string, any>;
}

/**
 * Cache warming job data
 */
export interface CacheWarmJobData extends BaseJobData {
  cacheKey: string;
  dataSource: string;
  ttl?: number;
}

/**
 * Cleanup job data
 */
export interface CleanupJobData extends BaseJobData {
  target: 'temp_files' | 'old_logs' | 'expired_sessions' | 'cache';
  olderThan?: number; // days
  pattern?: string;
}

/**
 * Union type for all job data types
 */
export type JobData =
  | EmailJobData
  | UserNotificationJobData
  | DataExportJobData
  | FileProcessJobData
  | CacheWarmJobData
  | CleanupJobData;

/**
 * Job options for BullMQ
 */
export interface JobOptions {
  priority?: JobPriority;
  delay?: number; // milliseconds
  attempts?: number;
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  removeOnComplete?: number;
  removeOnFail?: number;
  jobId?: string;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  name: string;
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  defaultJobOptions?: JobOptions;
  settings?: {
    stalledInterval?: number;
    maxStalledCount?: number;
  };
}

/**
 * Job statistics
 */
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

/**
 * Job result interface
 */
export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  processedAt: number;
  processingTime: number; // milliseconds
}

/**
 * Worker configuration
 */
export interface WorkerConfig {
  concurrency?: number;
  limiter?: {
    max: number;
    duration: number;
  };
  settings?: {
    stalledInterval?: number;
    retryProcessDelay?: number;
  };
}

/**
 * Job handler function type
 */
export type JobHandler<T extends BaseJobData = BaseJobData> = (
  jobData: T,
  jobId: string
) => Promise<JobResult>;

/**
 * Job handlers map
 */
export type JobHandlers = {
  [K in JobType]: JobHandler<
    Extract<
      JobData,
      { [P in keyof JobData]: JobData[P] extends { type?: K } ? JobData : never }[keyof JobData]
    >
  >;
};
