#!/usr/bin/env node
import dotenv from 'dotenv';
import { Worker, Job } from 'bullmq';
import { config } from '../../lib/validators/validateEnv.js';
import { defaultLogger } from '../../lib/logger/index.js';
import {
  JobType,
  type JobData,
  type JobResult,
  type WorkerConfig
} from './queue.types.js';

// Import job handlers
import { JOB_HANDLERS, getJobHandler } from './jobs/index.js';

// Load environment variables
dotenv.config();

/**
 * Queue Worker class for processing jobs
 * Runs as an independent process separate from the main application
 */
class QueueWorker {
  private worker: Worker;
  private config: WorkerConfig;
  private handlers: Map<string, Function>;
  private logger: ReturnType<typeof defaultLogger.child>;

  constructor(queueName: string = 'main') {
    // Initialize logger with worker context
    this.logger = defaultLogger.child({ 
      module: 'queue-worker',
      queueName 
    });

    // Load and validate environment
    const appConfig = config;
    
    // Worker configuration
    this.config = {
      concurrency: 5, // Process up to 5 jobs concurrently
      limiter: {
        max: 100, // Max 100 jobs
        duration: 60000 // per 60 seconds
      }
    };

    this.logger.info({
      queueName,
      concurrency: this.config.concurrency,
      environment: process.env.NODE_ENV || 'development'
    }, 'Initializing Queue Worker');

    // Initialize job handlers
    this.handlers = new Map();
    this.setupHandlers();

    // Log Redis connection info
    const redisInfo = {
      host: appConfig.REDIS_HOST,
      port: appConfig.REDIS_PORT,
      db: appConfig.REDIS_DB,
      hasPassword: !!appConfig.REDIS_PASSWORD
    };

    this.logger.info(redisInfo, 'Connecting to Redis for queue processing');

    // Create BullMQ worker
    this.worker = new Worker(
      queueName,
      async (job: Job) => this.processJob(job),
      {
        connection: {
          host: appConfig.REDIS_HOST,
          port: appConfig.REDIS_PORT,
          ...(appConfig.REDIS_PASSWORD && { password: appConfig.REDIS_PASSWORD }),
          ...(appConfig.REDIS_DB !== undefined && { db: appConfig.REDIS_DB })
        },
        concurrency: 5,
        limiter: {
          max: 100,
          duration: 60000
        }
      }
    );

    this.setupEventListeners();
    
    this.logger.info({
      ...redisInfo,
      concurrency: this.config.concurrency,
      limiter: this.config.limiter,
      handlersCount: this.handlers.size
    }, 'Queue Worker started successfully');
  }

  /**
   * Process a job from the queue
   */
  private async processJob(job: Job): Promise<JobResult> {
    const startTime = Date.now();
    const jobType = job.name;
    const jobLogger = this.logger.child({ 
      jobId: job.id, 
      jobType,
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts || 1
    });
    
    jobLogger.info('Starting job processing');
    
    try {
      // Get handler for job type
      const handler = this.handlers.get(jobType);
      if (!handler) {
        throw new Error(`No handler found for job type: ${jobType}`);
      }

      // Validate job data
      this.validateJobData(job.data);

      jobLogger.debug({ jobData: job.data }, 'Job data validated, executing handler');

      // Process job with handler
      const result = await handler(job.data, job.id || 'unknown', jobLogger);
      
      const processingTime = Date.now() - startTime;
      
      jobLogger.info({
        processingTime,
        result: result.success
      }, 'Job completed successfully');
      
      return {
        ...result,
        processedAt: Date.now(),
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      jobLogger.error({
        error: error instanceof Error ? error : new Error(String(error)),
        processingTime,
        attemptsMade: job.attemptsMade,
        willRetry: job.attemptsMade < (job.opts.attempts || 1)
      }, 'Job processing failed');
      
      return {
        success: false,
        error: errorMessage,
        processedAt: Date.now(),
        processingTime
      };
    }
  }

  /**
   * Setup job handlers for different job types
   * Uses modular handlers from the jobs directory
   */
  private setupHandlers(): void {
    // Register all job handlers from the registry
    for (const [jobType, handler] of Object.entries(JOB_HANDLERS)) {
      this.handlers.set(jobType, handler);
    }

    this.logger.info({
      handlersCount: this.handlers.size,
      jobTypes: Array.from(this.handlers.keys())
    }, 'Job handlers registered successfully from modular handlers');
  }

  /**
   * Setup event listeners for the worker
   */
  private setupEventListeners(): void {
    // Worker events
    this.worker.on('ready', () => {
      this.logger.info('Worker is ready to process jobs');
    });

    this.worker.on('error', (error) => {
      this.logger.error({ error }, 'Worker error occurred');
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error({
        jobId: job?.id,
        jobType: job?.name,
        error: err,
        attemptsMade: job?.attemptsMade,
        maxAttempts: job?.opts?.attempts
      }, 'Job failed');
    });

    this.worker.on('completed', (job) => {
      this.logger.info({
        jobId: job.id,
        jobType: job.name,
        processingTime: job.finishedOn ? job.finishedOn - job.processedOn! : 0
      }, 'Job completed successfully');
    });

    this.worker.on('stalled', (jobId) => {
      this.logger.warn({ jobId }, 'Job stalled');
    });

    this.worker.on('progress', (job, progress) => {
      this.logger.debug({
        jobId: job.id,
        jobType: job.name,
        progress
      }, 'Job progress update');
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => this.gracefulShutdown('SIGUSR2'));
  }

  /**
   * Validate job data before processing
   */
  private validateJobData(data: JobData): void {
    if (!data) {
      throw new Error('Job data is required');
    }

    if (typeof data !== 'object') {
      throw new Error('Job data must be an object');
    }

    // Basic XSS protection
    if (typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          if (value.includes('<script>') || value.includes('javascript:')) {
            throw new Error(`Potentially malicious content detected in field: ${key}`);
          }
        }
      }
    }

    // Validate required timestamp
    if (!data.timestamp || typeof data.timestamp !== 'number') {
      throw new Error('Job data must include a valid timestamp');
    }
  }

  /**
   * Graceful shutdown
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    this.logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown');
    
    try {
      await this.worker.close();
      this.logger.info('Worker closed gracefully');
      process.exit(0);
    } catch (error) {
      this.logger.error({ error }, 'Error during worker shutdown');
      process.exit(1);
    }
  }

  /**
   * Get worker statistics
   */
  public getStats() {
    return {
      isRunning: !this.worker.closing,
      concurrency: this.config.concurrency,
      handlersCount: this.handlers.size
    };
  }
}

/**
 * Start the queue worker if this file is run directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const queueName = process.env.QUEUE_NAME || 'main';
  const logger = defaultLogger.child({ 
    module: 'queue-worker-main',
    queueName 
  });

  try {
    logger.info({
      queueName,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version
    }, 'Starting Queue Worker process');
    
    const worker = new QueueWorker(queueName);
    
    logger.info('Queue Worker is running successfully. Press Ctrl+C to stop.');
    
  } catch (error) {
    logger.fatal({
      error: error instanceof Error ? error : new Error(String(error)),
      queueName
    }, 'Failed to start Queue Worker');
    process.exit(1);
  }
}

export { QueueWorker };