/**
 * Cache module exports
 * Provides Redis-based caching functionality with dependency injection support
 */

export { RedisConnection, getRedisConnection } from './redis.connection.js';
export { CacheManager, getCacheManager } from './cache.manager.js';
export type { RedisClientType } from './redis.connection.js';
export type { CacheOptions, CacheStats } from './cache.manager.js';

// NEW: Dependency injection exports
export { RedisCacheService, MemoryCacheService, type ICacheService } from './cache.service.js';
export { CacheServiceFactory } from './cache.factory.js';

/**
 * Re-export commonly used cache functionality for convenience
 * DEPRECATED: Use CacheServiceFactory for new implementations
 */

import { getCacheManager } from './cache.manager.js';

/**
 * Get the default cache manager instance with standard configuration
 * TTL: 1 hour (3600 seconds)
 * Namespace: 'app'
 *
 * @deprecated Use CacheServiceFactory.createDefaultCacheService() instead
 * @returns {CacheManager} Pre-configured cache manager instance
 */
export const getDefaultCache = () => getCacheManager(3600, 'app');

/**
 * Get a cache manager for session data
 * TTL: 24 hours (86400 seconds)
 * Namespace: 'session'
 *
 * @deprecated Use CacheServiceFactory.createSessionCacheService() instead
 * @returns {CacheManager} Session cache manager instance
 */
export const getSessionCache = () => getCacheManager(86400, 'session');

/**
 * Get a cache manager for temporary data
 * TTL: 5 minutes (300 seconds)
 * Namespace: 'temp'
 *
 * @deprecated Use CacheServiceFactory.createTempCacheService() instead
 * @returns {CacheManager} Temporary cache manager instance
 */
export const getTempCache = () => getCacheManager(300, 'temp');
