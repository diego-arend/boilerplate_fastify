/**
 * Cache module exports
 * Provides Redis-based caching functionality with multi-client support and dependency injection
 */

// Multi-client Redis connection exports
// Multi-client Redis connection exports
export {
  MultiRedisConnectionManager,
  getMultiRedisConnectionManager,
  getCacheRedisClient,
  getQueueRedisClient
} from './multi-redis.connection.js';

// Enhanced cache manager with multi-client support
export {
  EnhancedCacheManager,
  getCacheCacheManager,
  getQueueCacheManager,
  type CacheOptions,
  type CacheStats
} from './enhanced-cache.manager.js';

// Redis configuration types and utilities
export {
  RedisClientType,
  type RedisConfig,
  type RedisConnectionStatus,
  getCacheRedisConfig,
  getQueueRedisConfig,
  buildRedisUrl
} from './redis.types.js';

// Redis client types
export type { RedisClientType as RedisClient } from 'redis';

// Dependency injection exports
export { RedisCacheService, MemoryCacheService, type ICacheService } from './cache.service.js';
export { CacheServiceFactory } from './cache.factory.js';

/**
 * Legacy compatibility functions for backward compatibility
 * @deprecated Use CacheServiceFactory with specific client types for new implementations
 */

import { getCacheCacheManager } from './enhanced-cache.manager.js';

/**
 * Get the default cache manager instance with standard configuration
 * TTL: 1 hour (3600 seconds)
 * Namespace: 'app'
 * Client: Uses cache client (db0)
 *
 * @deprecated Use CacheServiceFactory.createDefaultCacheService() instead
 * @returns {EnhancedCacheManager} Pre-configured cache manager instance
 */
export const getDefaultCache = () => getCacheCacheManager(3600, 'app');

/**
 * Get a cache manager for session data
 * TTL: 24 hours (86400 seconds)
 * Namespace: 'session'
 * Client: Uses cache client (db0)
 *
 * @deprecated Use CacheServiceFactory.createSessionCacheService() instead
 * @returns {EnhancedCacheManager} Session cache manager instance
 */
export const getSessionCache = () => getCacheCacheManager(86400, 'session');

/**
 * Get a cache manager for temporary data
 * TTL: 5 minutes (300 seconds)
 * Namespace: 'temp'
 * Client: Uses cache client (db0)
 *
 * @deprecated Use CacheServiceFactory.createTempCacheService() instead
 * @returns {EnhancedCacheManager} Temporary cache manager instance
 */
export const getTempCache = () => getCacheCacheManager(300, 'temp');
