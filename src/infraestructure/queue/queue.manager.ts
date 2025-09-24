/**
 * Queue Manager
 * Implements database persistence with Redis caching and concurrency control
 */

import type { RedisClientType } from 'redis';
import type { FastifyBaseLogger } from 'fastify';
import type { ClientSession } from 'mongoose';
import { randomUUID } from 'crypto';

import { JobModel, JobValidations, type IJob } from '../../entities/job/index.js';
import { DLQModel, type IDLQ } from '../../entities/dlq/index.js';
import { getQueueCacheManager, getQueueRedisClient } from '../cache/index.js';
import type { EnhancedCacheManager } from '../cache/enhanced-cache.manager.js';

import {
  QueueHealth,
  type QueueConfig,
  type QueueHealthInfo,
  type CleanupResult,
  type JobBatch,
  type BatchLoadOptions,
  type ConcurrencyLock,
  type QueueStats,
  type DLQStats
} from './queue.types.js';

import type { IJobRepository } from '../../entities/job/index.js';
import type { IDLQRepository } from '../../entities/dlq/index.js';

/**
 * Modern Queue Manager with MongoDB persistence and Redis caching
 * Provides enterprise-grade features:
 * - Database persistence for reliability
 * - Redis caching for performance
 * - Batch processing by priority
 * - Concurrency control with locks
 * - Dead Letter Queue (DLQ) management
 */
export class QueueManager {
  private redisClient: RedisClientType | null = null;
  private cacheManager: EnhancedCacheManager | null = null;
  private currentBatch: JobBatch | null = null;
  private lockPrefix: string;
  private workerPrefix: string;

  // Make repositories public for worker access
  public jobRepository: IJobRepository;
  public dlqRepository: IDLQRepository;

  constructor(
    private config: QueueConfig,
    jobRepository: IJobRepository,
    dlqRepository: IDLQRepository,
    private logger: FastifyBaseLogger
  ) {
    this.lockPrefix = `${config.name}:locks`;
    this.workerPrefix = `${config.name}:workers`;
    this.jobRepository = jobRepository;
    this.dlqRepository = dlqRepository;
  }

  /**
   * Initialize the queue manager
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Queue Manager...');

      // Get the Queue Redis client from cache module
      this.redisClient = getQueueRedisClient();
      if (!this.redisClient) {
        throw new Error(
          'Queue Redis client is not available. Make sure cache module is initialized.'
        );
      }

      // Initialize cache manager
      this.cacheManager = getQueueCacheManager(1800, 'queue'); // 30 min TTL

      this.logger.info('Queue Manager initialized successfully');
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize Queue Manager');
      throw error;
    }
  }

  /**
   * Add a job to the queue with database persistence
   */
  async addJob<T = any>(
    jobType: string,
    jobData: T,
    options: {
      priority?: number;
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
          priority: options.priority || 5,
          maxAttempts: options.attempts || 3,
          scheduledFor: options.delay ? new Date(Date.now() + options.delay) : new Date()
        },
        options.session
      );

      this.logger.debug(
        {
          jobId: job.jobId,
          type: jobType,
          priority: job.priority
        },
        'Job added to database'
      );

      // Invalidate current batch cache if priority changed
      if (this.currentBatch && job.priority > this.currentBatch.minPriority) {
        await this.invalidateBatchCache();
      }

