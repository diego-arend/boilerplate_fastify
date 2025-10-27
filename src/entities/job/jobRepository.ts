import type { FilterQuery, ClientSession } from 'mongoose';
import type { IJob } from './index.js';
import { JobModel, JobValidations } from './index.js';
import type {
  IBaseRepository,
  RepositoryOptions,
  PaginationOptions,
  PaginationResult
} from '../../infraestructure/mongo/index.js';

/**
 * Interface for Job Repository operations
 */
export interface IJobRepository {
  // Core CRUD operations
  createJob(jobData: any, session?: ClientSession): Promise<IJob>;
  updateJob(id: string, updateData: any, session?: ClientSession): Promise<IJob | null>;
  findJobById(id: string, session?: ClientSession): Promise<IJob | null>;
  findJobByJobId(jobId: string, session?: ClientSession): Promise<IJob | null>;
  deleteJob(id: string, session?: ClientSession): Promise<boolean>;

  // Batch operations for queue processing
  findReadyJobsBatch(limit: number, session?: ClientSession): Promise<IJob[]>;
  findJobsByPriority(priority: number, limit: number, session?: ClientSession): Promise<IJob[]>;
  findPendingJobsByPriority(
    priority: number,
    limit: number,
    session?: ClientSession
  ): Promise<IJob[]>;
  findJobsByStatus(status: string, limit?: number, session?: ClientSession): Promise<IJob[]>;
  findJobsByType(type: string, limit?: number, session?: ClientSession): Promise<IJob[]>;

  // Statistics and monitoring
  getJobStatsByStatus(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
  }>;

  // Job status management
  updateJobStatus(
    jobId: string,
    status: string,
    updateData?: any,
    session?: ClientSession
  ): Promise<IJob | null>;

  // Worker lock management
  lockJob(
    jobId: string,
    workerId: string,
    lockTimeout?: number,
    session?: ClientSession
  ): Promise<IJob | null>;
  releaseJobLock(jobId: string, session?: ClientSession): Promise<IJob | null>;
  findExpiredJobs(session?: ClientSession): Promise<IJob[]>;
  findJobsByWorker(workerId: string, session?: ClientSession): Promise<IJob[]>;

  // Job processing operations
  markJobAsProcessing(
    jobId: string,
    workerId: string,
    session?: ClientSession
  ): Promise<IJob | null>;
  markJobAsCompleted(
    jobId: string,
    result?: any,
    processingTime?: number,
    session?: ClientSession
  ): Promise<IJob | null>;
  markJobAsFailed(
    jobId: string,
    error: string,
    stack?: string,
    session?: ClientSession
  ): Promise<IJob | null>;
  incrementJobAttempts(jobId: string, session?: ClientSession): Promise<IJob | null>;

  // Retry and recovery operations
  retryFailedJob(
    jobId: string,
    resetAttempts?: boolean,
    session?: ClientSession
  ): Promise<IJob | null>;
  retryJobsByType(
    type: string,
    maxJobs?: number,
    session?: ClientSession
  ): Promise<{ retried: number; errors: string[] }>;

  // Cleanup operations
  cleanupOldJobs(
    olderThanDays: number,
    statuses?: string[],
    session?: ClientSession
  ): Promise<number>;
  cleanupCompletedJobs(olderThanHours: number, session?: ClientSession): Promise<number>;

  // Statistics and monitoring
  getJobStats(session?: ClientSession): Promise<Record<string, number>>;
  getJobsByTypeStats(
    session?: ClientSession
  ): Promise<Array<{ type: string; count: number; avgProcessingTime?: number }>>;
  findRecentJobs(limit?: number, session?: ClientSession): Promise<IJob[]>;

  // Scheduled jobs
  findScheduledJobs(beforeDate?: Date, session?: ClientSession): Promise<IJob[]>;
  scheduleJob(jobId: string, scheduledFor: Date, session?: ClientSession): Promise<IJob | null>;

  // Pagination support
  findJobsPaginated(
    filter: FilterQuery<IJob>,
    options?: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IJob>>;
}

/**
 * Job Repository - Handles all database operations for Job entity
 * Uses composition with BaseRepository instead of inheritance
 */
export class JobRepository implements IJobRepository {
  constructor(private baseRepository: IBaseRepository<IJob>) {}

  /**
   * Helper to create repository options with session support
   */
  private createOptions(session?: ClientSession): RepositoryOptions {
    return session ? { session } : {};
  }

