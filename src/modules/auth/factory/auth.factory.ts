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
  static async createAuthRepository(): Promise<IAuthRepository> {
    const connectionManager = await MongoConnectionManagerFactory.create();
    const userRepository = await UserRepositoryFactory.createUserRepository(connectionManager);
    return new AuthRepository(userRepository);
  }

  /**
   * Create AuthRepository instance with cache support (Database 0 - Cache Client)
   * Uses multi-client Redis architecture for authentication data caching
   */
  static async createAuthRepositoryWithCache(): Promise<IAuthRepository> {
    const connectionManager = await MongoConnectionManagerFactory.create();
    const userRepository = await UserRepositoryFactory.createUserRepository(connectionManager);

    // Use Cache Client (Database 0) for authentication data
    const cacheService = CacheServiceFactory.getDataCache();

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
   * Uses in-memory cache instead of Redis for isolated testing
   */
  static async createAuthRepositoryWithMemoryCache(): Promise<IAuthRepository> {
    const connectionManager = await MongoConnectionManagerFactory.create();
    const userRepository = await UserRepositoryFactory.createUserRepository(connectionManager);
    const memoryCacheService = CacheServiceFactory.createMemoryCacheService();

    return new AuthRepository(userRepository, memoryCacheService);
  }

  /**
   * Create AuthRepository with session cache support (Database 0 - 24h TTL)
   * Optimized for long-duration authentication sessions
   */
  static async createAuthRepositoryWithSessionCache(): Promise<IAuthRepository> {
    const connectionManager = await MongoConnectionManagerFactory.create();
    const userRepository = await UserRepositoryFactory.createUserRepository(connectionManager);

    // Use Session Cache (Database 0, 24h TTL) for long-duration auth sessions
    const sessionCacheService = CacheServiceFactory.getDataCache();

    return new AuthRepository(userRepository, sessionCacheService);
  }
}
