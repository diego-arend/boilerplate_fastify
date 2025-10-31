import mongoose from 'mongoose';
import type { ClientSession } from 'mongoose';
import type { IMongoConnectionManager } from './connectionManager.interface';
import type { ITransactionManager } from './transactionManager.interface';
import type {
  TransactionOptions,
  TransactionResult,
  TransactionStats,
  TransactionalFunction
} from './transaction.types';

/**
 * Transaction Manager with dependency injection support
 * Replaces singleton pattern with injectable transaction management
 */
export class TransactionManager implements ITransactionManager {
  private activeTransactions = new Map<string, TransactionStats>();

  constructor(
    private connectionManager: IMongoConnectionManager,
    private logger: ReturnType<typeof import('../../lib/logger/index').defaultLogger.child>
  ) {}

  /**
   * Start a new transaction session
   */
  async startTransaction(options: TransactionOptions = {}): Promise<ClientSession> {
    if (!this.supportsTransactions()) {
      throw new Error('MongoDB connection does not support transactions');
    }

    const session = await mongoose.startSession();
    session.startTransaction({
      ...(options.readConcern && { readConcern: options.readConcern }),
      ...(options.writeConcern && { writeConcern: options.writeConcern }),
      ...(options.readPreference && { readPreference: options.readPreference }),
      maxTimeMS: options.maxTimeMS || 30000
    });

    const transactionId = this.generateTransactionId();
    const transactionStats: TransactionStats = {
      transactionId,
      startTime: new Date(),
      status: 'started',
      operations: 0
    };

    this.activeTransactions.set(transactionId, transactionStats);

    this.logger.info({ transactionId }, 'Transaction session started');
    return session;
  }

  /**
   * Commit a transaction
   */
  async commitTransaction(session: ClientSession): Promise<void> {
    try {
      await session.commitTransaction();
      this.logger.info({ sessionId: session.id }, 'Transaction committed');
    } catch (error) {
      this.logger.error({ sessionId: session.id, error }, 'Failed to commit transaction');
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Rollback a transaction
   */
  async rollbackTransaction(session: ClientSession): Promise<void> {
    try {
      await session.abortTransaction();
      this.logger.info({ sessionId: session.id }, 'Transaction rolled back');
    } catch (error) {
      this.logger.error({ sessionId: session.id, error }, 'Failed to rollback transaction');
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Execute a function within a MongoDB transaction
   */
  async withTransaction<T = any>(
    operation: TransactionalFunction<T>,
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T>> {
    const transactionId = this.generateTransactionId();
    const startTime = Date.now();

    // Check if MongoDB connection supports transactions
    if (!this.supportsTransactions()) {
      this.logger.warn(
        'MongoDB connection does not support transactions. Running without transaction.'
      );

      try {
        const result = await operation();
        return {
          success: true,
          data: result,
          transactionId,
          executionTime: Date.now() - startTime
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          transactionId,
          executionTime: Date.now() - startTime
        };
      }
    }

    const session = await mongoose.startSession();

    const transactionStats: TransactionStats = {
      transactionId,
      startTime: new Date(startTime),
      status: 'started',
      operations: 0
    };

    this.activeTransactions.set(transactionId, transactionStats);

    try {
      this.logger.info({ transactionId }, 'Starting MongoDB transaction');

      const result = await session.withTransaction(
        async () => {
          transactionStats.operations++;
          return await operation(session);
        },
        {
          ...(options.readConcern && { readConcern: options.readConcern }),
          ...(options.writeConcern && { writeConcern: options.writeConcern }),
          ...(options.readPreference && { readPreference: options.readPreference }),
          maxTimeMS: options.maxTimeMS || 30000 // Default 30 seconds
        }
      );

      transactionStats.status = 'committed';
      transactionStats.endTime = new Date();
      transactionStats.duration = Date.now() - startTime;

      this.logger.info(
        {
          transactionId,
          duration: transactionStats.duration,
          operations: transactionStats.operations
        },
        'Transaction committed successfully'
      );

      return {
        success: true,
        data: result,
        transactionId,
        executionTime: transactionStats.duration
      };
    } catch (error) {
      transactionStats.status = 'aborted';
      transactionStats.error = error instanceof Error ? error : new Error(String(error));
      transactionStats.endTime = new Date();
      transactionStats.duration = Date.now() - startTime;

      this.logger.error(
        {
          transactionId,
          error: transactionStats.error,
          duration: transactionStats.duration,
          operations: transactionStats.operations
        },
        'Transaction aborted due to error'
      );

      return {
        success: false,
        error: transactionStats.error,
        transactionId,
        executionTime: transactionStats.duration
      };
    } finally {
      await session.endSession();

      // Clean up old transaction stats after 1 hour
      setTimeout(() => {
        this.activeTransactions.delete(transactionId);
      }, 3600000);
    }
  }

  /**
   * Execute multiple operations in a single transaction
   */
  async withTransactionBatch<T = any>(
    operations: TransactionalFunction<any>[],
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T[]>> {
    return this.withTransaction(async session => {
      const results: any[] = [];

      for (const operation of operations) {
        const result = await operation(session);
        results.push(result);
      }

      return results;
    }, options);
  }

  /**
   * Check if the current MongoDB connection supports transactions
   */
  private supportsTransactions(): boolean {
    if (!this.connectionManager.isConnected()) {
      return false;
    }

    if (process.env.NODE_ENV === 'test') {
      return true;
    }

    try {
      const connection = this.connectionManager.getConnection();
      return connection && connection.readyState === 1;
    } catch (error) {
      this.logger.warn(
        { error },
        'Could not determine transaction support, assuming not supported'
      );
      return false;
    }
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get statistics for active transactions
   */
  getActiveTransactions(): TransactionStats[] {
    return Array.from(this.activeTransactions.values());
  }

  /**
   * Get transaction by ID
   */
  getTransaction(transactionId: string): TransactionStats | undefined {
    return this.activeTransactions.get(transactionId);
  }

  /**
   * Clean up old transactions
   */
  cleanup(): void {
    const now = Date.now();
    const oneHourAgo = now - 3600000; // 1 hour

    for (const [id, stats] of this.activeTransactions.entries()) {
      if (stats.startTime.getTime() < oneHourAgo) {
        this.activeTransactions.delete(id);
      }
    }
  }
}
