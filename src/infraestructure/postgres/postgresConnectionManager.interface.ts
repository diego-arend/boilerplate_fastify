/**
 * Interface for PostgreSQL Connection Manager
 *
 * Defines the contract for managing PostgreSQL connections with dependency injection
 */

import type { DataSource, QueryRunner } from 'typeorm';
import type { PostgresHealthInfo, PostgresQueryResult } from './postgres.types.js';

export interface IPostgresConnectionManager {
  /**
   * Connect to PostgreSQL
   */
  connect(): Promise<void>;

  /**
   * Disconnect from PostgreSQL
   */
  disconnect(): Promise<void>;

  /**
   * Get the TypeORM DataSource instance
   */
  getDataSource(): DataSource;

  /**
   * Check if currently connected
   */
  isConnected(): boolean;

  /**
   * Get connection health information
   */
  getHealthInfo(): Promise<PostgresHealthInfo>;

  /**
   * Execute a raw SQL query
   */
  runQuery<T = any>(query: string, parameters?: any[]): Promise<PostgresQueryResult<T>>;

  /**
   * Create a query runner for manual transaction control
   */
  createQueryRunner(): QueryRunner;
}
