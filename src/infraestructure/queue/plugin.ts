/**
 * Queue Plugin for Fastify
 *
 * Queue implementation with BullMQ for job processing,
 * performance, reliability, and monitoring capabilities.
 *
 * Integrated with QueueCache for proper Redis connection management
 * and persistent job storage in MongoDB
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { createQueueManager, QueueManager } from './queue.js';
import { PersistentQueueManager } from './persistentQueueManager.js';
import { defaultLogger } from '../../lib/logger/index.js';
import { QUEUE_HANDLERS } from './handlers.js';
import { getQueueCache } from '../cache/cache.js';

interface QueuePluginOptions extends FastifyPluginOptions {
  queueName?: string;
  concurrency?: number;
  batchSize?: number;
  processingInterval?: number;
  enablePersistence?: boolean;
  workerMode?: boolean; // 🆕 Flag para modo worker
}

async function queuePlugin(fastify: FastifyInstance, options: QueuePluginOptions): Promise<void> {
  const logger = defaultLogger.child({ plugin: 'queue' });
  const enablePersistence = options.enablePersistence !== false; // Default to true
  const workerMode = options.workerMode || process.env.WORKER_MODE === 'true'; // 🆕 Detectar modo worker

  try {
    // Initialize QueueCache first
    const queueCache = getQueueCache();

    // Ensure QueueCache is ready before creating QueueManager
    const isReady = await queueCache.isReadyForBullMQ();
    if (!isReady) {
      logger.warn('QueueCache not ready, attempting to connect...');
      await queueCache.connect();

      const retryReady = await queueCache.isReadyForBullMQ();
      if (!retryReady) {
        throw new Error('QueueCache failed to initialize properly');
      }
    }

    logger.info('QueueCache initialized and ready for BullMQ integration');

    if (workerMode) {
      // 🆕 MODO WORKER: Apenas processar jobs, não inicializar persistent manager
      logger.info('Running in WORKER MODE - only processing jobs');

      const queueManager = await createQueueManager(
        options.queueName || 'app-queue',
        options.concurrency || 5,
        logger
      );

      // Register handlers from handlers.ts
      Object.entries(QUEUE_HANDLERS).forEach(([jobType, handler]) => {
        queueManager.registerHandler(jobType, async (data: any) => {
          return await handler(data, logger);
        });
      });

      // Decorate apenas com queueManager
      fastify.decorate('queueManager', queueManager);
      fastify.decorate('queueCache', queueCache);

      logger.info('Queue Plugin initialized in WORKER MODE');

      // Graceful shutdown para worker
      fastify.addHook('onClose', async () => {
        logger.info('Shutting down Worker Queue...');
        await queueManager.stop();
        await queueCache.disconnect();
      });

      return; // 🆕 Early return para worker mode
    }

    // 🔄 MODO API: Apenas publisher (sem worker/processamento)
    logger.info('Running in API MODE - publisher-only, no job processing');

    // Create only Queue instance for publishing (no Worker)
    const { Queue } = await import('bullmq');
    const queueConnection = await queueCache.createBullMQClient();

    const publisherQueue = new Queue(options.queueName || 'app-queue', {
      connection: queueConnection
    });

    // Initialize Persistent Queue Manager apenas para publishing
    const persistentQueueManager = new PersistentQueueManager(
      null, // 🔄 Sem QueueManager no modo API (só publisher)
      options.batchSize || 50,
      logger
    );

    // Create simplified queueManager for API mode (publishing only)
    const apiQueueManager = {
      addJob: async (jobId: string, type: string, data: any, options?: any) => {
        logger.info(`Publishing job to queue: ${jobId} (type: ${type})`);
        await publisherQueue.add(type, data, {
          jobId,
          attempts: options?.attempts || 3,
          priority: options?.priority || 0,
          delay: options?.delay || 0
        });
        return jobId;
      },
      getStats: async () => {
        const waiting = await publisherQueue.getWaiting();
        const active = await publisherQueue.getActive();
        const completed = await publisherQueue.getCompleted();
        const failed = await publisherQueue.getFailed();
        return {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length
        };
      }
    };

    // Decorate Fastify instance with API-only components
    fastify.decorate('queueManager', apiQueueManager as any); // 🆕 Simplified for API mode
    fastify.decorate('persistentQueueManager', persistentQueueManager);
    fastify.decorate('queueCache', queueCache);

    // Add job method (unified for API mode)
    fastify.decorate(
      'addJob',
      async (
        type: string,
        data: any,
        jobOptions?: {
          priority?: number;
          attempts?: number;
          delay?: number;
          scheduledFor?: Date;
        }
      ) => {
        return await persistentQueueManager.addJob(type, data, jobOptions);
      }
    );

    logger.info('Queue Plugin initialized in API MODE (publisher-only)');

    // Graceful shutdown for API mode
    fastify.addHook('onClose', async () => {
      logger.info('Shutting down API Queue...');
      await publisherQueue.close(); // 🔄 Fechar apenas a queue de publishing
      await persistentQueueManager.stopBatchProcessing();
      await queueCache.disconnect();
    });
  } catch (error) {
    logger.error(`Failed to initialize Queue Plugin: ${error}`);
    throw error;
  }
}

export default fp(queuePlugin, {
  name: 'queue'
});

/**
 * Generate unique job ID
 */
export function generateJobId(type: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  // Replace ':' with '-' to match JobIdSchema validation
  const cleanType = type.replace(/:/g, '-');
  return `${cleanType}-${timestamp}-${random}`;
}

export const options = {
  name: 'queue'
};
