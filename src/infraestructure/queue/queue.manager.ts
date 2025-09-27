/**
 * Simplified Queue Manager
 * Implements database persistence with QueueCache for batch processing
 */

import type { FastifyBaseLogger } from 'fastify';
import type { ClientSession } from 'mongoose';
import { randomUUID } from 'crypto';

import { JobModel, JobValidations, type IJob } from '../../entities/job/index.js';
import { DLQModel, type IDLQ } from '../../entities/dlq/index.js';
import { getQueueCache } from '../cache/index.js';
import type { QueueCache } from '../cache/cache.js';

import {
  QueueHealth,
  type QueueStats,
  type DLQStats,
  type JobBatch,
  type JobPriority,
  type JobType,
  type JobStatus,
  type JobResult,
  type QueueHealthInfo
} from './queue.types.js';

import type { IJobRepository } from '../../entities/job/index.js';
import type { IDLQRepository } from '../../entities/dlq/index.js';

/**
 * Simplified Queue Manager with MongoDB persistence and QueueCache batch processing
 */
export class QueueManager {
  private queueCache: QueueCache;
  private currentBatch: JobBatch | null = null;
  private batchPrefix: string;

  public jobRepository: IJobRepository;
  public dlqRepository: IDLQRepository;

  constructor(
    jobRepository: IJobRepository,
    dlqRepository: IDLQRepository,
    private logger: FastifyBaseLogger,
    private queueName = 'default'
  ) {
    this.batchPrefix = `batch:${queueName}`;
    this.jobRepository = jobRepository;
    this.dlqRepository = dlqRepository;
    this.queueCache = getQueueCache();
  }

  /**
   * Initialize the queue manager
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Queue Manager...');
      await this.queueCache.connect();
      this.logger.info('Queue Manager initialized successfully');
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize Queue Manager');
      throw error;
    }
  }

  /**
   * Add a job to the database queue
   */
  async addJob<T = any>(
    jobType: JobType,
    jobData: T,
    options: {
      priority?: JobPriority;
      attempts?: number;
      delay?: number;
      session?: ClientSession;
    } = {}
  ): Promise<string> {
    try {
      const job = await this.jobRepository.createJob(
        {
          jobId: this.generateJobId(jobType),
          type: jobType,
          data: jobData,
          priority: options.priority || 10,
          maxAttempts: options.attempts || 3,
          scheduledFor: options.delay ? new Date(Date.now() + options.delay) : new Date()
        },
        options.session
      );

      this.logger.debug({ jobId: job.jobId, type: jobType, priority: job.priority }, 'Job added');

      // Invalidate current batch cache if higher priority job added
      if (this.currentBatch && job.priority > this.currentBatch.priority) {
        await this.invalidateBatchCache();
      }

      return job.jobId;
    } catch (error) {
      this.logger.error({ error, jobType, jobData }, 'Failed to add job');
      throw error;
    }
  }

  /**
   * Load next batch of jobs by priority
   */
  async loadNextBatch(
    batchSize = 50,
    priorities: JobPriority[] = [20, 15, 10, 5]
  ): Promise<JobBatch | null> {
    try {
      // Check if current batch is still valid
      if (this.currentBatch && !this.isBatchExpired(this.currentBatch)) {
        return this.currentBatch;
      }

      // Load from database by priority
      for (const priority of priorities) {
        const jobs = await this.jobRepository.findPendingJobsByPriority(priority, batchSize);

        if (jobs.length > 0) {
          const batch: JobBatch = {
            id: randomUUID(),
            jobs,
            priority,
            loadedAt: new Date(),
            ttl: 1800 // 30 minutes
          };

          // Cache the batch using pushJob method
          await this.queueCache.pushJob(`batch:${batch.id}`, batch, batch.priority);

          this.currentBatch = batch;
          this.logger.debug({ batchId: batch.id, jobCount: jobs.length, priority }, 'Batch loaded');

          return batch;
        }
      }

      this.logger.debug('No pending jobs found');
      return null;
    } catch (error) {
      this.logger.error({ error }, 'Failed to load batch');
      throw error;
    }
  }

  /**
   * Get next job from current batch
   */
  async getNextJob(): Promise<IJob | null> {
    if (!this.currentBatch || this.currentBatch.jobs.length === 0) {
      const batch = await this.loadNextBatch();
      if (!batch) return null;
    }

    return this.currentBatch!.jobs.shift() || null;
  }

  /**
   * Complete a job
   */
  async completeJob(jobId: string, result: any, session?: ClientSession): Promise<void> {
    try {
      await this.jobRepository.updateJobStatus(jobId, 'completed', session);
      this.logger.debug({ jobId }, 'Job completed');
    } catch (error) {
      this.logger.error({ error, jobId }, 'Failed to complete job');
      throw error;
    }
  }

