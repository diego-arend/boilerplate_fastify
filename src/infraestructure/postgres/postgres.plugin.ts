import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { createPostgresConnectionManagerFromEnv } from './postgresConnectionManager.factory.js';
import type { IPostgresConnectionManager } from './postgresConnectionManager.interface.js';
import { AppDataSource, initializeDataSource } from './data-source.js';
import { config } from '../../lib/validators/validateEnv.js';

/**
 * PostgreSQL Plugin for Fastify
 * Manages PostgreSQL connection lifecycle with TypeORM DataSource
 * Handles migrations based on environment configuration
 *
 * Migration Control:
 * - POSTGRES_RUN_MIGRATIONS=true: Enable migration execution
 * - POSTGRES_MIGRATION_AUTO=true: Auto-run pending migrations on startup
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
    // Create PostgreSQL connection manager (pg driver)
    const postgresManager = createPostgresConnectionManagerFromEnv(app);

    // Connect to PostgreSQL
    await postgresManager.connect();

    logger.info('PostgreSQL connection established successfully');

    // Register as Fastify decorator
    app.decorate('postgres', postgresManager);

    // Initialize TypeORM DataSource
    logger.info('Initializing TypeORM DataSource...');
    await initializeDataSource();
    logger.info('TypeORM DataSource initialized successfully');

    // ==========================================
    // MIGRATION HANDLING
    // ==========================================

    const runMigrations = config.POSTGRES_RUN_MIGRATIONS;
    const autoMigrations = config.POSTGRES_MIGRATION_AUTO;

    if (runMigrations) {
      logger.info(
        {
          auto: autoMigrations
        },
        'Migration execution enabled'
      );

      if (autoMigrations) {
        logger.info('Running pending migrations automatically...');
        const pendingMigrations = await AppDataSource.showMigrations();

        if (pendingMigrations) {
          const executedMigrations = await AppDataSource.runMigrations({
            transaction: 'all' // Run all migrations in a single transaction
          });

          logger.info(
            {
              count: executedMigrations.length,
              migrations: executedMigrations.map(m => m.name)
            },
            'Migrations executed successfully'
          );
        } else {
          logger.info('No pending migrations to run');
        }
      } else {
        // Check for pending migrations but don't run automatically
        const pendingMigrations = await AppDataSource.showMigrations();
        if (pendingMigrations) {
          logger.warn('Pending migrations detected! Run manually with: pnpm migration:run');
        } else {
          logger.info('Database schema is up to date');
        }
      }
    } else {
      logger.info('Migration execution disabled (POSTGRES_RUN_MIGRATIONS=false)');
    }

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
      logger.info('Closing PostgreSQL connections...');
      try {
        // Close TypeORM DataSource
        if (AppDataSource.isInitialized) {
          await AppDataSource.destroy();
          logger.info('TypeORM DataSource closed');
        }

        // Close pg connection manager
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
