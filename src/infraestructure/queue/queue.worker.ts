/**
 * Queue Worker - Worker with batch processing and concurrency control
 */

import { randomUUID } from 'crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { ClientSession } from 'mongoose';

import type { IJob } from '../../entities/job/index.js';
import type { QueueManager } from './queue.manager.js';
import type { JobResult, JobHandler } from './queue.types.js';
import { EmailService, type EmailConfig } from '../email/index.js';

import { JOB_HANDLERS } from './jobs/index.js';
import { JobType } from './queue.types.js';

/**
 * Queue Worker with features:
 * - Batch processing from database
 * - Concurrency control with Redis locks
 * - Graceful shutdown handling
 * - Performance metrics
 */
export class QueueWorker {
  private isRunning = false;
  private isShuttingDown = false;
  private workerId: string;
  private currentJob: IJob | null = null;
  private processedJobs = 0;
  private failedJobs = 0;
  private startTime: Date;
  private emailService: EmailService | null = null;

  constructor(
    private queueManager: QueueManager,
    private logger: FastifyBaseLogger,
    private concurrency = 1,
    private batchSize = 50,
    private pollInterval = 5000, // 5 seconds
    emailConfig?: EmailConfig
  ) {
    this.workerId = `worker_${randomUUID()}`;
    this.startTime = new Date();

    // Initialize EmailService if config provided
    if (emailConfig && emailConfig.host) {
      try {
        this.emailService = new EmailService(emailConfig, this.logger);
      } catch (error) {
        this.logger.warn({ error }, 'Failed to initialize EmailService, email jobs may fail');
      }
    }
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn({ workerId: this.workerId }, 'Worker is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info(
      {
        workerId: this.workerId,
        concurrency: this.concurrency,
        batchSize: this.batchSize,
        pollInterval: this.pollInterval
      },
      'Starting Queue Worker'
    ); // Setup graceful shutdown handlers
    this.setupGracefulShutdown();

    // Start processing loop
    this.processLoop().catch(error => {
      this.logger.error({ error, workerId: this.workerId }, 'Worker process loop failed');
    });
  }

  /**
   * Stop the worker gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info({ workerId: this.workerId }, 'Stopping Queue Worker...');

    this.isShuttingDown = true;

    // Wait for current job to finish
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max wait

    while (this.currentJob && attempts < maxAttempts) {
      this.logger.info(
        {
          workerId: this.workerId,
          currentJobId: this.currentJob.jobId
        },
        'Waiting for current job to finish...'
      );
      await this.sleep(1000);
      attempts++;
    }

    this.isRunning = false;

    this.logger.info(
      {
        workerId: this.workerId,
        processedJobs: this.processedJobs,
        failedJobs: this.failedJobs,
        uptime: Date.now() - this.startTime.getTime()
      },
      'Queue Worker stopped'
    );
  }

  /**
   * Main processing loop
   */
  private async processLoop(): Promise<void> {
    while (this.isRunning && !this.isShuttingDown) {
      try {
        // Load batch of jobs
        const batch = await this.queueManager.loadNextBatch(
          this.batchSize,
          [20, 15, 10, 5] // CRITICAL → HIGH → NORMAL → LOW
        );

        if (!batch || batch.jobs.length === 0) {
          // No jobs available, wait before next poll
          await this.sleep(this.pollInterval);
          continue;
        }

        this.logger.debug(
          {
            workerId: this.workerId,
            batchId: batch.id,
            jobCount: batch.jobs.length,
            priority: batch.priority
          },
          'Processing job batch'
        );

        // Process jobs with concurrency control
        await this.processBatch(batch.jobs);
      } catch (error) {
        this.logger.error({ error, workerId: this.workerId }, 'Error in worker processing loop');

        // Wait before retrying to avoid tight error loops
        await this.sleep(this.pollInterval);
      }
    }
  }

