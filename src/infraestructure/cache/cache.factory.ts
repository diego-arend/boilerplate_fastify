import { getCacheManager } from './cache.manager.js';
import { RedisCacheService, MemoryCacheService, type ICacheService } from './cache.service.js';
import type { config } from '../../lib/validators/validateEnv.js';

/**
 * Cache service factory for dependency injection
 * Provides different cache implementations based on configuration or testing needs
 */
export class CacheServiceFactory {
  private static defaultService: ICacheService | null = null;
  private static sessionService: ICacheService | null = null;
  private static tempService: ICacheService | null = null;

  /**
   * Create default cache service (1 hour TTL, 'app' namespace)
   * Uses Redis in production, memory for testing
   */
  static async createDefaultCacheService(appConfig: typeof config): Promise<ICacheService> {
    if (!this.defaultService) {
      const cacheManager = getCacheManager(3600, 'app');
      await cacheManager.initialize(appConfig);
      this.defaultService = new RedisCacheService(cacheManager);
    }
    return this.defaultService;
  }

  /**
   * Create session cache service (24 hours TTL, 'session' namespace)
   */
  static async createSessionCacheService(appConfig: typeof config): Promise<ICacheService> {
    if (!this.sessionService) {
      const cacheManager = getCacheManager(86400, 'session');
      await cacheManager.initialize(appConfig);
      this.sessionService = new RedisCacheService(cacheManager);
    }
    return this.sessionService;
  }

  /**
   * Create temporary cache service (5 minutes TTL, 'temp' namespace)
   */
  static async createTempCacheService(appConfig: typeof config): Promise<ICacheService> {
    if (!this.tempService) {
      const cacheManager = getCacheManager(300, 'temp');
      await cacheManager.initialize(appConfig);
      this.tempService = new RedisCacheService(cacheManager);
    }
    return this.tempService;
  }

  /**
   * Create memory cache service for testing
   * Doesn't require Redis connection
   */
  static createMemoryCacheService(): ICacheService {
    return new MemoryCacheService();
  }

  /**
   * Create custom Redis cache service with specific configuration
   */
  static async createCustomCacheService(
    appConfig: typeof config,
    defaultTTL: number = 3600,
    defaultNamespace: string = 'custom'
  ): Promise<ICacheService> {
    const cacheManager = getCacheManager(defaultTTL, defaultNamespace);
    await cacheManager.initialize(appConfig);
    return new RedisCacheService(cacheManager);
  }

  /**
   * Create cache service for testing with mocked implementation
   */
  static createCacheServiceForTesting(mockCacheService?: ICacheService): ICacheService {
    return mockCacheService || new MemoryCacheService();
  }

  /**
   * Reset factory state (useful for testing)
   */
  static reset(): void {
    this.defaultService = null;
    this.sessionService = null;
    this.tempService = null;
  }
}