  /**
   * Create a new job
   */
  async createJob(jobData: any, session?: ClientSession): Promise<IJob> {
    // Validate job data
    const validatedData = JobValidations.validateCreateJob(jobData);

    // Generate unique job ID if not provided
    if (!validatedData.jobId) {
      validatedData.jobId = JobValidations.generateJobId(validatedData.type);
    }

    const options = this.createOptions(session);

    // Remove undefined properties to comply with exactOptionalPropertyTypes
    const cleanedData = Object.fromEntries(
      Object.entries(validatedData).filter(([_, value]) => value !== undefined)
    ) as Partial<IJob>;

    try {
      return await this.baseRepository.create(cleanedData, options);
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate key')) {
        throw new Error(`Job with ID '${validatedData.jobId}' already exists`);
      }
      throw error;
    }
  }

  /**
   * Update job by database ID
   */
  async updateJob(id: string, updateData: any, session?: ClientSession): Promise<IJob | null> {
    const validatedData = JobValidations.validateUpdateJob(updateData);
    const options = this.createOptions(session);

    return await this.baseRepository.updateById(id, validatedData, options);
  }

  /**
   * Find job by database ID
   */
  async findJobById(id: string, session?: ClientSession): Promise<IJob | null> {
    const options = this.createOptions(session);
    return await this.baseRepository.findById(id, options);
  }

  /**
   * Find job by unique job ID
   */
  async findJobByJobId(jobId: string, session?: ClientSession): Promise<IJob | null> {
    const options = this.createOptions(session);
    return await this.baseRepository.findOne({ jobId }, options);
  }

  /**
   * Delete job by ID
   */
  async deleteJob(id: string, session?: ClientSession): Promise<boolean> {
    const options = this.createOptions(session);
    return await this.baseRepository.deleteById(id, options);
  }

  /**
   * Find batch of jobs ready for processing (ordered by priority)
   */
  async findReadyJobsBatch(limit: number = 50, session?: ClientSession): Promise<IJob[]> {
    const options = this.createOptions(session);
    const now = new Date();

    return await this.baseRepository.find(
      {
        status: 'pending',
        $or: [{ scheduledFor: null }, { scheduledFor: { $lte: now } }]
      },
      {
        ...options,
        sort: { priority: -1, createdAt: 1 }, // Higher priority first, then FIFO
        limit
      }
    );
  }

  /**
   * Find jobs by priority level
   */
  async findJobsByPriority(
    priority: number,
    limit: number = 50,
    session?: ClientSession
  ): Promise<IJob[]> {
    const options = this.createOptions(session);

    return await this.baseRepository.find(
      {
        status: 'pending',
        priority: { $gte: priority }
      },
      {
        ...options,
        sort: { priority: -1, createdAt: 1 },
        limit
      }
    );
  }

  /**
   * Find jobs by status
   */
  async findJobsByStatus(status: string, limit?: number, session?: ClientSession): Promise<IJob[]> {
    const options = this.createOptions(session);

    return await this.baseRepository.find(
      { status },
      {
        ...options,
        sort: { createdAt: -1 },
        ...(limit && { limit })
      }
    );
  }

  /**
   * Find jobs by type
   */
  async findJobsByType(type: string, limit?: number, session?: ClientSession): Promise<IJob[]> {
    const options = this.createOptions(session);

    return await this.baseRepository.find(
      { type },
      {
        ...options,
        sort: { createdAt: -1 },
        ...(limit && { limit })
      }
    );
  }

  /**
   * Lock a job for processing by a specific worker
   */
  async lockJob(
    jobId: string,
    workerId: string,
    lockTimeout: number = JobValidations.DEFAULT_LOCK_TIMEOUT,
    session?: ClientSession
  ): Promise<IJob | null> {
    const options = this.createOptions(session);
    const now = new Date();
    const timeout = new Date(now.getTime() + lockTimeout);

    // Atomic update to lock the job only if it's available
    return await this.baseRepository.findOneAndUpdate(
      {
        jobId,
        status: 'pending',
        $or: [
          { workerId: null },
          { lockTimeout: { $lt: now } } // Or if previous lock expired
        ]
      },
      {
        $set: {
          status: 'processing',
          workerId,
          lockedAt: now,
          lockTimeout: timeout
        }
      },
      { ...options, returnDocument: 'after' }
    );
  }

  /**
   * Release job lock
   */
  async releaseJobLock(jobId: string, session?: ClientSession): Promise<IJob | null> {
    const options = this.createOptions(session);

    return await this.baseRepository.findOneAndUpdate(
      { jobId },
      {
        $set: {
          status: 'pending',
          workerId: null,
          lockedAt: null,
          lockTimeout: null
        }
      },
      { ...options, returnDocument: 'after' }
    );
  }

  /**
   * Find jobs with expired locks
   */
  async findExpiredJobs(session?: ClientSession): Promise<IJob[]> {
    const options = this.createOptions(session);
    const now = new Date();

    return await this.baseRepository.find(
      {
        status: 'processing',
        lockTimeout: { $lt: now }
      },
      options
    );
  }

