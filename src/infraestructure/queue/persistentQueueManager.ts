/**
 * Persistent Queue Manager
 *
 * Manages job persistence in MongoDB with Redis/BullMQ processing
 * Implements batch processing with failure recovery
 */

import { defaultLogger } from '../../lib/logger/index.js';
import type { Logger } from 'pino';
import { QueueManager } from './queue.js';
import { JobBatchRepository, type JobBatch } from '../../entities/job/jobBatchRepository.js';
import type { IJob } from '../../entities/job/jobEntity.js';
import { generateJobId } from './plugin.js';

export interface PersistentJobOptions {
  priority?: number;
  attempts?: number;
  delay?: number;
  scheduledFor?: Date;
}

export interface ProcessingStats {
  totalBatches: number;
  activeBatches: number;
  totalJobsProcessed: number;
  totalJobsFailed: number;
  batchSize: number;
  lastBatchTime?: Date;
}

export class PersistentQueueManager {
  private queueManager: QueueManager;
  private jobRepository: JobBatchRepository;
  private logger: Logger;
  private batchSize: number;
  private processingInterval: NodeJS.Timeout | null = null;
  private activeBatches: Map<string, JobBatch> = new Map();
  private stats: ProcessingStats = {
    totalBatches: 0,
    activeBatches: 0,
    totalJobsProcessed: 0,
    totalJobsFailed: 0,
    batchSize: 50
  };

  constructor(queueManager: QueueManager, batchSize: number = 50, logger?: Logger) {
    this.queueManager = queueManager;
    this.jobRepository = new JobBatchRepository();
    this.logger = logger || defaultLogger.child({ component: 'PersistentQueueManager' });
    this.batchSize = batchSize;
    this.stats.batchSize = batchSize;
  }

  /**
   * Add a persistent job
   */
  async addJob(type: string, data: any, options?: PersistentJobOptions): Promise<string> {
    try {
      const jobId = generateJobId(type);

      // First, persist job in MongoDB
      const createJobData: any = {
        jobId,
        type,
        data
      };

      if (options?.priority !== undefined) {
        createJobData.priority = options.priority;
      }
      if (options?.attempts !== undefined) {
        createJobData.maxAttempts = options.attempts;
      }
      if (options?.scheduledFor !== undefined) {
        createJobData.scheduledFor = options.scheduledFor;
      }

      await this.jobRepository.createJob(createJobData);

      this.logger.info(`Persistent job created: ${jobId} (type: ${type})`);

      return jobId;
    } catch (error) {
      this.logger.error(`Failed to add persistent job: ${error}`);
      throw error;
    }
  }

  /**
   * Start batch processing
   */
  async startBatchProcessing(intervalMs: number = 5000): Promise<void> {
    if (this.processingInterval) {
      this.logger.warn('Batch processing already started');
      return;
    }

    this.logger.info(`Starting batch processing with ${this.batchSize} jobs per batch`);

    this.processingInterval = setInterval(async () => {
      try {
        await this.processBatch();
      } catch (error) {
        this.logger.error(`Batch processing error: ${error}`);
      }
    }, intervalMs);
  }

