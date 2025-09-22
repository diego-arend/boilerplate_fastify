/**
 * Dead Letter Queue Manager
 * Handles jobs that have exhausted all retry attempts
 * Provides recovery and monitoring capabilities for failed jobs
 */

import { Queue, Job } from 'bullmq';
import type { JobData, JobResult, JobType } from './queue.types.js';
import type { FastifyBaseLogger } from 'fastify';

export interface DLQJobData {
  // Original job data fields
  userId?: string;
  timestamp: number;
  metadata?: Record<string, any>;
  // DLQ specific fields
  originalJobId: string;
  originalJobType: JobType;
  finalError: string;
  attemptHistory: Array<{
    attemptNumber: number;
    error: string;
    timestamp: number;
  }>;
  firstFailedAt: number;
  lastFailedAt: number;
  totalAttempts: number;
}

export interface DLQStats {
  total: number;
  byJobType: Record<string, number>;
  byErrorType: Record<string, number>;
  oldestJob: {
    id?: string;
    failedAt?: number;
    daysSinceFailed?: number;
  };
}

export interface DLQRecoveryOptions {
  maxRetries?: number;
  resetAttempts?: boolean;
  modifyData?: (data: JobData) => JobData;
}

/**
 * Dead Letter Queue Manager class
 * Manages jobs that have permanently failed after exhausting all retries
 */
export class DeadLetterQueueManager {
  private dlqQueue: Queue;
  private sourceQueue: Queue;
  private logger: FastifyBaseLogger;
  private initialized: boolean = false;

  constructor(
    sourceQueue: Queue,
    logger: FastifyBaseLogger,
    dlqName: string = 'dead-letter'
  ) {
    this.sourceQueue = sourceQueue;
    this.logger = logger.child({ module: 'dlq-manager' });
    
    // Create dedicated DLQ queue
    this.dlqQueue = new Queue(dlqName, {
      connection: sourceQueue.opts.connection,
      defaultJobOptions: {
        removeOnComplete: 1000, // Keep more DLQ jobs for analysis
        removeOnFail: 100,
        attempts: 1, // DLQ jobs shouldn't retry
      }
    });

    this.setupEventListeners();
    this.initialized = true;

    this.logger.info({
      dlqName,
      sourceQueueName: sourceQueue.name
    }, 'Dead Letter Queue Manager initialized');
  }

  /**
   * Setup event listeners to automatically handle failed jobs
   */
  private setupEventListeners(): void {
    // Listen for jobs that have exhausted all retries
    // Note: Using any type for BullMQ event compatibility
    (this.sourceQueue as any).on('failed', async (job: Job | undefined, err: Error) => {
      if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
        await this.moveJobToDLQ(job, err);
      }
    });

