import { UserRepository } from './user.repository.js';
import { DeadLetterQueueRepository } from './dlq.repository.js';
import type { IUserRepository } from '../../entities/user/userRepository.interface.js';

/**
 * Repository Factory - Infrastructure layer
 * Provides dependency injection for repository implementations
 */
export class RepositoryFactory {
  private static userRepository: IUserRepository;
  private static dlqRepository: DeadLetterQueueRepository;

  /**
   * Get User Repository instance (Singleton pattern)
   */
  static getUserRepository(): IUserRepository {
    if (!this.userRepository) {
      this.userRepository = new UserRepository();
    }
    return this.userRepository;
  }

  /**
   * Create new User Repository instance
   */
  static createUserRepository(): IUserRepository {
    return new UserRepository();
  }

  /**
   * Get Dead Letter Queue Repository instance (Singleton pattern)
   */
  static getDLQRepository(): DeadLetterQueueRepository {
    if (!this.dlqRepository) {
      this.dlqRepository = new DeadLetterQueueRepository();
    }
    return this.dlqRepository;
  }

  /**
   * Create new Dead Letter Queue Repository instance
   */
  static createDLQRepository(): DeadLetterQueueRepository {
    return new DeadLetterQueueRepository();
  }
}

/**
 * Individual factory functions for dependency injection
 */
export const createUserRepository = (): IUserRepository => {
  return RepositoryFactory.createUserRepository();
};

export const getUserRepository = (): IUserRepository => {
  return RepositoryFactory.getUserRepository();
};

export const createDLQRepository = (): DeadLetterQueueRepository => {
  return RepositoryFactory.createDLQRepository();
};

export const getDLQRepository = (): DeadLetterQueueRepository => {
  return RepositoryFactory.getDLQRepository();
};
