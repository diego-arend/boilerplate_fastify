import type { IAuthRepository } from '../repository/auth.repository.js';
import { AuthRepository } from '../repository/auth.repository.js';
import { UserRepositoryFactory } from '../../../entities/user/userRepository.factory.js';
import { CacheServiceFactory } from '../../../infraestructure/cache/index.js';
import { MongoConnectionManagerFactory } from '../../../infraestructure/mongo/connectionManager.factory.js';
import { config } from '../../../lib/validators/validateEnv.js';

/**
 * Factory class for creating Authentication-related repositories with dependency injection
 * This ensures proper separation of concerns and testability
 */
export class AuthRepositoryFactory {
  /**
   * Create AuthRepository instance with injected dependencies (no cache)
   */
  static createAuthRepository(): IAuthRepository {
    const connectionManager = MongoConnectionManagerFactory.create();
    const userRepository = UserRepositoryFactory.createUserRepository(connectionManager);
    return new AuthRepository(userRepository);
  }

  /**
   * Create AuthRepository instance with cache support
   */
  static async createAuthRepositoryWithCache(): Promise<IAuthRepository> {
    const connectionManager = MongoConnectionManagerFactory.create();
    const userRepository = UserRepositoryFactory.createUserRepository(connectionManager);
    const cacheService = await CacheServiceFactory.createDefaultCacheService(config);

    return new AuthRepository(userRepository, cacheService);
  }

  /**
   * Create AuthRepository instance for testing with mocked dependencies
   * @param mockUserRepository - Mocked UserRepository for testing
   * @param mockCacheService - Optional mocked cache service
   */
  static createAuthRepositoryForTesting(
    mockUserRepository: any,
    mockCacheService?: any
  ): IAuthRepository {
    return new AuthRepository(mockUserRepository, mockCacheService);
  }

  /**
   * Create AuthRepository with memory cache for development/testing
   */
  static createAuthRepositoryWithMemoryCache(): IAuthRepository {
    const connectionManager = MongoConnectionManagerFactory.create();
    const userRepository = UserRepositoryFactory.createUserRepository(connectionManager);
    const memoryCacheService = CacheServiceFactory.createMemoryCacheService();

    return new AuthRepository(userRepository, memoryCacheService);
  }
}
