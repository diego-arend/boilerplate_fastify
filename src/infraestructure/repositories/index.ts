/**
 * Repository Infrastructure - Exports
 * Centralized exports for all repository implementations
 */

// User Repository
export { UserRepository } from './user.repository.js';

// Dead Letter Queue Repository
export { DeadLetterQueueRepository } from './dlq.repository.js';

// Repository Factory
export {
  RepositoryFactory,
  createUserRepository,
  getUserRepository,
  createDLQRepository,
  getDLQRepository
} from './repository.factory.js';

// Repository Factory Functions
export type { PaginationOptions, PaginationResult, RepositoryOptions } from '../mongo/index.js';