  /**
   * Find jobs being processed by a specific worker
   */
  async findJobsByWorker(workerId: string, session?: ClientSession): Promise<IJob[]> {
    const options = this.createOptions(session);

    return await this.baseRepository.find(
      { workerId, status: 'processing' },
      { ...options, sort: { lockedAt: -1 } }
    );
  }

  /**
   * Mark job as processing
   */
  async markJobAsProcessing(
    jobId: string,
    workerId: string,
    session?: ClientSession
  ): Promise<IJob | null> {
    return await this.lockJob(jobId, workerId, JobValidations.DEFAULT_LOCK_TIMEOUT, session);
  }

  /**
   * Mark job as completed
   */
  async markJobAsCompleted(
    jobId: string,
    result?: any,
    processingTime?: number,
    session?: ClientSession
  ): Promise<IJob | null> {
    const options = this.createOptions(session);
    const now = new Date();

    const updateData: any = {
      status: 'completed',
      processedAt: now,
      workerId: null,
      lockedAt: null,
      lockTimeout: null
    };

    if (result !== undefined) {
      updateData.result = result;
    }

    if (processingTime !== undefined) {
      updateData.processingTime = processingTime;
    }

    return await this.baseRepository.findOneAndUpdate(
      { jobId },
      { $set: updateData },
      { ...options, returnDocument: 'after' }
    );
  }

  /**
   * Mark job as failed
   */
  async markJobAsFailed(
    jobId: string,
    error: string,
    stack?: string,
    session?: ClientSession
  ): Promise<IJob | null> {
    const options = this.createOptions(session);
    const now = new Date();

    const updateData: any = {
      status: 'failed',
      processedAt: now,
      error: error.substring(0, 1000), // Truncate to max length
      workerId: null,
      lockedAt: null,
      lockTimeout: null
    };

    if (stack) {
      updateData.errorStack = stack.substring(0, 5000); // Truncate to max length
    }

    return await this.baseRepository.findOneAndUpdate(
      { jobId },
      { $set: updateData },
      { ...options, returnDocument: 'after' }
    );
  }

  /**
   * Increment job attempts counter
   */
  async incrementJobAttempts(jobId: string, session?: ClientSession): Promise<IJob | null> {
    const options = this.createOptions(session);

    return await this.baseRepository.findOneAndUpdate(
      { jobId },
      { $inc: { attempts: 1 } },
      { ...options, returnDocument: 'after' }
    );
  }

  /**
   * Retry a failed job
   */
  async retryFailedJob(
    jobId: string,
    resetAttempts: boolean = false,
    session?: ClientSession
  ): Promise<IJob | null> {
    const options = this.createOptions(session);

    // Find the job first to check if it can be retried
    const job = await this.findJobByJobId(jobId, session);
    if (!job) {
      throw new Error(`Job with ID '${jobId}' not found`);
    }

    if (job.status !== 'failed') {
      throw new Error(`Job '${jobId}' is not in failed status (current: ${job.status})`);
    }

    if (!resetAttempts && job.attempts >= job.maxAttempts) {
      throw new Error(`Job '${jobId}' has exceeded maximum attempts (${job.maxAttempts})`);
    }

    const updateData: any = {
      status: 'pending',
      error: null,
      errorStack: null,
      workerId: null,
      lockedAt: null,
      lockTimeout: null,
      processedAt: null
    };

    if (resetAttempts) {
      updateData.attempts = 0;
    }

    return await this.baseRepository.findOneAndUpdate(
      { jobId },
      { $set: updateData },
      { ...options, returnDocument: 'after' }
    );
  }

