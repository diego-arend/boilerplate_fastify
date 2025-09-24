import { getCacheCacheManager, getQueueCacheManager } from './enhanced-cache.manager.js';
import { RedisCacheService, MemoryCacheService, type ICacheService } from './cache.service.js';
import type { config } from '../../lib/validators/validateEnv.js';
import { RedisClientType } from './redis.types.js';

/**
 * Enhanced Cache service factory for dependency injection
 * Provides different cache implementations with multi-Redis client support
 * Supports both cache and queue Redis clients with proper isolation
 */
export class CacheServiceFactory {
  private static defaultService: ICacheService | null = null;
  private static sessionService: ICacheService | null = null;
  private static tempService: ICacheService | null = null;
  private static queueCacheService: ICacheService | null = null;
  private static queueWorkerService: ICacheService | null = null;

  /**
   * Create default cache service (1 hour TTL, 'app' namespace, uses cache Redis client)
   * Uses Redis cache client (db0) for API caching operations
   */
  static async createDefaultCacheService(appConfig: typeof config): Promise<ICacheService> {
    if (!this.defaultService) {
      const cacheManager = getCacheCacheManager(3600, 'app');
      await cacheManager.initialize(appConfig);
      this.defaultService = new RedisCacheService(cacheManager);
    }
    return this.defaultService;
  }

  /**
   * Create session cache service (24 hours TTL, 'session' namespace, uses cache Redis client)
   * Uses Redis cache client (db0) for session data
   */
  static async createSessionCacheService(appConfig: typeof config): Promise<ICacheService> {
    if (!this.sessionService) {
      const cacheManager = getCacheCacheManager(86400, 'session');
      await cacheManager.initialize(appConfig);
      this.sessionService = new RedisCacheService(cacheManager);
    }
    return this.sessionService;
  }

  /**
   * Create temporary cache service (5 minutes TTL, 'temp' namespace, uses cache Redis client)
   * Uses Redis cache client (db0) for temporary data
   */
  static async createTempCacheService(appConfig: typeof config): Promise<ICacheService> {
    if (!this.tempService) {
      const cacheManager = getCacheCacheManager(300, 'temp');
      await cacheManager.initialize(appConfig);
      this.tempService = new RedisCacheService(cacheManager);
    }
    return this.tempService;
  }

  /**
   * Create queue cache service (30 minutes TTL, 'queue-cache' namespace, uses queue Redis client)
   * Uses Redis queue client (db1) for queue-related caching
   */
  static async createQueueCacheService(appConfig: typeof config): Promise<ICacheService> {
    if (!this.queueCacheService) {
      const queueManager = getQueueCacheManager(1800, 'queue-cache');
      await queueManager.initialize(appConfig);
      this.queueCacheService = new RedisCacheService(queueManager);
    }
    return this.queueCacheService;
  }

  /**
   * Create queue worker service (15 minutes TTL, 'queue-worker' namespace, uses queue Redis client)
   * Uses Redis queue client (db1) for worker-specific caching and coordination
   */
  static async createQueueWorkerService(appConfig: typeof config): Promise<ICacheService> {
    if (!this.queueWorkerService) {
      const queueManager = getQueueCacheManager(900, 'queue-worker');
      await queueManager.initialize(appConfig);
      this.queueWorkerService = new RedisCacheService(queueManager);
    }
    return this.queueWorkerService;
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
   * Uses cache Redis client (db0) by default
   */
  static async createCustomCacheService(
    appConfig: typeof config,
    defaultTTL: number = 3600,
    defaultNamespace: string = 'custom',
    clientType: RedisClientType = RedisClientType.CACHE
  ): Promise<ICacheService> {
    const cacheManager =
      clientType === RedisClientType.CACHE
        ? getCacheCacheManager(defaultTTL, defaultNamespace)
        : getQueueCacheManager(defaultTTL, defaultNamespace);

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
    this.queueCacheService = null;
    this.queueWorkerService = null;
  }
}
