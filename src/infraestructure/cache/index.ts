/**
 * Cache module exports
 * Provides Redis-based caching functionality for the application
 */

export { RedisConnection, getRedisConnection } from './redis.connection.js';
export { CacheManager, getCacheManager } from './cache.manager.js';
export type { RedisClientType } from './redis.connection.js';
export type { CacheOptions, CacheStats } from './cache.manager.js';

/**
 * Re-export commonly used cache functionality for convenience
 */

import { getCacheManager } from './cache.manager.js';

/**
 * Get the default cache manager instance with standard configuration
 * TTL: 1 hour (3600 seconds)
 * Namespace: 'app'
 * 
 * @returns {CacheManager} Pre-configured cache manager instance
 */
export const getDefaultCache = () => getCacheManager(3600, 'app');

/**
 * Get a cache manager for session data
 * TTL: 24 hours (86400 seconds)
 * Namespace: 'session'
 * 
 * @returns {CacheManager} Session cache manager instance
 */
export const getSessionCache = () => getCacheManager(86400, 'session');

/**
 * Get a cache manager for temporary data
 * TTL: 5 minutes (300 seconds)
 * Namespace: 'temp'
 * 
 * @returns {CacheManager} Temporary cache manager instance
 */
export const getTempCache = () => getCacheManager(300, 'temp');