import mongoose from 'mongoose';
import type { IMongoConnectionManager } from './connectionManager.interface';
import type { LogContext as _LogContext } from '../../lib/logger/index';

/**
 * MongoDB Connection Manager with dependency injection support
 * Replaces the singleton pattern with injectable connection management
 */
export class MongoConnectionManager implements IMongoConnectionManager {
  private isConnectedFlag: boolean = false;
  private connection: mongoose.Connection;

  constructor(
    private connectionString: string,
    private logger: ReturnType<typeof import('../../lib/logger/index').defaultLogger.child>
  ) {
    this.connection = mongoose.connection;
  }

  public async connect(): Promise<void> {
    if (this.isConnectedFlag) {
      this.logger.info('MongoDB connection already established');
      return;
    }

    const connectionInfo = {
      host: this.extractHostFromUri(this.connectionString),
      database: this.extractDatabaseFromUri(this.connectionString),
      environment: process.env.NODE_ENV || 'development'
    };

    this.logger.info(connectionInfo, 'Attempting to connect to MongoDB');

    try {
      await mongoose.connect(this.connectionString, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
        maxPoolSize: 10
      });

      this.isConnectedFlag = true;
      this.connection = mongoose.connection;

      this.logger.info(
        {
          ...connectionInfo,
          readyState: this.connection.readyState,
          connectionId: this.connection.id
        },
        'Successfully connected to MongoDB'
      );
    } catch (error) {
      this.logger.error(
        {
          ...connectionInfo,
          error: error instanceof Error ? error : new Error(String(error))
        },
        'Failed to connect to MongoDB'
      );
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnectedFlag) {
      this.logger.info('MongoDB already disconnected');
      return;
    }

    this.logger.info('Attempting to disconnect from MongoDB');

    try {
      await mongoose.disconnect();
      this.isConnectedFlag = false;
      this.logger.info('Successfully disconnected from MongoDB');
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error : new Error(String(error))
        },
        'Error disconnecting from MongoDB'
      );
      throw error;
    }
  }

  public getConnection(): mongoose.Connection {
    return this.connection;
  }

  public isConnected(): boolean {
    return this.isConnectedFlag && this.connection.readyState === 1;
  }

  public getHealthInfo() {
    return {
      isConnected: this.isConnected(),
      readyState: this.connection.readyState,
      host: this.connection.host,
      port: this.connection.port,
      name: this.connection.name
    };
  }

  private extractHostFromUri(uri: string): string {
    try {
      const url = new URL(uri);
      return `${url.hostname}:${url.port || '27017'}`;
    } catch {
      return 'unknown-host';
    }
  }

  private extractDatabaseFromUri(uri: string): string {
    try {
      const url = new URL(uri);
      return url.pathname.slice(1) || 'unknown-database';
    } catch {
      return 'unknown-database';
    }
  }
}
