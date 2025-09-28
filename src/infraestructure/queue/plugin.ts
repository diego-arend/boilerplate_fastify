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
}

async function queuePlugin(fastify: FastifyInstance, options: QueuePluginOptions): Promise<void> {
  const logger = defaultLogger.child({ plugin: 'queue' });
  const enablePersistence = options.enablePersistence !== false; // Default to true

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

    // Initialize Queue Manager with QueueCache integration
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

    if (enablePersistence) {
      // Initialize Persistent Queue Manager
      const persistentQueueManager = new PersistentQueueManager(
        queueManager,
        options.batchSize || 50,
        logger
      );

      // Start batch processing
      await persistentQueueManager.startBatchProcessing(options.processingInterval || 5000);

      // Decorate Fastify instance with persistent queue manager
      fastify.decorate('persistentQueueManager', persistentQueueManager);
      fastify.decorate('queueManager', queueManager);
      fastify.decorate('queueCache', queueCache);

      // Add persistent job method
      fastify.decorate(
        'addPersistentJob',
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

      // Add direct queue method (for non-persistent jobs)
      fastify.decorate(
        'addJob',
        async (
          jobId: string,
          type: string,
          data: any,
          jobOptions?: {
            priority?: number;
            attempts?: number;
            delay?: number;
            scheduledFor?: Date;
          }
        ) => {
          return await queueManager.addJob(jobId, type, data, jobOptions);
        }
      );

      logger.info('Queue Plugin initialized successfully with persistence enabled');

      // Graceful shutdown for persistent queue
      fastify.addHook('onClose', async () => {
        logger.info('Shutting down Persistent Queue...');
        await persistentQueueManager.stopBatchProcessing();
        await queueManager.stop();
        await queueCache.disconnect();
      });
    } else {
      // Non-persistent mode (original behavior)
      fastify.decorate('queueManager', queueManager);
      fastify.decorate('queueCache', queueCache);

      fastify.decorate(
        'addJob',
        async (
          jobId: string,
          type: string,
          data: any,
          jobOptions?: {
            priority?: number;
            attempts?: number;
            delay?: number;
            scheduledFor?: Date;
          }
        ) => {
          return await queueManager.addJob(jobId, type, data, jobOptions);
        }
      );

      logger.info('Queue Plugin initialized successfully without persistence');

      // Graceful shutdown for regular queue
      fastify.addHook('onClose', async () => {
        logger.info('Shutting down Queue...');
        await queueManager.stop();
        await queueCache.disconnect();
      });
    }
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
