/**
 * Standalone Worker I  private connectionManager!: IMongoConnectionManager;
  private queueCache!: QueueCache;
  private queueManager!: PersistentQueueManager;
  private jobBatchRepository!: JobBatchRepository;mentation
 *
 * Worker independente que processa jobs usando os módulos existentes:
 * - MongoConnectionManagerFactory para MongoDB
 * - QueueCache para Redis/BullMQ
 * - QUEUE_HANDLERS para processamento
 */

import { MongoConnectionManagerFactory } from '../mongo/index.js';
import { getQueueCache, type QueueCache } from '../cache/index.js';
import { JOB_HANDLERS, type JobHandler } from '../queue/jobs/index.js';
import { JobBatchRepository, type JobBatch } from '../../entities/job/index.js';
import { type IJob } from '../../entities/job/index.js';
import { defaultLogger } from '../../lib/logger/index.js';
import type { Logger } from 'pino';
import type { IMongoConnectionManager } from '../mongo/index.js';

export interface WorkerConfig {
  queueName: string;
  concurrency: number;
  batchSize: number;
  processingInterval: number;
}

export class StandaloneWorker {
  private mongoConnection!: IMongoConnectionManager;
  private queueCache!: QueueCache;
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

      this.logger.info('Worker initialized successfully');

      // Iniciar processamento de jobs
      this.startBatchProcessing();
    } catch (error) {
      this.logger.error(
        `Worker initialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Iniciar processamento de batches do MongoDB
   */
  private async startBatchProcessing(): Promise<void> {
    if (this.processingInterval) {
      this.logger.warn('Batch processing already started');
      return;
    }

    this.logger.info(`Starting batch processing with ${this.config.batchSize} jobs per batch`);

    this.processingInterval = setInterval(async () => {
      if (this.isShuttingDown) return;

      try {
        await this.processBatch();
      } catch (error) {
        this.logger.error(`Batch processing error: ${error}`);
      }
    }, this.config.processingInterval);
  }

  /**
   * Processar próximo batch de jobs do MongoDB
   */
  private async processBatch(): Promise<void> {
    try {
      // Carregar próximo batch do MongoDB
      const batch = await this.jobRepository.loadNextBatch(this.config.batchSize);
      if (!batch || batch.jobs.length === 0) {
        return; // Sem jobs para processar
      }

      this.logger.info(`Processing batch: ${batch.batchId} with ${batch.jobs.length} jobs`);

      // Processar cada job no batch via BullMQ
      const processingPromises = batch.jobs.map(job => this.processJob(job));
      await Promise.allSettled(processingPromises);

      this.logger.info(`Completed batch: ${batch.batchId}`);
    } catch (error) {
      this.logger.error(`Failed to process batch: ${error}`);
    }
  }

  /**
   * Processar job individual diretamente
   */
  private async processJob(job: IJob): Promise<void> {
    try {
      // Obter handler para o tipo de job
      const handler = JOB_HANDLERS[job.type] as JobHandler;
      if (!handler) {
        throw new Error(`No handler found for job type: ${job.type}`);
      }

      // Processar job diretamente
      await handler(job.data, job.jobId, this.logger, { attempts: job.maxAttempts || 3 });

      // Marcar job como concluído no MongoDB
      await this.jobRepository.markJobAsCompleted(job.jobId);

      this.logger.info(`Job completed: ${job.jobId} (type: ${job.type})`);
    } catch (error) {
      this.logger.error(
        `Job failed: ${job.jobId} - ${error instanceof Error ? error.message : String(error)}`
      );

      // Marcar job como falhado no MongoDB
      await this.jobRepository.markJobAsFailed(
        job.jobId,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Parar worker gracefully
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping Standalone Worker...');
    this.isShuttingDown = true;

    // Parar processamento de batches
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Desconectar QueueCache
    if (this.queueCache) {
      // QueueCache não tem método disconnect, usar método interno do Redis
      // await this.queueCache.disconnect();
    }

    // Desconectar MongoDB
    if (this.mongoConnection) {
      await this.mongoConnection.disconnect();
    }

    this.logger.info('Standalone Worker stopped successfully');
  }

  /**
   * Obter estatísticas do worker
   */
  async getStats(): Promise<any> {
    const jobStats = await this.jobRepository.getBatchStats();

    return {
      worker: {
        config: this.config,
        isRunning: !this.isShuttingDown,
        batchProcessing: !!this.processingInterval
      },
      jobs: jobStats,
      connections: {
        mongo: this.mongoConnection?.isConnected() || false,
        redis: true // QueueCache não tem método isConnected público
      }
    };
  }

  /**
   * Health check para container
   */
  async healthCheck(): Promise<boolean> {
    try {
      const mongoConnected = this.mongoConnection?.isConnected() || false;
      const redisConnected = true; // QueueCache não tem método isConnected público
      const workerRunning = !this.isShuttingDown;

      return mongoConnected && redisConnected && workerRunning;
    } catch (error) {
      this.logger.error(`Health check failed: ${error}`);
      return false;
    }
  }
}
