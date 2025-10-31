/**
 * PostgreSQL Infrastructure Module
 * Exports all public interfaces, types, and factories for PostgreSQL integration
 */

// Plugin
export { default as postgresPlugin } from './postgres.plugin.js';

// Types and Interfaces
export type {
  PostgresConfig,
  PostgresConnectionOptions,
  PostgresHealthInfo,
  PostgresQueryResult
} from './postgres.types.js';
export type { IPostgresConnectionManager } from './postgresConnectionManager.interface.js';

// Connection Manager
export { PostgresConnectionManager } from './postgresConnectionManager.js';

// Factories
export {
  createPostgresConnectionManager,
  createPostgresConnectionManagerFromEnv
} from './postgresConnectionManager.factory.js';
