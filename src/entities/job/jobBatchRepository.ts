/**
 * Job Batch Repository
 *
 * Repository for persistent job batch processing with MongoDB
 * Handles batch loading, processing tracking, and failure management
 */

import { defaultLogger } from '../../lib/logger/index.js';
import { BaseRepository } from '../../infraestructure/mongo/baseRepository.js';
import { JobModel, type IJob } from './index.js';
import {
  DeadLetterQueue,
  type IDeadLetterQueue,
  DLQReason
} from '../deadLetterQueue/deadLetterQueueEntity.js';
import type { ClientSession } from 'mongoose';

export interface JobBatch {
  batchId: string;
  jobs: IJob[];
  createdAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface BatchProcessingResult {
  batchId: string;
  totalJobs: number;
  processedJobs: number;
  failedJobs: number;
  completedJobs: number;
  errors: Array<{
    jobId: string;
    error: string;
    errorStack?: string;
  }>;
}

// Define job statuses locally since they're not exported from jobEntity
const JobStatus = {
  PENDING: 'pending' as const,
  BATCHED: 'batched' as const,
  PROCESSING: 'processing' as const,
  COMPLETED: 'completed' as const,
  FAILED: 'failed' as const,
  CANCELLED: 'cancelled' as const
};

export class JobBatchRepository extends BaseRepository<IJob> {
  private logger = defaultLogger.child({ component: 'JobBatchRepository' });

  constructor() {
    super(JobModel);
  }

  /**
   * Create a persistent job in MongoDB
   */
  async createJob(jobData: {
    jobId: string;
    type: string;
    data: Record<string, any>;
    priority?: number;
    maxAttempts?: number;
    scheduledFor?: Date;
  }): Promise<IJob> {
    try {
      const job = new JobModel({
        ...jobData,
        status: JobStatus.PENDING,
        priority: jobData.priority || 5,
        maxAttempts: jobData.maxAttempts || 3,
        metadata: {
          origin: 'api',
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        }
      });

      const savedJob = await job.save();
      this.logger.info(`Job created in MongoDB: ${savedJob.jobId}`);

      return savedJob;
    } catch (error) {
      this.logger.error(`Failed to create job: ${error}`);
      throw error;
    }
  }

  /**
   * Load next batch of pending jobs (up to 50 jobs)
   */
  async loadNextBatch(batchSize: number = 50): Promise<JobBatch | null> {
    try {
      const now = new Date();

      // Find jobs ready for processing
      const jobs = await JobModel.find({
        status: JobStatus.PENDING,
        $or: [{ scheduledFor: null }, { scheduledFor: { $lte: now } }]
      })
        .sort({ priority: -1, createdAt: 1 }) // Higher priority first, then FIFO
        .limit(batchSize);

      if (jobs.length === 0) {
        return null;
      }

      // Generate batch ID
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Mark jobs as batched
      const session = await JobModel.startSession();

      try {
        await session.withTransaction(async () => {
          const jobIds = jobs.map(job => job._id);

          await JobModel.updateMany(
            { _id: { $in: jobIds }, status: JobStatus.PENDING },
            {
              $set: {
                status: JobStatus.BATCHED,
                batchId: batchId,
                updatedAt: new Date()
              }
            },
            { session }
          );
        });

        // Refresh jobs with updated status
        const batchedJobs = await JobModel.find({ batchId });

        const batch: JobBatch = {
          batchId,
          jobs: batchedJobs,
          createdAt: new Date(),
          status: 'pending'
        };

        this.logger.info(`Loaded job batch: ${batchId} with ${jobs.length} jobs`);

        return batch;
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        await session.endSession();
      }
    } catch (error) {
      this.logger.error(`Failed to load job batch: ${error}`);
      throw error;
    }
  }

  /**
   * Mark job as processing
   */
  async markJobAsProcessing(jobId: string, redisJobId: string): Promise<void> {
    try {
      await JobModel.findOneAndUpdate(
        { jobId, status: JobStatus.BATCHED },
        {
          $set: {
            status: JobStatus.PROCESSING,
            processingStartedAt: new Date(),
            redisJobId,
            updatedAt: new Date()
          }
        }
      );

      this.logger.debug(`Job marked as processing: ${jobId}`);
    } catch (error) {
      this.logger.error(`Failed to mark job as processing: ${jobId} - ${error}`);
      throw error;
    }
  }

