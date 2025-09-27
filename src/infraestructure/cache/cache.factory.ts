/**
 * Cache Factory
 *
 * Provides factory methods for the simplified cache structure:
 * - DataCache for application data (Redis db0)
 * - QueueCache for job processing (Redis db1)
 */

import { getDataCache, getQueueCache, initializeCaches, disconnectCaches } from './cache.js';
import type { DataCache, QueueCache } from './cache.js';

/**
 * Cache Factory with static methods
 */
export class CacheServiceFactory {
  /**
   * Get DataCache instance for application data
   * Uses Redis db0 for variables, HTTP requests, and general app caching
   */
  static getDataCache(): DataCache {
    return getDataCache();
  }

  /**
   * Get QueueCache instance for job processing
   * Uses Redis db1 for job batches, worker processing, and queue operations
   */
  static getQueueCache(): QueueCache {
    return getQueueCache();
  }

  /**
   * Initialize all cache instances
   */
  static async initializeAll(): Promise<{ dataCache: DataCache; queueCache: QueueCache }> {
    return initializeCaches();
  }

  /**
   * Disconnect all cache instances
   */
  static async disconnectAll(): Promise<void> {
    return disconnectCaches();
  }

  /**
   * Create in-memory cache service for testing
   */
  static createMemoryCacheService(): any {
    return {
      data: new Map(),
      async get(key: string) {
        return this.data.get(key) || null;
      },
      async set(key: string, value: any) {
        this.data.set(key, value);
      },
      async del(key: string) {
        return this.data.delete(key);
      },
      async exists(key: string) {
        return this.data.has(key);
      },
      async clear() {
        this.data.clear();
        return this.data.size;
      },
      isReady: () => true,
      connect: () => Promise.resolve(),
      disconnect: () => Promise.resolve(),
      ping: () => Promise.resolve('PONG')
    };
  }
}