  /**
   * Process a batch of jobs with concurrency control
   */
  private async processBatch(jobs: IJob[]): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const job of jobs) {
      if (this.isShuttingDown) {
        break;
      }

      // Respect concurrency limit
      if (promises.length >= this.concurrency) {
        await Promise.race(promises);
        // Remove completed promises
        for (let i = promises.length - 1; i >= 0; i--) {
          if (promises[i] && (await this.isPromiseSettled(promises[i]!))) {
            promises.splice(i, 1);
          }
        }
      }

      // Start processing job
      promises.push(this.processJob(job));
    }

    // Wait for all remaining jobs to complete
    await Promise.allSettled(promises);
  }

  /**
   * Process a single job with full lifecycle management
   */
  private async processJob(job: IJob): Promise<void> {
    const startTime = Date.now();
    let lockAcquired = false;

    try {
      // Try to acquire lock for this job
      lockAcquired = await this.queueManager.acquireLock(
        job.jobId,
        this.workerId,
        300 // 5 minutes timeout
      );

      if (!lockAcquired) {
        this.logger.debug(
          { jobId: job.jobId, workerId: this.workerId },
          'Could not acquire lock for job, skipping'
        );
        return;
      }

      // Set current job for graceful shutdown tracking
      this.currentJob = job;

      // Get job handler
      const handler = JOB_HANDLERS[job.type as keyof typeof JOB_HANDLERS];
      if (!handler) {
        throw new Error(`No handler found for job type: ${job.type}`);
      }

      this.logger.info(
        {
          jobId: job.jobId,
          jobType: job.type,
          workerId: this.workerId,
          attempt: job.attempts + 1,
          maxAttempts: job.maxAttempts
        },
        'Processing job'
      );

      // Update job status to processing
      await this.queueManager.jobRepository.updateJobStatus(job.jobId, 'processing', {
        processingBy: this.workerId,
        processingAt: new Date(),
        attempts: job.attempts + 1
      });

      // Prepare metadata for job handler
      const metadata = {
        attempt: job.attempts + 1,
        maxAttempts: job.maxAttempts,
        queuedAt: job.createdAt,
        processingAt: new Date()
      };

      // Prepare services object
      const services = {
        emailService: this.emailService
      };

      // Execute the job handler with enhanced parameters
      const result = await handler(job.data, job.jobId, this.logger, metadata, services);

      const processingTime = Date.now() - startTime;

      if (result.success) {
        // Job completed successfully
        await this.queueManager.jobRepository.updateJobStatus(job.jobId, 'completed', {
          completedAt: new Date(),
          processingTime,
          result: result.data,
          processingBy: null,
          processingAt: null
        });

        this.processedJobs++;

        this.logger.info(
          {
            jobId: job.jobId,
            jobType: job.type,
            workerId: this.workerId,
            processingTime
          },
          'Job completed successfully'
        );
      } else {
        // Job failed
        await this.handleJobFailure(job, result.error || 'Unknown error', processingTime);
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.handleJobFailure(job, errorMessage, processingTime);
    } finally {
      // Always release lock and clear current job
      if (lockAcquired) {
        await this.queueManager.releaseLock(job.jobId, this.workerId);
      }

      if (this.currentJob?.jobId === job.jobId) {
        this.currentJob = null;
      }
    }
  }

  /**
   * Handle job failure with retry logic
   */
  private async handleJobFailure(job: IJob, error: string, processingTime: number): Promise<void> {
    this.failedJobs++;

    const newAttempts = job.attempts + 1;
    const shouldRetry = newAttempts < job.maxAttempts;

    if (shouldRetry) {
      // Retry the job
      await this.queueManager.jobRepository.updateJobStatus(job.jobId, 'pending', {
        attempts: newAttempts,
        lastError: error,
        lastFailedAt: new Date(),
        processingTime,
        processingBy: null,
        processingAt: null,
        // Add exponential backoff delay
        scheduledFor: new Date(Date.now() + Math.pow(2, newAttempts) * 1000)
      });

      this.logger.warn(
        {
          jobId: job.jobId,
          jobType: job.type,
          workerId: this.workerId,
          attempt: newAttempts,
          maxAttempts: job.maxAttempts,
          error,
          nextRetry: new Date(Date.now() + Math.pow(2, newAttempts) * 1000)
        },
        'Job failed, will retry'
      );
    } else {
      // Move to DLQ after exhausting all retries
      await this.queueManager.jobRepository.updateJobStatus(job.jobId, 'failed', {
        attempts: newAttempts,
        lastError: error,
        failedAt: new Date(),
        processingTime,
        processingBy: null,
        processingAt: null
      });

      // Move to DLQ for manual inspection
      await this.queueManager.moveToDLQ(job, `Failed after ${job.maxAttempts} attempts: ${error}`);

      this.logger.error(
        {
          jobId: job.jobId,
          jobType: job.type,
          workerId: this.workerId,
          attempts: newAttempts,
          maxAttempts: job.maxAttempts,
          error
        },
        'Job failed permanently, moved to DLQ'
      );
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    for (const signal of signals) {
      process.on(signal, async () => {
        this.logger.info({ signal, workerId: this.workerId }, 'Received shutdown signal');

        await this.stop();
        process.exit(0);
      });
    }
  }

  /**
   * Get worker statistics
   */
  getStats() {
    return {
      workerId: this.workerId,
      isRunning: this.isRunning,
      isShuttingDown: this.isShuttingDown,
      currentJob: this.currentJob
        ? {
            jobId: this.currentJob.jobId,
            type: this.currentJob.type,
            startedAt: new Date()
          }
        : null,
      processedJobs: this.processedJobs,
      failedJobs: this.failedJobs,
      uptime: Date.now() - this.startTime.getTime(),
      startTime: this.startTime
    };
  }

  // Helper methods

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async isPromiseSettled(promise: Promise<any>): Promise<boolean> {
    try {
      await Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 0))
      ]);
      return true;
    } catch {
      return true; // Consider both resolved and rejected as settled
    }
  }
}
