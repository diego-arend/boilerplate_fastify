// MongoDB Infrastructure with Dependency Injection
export { MongoConnectionManager } from './connectionManager.js';
export { MongoConnectionManagerFactory } from './connectionManager.factory.js';
export type { IMongoConnectionManager } from './connectionManager.interface.js';

// Base repository with DI support
export { BaseRepository } from './baseRepository.js';

// Transaction management with DI
export { TransactionManager } from './transactionManager.js';
export { TransactionManagerFactory } from './transactionManager.factory.js';
export type { ITransactionManager } from './transactionManager.interface.js';

// MongoDB Fastify Plugin with DI
export { default as mongoPlugin } from './mongodb.plugin.js';

// Interfaces for dependency injection
export type {
  IBaseRepository,
  RepositoryOptions,
  PaginationResult,
  PaginationOptions
} from './interfaces.js';

// Transaction plugin (updated to work with new DI approach)
export {
  default as transactionPlugin,
  transactionPlugin as namedTransactionPlugin,
  TRANSACTION_ROUTE_CONFIG
} from './transaction.plugin.js';

export type { TransactionPluginOptions, RouteTransactionConfig } from './transaction.plugin.js';

// Transaction types
export type {
  TransactionContext,
  TransactionalFunction,
  TransactionOptions,
  TransactionResult,
  TransactionStats
} from './transaction.types.js';

// Utility functions for DI
export { createWithTransaction, createWithTransactionBatch } from './transaction.utils.js';
