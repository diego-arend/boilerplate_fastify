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

    // 🔄 MODO API: Apenas publisher (código existente modificado)
    logger.info('Running in API MODE - only publishing jobs');

    // Initialize Persistent Queue Manager APENAS para publishing
    const persistentQueueManager = new PersistentQueueManager(
      null, // 🆕 Sem QueueManager no modo API
      options.batchSize || 50,
      logger
    );

    // Decorate Fastify instance apenas com publisher
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
  return `${type}-${timestamp}-${random}`;
}

export const options = {
  name: 'queue'
};
