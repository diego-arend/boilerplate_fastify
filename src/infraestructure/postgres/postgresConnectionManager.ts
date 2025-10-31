/**
 * PostgreSQL Connection Manager
 *
 * Manages PostgreSQL connections using TypeORM DataSource with dependency injection support
 */

import { DataSource } from 'typeorm';
import type { QueryRunner } from 'typeorm';
import type { IPostgresConnectionManager } from './postgresConnectionManager.interface';
import type { PostgresConfig, PostgresHealthInfo, PostgresQueryResult } from './postgres.types';
import type { Logger } from 'pino';

export class PostgresConnectionManager implements IPostgresConnectionManager {
  private dataSource!: DataSource;
  private isConnectedFlag: boolean = false;

  constructor(
    private config: PostgresConfig,
    private logger: Logger
  ) {
    this.initializeDataSource();
  }

  /**
   * Initialize TypeORM DataSource
   */
  private initializeDataSource(): void {
    this.dataSource = new DataSource({
      type: 'postgres',
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      username: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl ?? false,
      synchronize: this.config.synchronize ?? false, // Never true in production
      logging: this.config.logging ?? process.env.NODE_ENV === 'development',
      entities: [],
      migrations: [],
      subscribers: [],
      // Connection pool configuration
      extra: {
        min: this.config.poolMin ?? 2,
        max: this.config.poolMax ?? 10,
        connectionTimeoutMillis: this.config.connectionTimeout ?? 5000,
        idleTimeoutMillis: this.config.idleTimeout ?? 30000
      }
    });
  }

  /**
   * Connect to PostgreSQL
   */
  public async connect(): Promise<void> {
    if (this.isConnectedFlag) {
      this.logger.info('PostgreSQL connection already established');
      return;
    }

    const connectionInfo = {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      username: this.config.username,
      environment: process.env.NODE_ENV || 'development'
    };

    this.logger.info(connectionInfo, 'Attempting to connect to PostgreSQL');

    try {
      await this.dataSource.initialize();
      this.isConnectedFlag = true;

      this.logger.info(
        {
          ...connectionInfo,
          driver: this.dataSource.driver.options.type,
          poolSize: this.config.poolMax
        },
        'Successfully connected to PostgreSQL'
      );
    } catch (error) {
      this.logger.error(
        {
          ...connectionInfo,
          error: error instanceof Error ? error.message : String(error)
        },
        'Failed to connect to PostgreSQL'
      );
      throw error;
    }
  }

  /**
   * Disconnect from PostgreSQL
   */
  public async disconnect(): Promise<void> {
    if (!this.isConnectedFlag) {
      this.logger.info('PostgreSQL already disconnected');
      return;
    }

    this.logger.info('Attempting to disconnect from PostgreSQL');

    try {
      await this.dataSource.destroy();
      this.isConnectedFlag = false;
      this.logger.info('Successfully disconnected from PostgreSQL');
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error)
        },
        'Error disconnecting from PostgreSQL'
      );
      throw error;
    }
  }

  /**
   * Get the TypeORM DataSource instance
   */
  public getDataSource(): DataSource {
    if (!this.isConnectedFlag) {
      throw new Error('PostgreSQL is not connected. Call connect() first.');
    }
    return this.dataSource;
  }

  /**
   * Check if currently connected
   */
  public isConnected(): boolean {
    return this.isConnectedFlag && this.dataSource.isInitialized;
  }

  /**
   * Get connection health information
   */
  public async getHealthInfo(): Promise<PostgresHealthInfo> {
    const baseInfo: PostgresHealthInfo = {
      isConnected: this.isConnected(),
      host: this.config.host,
      port: this.config.port,
      database: this.config.database
    };

    if (!this.isConnected()) {
      return baseInfo;
    }

    try {
      // Get PostgreSQL version
      const versionResult = await this.runQuery<{ version: string }>('SELECT version()');
      const version = versionResult.rows[0]?.version || 'unknown';

      // Get pool statistics
      const poolStatsResult = await this.runQuery<{
        total: number;
        active: number;
        idle: number;
      }>(
        `
        SELECT 
          count(*) as total,
          count(*) FILTER (WHERE state = 'active') as active,
          count(*) FILTER (WHERE state = 'idle') as idle
        FROM pg_stat_activity 
        WHERE datname = $1
      `,
        [this.config.database]
      );

      const poolStats = poolStatsResult.rows[0];

      const healthInfo: PostgresHealthInfo = {
        ...baseInfo,
        version,
        activeConnections: Number(poolStats?.active) || 0,
        idleConnections: Number(poolStats?.idle) || 0
      };

      // Add poolSize only if defined
      if (this.config.poolMax !== undefined) {
        healthInfo.poolSize = this.config.poolMax;
      }

      return healthInfo;
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error)
        },
        'Error getting PostgreSQL health info'
      );
      return baseInfo;
    }
  }

  /**
   * Execute a raw SQL query
   */
  public async runQuery<T = any>(
    query: string,
    parameters?: any[]
  ): Promise<PostgresQueryResult<T>> {
    if (!this.isConnected()) {
      throw new Error('PostgreSQL is not connected');
    }

    try {
      const result = await this.dataSource.query(query, parameters);
      const trimmedQuery = query.trim();
      const command = trimmedQuery.split(' ')[0];

      return {
        rows: Array.isArray(result) ? result : [result],
        rowCount: Array.isArray(result) ? result.length : 1,
        command: command ? command.toUpperCase() : 'UNKNOWN'
      };
    } catch (error) {
      this.logger.error(
        {
          query: query.substring(0, 100), // Log only first 100 chars
          error: error instanceof Error ? error.message : String(error)
        },
        'Error executing PostgreSQL query'
      );
      throw error;
    }
  }

  /**
   * Create a query runner for manual transaction control
   */
  public createQueryRunner(): QueryRunner {
    if (!this.isConnected()) {
      throw new Error('PostgreSQL is not connected');
    }
    return this.dataSource.createQueryRunner();
  }
}
