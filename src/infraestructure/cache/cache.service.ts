import type { CacheManager } from './cache.manager.js';

/**
 * Interface defining cache operations contract for dependency injection
 * This allows different cache implementations (Redis, Memory, etc.)
 */
export interface ICacheService {
  // Basic operations
  get<T>(key: string, options?: { namespace?: string }): Promise<T | null>;
  set<T>(key: string, value: T, options?: { ttl?: number; namespace?: string }): Promise<void>;
  del(key: string, options?: { namespace?: string }): Promise<boolean>;
  exists(key: string, options?: { namespace?: string }): Promise<boolean>;
  
  // Advanced operations
  expire(key: string, ttl: number, options?: { namespace?: string }): Promise<boolean>;
  ttl(key: string, options?: { namespace?: string }): Promise<number>;
  clear(namespace?: string): Promise<number>;
  
  // Utility methods
  ping(): Promise<string>;
  isReady(): boolean;
  
  // Statistics (optional - can return null for implementations that don't support it)
  getStats?(): { hits: number; misses: number; sets: number; deletes: number; errors: number } | null;
  getHitRatio?(): number;
  resetStats?(): void;
}

/**
 * Redis-based cache service implementation
 * Adapts CacheManager to ICacheService interface
 */
export class RedisCacheService implements ICacheService {
  constructor(private cacheManager: CacheManager) {}

  async get<T>(key: string, options?: { namespace?: string }): Promise<T | null> {
    return this.cacheManager.get<T>(key, options);
  }

  async set<T>(key: string, value: T, options?: { ttl?: number; namespace?: string }): Promise<void> {
    return this.cacheManager.set(key, value, options);
  }

  async del(key: string, options?: { namespace?: string }): Promise<boolean> {
    return this.cacheManager.del(key, options);
  }

  async exists(key: string, options?: { namespace?: string }): Promise<boolean> {
    return this.cacheManager.exists(key, options);
  }

  async expire(key: string, ttl: number, options?: { namespace?: string }): Promise<boolean> {
    return this.cacheManager.expire(key, ttl, options);
  }

  async ttl(key: string, options?: { namespace?: string }): Promise<number> {
    return this.cacheManager.ttl(key, options);
  }

  async clear(namespace?: string): Promise<number> {
    return this.cacheManager.clear(namespace);
  }

  async ping(): Promise<string> {
    return this.cacheManager.ping();
  }

  isReady(): boolean {
    return this.cacheManager.isReady();
  }

  getStats() {
    return this.cacheManager.getStats();
  }

  getHitRatio(): number {
    return this.cacheManager.getHitRatio();
  }

  resetStats(): void {
    this.cacheManager.resetStats();
  }
}

/**
 * Memory-based cache service for testing or fallback
 * Simple in-memory implementation of ICacheService
 */
export class MemoryCacheService implements ICacheService {
  private cache = new Map<string, { value: any; expires?: number }>();
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0
  };

  async get<T>(key: string, options?: { namespace?: string }): Promise<T | null> {
    const fullKey = this.buildKey(key, options?.namespace);
    const item = this.cache.get(fullKey);

    if (!item) {
      this.stats.misses++;
      return null;
    }

    if (item.expires && Date.now() > item.expires) {
      this.cache.delete(fullKey);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return item.value as T;
  }

  async set<T>(key: string, value: T, options?: { ttl?: number; namespace?: string }): Promise<void> {
    const fullKey = this.buildKey(key, options?.namespace);
    const item: { value: T; expires?: number } = { value };

    if (options?.ttl && options.ttl > 0) {
      item.expires = Date.now() + (options.ttl * 1000);
    }

    this.cache.set(fullKey, item);
    this.stats.sets++;
  }

  async del(key: string, options?: { namespace?: string }): Promise<boolean> {
    const fullKey = this.buildKey(key, options?.namespace);
    const existed = this.cache.has(fullKey);
    this.cache.delete(fullKey);
    
    if (existed) {
      this.stats.deletes++;
    }
    
    return existed;
  }

  async exists(key: string, options?: { namespace?: string }): Promise<boolean> {
    const fullKey = this.buildKey(key, options?.namespace);
    const item = this.cache.get(fullKey);

    if (!item) return false;

    if (item.expires && Date.now() > item.expires) {
      this.cache.delete(fullKey);
      return false;
    }

    return true;
  }

  async expire(key: string, ttl: number, options?: { namespace?: string }): Promise<boolean> {
    const fullKey = this.buildKey(key, options?.namespace);
    const item = this.cache.get(fullKey);

    if (!item) return false;

    item.expires = Date.now() + (ttl * 1000);
    this.cache.set(fullKey, item);
    return true;
  }

  async ttl(key: string, options?: { namespace?: string }): Promise<number> {
    const fullKey = this.buildKey(key, options?.namespace);
    const item = this.cache.get(fullKey);

    if (!item) return -2; // Key doesn't exist

    if (!item.expires) return -1; // No TTL set

    const remaining = Math.ceil((item.expires - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async clear(namespace?: string): Promise<number> {
    if (!namespace) {
      const count = this.cache.size;
      this.cache.clear();
      this.stats.deletes += count;
      return count;
    }

    let count = 0;
    const pattern = `${namespace}:`;
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }

    this.stats.deletes += count;
    return count;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  isReady(): boolean {
    return true;
  }

  getStats() {
    return { ...this.stats };
  }

  getHitRatio(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : (this.stats.hits / total) * 100;
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  private buildKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key;
  }
}