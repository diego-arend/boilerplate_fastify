/**
 * PostgreSQL Types and Configurations
 *
 * Type definitions for PostgreSQL connection management
 */

/**
 * PostgreSQL connection configuration
 */
export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  poolMin?: number;
  poolMax?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
  logging?: boolean;
  synchronize?: boolean; // Only for development
}

/**
 * PostgreSQL connection options for TypeORM DataSource
 */
export interface PostgresConnectionOptions extends PostgresConfig {
  type: 'postgres';
  entities?: any[];
  migrations?: any[];
  subscribers?: any[];
}

/**
 * PostgreSQL health information
 */
export interface PostgresHealthInfo {
  isConnected: boolean;
  host: string;
  port: number;
  database: string;
  poolSize?: number;
  activeConnections?: number;
  idleConnections?: number;
  version?: string;
}

/**
 * PostgreSQL query result type
 */
export interface PostgresQueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
}
