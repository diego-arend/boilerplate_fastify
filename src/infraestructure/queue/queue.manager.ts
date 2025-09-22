import { Queue, Job } from 'bullmq';
import type { config } from '../../lib/validators/validateEnv.js';
import type {
  JobType,
  JobData,
  JobOptions,
  QueueConfig,
  QueueStats,
  JobStatus,
  JobResult
} from './queue.types.js';

/**
 * Queue Manager class for handling BullMQ operations
 * Provides high-level interface for job queue management
 */
export class QueueManager {
  private queue: Queue;
  private config: QueueConfig;
  private static instance: QueueManager | null = null;
  private initialized: boolean = false;

  /**
   * Create QueueManager instance
   * @param queueName - Name of the queue
   */
  constructor(queueName: string = 'main') {
    const redisPassword = process.env.REDIS_PASSWORD;
    
    this.config = {
      name: queueName,
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        ...(redisPassword && { password: redisPassword }),
        db: parseInt(process.env.REDIS_DB || '0')
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 10,
        removeOnFail: 50
      }
    };

    // Initialize queue
    this.queue = new Queue(queueName, {
      connection: this.getRedisConfig(),
      ...(this.config.defaultJobOptions && { defaultJobOptions: this.config.defaultJobOptions })
    });
    
    this.initialized = true;
  }

  /**
   * Get singleton instance of QueueManager
   */
  static getInstance(queueName = 'main'): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager(queueName);
    }
    return QueueManager.instance;
  }

  /**
   * Add a job to the queue
   * @param jobType - Type of job to add
   * @param jobData - Job data payload
   * @param options - Job options
   * @returns Job instance
   */
  public async addJob<T extends JobData>(
    jobType: JobType,
    jobData: T,
    options: JobOptions = {}
  ): Promise<Job<T>> {

    try {
      // Validate job data
      this.validateJobData(jobData);

      // Add timestamp if not present
      if (!jobData.timestamp) {
        jobData.timestamp = Date.now();
      }

      // Add job to queue
      const job = await this.queue.add(jobType, jobData, {
        ...this.config.defaultJobOptions,
        ...options
      });

      console.log(`QueueManager: Added job ${job.id} of type ${jobType}`);
      return job;

    } catch (error) {
      console.error(`QueueManager: Failed to add job ${jobType}`, error);
      throw new Error(`Failed to add job: ${error}`);
    }
  }

  /**
   * Get job by ID
   * @param jobId - Job ID
   * @returns Job instance or null if not found
   */
  public async getJob(jobId: string): Promise<Job | null> {

    try {
      const job = await this.queue.getJob(jobId);
      return job || null;
    } catch (error) {
      console.error(`QueueManager: Failed to get job ${jobId}`, error);
      return null;
    }
  }

  /**
   * Get job status
   * @param jobId - Job ID
   * @returns Job status or null if not found
   */
  public async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const job = await this.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    return state as JobStatus;
  }

  /**
   * Get job result
   * @param jobId - Job ID
   * @returns Job result or null
   */
  public async getJobResult(jobId: string): Promise<JobResult | null> {
    const job = await this.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    
    if (state === 'completed') {
      return {
        success: true,
        data: job.returnvalue,
        processedAt: job.processedOn || 0,
        processingTime: (job.finishedOn || 0) - (job.processedOn || 0)
      };
    } else if (state === 'failed') {
      return {
        success: false,
        error: job.failedReason,
        processedAt: job.processedOn || 0,
        processingTime: (job.finishedOn || 0) - (job.processedOn || 0)
      };
    }

    return null;
  }

  /**
   * Remove job from queue
   * @param jobId - Job ID
   * @returns True if removed successfully
   */
  public async removeJob(jobId: string): Promise<boolean> {

    try {
      const job = await this.getJob(jobId);
      if (!job) return false;

      await job.remove();
      console.log(`QueueManager: Removed job ${jobId}`);
      return true;

    } catch (error) {
      console.error(`QueueManager: Failed to remove job ${jobId}`, error);
      return false;
    }
  }

  /**
   * Get queue statistics
   * @returns Queue statistics
   */
  public async getStats(): Promise<QueueStats> {

    try {
      const waiting = await this.queue.getWaiting();
      const active = await this.queue.getActive();
      const completed = await this.queue.getCompleted();
      const failed = await this.queue.getFailed();
      const delayed = await this.queue.getDelayed();

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        paused: await this.queue.isPaused() ? 1 : 0
      };

    } catch (error) {
      console.error('QueueManager: Failed to get stats', error);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0
      };
    }
  }

  /**
   * Pause the queue
   */
  public async pause(): Promise<void> {
    await this.queue.pause();
    console.log(`QueueManager: Queue '${this.config.name}' paused`);
  }

  /**
   * Resume the queue
   */
  public async resume(): Promise<void> {
    await this.queue.resume();
    console.log(`QueueManager: Queue '${this.config.name}' resumed`);
  }

  /**
   * Clean completed jobs
   * @param grace - Grace period in milliseconds
   * @param limit - Maximum number of jobs to clean
   */
  public async cleanCompleted(grace: number = 24 * 60 * 60 * 1000, limit: number = 100): Promise<number> {

    try {
      const jobs = await this.queue.clean(grace, limit, 'completed');
      console.log(`QueueManager: Cleaned ${jobs.length} completed jobs`);
      return jobs.length;

    } catch (error) {
      console.error('QueueManager: Failed to clean completed jobs', error);
      return 0;
    }
  }

  /**
   * Clean failed jobs
   * @param grace - Grace period in milliseconds
   * @param limit - Maximum number of jobs to clean
   */
  public async cleanFailed(grace: number = 24 * 60 * 60 * 1000, limit: number = 100): Promise<number> {

    try {
      const jobs = await this.queue.clean(grace, limit, 'failed');
      console.log(`QueueManager: Cleaned ${jobs.length} failed jobs`);
      return jobs.length;

    } catch (error) {
      console.error('QueueManager: Failed to clean failed jobs', error);
      return 0;
    }
  }

  /**
   * Get queue instance for advanced operations
   * @returns BullMQ Queue instance
   */
  public getQueue(): Queue {
    return this.queue;
  }

  /**
   * Check if queue manager is initialized
   * @returns True if initialized
   */
  public isReady(): boolean {
    return this.initialized;
  }

  /**
   * Close queue connection
   */
  public async close(): Promise<void> {
    try {
      await this.queue.close();
      this.initialized = false;
      console.log(`QueueManager: Queue '${this.config.name}' closed`);
    } catch (error) {
      console.error('QueueManager: Error closing queue', error);
    }
  }

  /**
   * Get Redis configuration for BullMQ
   * @private
   */
  private getRedisConfig() {
    const redisConfig = {
      host: this.config.redis.host,
      port: this.config.redis.port,
      ...(this.config.redis.db !== undefined && { db: this.config.redis.db })
    };

    if (this.config.redis.password) {
      return {
        ...redisConfig,
        password: this.config.redis.password
      };
    }

    return redisConfig;
  }

  /**
   * Validate job data
   * @private
   */
  private validateJobData(jobData: JobData): void {
    if (!jobData) {
      throw new Error('Job data is required');
    }

    if (typeof jobData !== 'object') {
      throw new Error('Job data must be an object');
    }

    // Basic sanitization
    if (typeof jobData === 'object') {
      for (const [key, value] of Object.entries(jobData)) {
        if (typeof value === 'string') {
          // Basic XSS protection
          if (value.includes('<script>') || value.includes('javascript:')) {
            throw new Error(`Potentially malicious content detected in field: ${key}`);
          }
        }
      }
    }
  }
}

/**
 * Get default queue manager instance
 * @returns QueueManager singleton
 */
export function getDefaultQueueManager(): QueueManager {
  return QueueManager.getInstance('main');
}

/**
 * Create a new queue manager
 * @param queueName - Name of the queue
 * @returns New QueueManager instance
 */
export function createQueueManager(queueName: string): QueueManager {
  return new QueueManager(queueName);
}