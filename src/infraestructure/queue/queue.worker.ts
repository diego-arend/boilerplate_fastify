#!/usr/bin/env node
import dotenv from 'dotenv';
import { Worker, Job } from 'bullmq';
import { config } from '../../lib/validators/validateEnv.js';
import {
  JobType,
  type JobData,
  type JobResult,
  type WorkerConfig
} from './queue.types.js';

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

  constructor(queueName: string = 'main') {
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

    // Initialize job handlers
    this.handlers = new Map();
    this.setupHandlers();

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
    console.log(`🚀 Queue Worker started for queue: ${queueName}`);
    console.log(`📊 Configuration:`, {
      concurrency: this.config.concurrency,
      redis: `${appConfig.REDIS_HOST}:${appConfig.REDIS_PORT}`,
      database: appConfig.REDIS_DB
    });
  }

  /**
   * Process a job from the queue
   */
  private async processJob(job: Job): Promise<JobResult> {
    const startTime = Date.now();
    const jobType = job.name;
    
    console.log(`⚡ Processing job ${job.id} of type ${jobType}`);
    
    try {
      // Get handler for job type
      const handler = this.handlers.get(jobType);
      if (!handler) {
        throw new Error(`No handler found for job type: ${jobType}`);
      }

      // Validate job data
      this.validateJobData(job.data);

      // Process job with handler
      const result = await handler(job.data, job.id || 'unknown');
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Job ${job.id} completed successfully in ${processingTime}ms`);
      
      return {
        ...result,
        processedAt: Date.now(),
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`❌ Job ${job.id} failed:`, errorMessage);
      
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
   */
  private setupHandlers(): void {
    // Email sending handler
    this.handlers.set(JobType.EMAIL_SEND, async (data: any, jobId: string) => {
      console.log(`📧 Sending email to ${data.to}: ${data.subject}`);
      
      // Simulate email sending
      await this.delay(1000 + Math.random() * 2000);
      
      return {
        success: true,
        data: {
          messageId: `msg_${jobId}_${Date.now()}`,
          to: data.to,
          subject: data.subject,
          sentAt: new Date().toISOString()
        }
      };
    });

    // User notification handler
    this.handlers.set(JobType.USER_NOTIFICATION, async (data: any, jobId: string) => {
      console.log(`🔔 Sending notification to user ${data.userId}: ${data.title}`);
      
      // Simulate notification processing
      await this.delay(500 + Math.random() * 1000);
      
      return {
        success: true,
        data: {
          notificationId: `notif_${jobId}_${Date.now()}`,
          userId: data.userId,
          channels: data.channels || ['push'],
          sentAt: new Date().toISOString()
        }
      };
    });

    // Data export handler
    this.handlers.set(JobType.DATA_EXPORT, async (data: any, jobId: string) => {
      console.log(`📊 Exporting data for user ${data.userId} in ${data.format} format`);
      
      // Simulate data export processing
      await this.delay(2000 + Math.random() * 3000);
      
      const filePath = data.outputPath || `/tmp/export_${jobId}_${Date.now()}.${data.format}`;
      
      return {
        success: true,
        data: {
          exportId: `export_${jobId}_${Date.now()}`,
          filePath,
          format: data.format,
          recordCount: Math.floor(Math.random() * 10000),
          completedAt: new Date().toISOString()
        }
      };
    });

    // File processing handler
    this.handlers.set(JobType.FILE_PROCESS, async (data: any, jobId: string) => {
      console.log(`🎯 Processing file ${data.fileId} with operation: ${data.operation}`);
      
      // Simulate file processing
      await this.delay(3000 + Math.random() * 5000);
      
      return {
        success: true,
        data: {
          processId: `proc_${jobId}_${Date.now()}`,
          fileId: data.fileId,
          operation: data.operation,
          originalPath: data.filePath,
          processedPath: `${data.filePath}.processed`,
          completedAt: new Date().toISOString()
        }
      };
    });

    // Cache warming handler
    this.handlers.set(JobType.CACHE_WARM, async (data: any, jobId: string) => {
      console.log(`🔥 Warming cache for key: ${data.cacheKey}`);
      
      // Simulate cache warming
      await this.delay(500 + Math.random() * 1000);
      
      return {
        success: true,
        data: {
          cacheKey: data.cacheKey,
          dataSource: data.dataSource,
          ttl: data.ttl || 3600,
          warmedAt: new Date().toISOString()
        }
      };
    });

    // Cleanup handler
    this.handlers.set(JobType.CLEANUP, async (data: any, jobId: string) => {
      console.log(`🧹 Running cleanup task: ${data.target}`);
      
      // Simulate cleanup operation
      await this.delay(1000 + Math.random() * 2000);
      
      const itemsRemoved = Math.floor(Math.random() * 100);
      
      return {
        success: true,
        data: {
          target: data.target,
          itemsRemoved,
          olderThan: data.olderThan,
          completedAt: new Date().toISOString()
        }
      };
    });

    console.log(`📋 Registered ${this.handlers.size} job handlers:`, Array.from(this.handlers.keys()));
  }

  /**
   * Setup event listeners for the worker
   */
  private setupEventListeners(): void {
    // Worker events
    this.worker.on('ready', () => {
      console.log('🟢 Worker is ready to process jobs');
    });

    this.worker.on('error', (error) => {
      console.error('🔴 Worker error:', error);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`💥 Job ${job?.id} failed:`, err.message);
    });

    this.worker.on('completed', (job) => {
      console.log(`🎉 Job ${job.id} completed successfully`);
    });

    this.worker.on('stalled', (jobId) => {
      console.warn(`⚠️ Job ${jobId} stalled`);
    });

    this.worker.on('progress', (job, progress) => {
      console.log(`📈 Job ${job.id} progress: ${progress}%`);
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
    console.log(`📴 Received ${signal}, starting graceful shutdown...`);
    
    try {
      await this.worker.close();
      console.log('✅ Worker closed gracefully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Delay utility for simulating async operations
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
  try {
    const queueName = process.env.QUEUE_NAME || 'main';
    const worker = new QueueWorker(queueName);
    
    // Keep the process running
    console.log('🎯 Queue Worker is running. Press Ctrl+C to stop.');
    
  } catch (error) {
    console.error('💥 Failed to start Queue Worker:', error);
    process.exit(1);
  }
}

export { QueueWorker };