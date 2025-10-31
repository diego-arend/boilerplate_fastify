// MongoDB Infrastructure with Dependency Injection
export { MongoConnectionManager } from './connectionManager';
export { MongoConnectionManagerFactory } from './connectionManager.factory';
export type { IMongoConnectionManager } from './connectionManager.interface';

// Base repository with DI support
export { BaseRepository } from './baseRepository';

// Transaction management with DI
export { TransactionManager } from './transactionManager';
export { TransactionManagerFactory } from './transactionManager.factory';
export type { ITransactionManager } from './transactionManager.interface';

// MongoDB Fastify Plugin with DI
export { default as mongoPlugin } from './mongodb.plugin';

// Interfaces for dependency injection
export type {
  IBaseRepository,
  RepositoryOptions,
  PaginationResult,
  PaginationOptions
} from './interfaces';

// Transaction plugin (updated to work with new DI approach)
export {
  default as transactionPlugin,
  transactionPlugin as namedTransactionPlugin,
  TRANSACTION_ROUTE_CONFIG
} from './transaction.plugin';

export type { TransactionPluginOptions, RouteTransactionConfig } from './transaction.plugin';

// Transaction types
export type {
  TransactionContext,
  TransactionalFunction,
  TransactionOptions,
  TransactionResult,
  TransactionStats
} from './transaction.types';

// Utility functions for DI
export { createWithTransaction, createWithTransactionBatch } from './transaction.utils';
