/**
 * Queue Plugin for Fastify
 *
 * Queue implementation with BullMQ for job processing,
 * performance, reliability, and monitoring capabilities.
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { createQueueManager, QueueManager } from './queue.js';
import { defaultLogger } from '../../lib/logger/index.js';
import { QUEUE_HANDLERS } from './handlers.js';

interface QueuePluginOptions extends FastifyPluginOptions {
  queueName?: string;
  concurrency?: number;
}

async function queuePlugin(fastify: FastifyInstance, options: QueuePluginOptions): Promise<void> {
  const logger = defaultLogger.child({ plugin: 'queue' });

  try {
    // Initialize Queue Manager
    const queueManager = await createQueueManager(
      options.queueName || 'default-queue',
      options.concurrency || 5,
      logger
    );

    // Register handlers from handlers.ts
    Object.entries(QUEUE_HANDLERS).forEach(([jobType, handler]) => {
      queueManager.registerHandler(jobType, async (data: any) => {
        return await handler(data, logger);
      });
    });

    // Decorate Fastify instance
    fastify.decorate('queueManager', queueManager);

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

    logger.info('Queue Plugin initialized successfully');

    // Graceful shutdown
    fastify.addHook('onClose', async () => {
      logger.info('Shutting down Queue...');
      await queueManager.stop();
    });
  } catch (error) {
    logger.error('Failed to initialize Queue Plugin');
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
