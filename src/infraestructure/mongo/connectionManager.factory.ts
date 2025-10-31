import { MongoConnectionManager } from './connectionManager';
import type { IMongoConnectionManager } from './connectionManager.interface';
import { config } from '../../lib/validators/validateEnv';
import { defaultLogger } from '../../lib/logger/index';

/**
 * Factory for creating MongoDB Connection Manager instances
 * Handles dependency injection for connection managers
 */
export class MongoConnectionManagerFactory {
  /**
   * Create a new MongoDB Connection Manager instance
   */
  static create(connectionString?: string): IMongoConnectionManager {
    const logger = defaultLogger.child({ module: 'mongodb-connection' });
    const uri = connectionString || config.MONGO_URI;

    return new MongoConnectionManager(uri, logger);
  }

  /**
   * Create MongoDB Connection Manager for testing with custom dependencies
   */
  static createForTesting(connectionString: string, mockLogger: any): IMongoConnectionManager {
    return new MongoConnectionManager(connectionString, mockLogger);
  }
}
