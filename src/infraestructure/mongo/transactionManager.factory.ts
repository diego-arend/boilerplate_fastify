import { TransactionManager } from './transactionManager.js';
import type { ITransactionManager } from './transactionManager.interface.js';
import type { IMongoConnectionManager } from './connectionManager.interface.js';
import { defaultLogger } from '../../lib/logger/index.js';

/**
 * Factory for creating Transaction Manager instances with dependency injection
 */
export class TransactionManagerFactory {
  /**
   * Create Transaction Manager with injected connection manager
   */
  static create(connectionManager: IMongoConnectionManager): ITransactionManager {
    const logger = defaultLogger.child({ module: 'mongodb-transaction' });
    return new TransactionManager(connectionManager, logger);
  }

  /**
   * Create Transaction Manager for testing
   */
  static createForTesting(
    connectionManager: IMongoConnectionManager,
    mockLogger: any
  ): ITransactionManager {
    return new TransactionManager(connectionManager, mockLogger);
  }
}
