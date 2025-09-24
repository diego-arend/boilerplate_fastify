import type { ITransactionManager } from './transactionManager.interface.js';
import type {
  TransactionalFunction,
  TransactionOptions,
  TransactionResult
} from './transaction.types.js';

/**
 * Create a withTransaction function bound to a specific transaction manager
 */
export const createWithTransaction = (transactionManager: ITransactionManager) => {
  return async <T = any>(
    operation: TransactionalFunction<T>,
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T>> => {
    return transactionManager.withTransaction(operation, options);
  };
};

/**
 * Create a withTransactionBatch function bound to a specific transaction manager
 */
export const createWithTransactionBatch = (transactionManager: ITransactionManager) => {
  return async <T = any>(
    operations: TransactionalFunction<any>[],
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T[]>> => {
    return transactionManager.withTransactionBatch(operations, options);
  };
};
