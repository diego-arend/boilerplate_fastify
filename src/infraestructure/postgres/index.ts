/**
 * PostgreSQL Infrastructure Module
 * Exports all public interfaces, types, and factories for PostgreSQL integration
 */

// Plugin
export { default as postgresPlugin } from './postgres.plugin';

// TypeORM DataSource
export { AppDataSource, initializeDataSource } from './data-source';

// Types and Interfaces
export type {
  PostgresConfig,
  PostgresConnectionOptions,
  PostgresHealthInfo,
  PostgresQueryResult
} from './postgres.types';
export type { IPostgresConnectionManager } from './postgresConnectionManager.interface';

// Connection Manager
export { PostgresConnectionManager } from './postgresConnectionManager';

// Factories
export {
  createPostgresConnectionManager,
  createPostgresConnectionManagerFromEnv
} from './postgresConnectionManager.factory';
