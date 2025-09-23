/**
 * Resilient Queue Manager with Redis failure handling
 * Implements circuit breaker, retry logic, and fallback mechanisms
 */

import { Queue, Job, Worker } from 'bullmq';
import type { FastifyBaseLogger } from 'fastify';
import type {
  JobType,
  JobData,
  JobOptions,
  QueueConfig,
  QueueStats,
  JobResult
} from './queue.types.js';

export enum SystemHealth {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  CRITICAL = 'critical',
  DOWN = 'down'
}

export interface HealthStatus {
  overall: SystemHealth;
  redis: {
    status: 'connected' | 'disconnected' | 'error';
    latency?: number;
    lastError?: string;
    consecutiveFailures: number;
  };
  fallback: {
    active: boolean;
    type: 'database' | 'memory' | null;
    queuedJobs: number;
  };
  metrics: {
    totalJobs: number;
    successfulJobs: number;
    failedJobs: number;
    fallbackJobs: number;
  };
}

export interface FallbackJobData {
  // Base job data
  userId?: string;
  timestamp: number;
  metadata?: Record<string, any>;
  // Fallback specific
  fallbackId: string;
  createdAt: number;
  retryCount: number;
  originalJobType: JobType;
  fallbackReason: string;
}

/**
 * Circuit Breaker for Redis connections
 */
class RedisCircuitBreaker {
  private failureCount: number = 0;
  private lastFailure: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly failureThreshold: number = 5;
  private readonly recoveryTimeout: number = 30000; // 30s
  private readonly resetTimeout: number = 60000; // 1min

  constructor(private logger: FastifyBaseLogger) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        this.logger.info('Circuit breaker moving to HALF_OPEN state');
      } else {
        throw new Error('Circuit breaker is OPEN - Redis operations blocked');
      }
    }

    try {
      const result = await operation();

      if (this.state === 'HALF_OPEN') {
        this.reset();
        this.logger.info('Circuit breaker reset to CLOSED - Redis recovered');
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailure = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.logger.error(
        {
          failureCount: this.failureCount,
          threshold: this.failureThreshold
        },
        'Circuit breaker opened - Redis operations blocked'
      );

      // Auto-reset after timeout
      setTimeout(() => {
        if (this.state === 'OPEN') {
          this.state = 'HALF_OPEN';
          this.logger.info('Circuit breaker auto-reset to HALF_OPEN');
        }
      }, this.resetTimeout);
    }
  }

  private reset(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.lastFailure = 0;
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailure: this.lastFailure
    };
  }
}

/**
 * In-memory fallback queue for emergency situations
 */
class MemoryFallbackQueue {
  private jobs: Map<string, FallbackJobData> = new Map();
  private processing: Set<string> = new Set();
  private completed: Map<string, JobResult> = new Map();
  private failed: Map<string, { error: string; attempts: number }> = new Map();

  constructor(private logger: FastifyBaseLogger) {}

  async addJob(jobType: JobType, data: JobData, options: JobOptions = {}): Promise<string> {
    const jobId = `fallback:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;

    const fallbackJob: FallbackJobData = {
      ...data,
      fallbackId: jobId,
      createdAt: Date.now(),
      retryCount: 0,
      originalJobType: jobType,
      fallbackReason: 'Redis connection failed'
    };

    this.jobs.set(jobId, fallbackJob);

    this.logger.warn(
      {
        jobId,
        jobType,
        fallbackReason: 'Redis unavailable'
      },
      'Job added to memory fallback queue'
    );

    return jobId;
  }

  async getStats(): Promise<QueueStats> {
    return {
      waiting: this.jobs.size - this.processing.size,
      active: this.processing.size,
      completed: this.completed.size,
      failed: this.failed.size,
      delayed: 0,
      paused: 0
    };
  }

  async getJobs(): Promise<FallbackJobData[]> {
    return Array.from(this.jobs.values());
  }

  async processJob(jobId: string): Promise<JobResult> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Fallback job ${jobId} not found`);
    }

    this.processing.add(jobId);

    try {
      // Simulate job processing (in real implementation, call actual handlers)
      const result: JobResult = {
        success: true,
        data: { processed: true, fallback: true },
        processedAt: Date.now(),
        processingTime: 100
      };

      this.completed.set(jobId, result);
      this.jobs.delete(jobId);
      this.processing.delete(jobId);

      this.logger.info(
        {
          jobId,
          jobType: job.originalJobType
        },
        'Fallback job processed successfully'
      );

      return result;
    } catch (error) {
      this.processing.delete(jobId);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      this.failed.set(jobId, {
        error: errorMsg,
        attempts: job.retryCount + 1
      });

      this.logger.error(
        {
          jobId,
          jobType: job.originalJobType,
          error: errorMsg,
          attempts: job.retryCount + 1
        },
        'Fallback job processing failed'
      );

      return {
        success: false,
        error: errorMsg,
        processedAt: Date.now(),
        processingTime: 0
      };
    }
  }

  async clear(): Promise<void> {
    this.jobs.clear();
    this.processing.clear();
    this.completed.clear();
    this.failed.clear();
    this.logger.info('Memory fallback queue cleared');
  }
}

