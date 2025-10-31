import type { ClientSession } from 'mongoose';
import type {
  TransactionOptions,
  TransactionResult,
  TransactionStats,
  TransactionalFunction
} from './transaction.types';

/**
 * Interface for Transaction Manager with dependency injection
 */
export interface ITransactionManager {
  startTransaction(options?: TransactionOptions): Promise<ClientSession>;
  commitTransaction(session: ClientSession): Promise<void>;
  rollbackTransaction(session: ClientSession): Promise<void>;
  withTransaction<T = any>(
    operation: TransactionalFunction<T>,
    options?: TransactionOptions
  ): Promise<TransactionResult<T>>;
  withTransactionBatch<T = any>(
    operations: TransactionalFunction<any>[],
    options?: TransactionOptions
  ): Promise<TransactionResult<T[]>>;
  getActiveTransactions(): TransactionStats[];
  getTransaction(transactionId: string): TransactionStats | undefined;
  cleanup(): void;
}
