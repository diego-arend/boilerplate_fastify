import type { IAuthRepository } from '../repository/auth.repository.js';
import { AuthRepository } from '../repository/auth.repository.js';
import { UserRepositoryFactory } from '../../../entities/user/index.js';
import { CacheServiceFactory } from '../../../infraestructure/cache/index.js';

/**
 * Factory class for creating Authentication-related repositories with dependency injection
 * Uses the new hybrid DDD pattern with interfaces in entities and implementations in infrastructure
 */
export class AuthRepositoryFactory {
  /**
   * Create AuthRepository instance with injected dependencies (no cache)
   * Uses the new hybrid repository pattern
   */
  static async createAuthRepository(): Promise<IAuthRepository> {
    const userRepository = await UserRepositoryFactory.createUserRepository();
    return new AuthRepository(userRepository);
  }

  /**
   * Create AuthRepository instance with cache support (Database 0 - Cache Client)
   * Uses multi-client Redis architecture for authentication data caching
   */
  static async createAuthRepositoryWithCache(): Promise<IAuthRepository> {
    const userRepository = await UserRepositoryFactory.createUserRepository();

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
    const userRepository = await UserRepositoryFactory.createUserRepository();
    const memoryCacheService = CacheServiceFactory.createMemoryCacheService();

    return new AuthRepository(userRepository, memoryCacheService);
  }

  /**
   * Create AuthRepository with session cache support (Database 0 - 24h TTL)
   * Optimized for long-duration authentication sessions
   */
  static async createAuthRepositoryWithSessionCache(): Promise<IAuthRepository> {
    const userRepository = await UserRepositoryFactory.createUserRepository();

    // Use Session Cache (Database 0, 24h TTL) for long-duration auth sessions
    const sessionCacheService = CacheServiceFactory.getDataCache();

    return new AuthRepository(userRepository, sessionCacheService);
  }
}