  /**
   * Mark job as completed and delete from MongoDB
   */
  async markJobAsCompleted(jobId: string, result?: any): Promise<void> {
    try {
      const job = await JobModel.findOneAndDelete({
        jobId,
        status: { $in: [JobStatus.PROCESSING, JobStatus.BATCHED] }
      });

      if (job) {
        this.logger.info(`Job completed and removed from MongoDB: ${jobId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to mark job as completed: ${jobId} - ${error}`);
      throw error;
    }
  }

  /**
   * Mark job as failed and move to Dead Letter Queue if max attempts reached
   */
  async markJobAsFailed(jobId: string, error: string, errorStack?: string): Promise<void> {
    const session = await JobModel.startSession();

    try {
      await session.withTransaction(async () => {
        const job = await JobModel.findOne({ jobId }).session(session);

        if (!job) {
          throw new Error(`Job not found: ${jobId}`);
        }

        // Increment attempts
        job.attempts += 1;

        // Check if max attempts reached
        if (job.attempts >= job.maxAttempts) {
          // Move to Dead Letter Queue
          await this.moveToDeadLetterQueue(job, error, errorStack, session);

          // Remove from jobs collection
          await JobModel.findByIdAndDelete(job._id).session(session);

          this.logger.warn(`Job moved to DLQ after max attempts: ${jobId}`);
        } else {
          // Update job with failure info and reset to pending for retry
          await JobModel.findByIdAndUpdate(
            job._id,
            {
              $set: {
                status: JobStatus.PENDING,
                attempts: job.attempts,
                updatedAt: new Date(),
                batchId: null,
                redisJobId: null,
                processingStartedAt: null
              }
            },
            { session }
          );

          this.logger.info(
            `Job failed but will retry: ${jobId} (attempt ${job.attempts}/${job.maxAttempts})`
          );
        }
      });
    } catch (error) {
      this.logger.error(`Failed to mark job as failed: ${jobId} - ${error}`);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Move job to Dead Letter Queue
   */
  private async moveToDeadLetterQueue(
    job: IJob,
    error: string,
    errorStack?: string,
    session?: ClientSession
  ): Promise<void> {
    try {
      const dlqEntry = new DeadLetterQueue({
        originalJobId: job.jobId,
        jobId: `dlq_${job.jobId}_${Date.now()}`,
        type: job.type,
        data: job.data,
        priority: job.priority,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        failedAt: new Date(),
        finalError: error,
        finalErrorStack: errorStack,
        originalCreatedAt: job.createdAt,
        reason: DLQReason.MAX_ATTEMPTS_EXCEEDED,
        metadata: {
          batchId: job.batchId,
          redisJobId: job.redisJobId,
          environment: process.env.NODE_ENV || 'development',
          version: '1.0.0'
        },
        reprocessed: false,
        allErrors: [],
        processingHistory: []
      });

      if (session) {
        await dlqEntry.save({ session });
      } else {
        await dlqEntry.save();
      }

      this.logger.info(`Job moved to Dead Letter Queue: ${job.jobId}`);
    } catch (error) {
      this.logger.error(`Failed to move job to DLQ: ${job.jobId} - ${error}`);
      throw error;
    }
  }

  /**
   * Clean up failed batches (reset jobs to pending status)
   */
  async cleanupFailedBatch(batchId: string): Promise<void> {
    try {
      const result = await JobModel.updateMany(
        {
          batchId,
          status: { $in: [JobStatus.BATCHED, JobStatus.PROCESSING] }
        },
        {
          $set: {
            status: JobStatus.PENDING,
            batchId: null,
            redisJobId: null,
            processingStartedAt: null,
            updatedAt: new Date()
          }
        }
      );

      this.logger.info(`Cleaned up failed batch: ${batchId}, reset ${result.modifiedCount} jobs`);
    } catch (error) {
      this.logger.error(`Failed to cleanup failed batch: ${batchId} - ${error}`);
      throw error;
    }
  }

  /**
   * Get batch processing statistics
   */
  async getBatchStats(): Promise<{
    pending: number;
    batched: number;
    processing: number;
    dlq: number;
  }> {
    try {
      const [jobStats, dlqStats] = await Promise.all([
        JobModel.aggregate([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ]),
        DeadLetterQueue.countDocuments({})
      ]);

      const stats = {
        pending: 0,
        batched: 0,
        processing: 0,
        dlq: dlqStats
      };

      jobStats.forEach(stat => {
        if (stat._id === JobStatus.PENDING) stats.pending = stat.count;
        if (stat._id === JobStatus.BATCHED) stats.batched = stat.count;
        if (stat._id === JobStatus.PROCESSING) stats.processing = stat.count;
      });

      return stats;
    } catch (error) {
      this.logger.error(`Failed to get batch stats - ${error}`);
      throw error;
    }
  }

  /**
   * Get jobs ready for processing count
   */
  async getReadyJobsCount(): Promise<number> {
    try {
      const now = new Date();

      return await JobModel.countDocuments({
        status: JobStatus.PENDING,
        $or: [{ scheduledFor: null }, { scheduledFor: { $lte: now } }]
      });
    } catch (error) {
      this.logger.error(`Failed to get ready jobs count - ${error}`);
      return 0;
    }
  }

  /**
   * Get failed jobs that can be retried
   */
  async getRetryableJobs(limit: number = 10): Promise<IJob[]> {
    try {
      return await JobModel.find({
        status: JobStatus.PENDING,
        attempts: { $gt: 0, $lt: { $expr: '$maxAttempts' } }
      })
        .sort({ updatedAt: 1 })
        .limit(limit);
    } catch (error) {
      this.logger.error(`Failed to get retryable jobs - ${error}`);
      return [];
    }
  }
}