  /**
   * Retry all failed jobs of a specific type
   */
  async retryJobsByType(
    type: string,
    maxJobs: number = 100,
    session?: ClientSession
  ): Promise<{ retried: number; errors: string[] }> {
    const options = this.createOptions(session);
    const errors: string[] = [];
    let retried = 0;

    // Find failed jobs of this type that can be retried
    const failedJobs = await this.baseRepository.find(
      {
        type,
        status: 'failed',
        $expr: { $lt: ['$attempts', '$maxAttempts'] }
      },
      { ...options, limit: maxJobs }
    );

    for (const job of failedJobs) {
      try {
        await this.retryFailedJob(job.jobId, false, session);
        retried++;
      } catch (error) {
        errors.push(
          `Failed to retry job ${job.jobId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return { retried, errors };
  }

  /**
   * Cleanup old jobs based on age and status
   */
  async cleanupOldJobs(
    olderThanDays: number,
    statuses: string[] = ['completed', 'failed'],
    session?: ClientSession
  ): Promise<number> {
    const options = this.createOptions(session);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.baseRepository.deleteMany(
      {
        status: { $in: statuses },
        createdAt: { $lt: cutoffDate }
      },
      options
    );

    return result.deletedCount || 0;
  }

  /**
   * Cleanup completed jobs older than specified hours
   */
  async cleanupCompletedJobs(olderThanHours: number, session?: ClientSession): Promise<number> {
    const options = this.createOptions(session);
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);

    const result = await this.baseRepository.deleteMany(
      {
        status: 'completed',
        processedAt: { $lt: cutoffDate }
      },
      options
    );

    return result.deletedCount || 0;
  }

  /**
   * Get job statistics by status
   */
  async getJobStats(session?: ClientSession): Promise<Record<string, number>> {
    const pipeline = [
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ] as any[];

    if (session) {
      pipeline.unshift({ $match: {} }); // Add session context
    }

    const results = await JobModel.aggregate(pipeline).session(session || null);

    // Convert to object with default values
    const stats: Record<string, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    results.forEach(result => {
      stats[result._id] = result.count;
    });

    return stats;
  }

  /**
   * Get statistics by job type
   */
  async getJobsByTypeStats(
    session?: ClientSession
  ): Promise<Array<{ type: string; count: number; avgProcessingTime?: number }>> {
    const pipeline = [
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avgProcessingTime: {
            $avg: {
              $cond: [{ $ne: ['$processingTime', null] }, '$processingTime', null]
            }
          }
        }
      },
      {
        $sort: { count: -1 }
      }
    ] as any[];

    if (session) {
      pipeline.unshift({ $match: {} }); // Add session context
    }

    const results = await JobModel.aggregate(pipeline).session(session || null);

    return results.map(result => ({
      type: result._id,
      count: result.count,
      ...(result.avgProcessingTime && { avgProcessingTime: Math.round(result.avgProcessingTime) })
    }));
  }

  /**
   * Find recent jobs
   */
  async findRecentJobs(limit: number = 50, session?: ClientSession): Promise<IJob[]> {
    const options = this.createOptions(session);

    return await this.baseRepository.find(
      {},
      {
        ...options,
        sort: { createdAt: -1 },
        limit
      }
    );
  }

  /**
   * Find scheduled jobs ready to be processed
   */
  async findScheduledJobs(beforeDate?: Date, session?: ClientSession): Promise<IJob[]> {
    const options = this.createOptions(session);
    const date = beforeDate || new Date();

    return await this.baseRepository.find(
      {
        status: 'pending',
        scheduledFor: { $lte: date }
      },
      {
        ...options,
        sort: { scheduledFor: 1 }
      }
    );
  }

  /**
   * Schedule a job for later processing
   */
  async scheduleJob(
    jobId: string,
    scheduledFor: Date,
    session?: ClientSession
  ): Promise<IJob | null> {
    const options = this.createOptions(session);

    return await this.baseRepository.findOneAndUpdate(
      { jobId, status: 'pending' },
      { $set: { scheduledFor } },
      { ...options, returnDocument: 'after' }
    );
  }

  /**
   * Find jobs with pagination support
   */
  async findJobsPaginated(
    filter: FilterQuery<IJob>,
    paginationOptions: PaginationOptions = { page: 1, limit: 10 },
    session?: ClientSession
  ): Promise<PaginationResult<IJob>> {
    const options = this.createOptions(session);

    return await this.baseRepository.findPaginated(
      filter,
      paginationOptions.page || 1,
      paginationOptions.limit || 10,
      paginationOptions.sort || { createdAt: -1 },
      options
    );
  }

  /**
   * Find pending jobs by priority with limit
   */
  async findPendingJobsByPriority(
    priority: number,
    limit: number,
    session?: ClientSession
  ): Promise<IJob[]> {
    const options = this.createOptions(session);

    return await this.baseRepository.find(
      {
        status: 'pending',
        priority: priority,
        $or: [{ scheduledFor: { $lte: new Date() } }, { scheduledFor: { $exists: false } }]
      },
      { ...options, limit }
    );
  }

  /**
   * Get job statistics by status
   */
  async getJobStatsByStatus(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
  }> {
    const stats = await JobModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    for (const stat of stats) {
      if (stat._id in result) {
        result[stat._id as keyof typeof result] = stat.count;
      }
    }

    return result;
  }

  /**
   * Update job status with additional data
   */
  async updateJobStatus(
    jobId: string,
    status: string,
    updateData: any = {},
    session?: ClientSession
  ): Promise<IJob | null> {
    const options = this.createOptions(session);

    const updateFields = {
      status,
      ...updateData,
      updatedAt: new Date()
    };

    return await this.baseRepository.updateOne({ jobId }, { $set: updateFields }, options);
  }
}