      return job.jobId;
    } catch (error) {
      this.logger.error({ error, jobType, jobData }, 'Failed to add job to queue');
      throw error;
    }
  }

  /**
   * Load next batch of jobs by priority
   */
  async loadNextBatch(options: BatchLoadOptions = {}): Promise<JobBatch | null> {
    const { batchSize = 50, priorities = [15, 10, 5, 1], useCache = true } = options;

    try {
      // Check cache first
      if (useCache && this.cacheManager && this.currentBatch) {
        if (!this.isBatchExpired(this.currentBatch)) {
          return this.currentBatch;
        }
      }

      // Load from database by priority
      for (const priority of priorities) {
        const jobs = await this.jobRepository.findPendingJobsByPriority(priority, batchSize);

        if (jobs.length > 0) {
          const batch: JobBatch = {
            id: randomUUID(),
            jobs,
            priority,
            minPriority: Math.min(...jobs.map(j => j.priority)),
            maxPriority: Math.max(...jobs.map(j => j.priority)),
            loadedAt: new Date(),
            ttl: this.config.cache?.ttl || 1800,
            size: jobs.length
          };

          this.currentBatch = batch;

          // Cache the batch
          if (this.cacheManager) {
            await this.cacheManager.set(`batch:${batch.id}`, batch, {
              ttl: this.config.cache?.ttl || 1800
            });
          }

          this.logger.debug(
            {
              batchId: batch.id,
              priority,
              jobCount: jobs.length
            },
            'Loaded new job batch'
          );

          return batch;
        }
      }

      return null; // No jobs available
    } catch (error) {
      this.logger.error({ error }, 'Failed to load job batch');
      throw error;
    }
  }

  /**
   * Acquire lock for job processing
   */
  async acquireLock(jobId: string, workerId: string, timeout = 300): Promise<boolean> {
    if (!this.redisClient) {
      this.logger.warn('Redis not available, using database fallback for locking');
      return this.acquireDatabaseLock(jobId, workerId, timeout);
    }

    try {
      const lockKey = `${this.lockPrefix}:${jobId}`;
      const lockValue = JSON.stringify({
        workerId,
        acquiredAt: Date.now(),
        timeout: timeout * 1000
      });

      const result = await this.redisClient.set(lockKey, lockValue, {
        EX: timeout,
        NX: true
      });
      return result === 'OK';
    } catch (error) {
      this.logger.error({ error, jobId, workerId }, 'Failed to acquire lock');
      return false;
    }
  }

  /**
   * Release lock for job processing
   */
  async releaseLock(jobId: string, workerId: string): Promise<boolean> {
    if (!this.redisClient) {
      return this.releaseDatabaseLock(jobId, workerId);
    }

    try {
      const lockKey = `${this.lockPrefix}:${jobId}`;
      const lockData = await this.redisClient.get(lockKey);

      if (lockData) {
        const lock = JSON.parse(lockData);
        if (lock.workerId === workerId) {
          await this.redisClient.del(lockKey);
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logger.error({ error, jobId, workerId }, 'Failed to release lock');
      return false;
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    try {
      const stats = await this.jobRepository.getJobStatsByStatus();
      const batchInfo = this.currentBatch
        ? {
            currentBatchSize: this.currentBatch.size,
            currentBatchPriority: this.currentBatch.priority,
            batchLoadedAt: this.currentBatch.loadedAt
          }
        : null;

      return {
        ...stats,
        batchInfo,
        redisConnected: !!this.redisClient,
        cacheConnected: !!this.cacheManager
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get queue stats');
      throw error;
    }
  }

  /**
   * Move job to DLQ
   */
  async moveToDLQ(job: IJob, reason: string): Promise<void> {
    try {
      await this.dlqRepository.createDLQEntry({
        originalJobId: job.jobId,
        jobType: job.type,
        jobData: job.data,
        priority: job.priority,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        failureReason: reason,
        originalCreatedAt: job.createdAt
      });

      this.logger.warn(
        {
          jobId: job.jobId,
          jobType: job.type,
          reason
        },
        'Job moved to DLQ'
      );
    } catch (error) {
      this.logger.error({ error, jobId: job.jobId, reason }, 'Failed to move job to DLQ');
      throw error;
    }
  }

  /**
   * Health check
   */
  async getHealthInfo(): Promise<QueueHealthInfo> {
    const health: QueueHealthInfo = {
      overall: QueueHealth.HEALTHY,
      database: { connected: true },
      cache: { connected: !!this.cacheManager },
      workers: { active: 0, failed: 0 },
      queues: { backlog: 0, stalled: 0, processing: 0 }
    };

    // Determine overall health
    if (!health.database.connected) {
      health.overall = QueueHealth.CRITICAL;
    } else if (!health.cache.connected) {
      health.overall = QueueHealth.DEGRADED;
    }

    return health;
  }

  // Private helper methods

  private generateJobId(jobType: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${jobType.replace(':', '_')}_${timestamp}_${random}`;
  }

  private isBatchExpired(batch: JobBatch): boolean {
    const expiresAt = new Date(batch.loadedAt.getTime() + batch.ttl * 1000);
    return new Date() > expiresAt;
  }

  private async invalidateBatchCache(): Promise<void> {
    if (this.currentBatch && this.cacheManager) {
      await this.cacheManager.del(`batch:${this.currentBatch.id}`);
      this.currentBatch = null;
    }
  }

  private async acquireDatabaseLock(
    jobId: string,
    workerId: string,
    timeout: number
  ): Promise<boolean> {
    try {
      const result = await this.jobRepository.updateJobStatus(jobId, 'processing', {
        processingBy: workerId,
        processingAt: new Date()
      });
      return !!result;
    } catch (error) {
      return false;
    }
  }

  private async releaseDatabaseLock(jobId: string, workerId: string): Promise<boolean> {
    try {
      const result = await this.jobRepository.updateJobStatus(jobId, 'pending', {
        processingBy: null,
        processingAt: null
      });
      return !!result;
    } catch (error) {
      return false;
    }
  }
}
