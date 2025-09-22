export { default as MongoConnection } from './connection.js';
export { BaseRepository } from './baseRepository.js';

// Transaction management
export { 
  TransactionManager,
  getTransactionManager,
  withTransaction,
  withTransactionBatch
} from './transactionManager.js';

// Transaction plugin (recommended for Fastify applications)
export { 
  default as transactionPlugin,
  transactionPlugin as namedTransactionPlugin,
  TRANSACTION_ROUTE_CONFIG
} from './transaction.plugin.js';

export type { 
  TransactionPluginOptions,
  RouteTransactionConfig
} from './transaction.plugin.js';

// Transaction types
export type { 
  TransactionContext,
  TransactionalFunction,
  TransactionOptions,
  TransactionResult,
  TransactionStats
} from './transaction.types.js';