  /**
   * Stop batch processing
   */
  async stopBatchProcessing(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;

      // Wait for active batches to complete
      await this.waitForActiveBatches();

      this.logger.info('Batch processing stopped');
    }
  }

  /**
   * Process next batch of jobs
   */
  private async processBatch(): Promise<void> {
    try {
      // Check if we have capacity for more batches
      if (this.activeBatches.size >= 5) {
        this.logger.debug('Maximum concurrent batches reached, skipping');
        return;
      }

      // Load next batch from MongoDB
      const batch = await this.jobRepository.loadNextBatch(this.batchSize);
      if (!batch || batch.jobs.length === 0) {
        return; // No jobs ready for processing
      }

      this.activeBatches.set(batch.batchId, batch);
      this.stats.totalBatches++;
      this.stats.activeBatches = this.activeBatches.size;
      this.stats.lastBatchTime = new Date();

      this.logger.info(`Processing batch: ${batch.batchId} with ${batch.jobs.length} jobs`);

      // Process each job in the batch
      const processingPromises = batch.jobs.map(job => this.processJob(batch.batchId, job));

      // Wait for all jobs in batch to complete
      await Promise.allSettled(processingPromises);

      // Clean up batch
      this.activeBatches.delete(batch.batchId);
      this.stats.activeBatches = this.activeBatches.size;

      this.logger.info(`Completed batch: ${batch.batchId}`);
    } catch (error) {
      this.logger.error(`Failed to process batch: ${error}`);
    }
  }

  /**
   * Process individual job
   */
  private async processJob(batchId: string, job: IJob): Promise<void> {
    try {
      // Add job to Redis/BullMQ for processing
      const redisJobId = await this.queueManager.addJob(job.jobId, job.type, job.data, {
        priority: job.priority,
        attempts: job.maxAttempts || 3,
        delay: job.delay || 0
      });

      // Mark job as processing in MongoDB
      await this.jobRepository.markJobAsProcessing(job.jobId, redisJobId);

      // Monitor job completion (this would be handled by BullMQ events)
      this.setupJobMonitoring(job.jobId, redisJobId);
    } catch (error) {
      this.logger.error(`Failed to process job ${job.jobId}: ${error}`);

      // Mark job as failed in MongoDB
      await this.jobRepository.markJobAsFailed(
        job.jobId,
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error.stack : undefined
      );

      this.stats.totalJobsFailed++;
    }
  }

  /**
   * Setup monitoring for job completion (would integrate with BullMQ events)
   */
  private setupJobMonitoring(jobId: string, redisJobId: string): void {
    // This would be replaced with actual BullMQ event listeners
    // For now, we'll simulate with a timeout

    // Simulated job completion after random delay
    const completionDelay = Math.random() * 10000 + 1000; // 1-11 seconds

    setTimeout(async () => {
      try {
        if (Math.random() > 0.1) {
          // 90% success rate
          await this.handleJobSuccess(jobId);
        } else {
          await this.handleJobFailure(jobId, 'Simulated job failure');
        }
      } catch (error) {
        this.logger.error(`Job monitoring error for ${jobId}: ${error}`);
      }
    }, completionDelay);
  }

  /**
   * Handle successful job completion
   */
  async handleJobSuccess(jobId: string, result?: any): Promise<void> {
    try {
      await this.jobRepository.markJobAsCompleted(jobId, result);
      this.stats.totalJobsProcessed++;

      this.logger.debug(`Job completed: ${jobId}`);
    } catch (error) {
      this.logger.error(`Failed to handle job success ${jobId}: ${error}`);
    }
  }

  /**
   * Handle job failure
   */
  async handleJobFailure(jobId: string, error: string, errorStack?: string): Promise<void> {
    try {
      await this.jobRepository.markJobAsFailed(jobId, error, errorStack);
      this.stats.totalJobsFailed++;

      this.logger.warn(`Job failed: ${jobId} - ${error}`);
    } catch (err) {
      this.logger.error(`Failed to handle job failure ${jobId}: ${err}`);
    }
  }

  /**
   * Handle Redis connection failure
   */
  async handleRedisFailure(): Promise<void> {
    try {
      this.logger.warn('Redis failure detected, cleaning up batches');

      // Clean up all active batches - reset jobs to pending
      for (const [batchId] of this.activeBatches) {
        await this.jobRepository.cleanupFailedBatch(batchId);
      }

      this.activeBatches.clear();
      this.stats.activeBatches = 0;

      this.logger.info('Redis failure cleanup completed');
    } catch (error) {
      this.logger.error(`Failed to handle Redis failure: ${error}`);
    }
  }

  /**
   * Wait for all active batches to complete
   */
  private async waitForActiveBatches(timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (this.activeBatches.size > 0 && Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeBatches.size > 0) {
      this.logger.warn(`Timeout waiting for ${this.activeBatches.size} active batches to complete`);
    }
  }

  /**
   * Get processing statistics
   */
  getStats(): ProcessingStats {
    return { ...this.stats };
  }

  /**
   * Get job statistics from repository
   */
  async getJobStats(): Promise<{
    pending: number;
    batched: number;
    processing: number;
    dlq: number;
  }> {
    return await this.jobRepository.getBatchStats();
  }

  /**
   * Get ready jobs count
   */
  async getReadyJobsCount(): Promise<number> {
    return await this.jobRepository.getReadyJobsCount();
  }
}
