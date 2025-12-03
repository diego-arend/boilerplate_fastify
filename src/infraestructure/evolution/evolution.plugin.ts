/**
 * Evolution API Plugin for Fastify
 * Registers the Evolution API service as a Fastify decorator with connection management
 */

import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { EvolutionApiService } from './evolutionApi.service.js';
import { evolutionConnectionManager } from './connectionManager.js';
import { defaultLogger } from '../../lib/logger/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    evolutionApi: EvolutionApiService;
    evolutionConnectionManager: typeof evolutionConnectionManager;
  }
}

export type EvolutionApiPluginOptions = {
  enableConnectionMonitoring?: boolean;
} & FastifyPluginOptions;

async function evolutionApiPlugin(fastify: FastifyInstance, options: EvolutionApiPluginOptions) {
  const logger = defaultLogger.child({ context: 'evolution-api-plugin' });
  const { enableConnectionMonitoring = true } = options;

  try {
    // Initialize Evolution API service
    const evolutionService = new EvolutionApiService();

    // Decorate Fastify instance with Evolution API service
    fastify.decorate('evolutionApi', evolutionService);

    // Decorate Fastify instance with connection manager
    fastify.decorate('evolutionConnectionManager', evolutionConnectionManager);

    if (enableConnectionMonitoring) {
      // Start connection monitoring
      await evolutionConnectionManager.start();

      // Ensure graceful shutdown
      fastify.addHook('onClose', async () => {
        logger.info('Stopping Evolution API connection monitoring');
        evolutionConnectionManager.stop();
      });
    }

    logger.info('Evolution API plugin registered successfully');
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'Failed to register Evolution API plugin'
    );
    throw error;
  }
}

export default fp(evolutionApiPlugin, {
  name: 'evolution-api',
  dependencies: []
});