  /**
   * Fail a job and optionally move to DLQ
   */
  async failJob(
    job: IJob,
    error: string,
    moveToDLQ = true,
    session?: ClientSession
  ): Promise<void> {
    try {
      await this.jobRepository.updateJobStatus(job.jobId, 'failed', session);

      if (moveToDLQ) {
        await this.moveToDLQ(job, error, session);
      }

      this.logger.warn({ jobId: job.jobId, error }, 'Job failed');
    } catch (err) {
      this.logger.error({ error: err, jobId: job.jobId }, 'Failed to fail job');
      throw err;
    }
  }

  /**
   * Move job to Dead Letter Queue
   */
  async moveToDLQ(job: IJob, reason: string, session?: ClientSession): Promise<void> {
    await this.dlqRepository.createDLQEntry(
      {
        originalJobId: job.jobId,
        jobType: job.type,
        jobData: job.data,
        failureReason: reason,
        priority: job.priority,
        attempts: job.attempts,
        originalCreatedAt: job.createdAt
      },
      session
    );

    this.logger.warn({ jobId: job.jobId, jobType: job.type, reason }, 'Job moved to DLQ');
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    try {
      const stats = await this.jobRepository.getJobStatsByStatus();

      return {
        pending: stats.pending,
        processing: stats.processing,
        completed: stats.completed,
        failed: stats.failed,
        currentBatch: {
          id: this.currentBatch?.id || null,
          size: this.currentBatch?.jobs.length || 0,
          priority: this.currentBatch?.priority || null,
          loadedAt: this.currentBatch?.loadedAt || null
        }
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get queue stats');
      throw error;
    }
  }

  /**
   * Get DLQ statistics
   */
  async getDLQStats(): Promise<DLQStats> {
    try {
      const dlqEntries = await this.dlqRepository.findRecentDLQEntries(1000);
      const byType: Record<JobType, number> = {} as Record<JobType, number>;

      dlqEntries.forEach((entry: any) => {
        byType[entry.jobType as JobType] = (byType[entry.jobType as JobType] || 0) + 1;
      });

      const oldest =
        dlqEntries.length > 0 && dlqEntries[0]
          ? {
              id: dlqEntries[0].originalJobId,
              failedAt: dlqEntries[0].movedToDLQAt,
              daysSince: Math.floor(
                (Date.now() - dlqEntries[0].movedToDLQAt.getTime()) / (1000 * 60 * 60 * 24)
              )
            }
          : null;

      return {
        total: dlqEntries.length,
        byType,
        oldest
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get DLQ stats');
      throw error;
    }
  }

  /**
   * Get health information
   */
  async getHealthInfo(): Promise<QueueHealthInfo> {
    try {
      const dbStart = Date.now();
      const stats = await this.getStats();
      const dbResponseTime = Date.now() - dbStart;

      const cacheStart = Date.now();
      await this.queueCache.ping();
      const cacheResponseTime = Date.now() - cacheStart;

      const status =
        stats.failed > stats.completed * 0.1 ? QueueHealth.DEGRADED : QueueHealth.HEALTHY;

      return {
        status,
        database: {
          connected: true,
          responseTime: dbResponseTime
        },
        cache: {
          connected: true,
          responseTime: cacheResponseTime
        },
        stats
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get health info');
      return {
        status: QueueHealth.DOWN,
        database: { connected: false, responseTime: -1 },
        cache: { connected: false, responseTime: -1 },
        stats: {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          currentBatch: { id: null, size: 0, priority: null, loadedAt: null }
        }
      };
    }
  }

  /**
   * Acquire lock for job processing
   */
  async acquireLock(jobId: string, workerId: string, timeout = 300): Promise<boolean> {
    try {
      const job = await this.jobRepository.lockJob(jobId, workerId, timeout * 1000);
      return job !== null;
    } catch (error) {
      this.logger.error({ error, jobId, workerId }, 'Failed to acquire lock');
      return false;
    }
  }

  /**
   * Release lock for job processing
   */
  async releaseLock(jobId: string, workerId: string): Promise<boolean> {
    try {
      const job = await this.jobRepository.releaseJobLock(jobId);
      return job !== null;
    } catch (error) {
      this.logger.error({ error, jobId, workerId }, 'Failed to release lock');
      return false;
    }
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(jobType: JobType): string {
    return `${jobType}:${Date.now()}:${randomUUID()}`;
  }

  /**
   * Check if batch is expired
   */
  private isBatchExpired(batch: JobBatch): boolean {
    const now = Date.now();
    const loadedTime = batch.loadedAt.getTime();
    const ttlMs = batch.ttl * 1000;
    return now - loadedTime > ttlMs;
  }

  /**
   * Invalidate current batch cache
   */
  private async invalidateBatchCache(): Promise<void> {
    if (this.currentBatch) {
      await this.queueCache.clearQueue(`${this.batchPrefix}:${this.currentBatch.id}`);
      this.currentBatch = null;
    }
  }
}
