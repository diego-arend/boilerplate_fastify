import { BaseRepository } from '../../infraestructure/mongo/index.js';
import { UserModel } from './userEntity.js';
import { UserRepository, type IUserRepository } from './userRepository.js';
import type { IUser } from './userEntity.js';

/**
 * Factory class for creating User-related repositories with proper dependency injection
 * This ensures proper separation of concerns and testability
 */
export class UserRepositoryFactory {
  /**
   * Create UserRepository instance with injected BaseRepository
   */
  static createUserRepository(): IUserRepository {
    const baseRepository = new BaseRepository<IUser>(UserModel);
    return new UserRepository(baseRepository);
  }

  /**
   * Create UserRepository instance for testing with mocked BaseRepository
   * @param mockBaseRepository - Mocked BaseRepository for testing
   */
  static createUserRepositoryForTesting(mockBaseRepository: any): IUserRepository {
    return new UserRepository(mockBaseRepository);
  }
}