/**
 * Resilient Queue Manager with comprehensive failure handling
 */
export class ResilientQueueManager {
  private primaryQueue: Queue | null = null;
  private circuitBreaker: RedisCircuitBreaker;
  private memoryFallback: MemoryFallbackQueue;
  private healthStatus: HealthStatus;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private logger: FastifyBaseLogger;

  constructor(
    private queueName: string,
    private config: QueueConfig,
    logger: FastifyBaseLogger
  ) {
    this.logger = logger.child({ module: 'resilient-queue' });
    this.circuitBreaker = new RedisCircuitBreaker(this.logger);
    this.memoryFallback = new MemoryFallbackQueue(this.logger);

    this.healthStatus = {
      overall: SystemHealth.DOWN,
      redis: {
        status: 'disconnected',
        consecutiveFailures: 0
      },
      fallback: {
        active: false,
        type: null,
        queuedJobs: 0
      },
      metrics: {
        totalJobs: 0,
        successfulJobs: 0,
        failedJobs: 0,
        fallbackJobs: 0
      }
    };

    this.initializePrimaryQueue();
    this.startHealthChecks();
  }

  /**
   * Initialize primary Redis queue with retry logic
   */
  private async initializePrimaryQueue(): Promise<void> {
    try {
      this.primaryQueue = new Queue(this.queueName, {
        connection: {
          ...this.config.redis,
          retryDelayOnFailover: 100,
          enableReadyCheck: true,
          maxRetriesPerRequest: 3,
          connectTimeout: 10000,
          commandTimeout: 5000,
          lazyConnect: true
        },
        defaultJobOptions: {
          ...this.config.defaultJobOptions,
          attempts: 5, // Increase attempts for resilience
          backoff: {
            type: 'exponential',
            delay: 1000
          }
        }
      });

      // Setup Redis event listeners
      this.setupRedisEventListeners();

      // Test connection
      await this.testRedisConnection();

      this.updateHealthStatus({
        redis: {
          status: 'connected',
          consecutiveFailures: 0
        },
        overall: SystemHealth.HEALTHY
      });

      this.logger.info('Primary Redis queue initialized successfully');
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        'Failed to initialize primary Redis queue'
      );

      this.updateHealthStatus({
        redis: {
          status: 'error',
          lastError: error instanceof Error ? error.message : 'Unknown error',
          consecutiveFailures: this.healthStatus.redis.consecutiveFailures + 1
        },
        overall: SystemHealth.CRITICAL,
        fallback: { active: true, type: 'memory', queuedJobs: 0 }
      });
    }
  }

  /**
   * Setup Redis connection event listeners
   */
  private setupRedisEventListeners(): void {
    if (!this.primaryQueue) return;

    const redis = (this.primaryQueue as any).client;

    redis.on('connect', () => {
      this.logger.info('Redis connection established');
      this.updateHealthStatus({
        redis: { status: 'connected', consecutiveFailures: 0 },
        overall: SystemHealth.HEALTHY,
        fallback: { active: false, type: null, queuedJobs: 0 }
      });
    });

    redis.on('error', (error: Error) => {
      this.logger.error(
        {
          error: error.message,
          consecutiveFailures: this.healthStatus.redis.consecutiveFailures + 1
        },
        'Redis connection error'
      );

      this.updateHealthStatus({
        redis: {
          status: 'error',
          lastError: error.message,
          consecutiveFailures: this.healthStatus.redis.consecutiveFailures + 1
        },
        overall: SystemHealth.CRITICAL,
        fallback: { active: true, type: 'memory', queuedJobs: 0 }
      });
    });

    redis.on('close', () => {
      this.logger.warn('Redis connection closed');
      this.updateHealthStatus({
        redis: { status: 'disconnected', consecutiveFailures: 0 },
        overall: SystemHealth.DEGRADED,
        fallback: { active: true, type: 'memory', queuedJobs: 0 }
      });
    });

    redis.on('reconnecting', () => {
      this.logger.info('Attempting to reconnect to Redis...');
    });
  }

  /**
   * Test Redis connection health
   */
  private async testRedisConnection(): Promise<boolean> {
    if (!this.primaryQueue) return false;

    try {
      const startTime = Date.now();
      await this.circuitBreaker.execute(async () => {
        const redis = (this.primaryQueue as any).client;
        await redis.ping();
      });

      const latency = Date.now() - startTime;
      this.updateHealthStatus({
        redis: {
          status: 'connected',
          latency,
          consecutiveFailures: 0
        }
      });

      return true;
    } catch (error) {
      this.updateHealthStatus({
        redis: {
          status: 'error',
          lastError: error instanceof Error ? error.message : 'Unknown error',
          consecutiveFailures: this.healthStatus.redis.consecutiveFailures + 1
        }
      });
      return false;
    }
  }

  /**
   * Add job with automatic fallback
   */
  public async addJob<T extends JobData>(
    jobType: JobType,
    jobData: T,
    options: JobOptions = {}
  ): Promise<{ jobId: string; fallback: boolean }> {
    this.healthStatus.metrics.totalJobs++;

    // Try primary queue first
    if (this.healthStatus.redis.status === 'connected' && this.primaryQueue) {
      try {
        const job = await this.circuitBreaker.execute(async () => {
          return await this.primaryQueue!.add(jobType, jobData, options);
        });

        this.healthStatus.metrics.successfulJobs++;
        this.logger.info(
          {
            jobId: job.id,
            jobType
          },
          'Job added to primary Redis queue'
        );

        return { jobId: job.id!, fallback: false };
      } catch (error) {
        this.logger.warn(
          {
            jobType,
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          'Primary queue failed, using fallback'
        );
      }
    }

    // Use fallback queue
    const fallbackJobId = await this.memoryFallback.addJob(jobType, jobData, options);
    this.healthStatus.metrics.fallbackJobs++;
    this.updateHealthStatus({
      fallback: {
        active: true,
        type: 'memory',
        queuedJobs: this.healthStatus.fallback.queuedJobs + 1
      }
    });

    return { jobId: fallbackJobId, fallback: true };
  }

  /**
   * Get comprehensive system health status
   */
  public getHealthStatus(): HealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Get queue statistics with fallback info
   */
  public async getStats(): Promise<QueueStats & { fallbackStats?: QueueStats }> {
    let primaryStats: QueueStats = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0
    };

    if (this.primaryQueue && this.healthStatus.redis.status === 'connected') {
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          this.primaryQueue.getWaiting(),
          this.primaryQueue.getActive(),
          this.primaryQueue.getCompleted(),
          this.primaryQueue.getFailed(),
          this.primaryQueue.getDelayed()
        ]);

        primaryStats = {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
          paused: (await this.primaryQueue.isPaused()) ? 1 : 0
        };
      } catch (error) {
        this.logger.error({ error }, 'Failed to get primary queue stats');
      }
    }

    const fallbackStats = await this.memoryFallback.getStats();

    return {
      ...primaryStats,
      fallbackStats
    };
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 30000); // Check every 30 seconds

    this.logger.info('Health checks started (30s interval)');
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    const isRedisHealthy = await this.testRedisConnection();

    if (isRedisHealthy && this.healthStatus.fallback.active) {
      await this.attemptFallbackRecovery();
    }

    // Update overall system health
    let overallHealth = SystemHealth.DOWN;

    if (isRedisHealthy) {
      overallHealth = SystemHealth.HEALTHY;
    } else if (this.healthStatus.fallback.active) {
      overallHealth = SystemHealth.DEGRADED;
    }

    this.updateHealthStatus({ overall: overallHealth });
  }

  /**
   * Attempt to recover jobs from fallback when Redis is healthy
   */
  private async attemptFallbackRecovery(): Promise<void> {
    if (!this.primaryQueue || this.healthStatus.redis.status !== 'connected') {
      return;
    }

    const fallbackJobs = await this.memoryFallback.getJobs();

    if (fallbackJobs.length === 0) {
      this.updateHealthStatus({
        fallback: { active: false, type: null, queuedJobs: 0 }
      });
      return;
    }

    this.logger.info(
      {
        jobCount: fallbackJobs.length
      },
      'Attempting to recover jobs from fallback to Redis'
    );

    let recovered = 0;
    for (const fallbackJob of fallbackJobs) {
      try {
        await this.primaryQueue.add(
          fallbackJob.originalJobType,
          fallbackJob,
          { priority: 10 } // High priority for recovered jobs
        );
        recovered++;
      } catch (error) {
        this.logger.error(
          {
            fallbackJobId: fallbackJob.fallbackId,
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          'Failed to recover job from fallback'
        );
        break; // Stop recovery on first failure
      }
    }

    if (recovered > 0) {
      await this.memoryFallback.clear();
      this.logger.info(
        {
          recoveredJobs: recovered
        },
        'Successfully recovered jobs from fallback to Redis'
      );

      this.updateHealthStatus({
        fallback: { active: false, type: null, queuedJobs: 0 }
      });
    }
  }

  /**
   * Update health status
   */
  private updateHealthStatus(updates: Partial<HealthStatus>): void {
    this.healthStatus = {
      ...this.healthStatus,
      ...updates,
      redis: { ...this.healthStatus.redis, ...updates.redis },
      fallback: { ...this.healthStatus.fallback, ...updates.fallback },
      metrics: { ...this.healthStatus.metrics, ...updates.metrics }
    };
  }

  /**
   * Graceful shutdown
   */
  public async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }

    if (this.primaryQueue) {
      await this.primaryQueue.close();
    }

    await this.memoryFallback.clear();

    this.logger.info('Resilient Queue Manager shutdown complete');
  }
}
