import { TransactionManager } from './transactionManager';
import type { ITransactionManager } from './transactionManager.interface';
import type { IMongoConnectionManager } from './connectionManager.interface';
import { defaultLogger } from '../../lib/logger/index';

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
