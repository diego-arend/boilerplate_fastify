import type { FilterQuery, ClientSession } from 'mongoose';
import type { IJob } from './jobEntity.js';
import type {
  PaginationOptions,
  PaginationResult,
  RepositoryOptions
} from '../../infraestructure/mongo/index.js';
import type { IBaseRepository } from '../../infraestructure/mongo/interfaces.js';
import { JobValidations } from './jobEntity.js';

/**
 * Job Repository Interface - Pure domain contract
 * Defines all operations for Job entity data access
 */
export interface IJobRepository extends IBaseRepository<IJob> {
  // Job-specific CRUD operations
  createJob(
    jobData: Parameters<typeof JobValidations.validateCreateJob>[0],
    session?: ClientSession
  ): Promise<IJob>;

  findJobById(jobId: string, session?: ClientSession): Promise<IJob | null>;
  findJobByRedisId(redisJobId: string, session?: ClientSession): Promise<IJob | null>;

  updateJob(
    id: string,
    updateData: Parameters<typeof JobValidations.validateUpdateJob>[0],
    session?: ClientSession
  ): Promise<IJob | null>;

  // Queue operations
  findReadyJobs(limit?: number, session?: ClientSession): Promise<IJob[]>;
  findJobsByStatus(
    status: IJob['status'],
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IJob>>;

  findJobsByType(
    type: string,
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IJob>>;

  // Worker operations
  lockJobForProcessing(
    jobId: string,
    workerId: string,
    lockTimeout?: number,
    session?: ClientSession
  ): Promise<IJob | null>;

  findJobsByWorker(workerId: string, session?: ClientSession): Promise<IJob[]>;
  findExpiredJobs(session?: ClientSession): Promise<IJob[]>;
  releaseExpiredLocks(session?: ClientSession): Promise<number>;

  // Job lifecycle operations
  markJobAsProcessing(
    jobId: string,
    workerId: string,
    session?: ClientSession
  ): Promise<IJob | null>;

  markJobAsCompleted(
    jobId: string,
    result?: Record<string, any>,
    processingTime?: number,
    session?: ClientSession
  ): Promise<IJob | null>;

  markJobAsFailed(
    jobId: string,
    error: string,
    errorStack?: string,
    session?: ClientSession
  ): Promise<IJob | null>;

  retryJob(jobId: string, session?: ClientSession): Promise<IJob | null>;
  cancelJob(jobId: string, session?: ClientSession): Promise<IJob | null>;

  // Batch operations
  createJobBatch(
    jobs: Parameters<typeof JobValidations.validateCreateJob>[0][],
    batchId?: string,
    session?: ClientSession
  ): Promise<IJob[]>;

  findJobsByBatch(
    batchId: string,
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IJob>>;

  cancelBatch(batchId: string, session?: ClientSession): Promise<number>;

  // Scheduling operations
  findScheduledJobs(
    beforeDate: Date,
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IJob>>;

  findDelayedJobs(
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IJob>>;

  // Statistics operations
  getJobStats(session?: ClientSession): Promise<Array<{ status: string; count: number }>>;

  getJobStatsByType(session?: ClientSession): Promise<Array<{ type: string; count: number }>>;

  getProcessingTimeStats(
    startDate: Date,
    endDate: Date,
    session?: ClientSession
  ): Promise<{
    averageTime: number;
    minTime: number;
    maxTime: number;
    totalJobs: number;
  }>;

  // Cleanup operations
  cleanupCompletedJobs(olderThanDays: number, session?: ClientSession): Promise<number>;
  cleanupFailedJobs(olderThanDays: number, session?: ClientSession): Promise<number>;
  cleanupCancelledJobs(olderThanDays: number, session?: ClientSession): Promise<number>;

  // Monitoring operations
  findStuckJobs(olderThanMinutes: number, session?: ClientSession): Promise<IJob[]>;
  findRecentErrors(
    limit: number,
    session?: ClientSession
  ): Promise<Array<{ error: string; count: number; lastOccurrence: Date }>>;

  findJobsWithHighRetries(
    minAttempts: number,
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IJob>>;

  // Priority operations
  updateJobPriority(jobId: string, priority: number, session?: ClientSession): Promise<IJob | null>;
  findHighPriorityJobs(
    minPriority: number,
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IJob>>;
}
