import type { RedisClientType } from './redis.connection.js';
import { getRedisConnection } from './redis.connection.js';
import type { config } from '../../lib/validators/validateEnv.js';

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
 * Cache Manager class for Redis operations
 * Provides a high-level interface for caching operations with type safety
 */
export class CacheManager {
  private redis: RedisClientType | null = null;
  private defaultTTL: number;
  private defaultNamespace: string;
  private stats: CacheStats;
  private isInitialized = false;

  /**
   * Create a new CacheManager instance
   * @param {number} defaultTTL - Default time to live in seconds (default: 3600 = 1 hour)
   * @param {string} defaultNamespace - Default namespace prefix (default: 'cache')
   */
  constructor(defaultTTL: number = 3600, defaultNamespace: string = 'cache') {
    this.defaultTTL = defaultTTL;
    this.defaultNamespace = defaultNamespace;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  /**
   * Initialize the cache manager with Redis connection
   * @param {typeof config} appConfig - Application configuration
   * @throws {Error} If Redis connection fails
   */
  public async initialize(appConfig: typeof config): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const redisConnection = getRedisConnection();
      this.redis = await redisConnection.connect(appConfig);
      this.isInitialized = true;
      console.log('CacheManager: Successfully initialized');
    } catch (error) {
      console.error('CacheManager: Initialization failed', error);
      throw new Error('Failed to initialize cache manager');
    }
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {T} value - Value to cache (will be JSON serialized)
   * @param {CacheOptions} options - Cache options
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
      console.debug(`CacheManager: Set key '${fullKey}' with TTL ${ttl}s`);
    } catch (error) {
      this.stats.errors++;
      console.error('CacheManager: Set operation failed', error);
      throw new Error(`Failed to set cache key: ${key}`);
    }
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @param {CacheOptions} options - Cache options
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
        console.debug(`CacheManager: Cache miss for key '${fullKey}'`);
        return null;
      }

      this.stats.hits++;
      console.debug(`CacheManager: Cache hit for key '${fullKey}'`);
      return this.deserialize<T>(value);
    } catch (error) {
      this.stats.errors++;
      console.error('CacheManager: Get operation failed', error);
      throw new Error(`Failed to get cache key: ${key}`);
    }
  }

  /**
   * Delete a value from cache
   * @param {string} key - Cache key
   * @param {CacheOptions} options - Cache options
   * @returns {Promise<boolean>} True if key was deleted, false if key didn't exist
   * @throws {Error} If not initialized or operation fails
   */
  public async del(key: string, options: CacheOptions = {}): Promise<boolean> {
    this.ensureInitialized();

    try {
      const fullKey = this.buildKey(key, options.namespace);
      const result = await this.redis!.del(fullKey);

      this.stats.deletes++;
      console.debug(`CacheManager: Deleted key '${fullKey}' (existed: ${result > 0})`);
      return result > 0;
    } catch (error) {
      this.stats.errors++;
      console.error('CacheManager: Delete operation failed', error);
      throw new Error(`Failed to delete cache key: ${key}`);
    }
  }

  /**
   * Check if a key exists in cache
   * @param {string} key - Cache key
   * @param {CacheOptions} options - Cache options
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
      console.error('CacheManager: Exists operation failed', error);
      throw new Error(`Failed to check cache key existence: ${key}`);
    }
  }

  /**
   * Set TTL for an existing key
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in seconds
   * @param {CacheOptions} options - Cache options
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
      console.error('CacheManager: Expire operation failed', error);
      throw new Error(`Failed to set TTL for cache key: ${key}`);
    }
  }

  /**
   * Get TTL for a key
   * @param {string} key - Cache key
   * @param {CacheOptions} options - Cache options
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
      console.error('CacheManager: TTL operation failed', error);
      throw new Error(`Failed to get TTL for cache key: ${key}`);
    }
  }

  /**
   * Clear all cache entries with the specified namespace
   * @param {string} namespace - Namespace to clear (default: default namespace)
   * @returns {Promise<number>} Number of keys deleted
   * @throws {Error} If not initialized or operation fails
   */
  public async clear(namespace?: string): Promise<number> {
    this.ensureInitialized();

    try {
      const pattern = `${namespace || this.defaultNamespace}:*`;
      const keys = await this.redis!.keys(pattern);

      if (keys.length === 0) {
        console.debug(`CacheManager: No keys found for pattern '${pattern}'`);
        return 0;
      }

      const result = await this.redis!.del(keys);
      this.stats.deletes += result;
      console.log(`CacheManager: Cleared ${result} keys with pattern '${pattern}'`);
      return result;
    } catch (error) {
      this.stats.errors++;
      console.error('CacheManager: Clear operation failed', error);
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
    console.log('CacheManager: Statistics reset');
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
    return await this.redis!.ping();
  }

  /**
   * Build full cache key with namespace
   * @param {string} key - Original key
   * @param {string} namespace - Optional namespace override
   * @returns {string} Full cache key
   * @private
   */
  private buildKey(key: string, namespace?: string): string {
    const ns = namespace || this.defaultNamespace;
    return `${ns}:${this.sanitizeKey(key)}`;
  }

  /**
   * Sanitize cache key to prevent injection and ensure valid Redis key
   * @param {string} key - Original key
   * @returns {string} Sanitized key
   * @private
   */
  private sanitizeKey(key: string): string {
    // Remove or replace invalid characters
    return key
      .replace(/[\\/:*?"<>|]/g, '_') // Replace invalid chars with underscore
      .replace(/\s+/g, '_') // Replace spaces with underscore
      .toLowerCase() // Convert to lowercase for consistency
      .slice(0, 250); // Limit key length (Redis max is 512MB but keep reasonable)
  }

  /**
   * Serialize value to JSON string
   * @param {T} value - Value to serialize
   * @returns {string} JSON string
   * @private
   */
  private serialize<T>(value: T): string {
    try {
      return JSON.stringify(value);
    } catch (error) {
      console.error('CacheManager: Serialization failed', error);
      throw new Error('Failed to serialize cache value');
    }
  }

  /**
   * Deserialize JSON string to typed value
   * @param {string} value - JSON string
   * @returns {T} Deserialized value
   * @private
   */
  private deserialize<T>(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('CacheManager: Deserialization failed', error);
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
      throw new Error('CacheManager not initialized. Call initialize() first.');
    }
  }
}

/**
 * Default cache manager singleton instance
 */
let defaultCacheManager: CacheManager | null = null;

/**
 * Get or create the default cache manager instance
 * @param {number} defaultTTL - Default TTL in seconds
 * @param {string} defaultNamespace - Default namespace
 * @returns {CacheManager} The cache manager instance
 */
export const getCacheManager = (
  defaultTTL: number = 3600,
  defaultNamespace: string = 'cache'
): CacheManager => {
  if (!defaultCacheManager) {
    defaultCacheManager = new CacheManager(defaultTTL, defaultNamespace);
  }
  return defaultCacheManager;
};
