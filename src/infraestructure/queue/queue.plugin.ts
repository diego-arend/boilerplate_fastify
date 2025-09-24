/**
 * Fastify Queue Plugin
 * Provides access to the queue system in Fastify routes
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { getDefaultQueueManager, type QueueManager } from './index.js';
import type { config } from '../../lib/validators/validateEnv.js';

// Extend Fastify instance with queue
declare module 'fastify' {
  interface FastifyInstance {
    queueManager: QueueManager;
  }
}

interface QueuePluginOptions {
  config?: typeof config;
}

/**
 * Queue Plugin for Fastify
 * Initializes and provides access to the queue system
 */
const queuePlugin: FastifyPluginAsync<QueuePluginOptions> = async (
  fastify: FastifyInstance,
  options: QueuePluginOptions
) => {
  // Get configuration
  const appConfig = options.config || fastify.config;

  if (!appConfig) {
    throw new Error('Queue plugin requires configuration');
  }

  try {
    // Initialize queue manager using factory
    const queueManager = await getDefaultQueueManager(appConfig, fastify.log);

    // Decorate Fastify instance with queue manager
    fastify.decorate('queueManager', queueManager);

    // Graceful shutdown hook
    fastify.addHook('onClose', async () => {
      try {
        fastify.log.info('Queue manager cleanup on server shutdown');
        // Queue cleanup will be handled by connection managers
      } catch (error) {
        fastify.log.error(error, 'Error during queue cleanup');
      }
    });

    fastify.log.info('Queue plugin registered successfully');
  } catch (error) {
    fastify.log.error(error, 'Failed to initialize queue plugin');
    throw error;
  }
};

export default fp(queuePlugin, {
  name: 'queue',
  dependencies: ['mongodb', 'cache'] // Ensure queue loads after these plugins
});
