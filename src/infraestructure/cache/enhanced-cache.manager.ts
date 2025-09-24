import type { RedisClientType } from 'redis';
import { defaultLogger } from '../../lib/logger/index.js';
import type { config } from '../../lib/validators/validateEnv.js';
import { getMultiRedisConnectionManager } from './multi-redis.connection.js';
import { RedisClientType as ClientType } from './redis.types.js';

/**
 * Interface for cache options
 */
export interface CacheOptions {
  /** Time to live in seconds */
  ttl?: number;
  /** Namespace/prefix for the cache key */
  namespace?: string;
}

/**
 * Interface for cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

/**
 * Enhanced Cache Manager class for Redis operations with multi-client support
 * Provides a high-level interface for caching operations with type safety
 * Supports different Redis clients for cache and queue operations
 */
export class EnhancedCacheManager {
  private redis: RedisClientType | null = null;
  private defaultTTL: number;
  private defaultNamespace: string;
  private clientType: ClientType;
  private stats: CacheStats;
  private isInitialized = false;
  private logger: ReturnType<typeof defaultLogger.child>;

  /**
   * Create a new EnhancedCacheManager instance
   * @param defaultTTL - Default time to live in seconds (default: 3600 = 1 hour)
   * @param defaultNamespace - Default namespace prefix (default: 'cache')
   * @param clientType - Type of Redis client to use (CACHE or QUEUE)
   */
  constructor(
    defaultTTL: number = 3600,
    defaultNamespace: string = 'cache',
    clientType: ClientType = ClientType.CACHE
  ) {
    this.defaultTTL = defaultTTL;
    this.defaultNamespace = defaultNamespace;
    this.clientType = clientType;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
    this.logger = defaultLogger.child({
      module: 'enhanced-cache-manager',
      clientType: this.clientType
    });
  }

  /**
   * Initialize the cache manager with Redis connection
   * @param appConfig - Application configuration
   * @throws {Error} If Redis connection fails
   */
  public async initialize(appConfig: typeof config): Promise<void> {
    if (this.isInitialized) {
      this.logger.debug('Cache manager already initialized');
      return;
    }

    try {
      const connectionManager = getMultiRedisConnectionManager();

      // Initialize all connections if not already done
      await connectionManager.initializeAll(appConfig);

      // Get the specific client for this manager
      this.redis = connectionManager.getClient(this.clientType);

      if (!this.redis) {
        throw new Error(`Failed to get ${this.clientType} Redis client`);
      }

      this.isInitialized = true;
      this.logger.info(
        {
          clientType: this.clientType,
          defaultTTL: this.defaultTTL,
          defaultNamespace: this.defaultNamespace
        },
        'Enhanced CacheManager successfully initialized'
      );
    } catch (error) {
      this.logger.error(
        { error, clientType: this.clientType },
        'CacheManager initialization failed'
      );
      throw new Error(`Failed to initialize cache manager for ${this.clientType}`);
    }
  }

  /**
   * Set a value in cache
   * @param key - Cache key
   * @param value - Value to cache (will be JSON serialized)
   * @param options - Cache options
   * @returns {Promise<void>}
   * @throws {Error} If not initialized or operation fails
   */
  public async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    this.ensureInitialized();

