/**
 * Standalone Worker Implementation
 *
 * Worker independente que processa jobs usando os módulos existentes:
 * - MongoConnectionManagerFactory para MongoDB
 * - QueueCache para Redis/BullMQ
 * - QUEUE_HANDLERS para processamento
 */

import { MongoConnectionManagerFactory } from '../mongo/index';
import { getQueueCache, type QueueCache } from '../cache/index';
import { QueueManager } from '../queue/queue';
import { JOB_HANDLERS } from '../queue/jobs/index';
import { JobBatchRepository } from '../../entities/job/index';
import { defaultLogger } from '../../lib/logger/index';
import type { Logger } from 'pino';
import type { IMongoConnectionManager } from '../mongo/index';

export interface WorkerConfig {
  queueName: string;
  batchSizeJobs: number; // MongoDB → Redis batch size (BATCH_SIZE_JOBS)
  workerSizeJobs: number; // BullMQ worker concurrency (WORKER_SIZE_JOBS)
  concurrency: number; // Kept for backward compatibility, use workerSizeJobs instead
  processingInterval: number; // Batch loading interval in milliseconds
}

export class StandaloneWorker {
  private mongoConnection!: IMongoConnectionManager;
  private queueCache!: QueueCache;
  private queueManager!: QueueManager;
  private jobRepository: JobBatchRepository;
  private logger: Logger;
  private config: WorkerConfig;
  private processingInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(config: WorkerConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger || defaultLogger.child({ component: 'StandaloneWorker' });
    this.jobRepository = new JobBatchRepository();
  }

  /**
   * Inicializar worker usando módulos existentes
   */
  async initialize(): Promise<void> {
    try {
      // Conectar ao MongoDB
      this.mongoConnection = MongoConnectionManagerFactory.create();
      await this.mongoConnection.connect();

      // Conectar ao QueueCache (Redis)
      this.queueCache = getQueueCache();

      // Initialize QueueManager with proper parameter order: (queueName, concurrency, queueCache, logger)
      this.queueManager = new QueueManager(
        this.config.queueName,
        this.config.workerSizeJobs, // Use workerSizeJobs for BullMQ concurrency
        this.queueCache, // Pass QueueCache instance
        this.logger
      );
      await this.queueManager.initialize();

      this.logger.info('StandaloneWorker initialized with queue integration');
    } catch (error) {
      this.logger.error(
        `Worker initialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Start the corrected worker flow: MongoDB → Redis → BullMQ
   */
  async run(): Promise<void> {
    try {
      await this.initialize();

      // Register job handlers with QueueManager
      this.registerJobHandlers();

      // Start the loading process: MongoDB → Redis
      await this.startBatchLoading();

      // Start BullMQ worker processing: Redis → Processing
      await this.queueManager.start();

      this.logger.info('StandaloneWorker started with corrected MongoDB→Redis→BullMQ flow');
    } catch (error) {
      this.logger.error(`Failed to start worker: ${error}`);
      throw error;
    }
  }

  /**
   * Register job handlers with QueueManager for BullMQ processing
   */
  private registerJobHandlers(): void {
    for (const [jobType, handler] of Object.entries(JOB_HANDLERS)) {
      this.queueManager.registerHandler(jobType, async (data: any) => {
        try {
          // Execute the job handler with proper signature:
          // handler(data, jobId, logger, jobInfo)
          const result = await handler(
            data.jobData, // The actual job data
            data.jobId, // Job ID from MongoDB
            this.logger, // Logger instance
            {
              attempt: 1,
              maxAttempts: data.maxAttempts || 3,
              queuedAt: new Date(),
              processingAt: new Date()
            }
          );

          // Mark job as completed in MongoDB
          await this.jobRepository.markJobAsCompleted(data.jobId);

          return result;
        } catch (error) {
          // Mark job as failed in MongoDB
          await this.jobRepository.markJobAsFailed(
            data.jobId,
            error instanceof Error ? error.message : String(error)
          );
          throw error;
        }
      });
    }

    this.logger.info(
      `Registered ${Object.keys(JOB_HANDLERS).length} job handlers with QueueManager`
    );
  }

  /**
   * Start loading batches from MongoDB to Redis queue
   */
  private async startBatchLoading(): Promise<void> {
    if (this.processingInterval) {
      this.logger.warn('Batch loading already started');
      return;
    }

    this.logger.info(
      `Starting batch loading: ${this.config.batchSizeJobs} jobs per MongoDB batch, ` +
        `${this.config.workerSizeJobs} BullMQ worker concurrency`
    );

    this.processingInterval = setInterval(async () => {
      if (this.isShuttingDown) return;

      try {
        await this.loadBatchToRedis();
      } catch (error) {
        this.logger.error(`Batch loading error: ${error}`);
      }
    }, this.config.processingInterval);
  }

  /**
   * Load next batch from MongoDB to Redis queue for BullMQ processing
   */
  private async loadBatchToRedis(): Promise<void> {
    try {
      // Load next batch from MongoDB
      const batch = await this.jobRepository.loadNextBatch(this.config.batchSizeJobs);
      if (!batch || batch.jobs.length === 0) {
        return; // No jobs to process
      }

      this.logger.info(`Loading batch to Redis: ${batch.batchId} with ${batch.jobs.length} jobs`);

      // Add each job to Redis queue via QueueManager
      const addingPromises = batch.jobs.map(job =>
        this.queueManager.addJob(job.jobId, job.type, {
          jobId: job.jobId,
          jobData: job.data,
          maxAttempts: job.maxAttempts || 3
        })
      );

      await Promise.allSettled(addingPromises);

      this.logger.info(`Loaded batch to Redis: ${batch.batchId}`);
    } catch (error) {
      this.logger.error(`Failed to load batch to Redis: ${error}`);
    }
  }

  /**
   * Stop worker gracefully
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping Standalone Worker...');
    this.isShuttingDown = true;

    // Stop batch loading interval
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Stop QueueManager and BullMQ worker
    if (this.queueManager) {
      await this.queueManager.stop();
    }

    // Disconnect MongoDB
    if (this.mongoConnection) {
      await this.mongoConnection.disconnect();
    }

    this.logger.info('Standalone Worker stopped successfully');
  }

  /**
   * Get worker statistics including queue status
   */
  async getStats(): Promise<any> {
    const jobStats = await this.jobRepository.getBatchStats();
    const queueStats = await this.queueManager.getStats();

    return {
      worker: {
        config: this.config,
        isRunning: !this.isShuttingDown,
        batchLoading: !!this.processingInterval
      },
      jobs: jobStats,
      queue: queueStats,
      connections: {
        mongo: this.mongoConnection?.isConnected() || false,
        redis: true // QueueCache manages Redis connections
      }
    };
  }

  /**
   * Health check for container
   */
  async healthCheck(): Promise<boolean> {
    try {
      const mongoConnected = this.mongoConnection?.isConnected() || false;
      const redisConnected = true; // QueueCache doesn't have public isConnected method
      const workerRunning = !this.isShuttingDown;

      return mongoConnected && redisConnected && workerRunning;
    } catch (error) {
      this.logger.error(`Health check failed: ${error}`);
      return false;
    }
  }
}
