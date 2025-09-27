/**
 * Queue Implementation
 *
 * BullMQ queue implementation with Redis backend
 * for job processing and queue management
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { defaultLogger } from '../../lib/logger/index.js';

export interface JobOptions {
  priority?: number;
  attempts?: number;
  delay?: number;
  scheduledFor?: Date;
}

export interface JobHandler {
  (data: any): Promise<any>;
}

export class QueueManager {
  private queue: Queue;
  private worker: Worker;
  private queueEvents: QueueEvents;
  private redisConnection: Redis;
  private handlers = new Map<string, JobHandler>();
  private logger?: Logger;

  constructor(
    private queueName: string,
    private concurrency: number = 5,
    logger?: Logger
  ) {
    this.logger = logger || defaultLogger.child({ component: 'queue' });

    // Create Redis connection for queue
    this.redisConnection = new Redis({
      host: process.env.QUEUE_REDIS_HOST || 'redis',
      port: parseInt(process.env.QUEUE_REDIS_PORT || '6379'),
      db: parseInt(process.env.QUEUE_REDIS_DB || '1'),
      maxRetriesPerRequest: null // Required by BullMQ
    });

    // Initialize BullMQ components
    this.queue = new Queue(this.queueName, {
      connection: this.redisConnection
    });

    this.worker = new Worker(this.queueName, this.processJob.bind(this), {
      connection: this.redisConnection,
      concurrency: this.concurrency
    });

    this.queueEvents = new QueueEvents(this.queueName, {
      connection: this.redisConnection
    });

    this.setupEventListeners();
  }

  /**
   * Register a job handler
   */
  registerHandler(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
    this.logger?.info(`Handler registered for job type: ${type}`);
  }

  /**
   * Add a job to the queue
   */
  async addJob(jobId: string, type: string, data: any, options?: JobOptions): Promise<string> {
    try {
      const jobOptions: any = {
        jobId,
        attempts: options?.attempts || 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      };

      if (options?.priority) {
        jobOptions.priority = options.priority;
      }

      if (options?.delay) {
        jobOptions.delay = options.delay;
      }

      if (options?.scheduledFor) {
        jobOptions.delay = options.scheduledFor.getTime() - Date.now();
      }

      const job = await this.queue.add(type, data, jobOptions);

      this.logger?.info(`Job added successfully: ${job.id} (type: ${type})`);
      return job.id as string;
    } catch (error) {
      this.logger?.error(`Failed to add job: ${error}`);
      throw error;
    }
  }

  /**
   * Process a job
   */
  private async processJob(job: any): Promise<any> {
    const { name: type, data } = job;

    this.logger?.info(`Processing job: ${job.id} (type: ${type})`);

    const handler = this.handlers.get(type);
    if (!handler) {
      throw new Error(`No handler found for job type: ${type}`);
    }

    try {
      const result = await handler(data);
      this.logger?.info(`Job completed successfully: ${job.id}`);
      return result;
    } catch (error) {
      this.logger?.error(`Job failed: ${job.id} - ${error}`);
      throw error;
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.queueEvents.on('completed', jobId => {
      this.logger?.info(`Job completed: ${jobId}`);
    });

    this.queueEvents.on('failed', (jobId, err) => {
      this.logger?.error(`Job failed: ${jobId} - ${err}`);
    });

    this.queueEvents.on('active', jobId => {
      this.logger?.debug(`Job started: ${jobId}`);
    });

    this.worker.on('error', err => {
      this.logger?.error(`Worker error: ${err}`);
    });
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    this.logger?.info(`BullMQ worker started for queue: ${this.queueName}`);
  }

  /**
   * Stop the worker and close connections
   */
  async stop(): Promise<void> {
    this.logger?.info('Stopping BullMQ worker...');

    await Promise.all([this.worker.close(), this.queueEvents.close(), this.queue.close()]);

    this.redisConnection.disconnect();
    this.logger?.info('BullMQ worker stopped');
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<any> {
    const waiting = await this.queue.getWaiting();
    const active = await this.queue.getActive();
    const completed = await this.queue.getCompleted();
    const failed = await this.queue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length
    };
  }
}

/**
 * Factory function to create QueueManager
 */
export async function createQueueManager(
  queueName: string,
  concurrency: number = 5,
  logger?: Logger
): Promise<QueueManager> {
  const queue = new QueueManager(queueName, concurrency, logger);
  await queue.start();
  return queue;
}
