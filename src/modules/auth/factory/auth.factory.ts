import type { IAuthRepository } from '../repository/auth.repository.js';
import { AuthRepository } from '../repository/auth.repository.js';
import { UserRepositoryFactory } from '../../../entities/user/userRepository.factory.js';

/**
 * Factory class for creating Authentication-related repositories with proper dependency injection
 * This ensures proper separation of concerns and testability
 */
export class AuthRepositoryFactory {
  /**
   * Create AuthRepository instance with injected UserRepository
   */
  static createAuthRepository(): IAuthRepository {
    const userRepository = UserRepositoryFactory.createUserRepository();
    return new AuthRepository(userRepository);
  }

  /**
   * Create AuthRepository instance for testing with mocked UserRepository
   * @param mockUserRepository - Mocked UserRepository for testing
   */
  static createAuthRepositoryForTesting(mockUserRepository: any): IAuthRepository {
    return new AuthRepository(mockUserRepository);
  }
}