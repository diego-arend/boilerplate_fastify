import type { ClientSession } from 'mongoose';

/**
 * Interface for transactional method context
 */
export interface TransactionContext {
  session: ClientSession;
  isTransactional: boolean;
}

/**
 * Function that can be executed within a transaction
 */
export type TransactionalFunction<T = any> = (session?: ClientSession) => Promise<T>;

/**
 * Method descriptor for transactional operations
 */
export interface TransactionalMethodDescriptor<T = any> extends PropertyDescriptor {
  value?: TransactionalFunction<T>;
}

/**
 * Transaction options
 */
export interface TransactionOptions {
  /**
   * Transaction read concern
   */
  readConcern?: {
    level: 'local' | 'available' | 'majority' | 'linearizable' | 'snapshot';
  };
  
  /**
   * Transaction write concern
   */
  writeConcern?: {
    w?: number | 'majority';
    j?: boolean;
    wtimeout?: number;
  };
  
  /**
   * Transaction read preference
   */
  readPreference?: 'primary' | 'primaryPreferred' | 'secondary' | 'secondaryPreferred' | 'nearest';
  
  /**
   * Maximum time transaction can run (milliseconds)
   */
  maxTimeMS?: number;
  
  /**
   * Maximum number of retry attempts
   */
  maxRetries?: number;
}

/**
 * Transaction result wrapper
 */
export interface TransactionResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  transactionId?: string;
  executionTime?: number;
}

/**
 * Transaction statistics
 */
export interface TransactionStats {
  transactionId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'started' | 'committed' | 'aborted' | 'error';
  operations: number;
  error?: Error;
}