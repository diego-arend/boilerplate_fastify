import type { FastifyInstance } from 'fastify';
import { PostgresConnectionManager } from './postgresConnectionManager.js';
import type { IPostgresConnectionManager } from './postgresConnectionManager.interface.js';
import type { PostgresConfig } from './postgres.types.js';
import { defaultLogger } from '../../lib/logger/index.js';

/**
 * Factory function to create PostgreSQL connection manager instance
 * Following DI pattern for better testability
 */
export function createPostgresConnectionManager(
  config: PostgresConfig
): IPostgresConnectionManager {
  const logger = defaultLogger.child({ module: 'postgres-connection' });
  return new PostgresConnectionManager(config, logger);
}

/**
 * Factory function to create PostgreSQL connection manager from Fastify instance
 * Extracts configuration from environment variables
 */
export function createPostgresConnectionManagerFromEnv(
  app: FastifyInstance
): IPostgresConnectionManager {
  const config: PostgresConfig = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DATABASE || 'boilerplate',
    username: process.env.POSTGRES_USERNAME || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    ssl: process.env.POSTGRES_SSL === 'true',
    synchronize: process.env.POSTGRES_SYNCHRONIZE === 'true',
    logging: process.env.POSTGRES_LOGGING === 'true'
  };

  // Add optional properties only if defined
  if (process.env.POSTGRES_POOL_MIN) {
    config.poolMin = parseInt(process.env.POSTGRES_POOL_MIN, 10);
  }
  if (process.env.POSTGRES_POOL_MAX) {
    config.poolMax = parseInt(process.env.POSTGRES_POOL_MAX, 10);
  }
  if (process.env.POSTGRES_CONNECTION_TIMEOUT) {
    config.connectionTimeout = parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT, 10);
  }
  if (process.env.POSTGRES_IDLE_TIMEOUT) {
    config.idleTimeout = parseInt(process.env.POSTGRES_IDLE_TIMEOUT, 10);
  }

  app.log.info(
    {
      host: config.host,
      port: config.port,
      database: config.database,
      ssl: config.ssl,
      poolMax: config.poolMax
    },
    'Creating PostgreSQL connection manager from environment'
  );

  return createPostgresConnectionManager(config);
}
