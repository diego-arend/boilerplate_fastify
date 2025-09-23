import mongoose from 'mongoose';
import { config } from '../../lib/validators/validateEnv.js';
import { defaultLogger, type LogContext } from '../../lib/logger/index.js';

class MongoConnection {
  private static instance: MongoConnection;
  private isConnected: boolean = false;
  private logger: ReturnType<typeof defaultLogger.child>;

  private constructor() {
    this.logger = defaultLogger.child({ module: 'mongodb-connection' });
  }

  public static getInstance(): MongoConnection {
    if (!MongoConnection.instance) {
      MongoConnection.instance = new MongoConnection();
    }
    return MongoConnection.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      this.logger.info('MongoDB connection already established');
      return;
    }

    const connectionInfo = {
      host: this.extractHostFromUri(config.MONGO_URI),
      database: this.extractDatabaseFromUri(config.MONGO_URI),
      environment: process.env.NODE_ENV || 'development'
    };

    this.logger.info(connectionInfo, 'Attempting to connect to MongoDB');

    try {
      await mongoose.connect(config.MONGO_URI, {
        serverSelectionTimeoutMS: 5000, // Server selection timeout
        socketTimeoutMS: 45000, // Socket timeout
        bufferCommands: false, // Disable command buffering
        maxPoolSize: 10 // Maximum connection pool size
      });
      this.isConnected = true;

      this.logger.info(
        {
          ...connectionInfo,
          readyState: mongoose.connection.readyState,
          connectionId: mongoose.connection.id
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
    if (!this.isConnected) {
      this.logger.info('MongoDB already disconnected');
      return;
    }

    this.logger.info('Attempting to disconnect from MongoDB');

    try {
      await mongoose.disconnect();
      this.isConnected = false;
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
    return mongoose.connection;
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

export default MongoConnection;