    try {
      const fullKey = this.buildKey(key, options.namespace);
      const serializedValue = this.serialize(value);
      const ttl = options.ttl ?? this.defaultTTL;

      if (ttl > 0) {
        await this.redis!.setEx(fullKey, ttl, serializedValue);
      } else {
        await this.redis!.set(fullKey, serializedValue);
      }

      this.stats.sets++;
      this.logger.debug(
        { key: fullKey, ttl, clientType: this.clientType },
        'Cache set operation successful'
      );
    } catch (error) {
      this.stats.errors++;
      this.logger.error({ error, key, clientType: this.clientType }, 'Cache set operation failed');
      throw new Error(`Failed to set cache key: ${key}`);
    }
  }

  /**
   * Get a value from cache
   * @param key - Cache key
   * @param options - Cache options
   * @returns {Promise<T | null>} The cached value or null if not found
   * @throws {Error} If not initialized or deserialization fails
   */
  public async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    this.ensureInitialized();

    try {
      const fullKey = this.buildKey(key, options.namespace);
      const value = await this.redis!.get(fullKey);

      if (value === null) {
        this.stats.misses++;
        this.logger.debug({ key: fullKey, clientType: this.clientType }, 'Cache miss');
        return null;
      }

      this.stats.hits++;
      this.logger.debug({ key: fullKey, clientType: this.clientType }, 'Cache hit');
      return this.deserialize<T>(value);
    } catch (error) {
      this.stats.errors++;
      this.logger.error({ error, key, clientType: this.clientType }, 'Cache get operation failed');
      throw new Error(`Failed to get cache key: ${key}`);
    }
  }

  /**
   * Delete a value from cache
   * @param key - Cache key
   * @param options - Cache options
   * @returns {Promise<boolean>} True if key was deleted, false if key didn't exist
   * @throws {Error} If not initialized or operation fails
   */
  public async del(key: string, options: CacheOptions = {}): Promise<boolean> {
    this.ensureInitialized();

    try {
      const fullKey = this.buildKey(key, options.namespace);
      const result = await this.redis!.del(fullKey);

      this.stats.deletes++;
      this.logger.debug(
        { key: fullKey, existed: result > 0, clientType: this.clientType },
        'Cache delete operation completed'
      );
      return result > 0;
    } catch (error) {
      this.stats.errors++;
      this.logger.error(
        { error, key, clientType: this.clientType },
        'Cache delete operation failed'
      );
      throw new Error(`Failed to delete cache key: ${key}`);
    }
  }

  /**
   * Check if a key exists in cache
   * @param key - Cache key
   * @param options - Cache options
   * @returns {Promise<boolean>} True if key exists
   * @throws {Error} If not initialized or operation fails
   */
  public async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    this.ensureInitialized();

    try {
      const fullKey = this.buildKey(key, options.namespace);
      const result = await this.redis!.exists(fullKey);
      return result > 0;
    } catch (error) {
      this.stats.errors++;
      this.logger.error(
        { error, key, clientType: this.clientType },
        'Cache exists operation failed'
      );
      throw new Error(`Failed to check cache key existence: ${key}`);
    }
  }

  /**
   * Set TTL for an existing key
   * @param key - Cache key
   * @param ttl - Time to live in seconds
   * @param options - Cache options
   * @returns {Promise<boolean>} True if TTL was set, false if key doesn't exist
   * @throws {Error} If not initialized or operation fails
   */
  public async expire(key: string, ttl: number, options: CacheOptions = {}): Promise<boolean> {
    this.ensureInitialized();

    try {
      const fullKey = this.buildKey(key, options.namespace);
      const result = await this.redis!.expire(fullKey, ttl);
      return Boolean(result);
    } catch (error) {
      this.stats.errors++;
      this.logger.error(
        { error, key, ttl, clientType: this.clientType },
        'Cache expire operation failed'
      );
      throw new Error(`Failed to set TTL for cache key: ${key}`);
    }
  }

  /**
   * Get TTL for a key
   * @param key - Cache key
   * @param options - Cache options
   * @returns {Promise<number>} TTL in seconds (-1 if no TTL, -2 if key doesn't exist)
   * @throws {Error} If not initialized or operation fails
   */
  public async ttl(key: string, options: CacheOptions = {}): Promise<number> {
    this.ensureInitialized();

    try {
      const fullKey = this.buildKey(key, options.namespace);
      return await this.redis!.ttl(fullKey);
    } catch (error) {
      this.stats.errors++;
      this.logger.error({ error, key, clientType: this.clientType }, 'Cache TTL operation failed');
      throw new Error(`Failed to get TTL for cache key: ${key}`);
    }
  }

  /**
   * Clear all cache entries with the specified namespace
   * @param namespace - Namespace to clear (default: default namespace)
   * @returns {Promise<number>} Number of keys deleted
   * @throws {Error} If not initialized or operation fails
   */
  public async clear(namespace?: string): Promise<number> {
    this.ensureInitialized();

    try {
      const pattern = `${namespace || this.defaultNamespace}:*`;
      const keys = await this.redis!.keys(pattern);

      if (keys.length === 0) {
        this.logger.debug({ pattern, clientType: this.clientType }, 'No keys found for pattern');
        return 0;
      }

      const result = await this.redis!.del(keys);
      this.stats.deletes += result;
      this.logger.info(
        { pattern, keysDeleted: result, clientType: this.clientType },
        'Cache clear operation completed'
      );
      return result;
    } catch (error) {
      this.stats.errors++;
      this.logger.error(
        { error, namespace, clientType: this.clientType },
        'Cache clear operation failed'
      );
      throw new Error('Failed to clear cache');
    }
  }

  /**
   * Get cache statistics
   * @returns {CacheStats} Current cache statistics
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  public resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
    this.logger.info({ clientType: this.clientType }, 'Cache statistics reset');
  }

  /**
   * Get cache hit ratio
   * @returns {number} Hit ratio as percentage (0-100)
   */
  public getHitRatio(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : (this.stats.hits / total) * 100;
  }

  /**
   * Check if cache manager is initialized and ready
   * @returns {boolean} True if initialized
   */
  public isReady(): boolean {
    return this.isInitialized && this.redis !== null;
  }

  /**
   * Ping Redis server to check connectivity
   * @returns {Promise<string>} PONG response
   * @throws {Error} If not initialized or ping fails
   */
  public async ping(): Promise<string> {
    this.ensureInitialized();

    try {
      const result = await this.redis!.ping();
      this.logger.debug({ clientType: this.clientType }, 'Ping successful');
      return result;
    } catch (error) {
      this.logger.error({ error, clientType: this.clientType }, 'Ping failed');
      throw new Error(`Redis ${this.clientType} client: Ping failed`);
    }
  }

  /**
   * Get client type used by this cache manager
   * @returns {ClientType} The Redis client type
   */
  public getClientType(): ClientType {
    return this.clientType;
  }

  /**
   * Build full cache key with namespace
   * @param key - Original key
   * @param namespace - Optional namespace override
   * @returns {string} Full cache key
   * @private
   */
  private buildKey(key: string, namespace?: string): string {
    const ns = namespace || this.defaultNamespace;
    return `${ns}:${this.sanitizeKey(key)}`;
  }

  /**
   * Sanitize cache key to prevent injection and ensure valid Redis key
   * @param key - Original key
   * @returns {string} Sanitized key
   * @private
   */
  private sanitizeKey(key: string): string {
    return key
      .replace(/[\\/:*?"<>|]/g, '_') // Replace invalid chars with underscore
      .replace(/\s+/g, '_') // Replace spaces with underscore
      .toLowerCase() // Convert to lowercase for consistency
      .slice(0, 250); // Limit key length
  }

  /**
   * Serialize value to JSON string
   * @param value - Value to serialize
   * @returns {string} JSON string
   * @private
   */
  private serialize<T>(value: T): string {
    try {
      return JSON.stringify(value);
    } catch (error) {
      this.logger.error({ error, clientType: this.clientType }, 'Serialization failed');
      throw new Error('Failed to serialize cache value');
    }
  }

  /**
   * Deserialize JSON string to typed value
   * @param value - JSON string
   * @returns {T} Deserialized value
   * @private
   */
  private deserialize<T>(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error({ error, clientType: this.clientType }, 'Deserialization failed');
      throw new Error('Failed to deserialize cache value');
    }
  }

  /**
   * Ensure cache manager is initialized
   * @throws {Error} If not initialized
   * @private
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.redis) {
      throw new Error(
        `Enhanced CacheManager for ${this.clientType} not initialized. Call initialize() first.`
      );
    }
  }
}

/**
 * Cache manager instances for different purposes
 */
let cacheCacheManager: EnhancedCacheManager | null = null;
let queueCacheManager: EnhancedCacheManager | null = null;

/**
 * Get or create the cache client manager instance (for API caching)
 * @param defaultTTL - Default TTL in seconds
 * @param defaultNamespace - Default namespace
 * @returns {EnhancedCacheManager} The cache manager instance for cache operations
 */
export const getCacheCacheManager = (
  defaultTTL: number = 3600,
  defaultNamespace: string = 'cache'
): EnhancedCacheManager => {
  if (!cacheCacheManager) {
    cacheCacheManager = new EnhancedCacheManager(defaultTTL, defaultNamespace, ClientType.CACHE);
  }
  return cacheCacheManager;
};

/**
 * Get or create the queue client manager instance (for queue caching)
 * @param defaultTTL - Default TTL in seconds
 * @param defaultNamespace - Default namespace
 * @returns {EnhancedCacheManager} The cache manager instance for queue operations
 */
export const getQueueCacheManager = (
  defaultTTL: number = 1800, // 30 minutes default for queue operations
  defaultNamespace: string = 'queue'
): EnhancedCacheManager => {
  if (!queueCacheManager) {
    queueCacheManager = new EnhancedCacheManager(defaultTTL, defaultNamespace, ClientType.QUEUE);
  }
  return queueCacheManager;
};