    this.logger.info('DLQ event listeners configured');
  }

  /**
   * Move a failed job to Dead Letter Queue
   */
  private async moveJobToDLQ(job: Job, finalError: Error): Promise<void> {
    try {
      const dlqData: DLQJobData = {
        ...job.data,
        originalJobId: job.id!,
        originalJobType: job.name as JobType,
        finalError: finalError.message,
        attemptHistory: this.extractAttemptHistory(job, finalError),
        firstFailedAt: job.processedOn || Date.now(),
        lastFailedAt: Date.now(),
        totalAttempts: job.attemptsMade,
        timestamp: Date.now() // Override timestamp for DLQ
      };

      // Add to DLQ with high priority for monitoring
      const dlqJob = await this.dlqQueue.add(
        `dlq:${job.name}`,
        dlqData,
        {
          priority: 10, // High priority for monitoring
          jobId: `dlq:${job.id}:${Date.now()}`,
        }
      );

      this.logger.warn({
        originalJobId: job.id,
        originalJobType: job.name,
        dlqJobId: dlqJob.id,
        finalError: finalError.message,
        totalAttempts: job.attemptsMade
      }, 'Job moved to Dead Letter Queue');

      // Optional: Send alert for critical job types
      await this.sendDLQAlert(dlqData);

    } catch (error) {
      this.logger.error({
        jobId: job.id,
        jobType: job.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to move job to DLQ');
    }
  }

  /**
   * Extract attempt history from job for detailed analysis
   */
  private extractAttemptHistory(job: Job, finalError: Error): DLQJobData['attemptHistory'] {
    const history: DLQJobData['attemptHistory'] = [];
    
    // Add all previous attempts if available
    for (let i = 1; i <= job.attemptsMade; i++) {
      history.push({
        attemptNumber: i,
        error: i === job.attemptsMade ? finalError.message : 'Previous attempt failed',
        timestamp: job.processedOn || Date.now()
      });
    }

    return history;
  }

  /**
   * Send alert for jobs moved to DLQ
   */
  private async sendDLQAlert(dlqData: DLQJobData): Promise<void> {
    // Critical job types that require immediate attention
    const criticalJobTypes: JobType[] = ['email:send', 'user:notification'];
    
    if (criticalJobTypes.includes(dlqData.originalJobType)) {
      this.logger.error({
        jobType: dlqData.originalJobType,
        jobId: dlqData.originalJobId,
        error: dlqData.finalError,
        userId: dlqData.userId
      }, '🚨 CRITICAL JOB MOVED TO DLQ - IMMEDIATE ATTENTION REQUIRED');

      // Here you could integrate with alerting systems:
      // - Slack notifications
      // - PagerDuty alerts
      // - Email notifications to DevOps team
    }
  }

  /**
   * Get DLQ statistics
   */
  public async getStats(): Promise<DLQStats> {
    try {
      const dlqJobs = await this.dlqQueue.getJobs(['waiting', 'completed'], 0, -1);
      
      const stats: DLQStats = {
        total: dlqJobs.length,
        byJobType: {},
        byErrorType: {},
        oldestJob: {}
      };

      let oldestJobTimestamp = Date.now();

      dlqJobs.forEach(job => {
        const dlqData = job.data as DLQJobData;
        
        // Count by job type
        const jobType = dlqData.originalJobType;
        stats.byJobType[jobType] = (stats.byJobType[jobType] || 0) + 1;
        
        // Count by error type (simplified)
        const errorType = this.categorizeError(dlqData.finalError);
        stats.byErrorType[errorType] = (stats.byErrorType[errorType] || 0) + 1;
        
        // Track oldest job
        if (dlqData.lastFailedAt < oldestJobTimestamp && job.id) {
          oldestJobTimestamp = dlqData.lastFailedAt;
          stats.oldestJob = {
            id: job.id,
            failedAt: dlqData.lastFailedAt,
            daysSinceFailed: Math.floor((Date.now() - dlqData.lastFailedAt) / (24 * 60 * 60 * 1000))
          };
        }
      });

      return stats;

    } catch (error) {
      this.logger.error({ error }, 'Failed to get DLQ stats');
      return {
        total: 0,
        byJobType: {},
        byErrorType: {},
        oldestJob: {}
      };
    }
  }

  /**
   * Categorize error for statistics
   */
  private categorizeError(error: string): string {
    if (error.includes('timeout') || error.includes('TIMEOUT')) return 'timeout';
    if (error.includes('connection') || error.includes('CONNECTION')) return 'connection';
    if (error.includes('validation') || error.includes('invalid')) return 'validation';
    if (error.includes('permission') || error.includes('unauthorized')) return 'permission';
    if (error.includes('rate limit') || error.includes('throttled')) return 'rate_limit';
    return 'other';
  }

  /**
   * Reprocess job from DLQ back to main queue
   */
  public async reprocessJob(
    dlqJobId: string, 
    options: DLQRecoveryOptions = {}
  ): Promise<{ success: boolean; newJobId?: string; error?: string }> {
    try {
      const dlqJob = await this.dlqQueue.getJob(dlqJobId);
      if (!dlqJob) {
        return { success: false, error: 'DLQ job not found' };
      }

      const dlqData = dlqJob.data as DLQJobData;
      
      // Prepare job data for reprocessing - reconstruct original job data
      const originalJobData = this.reconstructOriginalJobData(dlqData);
      
      // Apply data modifications if provided
      const jobData = options.modifyData ? options.modifyData(originalJobData) : originalJobData;

      // Add back to main queue with fresh attempts
      const newJob = await this.sourceQueue.add(
        dlqData.originalJobType,
        jobData,
        {
          attempts: options.maxRetries || 3,
          priority: 5, // Normal priority for recovery
          jobId: `recovery:${dlqJobId}:${Date.now()}`
        }
      );

      // Remove from DLQ
      await dlqJob.remove();

      this.logger.info({
        dlqJobId,
        newJobId: newJob.id,
        originalJobType: dlqData.originalJobType
      }, 'Job successfully reprocessed from DLQ');

      return { 
        success: true, 
        ...(newJob.id && { newJobId: newJob.id })
      };

    } catch (error) {
      this.logger.error({
        dlqJobId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to reprocess job from DLQ');
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Reconstruct original job data from DLQ data
   * Note: Returns placeholder data structure - should be populated with actual job data during recovery
   */
  private reconstructOriginalJobData(dlqData: DLQJobData): JobData {
    // Create base job data structure
    const baseData = {
      userId: dlqData.userId,
      timestamp: Date.now(), // Use current timestamp for reprocessing
      metadata: dlqData.metadata
    };

    // Return appropriate job data based on job type - using unknown cast for TypeScript compatibility
    switch (dlqData.originalJobType) {
      case 'email:send':
        return {
          ...baseData,
          to: 'placeholder@example.com', // Should be replaced with actual data
          subject: 'Recovery Processing',
          body: 'Job recovered from DLQ'
        } as unknown as JobData;
      
      case 'user:notification':
        return {
          ...baseData,
          userId: dlqData.userId || 'unknown',
          title: 'Recovery Processing',
          message: 'Job recovered from DLQ',
          type: 'info' as const
        } as unknown as JobData;
      
      case 'data:export':
        return {
          ...baseData,
          userId: dlqData.userId || 'unknown',
          format: 'csv' as const
        } as unknown as JobData;
      
      case 'file:process':
        return {
          ...baseData,
          fileId: 'recovery-placeholder',
          filePath: '/tmp/recovery',
          operation: 'analyze' as const
        } as unknown as JobData;
      
      case 'cache:warm':
        return {
          ...baseData,
          cacheKey: 'recovery-key',
          dataSource: 'recovery-source'
        } as unknown as JobData;
      
      case 'cleanup':
        return {
          ...baseData,
          target: 'temp_files' as const
        } as unknown as JobData;
      
      default:
        // Fallback for unknown job types
        return baseData as unknown as JobData;
    }
  }

  /**
   * Reprocess multiple jobs by job type
   */
  public async reprocessJobsByType(
    jobType: JobType, 
    options: DLQRecoveryOptions = {}
  ): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      const dlqJobs = await this.dlqQueue.getJobs(['waiting', 'completed'], 0, -1);
      const jobsToReprocess = dlqJobs.filter(job => {
        const dlqData = job.data as DLQJobData;
        return dlqData.originalJobType === jobType;
      });

      this.logger.info({
        jobType,
        totalJobs: jobsToReprocess.length
      }, 'Starting batch reprocessing from DLQ');

      for (const job of jobsToReprocess) {
        const result = await this.reprocessJob(job.id!, options);
        if (result.success) {
          processed++;
        } else {
          errors++;
          this.logger.warn({
            jobId: job.id,
            error: result.error
          }, 'Failed to reprocess job in batch');
        }
      }

      this.logger.info({
        jobType,
        processed,
        errors
      }, 'Batch reprocessing completed');

      return { processed, errors };

    } catch (error) {
      this.logger.error({
        jobType,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed batch reprocessing from DLQ');
      
      return { processed, errors: errors + 1 };
    }
  }

  /**
   * Clean old jobs from DLQ
   */
  public async cleanOldJobs(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      const cleaned = await this.dlqQueue.clean(cutoffTime, 0);
      
      this.logger.info({
        olderThanDays,
        cleanedCount: cleaned.length
      }, 'Cleaned old jobs from DLQ');

      return cleaned.length;

    } catch (error) {
      this.logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        olderThanDays
      }, 'Failed to clean old DLQ jobs');
      
      return 0;
    }
  }

  /**
   * Get DLQ queue instance for advanced operations
   */
  public getQueue(): Queue {
    return this.dlqQueue;
  }

  /**
   * Check if DLQ manager is ready
   */
  public isReady(): boolean {
    return this.initialized;
  }

  /**
   * Close DLQ connections
   */
  public async close(): Promise<void> {
    try {
      await this.dlqQueue.close();
      this.initialized = false;
      this.logger.info('Dead Letter Queue Manager closed');
    } catch (error) {
      this.logger.error({ error }, 'Error closing DLQ Manager');
    }
  }
}