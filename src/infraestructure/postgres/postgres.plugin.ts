import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { createPostgresConnectionManagerFromEnv } from './postgresConnectionManager.factory.js';
import type { IPostgresConnectionManager } from './postgresConnectionManager.interface.js';

/**
 * PostgreSQL Plugin for Fastify
 * Manages PostgreSQL connection lifecycle and registers it as a decorator
 * Following MongoDB plugin patterns for consistency
 */
const postgresPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  const logger = app.log.child({ module: 'postgres-plugin' });

  logger.info('Initializing PostgreSQL plugin');

  // Check if PostgreSQL is configured
  const isConfigured =
    process.env.POSTGRES_HOST && process.env.POSTGRES_DATABASE && process.env.POSTGRES_USERNAME;

  if (!isConfigured) {
    logger.warn('PostgreSQL not configured - skipping initialization');
    logger.warn(
      'To enable PostgreSQL, set POSTGRES_HOST, POSTGRES_DATABASE, and POSTGRES_USERNAME environment variables'
    );
    return;
  }

  try {
    // Create PostgreSQL connection manager
    const postgresManager = createPostgresConnectionManagerFromEnv(app);

    // Connect to PostgreSQL
    await postgresManager.connect();

    logger.info('PostgreSQL connection established successfully');

    // Register as Fastify decorator
    app.decorate('postgres', postgresManager);

    // Add health check to verify connection
    const health = await postgresManager.getHealthInfo();
    logger.info(
      {
        host: health.host,
        port: health.port,
        database: health.database,
        version: health.version,
        poolSize: health.poolSize
      },
      'PostgreSQL health check passed'
    );

    // Graceful shutdown hook
    app.addHook('onClose', async _instance => {
      logger.info('Closing PostgreSQL connection...');
      try {
        await postgresManager.disconnect();
        logger.info('PostgreSQL connection closed successfully');
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error)
          },
          'Error closing PostgreSQL connection'
        );
        throw error;
      }
    });

    logger.info('PostgreSQL plugin initialized successfully');
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      'Failed to initialize PostgreSQL plugin'
    );
    throw error;
  }
};

// Export with fastify-plugin wrapper for proper encapsulation
export default fp(postgresPlugin, {
  name: 'postgres-plugin',
  dependencies: []
});

// Export types for declaration augmentation
export type { IPostgresConnectionManager };
