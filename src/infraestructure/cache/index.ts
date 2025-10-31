/**
 * Cache Module - Clean Exports
 *
 * Simplified cache structure with two focused implementations:
 * - DataCache: For application data, variables, and HTTP request caching (Redis db0)
 * - QueueCache: For job batches and worker processing (Redis db1)
 */

// Main cache classes and factory functions
export {
  DataCache,
  QueueCache,
  getDataCache,
  getQueueCache,
  initializeCaches,
  disconnectCaches,
  type CacheStats,
  type CacheOptions
} from './cache';

// Factory methods
export { CacheServiceFactory } from './cache.factory';

// Configuration types
export {
  type RedisConfig,
  type RedisAppConfig,
  RedisClientType,
  getCacheRedisConfig,
  getQueueRedisConfig,
  buildRedisUrl
} from './redis.types';

// Cache service interface for compatibility
export interface ICacheService {
  get<T = any>(key: string, options?: any): Promise<T | null>;
  set(key: string, value: any, options?: any): Promise<boolean>;
  del(key: string, options?: any): Promise<boolean>;
  exists(key: string, options?: any): Promise<boolean>;
  keys(pattern: string, options?: any): Promise<string[]>;
  flushAll(): Promise<boolean>;
  getStats(): any;
}
