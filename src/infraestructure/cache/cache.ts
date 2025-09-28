/**
 * Simplified Cache Module
 *
 * Provides two focused cache implementations:
 * - DataCache: For application data, variables, and HTTP request caching (Redis db0)
 * - QueueCache: For job batches and worker processing (Redis db1)
 */

import { createClient, type RedisClientType } from 'redis';
import {
  getCacheRedisConfig,
  getQueueRedisConfig,
  buildRedisUrl,
  type RedisAppConfig
} from './redis.types.js';
import { defaultLogger } from '../../lib/logger/index.js';

const logger = defaultLogger;

// Get configuration from environment
const appConfig: RedisAppConfig = {
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_DB: parseInt(process.env.REDIS_DB || '0'),
  QUEUE_REDIS_HOST: process.env.QUEUE_REDIS_HOST,
  QUEUE_REDIS_PORT: process.env.QUEUE_REDIS_PORT
    ? parseInt(process.env.QUEUE_REDIS_PORT)
    : undefined,
  QUEUE_REDIS_PASSWORD: process.env.QUEUE_REDIS_PASSWORD,
  QUEUE_REDIS_DB: process.env.QUEUE_REDIS_DB ? parseInt(process.env.QUEUE_REDIS_DB) : undefined
};

/**
 * Base cache statistics interface
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

/**
 * Cache operation options
 */
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
}

/**
 * Base cache class with common functionality
 */
abstract class BaseCache {
  protected client: any; // Using any to avoid complex type issues
  protected stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0
  };

  constructor(client: any) {
    this.client = client;
    this.setupErrorHandlers();
  }

  /**
   * Build cache key with optional prefix
   */
  protected buildKey(key: string, prefix?: string): string {
    const sanitizedKey = key.replace(/[^\w\-:.]/g, '_');
    return prefix ? `${prefix}:${sanitizedKey}` : sanitizedKey;
  }

  /**
   * Setup Redis error handlers
   */
  private setupErrorHandlers(): void {
    this.client.on('error', (error: Error) => {
      logger.error('Redis error:', { error });
      this.stats.errors++;
    });

    this.client.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    this.client.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  /**
   * Check connection health
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Cache ping failed:', { error: error as Error });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}

/**
 * Data Cache - Redis db0
 * Optimized for application data, variables, and HTTP request caching
 */
export class DataCache extends BaseCache {
  private static instance: DataCache | null = null;

  private constructor() {
    const config = getCacheRedisConfig(appConfig);
    const client = createClient({
      url: buildRedisUrl(config),
      database: 0
    });

    super(client);
    logger.info('DataCache initialized for application data (db0)');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DataCache {
    if (!DataCache.instance) {
      DataCache.instance = new DataCache();
    }
    return DataCache.instance!;
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      await this.connect();
      const finalKey = this.buildKey(key, options.prefix);
      const value = await this.client.get(finalKey);

      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('DataCache get error:', { error: error as Error });
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    try {
      await this.connect();
      const finalKey = this.buildKey(key, options.prefix);
      const serializedValue = JSON.stringify(value);

      let result: string | null;
      if (options.ttl) {
        result = await this.client.setEx(finalKey, options.ttl, serializedValue);
      } else {
        result = await this.client.set(finalKey, serializedValue);
      }

      if (result === 'OK') {
        this.stats.sets++;
        return true;
      }
      return false;
    } catch (error) {
      logger.error('DataCache set error:', { error: error as Error });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async del(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      await this.connect();
      const finalKey = this.buildKey(key, options.prefix);
      const result = await this.client.del(finalKey);

      if (result > 0) {
        this.stats.deletes++;
        return true;
      }
      return false;
    } catch (error) {
      logger.error('DataCache del error:', { error: error as Error });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      await this.connect();
      const finalKey = this.buildKey(key, options.prefix);
      const result = await this.client.exists(finalKey);
      return result === 1;
    } catch (error) {
      logger.error('DataCache exists error:', { error: error as Error });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Set key expiration
   */
  async expire(key: string, ttl: number, options: CacheOptions = {}): Promise<boolean> {
    try {
      await this.connect();
      const finalKey = this.buildKey(key, options.prefix);
      const result = await this.client.expire(finalKey, ttl);
      return Boolean(result);
    } catch (error) {
      logger.error('DataCache expire error:', { error: error as Error });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get keys matching pattern
   */
  async keys(pattern: string, options: CacheOptions = {}): Promise<string[]> {
    try {
      await this.connect();
      const finalPattern = this.buildKey(pattern, options.prefix);
      return await this.client.keys(finalPattern);
    } catch (error) {
      logger.error('DataCache keys error:', { error: error as Error });
      this.stats.errors++;
      return [];
    }
  }

  /**
   * Flush all data cache (use with caution)
   */
  async flushAll(): Promise<boolean> {
    try {
      await this.connect();
      await this.client.flushDb();
      return true;
    } catch (error) {
      logger.error('DataCache flushAll error:', { error: error as Error });
      this.stats.errors++;
      return false;
    }
  }
}

/**
 * Queue Cache - Redis db1
 * Optimized for job batches and worker processing
 */
export class QueueCache extends BaseCache {
  private static instance: QueueCache | null = null;

  private constructor() {
    const config = getQueueRedisConfig(appConfig);
    const client = createClient({
      url: buildRedisUrl(config),
      database: 1
    });

    super(client);
    logger.info('QueueCache initialized for job processing (db1)');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): QueueCache {
    if (!QueueCache.instance) {
      QueueCache.instance = new QueueCache();
    }
    return QueueCache.instance!;
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  /**
   * Push job to queue
   */
  async pushJob(queueName: string, jobData: any, priority: number = 0): Promise<boolean> {
    try {
      await this.connect();
      const queueKey = this.buildKey(`jobs:${queueName}`);
      const job = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        data: jobData,
        priority,
        createdAt: new Date().toISOString()
      };

      const result = await this.client.zAdd(queueKey, {
        score: priority,
        value: JSON.stringify(job)
      });

      if (result > 0) {
        this.stats.sets++;
        return true;
      }
      return false;
    } catch (error) {
      logger.error('QueueCache pushJob error:', { error: error as Error });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Pop job from queue (highest priority first)
   */
  async popJob(queueName: string): Promise<any | null> {
    try {
      await this.connect();
      const queueKey = this.buildKey(`jobs:${queueName}`);

      // Get highest priority job using zRange with REV option
      const jobs = await this.client.zRange(queueKey, 0, 0, { REV: true });

      if (jobs.length === 0 || !jobs[0]) {
        this.stats.misses++;
        return null;
      }

      // Remove the job from queue
      await this.client.zRem(queueKey, jobs[0]);

      this.stats.hits++;
      return JSON.parse(jobs[0]);
    } catch (error) {
      logger.error('QueueCache popJob error:', { error: error as Error });
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Get queue length
   */
  async getQueueLength(queueName: string): Promise<number> {
    try {
      await this.connect();
      const queueKey = this.buildKey(`jobs:${queueName}`);
      return await this.client.zCard(queueKey);
    } catch (error) {
      logger.error('QueueCache getQueueLength error:', { error: error as Error });
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Peek at next job without removing it
   */
  async peekJob(queueName: string): Promise<any | null> {
    try {
      await this.connect();
      const queueKey = this.buildKey(`jobs:${queueName}`);
      const jobs = await this.client.zRange(queueKey, 0, 0, { REV: true });

      if (jobs.length === 0 || !jobs[0]) {
        return null;
      }

      return JSON.parse(jobs[0]);
    } catch (error) {
      logger.error('QueueCache peekJob error:', { error: error as Error });
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Clear entire queue
   */
  async clearQueue(queueName: string): Promise<boolean> {
    try {
      await this.connect();
      const queueKey = this.buildKey(`jobs:${queueName}`);
      const result = await this.client.del(queueKey);

      if (result > 0) {
        this.stats.deletes++;
        return true;
      }
      return false;
    } catch (error) {
      logger.error('QueueCache clearQueue error:', { error: error as Error });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get all queue names
   */
  async getQueueNames(): Promise<string[]> {
    try {
      await this.connect();
      const pattern = this.buildKey('jobs:*');
      const keys = await this.client.keys(pattern);

      // Extract queue names from keys
      return keys
        .map((key: string) => {
          const match = key.match(/jobs:(.+)$/);
          return match ? match[1] : key;
        })
        .filter((name: string | undefined): name is string => Boolean(name));
    } catch (error) {
      logger.error('QueueCache getQueueNames error:', { error: error as Error });
      this.stats.errors++;
      return [];
    }
  }

  /**
   * Set job processing status
   */
  async setJobStatus(
    jobId: string,
    status: 'processing' | 'completed' | 'failed',
    result?: any
  ): Promise<boolean> {
    try {
      await this.connect();
      const statusKey = this.buildKey(`status:${jobId}`);
      const statusData = {
        status,
        result,
        updatedAt: new Date().toISOString()
      };

      const success = await this.client.setEx(statusKey, 3600, JSON.stringify(statusData)); // 1 hour TTL

      if (success === 'OK') {
        this.stats.sets++;
        return true;
      }
      return false;
    } catch (error) {
      logger.error('QueueCache setJobStatus error:', { error: error as Error });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get job processing status
   */
  async getJobStatus(jobId: string): Promise<any | null> {
    try {
      await this.connect();
      const statusKey = this.buildKey(`status:${jobId}`);
      const status = await this.client.get(statusKey);

      if (status === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return JSON.parse(status);
    } catch (error) {
      logger.error('QueueCache getJobStatus error:', { error: error as Error });
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Get BullMQ compatible Redis configuration
   */
  getBullMQConnectionConfig(): {
    host: string;
    port: number;
    db: number;
    password?: string;
    maxRetriesPerRequest: null;
  } {
    const config = getQueueRedisConfig(appConfig);
    const bullConfig: {
      host: string;
      port: number;
      db: number;
      password?: string;
      maxRetriesPerRequest: null;
    } = {
      host: config.host,
      port: config.port,
      db: config.db,
      maxRetriesPerRequest: null // Required by BullMQ
    };

    if (config.password) {
      bullConfig.password = config.password;
    }

    return bullConfig;
  }

  /**
   * Check if QueueCache is ready for BullMQ integration
   */
  async isReadyForBullMQ(): Promise<boolean> {
    try {
      await this.connect();
      const isConnected = this.client.isOpen;
      const canPing = await this.ping();

      return isConnected && canPing;
    } catch (error) {
      logger.error('QueueCache BullMQ readiness check failed:', { error: error as Error });
      return false;
    }
  }

  /**
   * Get connection information for monitoring
   */
  getConnectionInfo(): {
    host: string;
    port: number;
    db: number;
    connected: boolean;
  } {
    const config = getQueueRedisConfig(appConfig);
    return {
      host: config.host,
      port: config.port,
      db: config.db,
      connected: this.client?.isOpen || false
    };
  }

  /**
   * Create Redis client instance for external use (BullMQ)
   * This provides a properly configured Redis client without breaking encapsulation
   */
  async createBullMQClient(): Promise<any> {
    const config = this.getBullMQConnectionConfig();

    // Import Redis from ioredis for BullMQ compatibility
    const { Redis } = await import('ioredis');

    const client = new Redis(config);

    // Setup error handlers for the new client
    client.on('error', (error: Error) => {
      logger.error('BullMQ Redis client error:', { error });
      this.stats.errors++;
    });

    client.on('connect', () => {
      logger.debug('BullMQ Redis client connected');
    });

    client.on('reconnecting', () => {
      logger.debug('BullMQ Redis client reconnecting...');
    });

    return client;
  }
}

/**
 * Factory function to get DataCache instance
 */
export const getDataCache = (): DataCache => {
  return DataCache.getInstance();
};

/**
 * Factory function to get QueueCache instance
 */
export const getQueueCache = (): QueueCache => {
  return QueueCache.getInstance();
};

/**
 * Initialize both cache instances
 */
export const initializeCaches = async (): Promise<{
  dataCache: DataCache;
  queueCache: QueueCache;
}> => {
  const dataCache = getDataCache();
  const queueCache = getQueueCache();

  // Test connections
  const dataHealthy = await dataCache.ping();
  const queueHealthy = await queueCache.ping();

  if (!dataHealthy) {
    logger.warn('DataCache connection failed');
  }

  if (!queueHealthy) {
    logger.warn('QueueCache connection failed');
  }

  logger.info('Cache modules initialized', {
    dataCache: dataHealthy ? 'healthy' : 'unhealthy',
    queueCache: queueHealthy ? 'healthy' : 'unhealthy'
  });

  return { dataCache, queueCache };
};

/**
 * Disconnect all cache instances
 */
export const disconnectCaches = async (): Promise<void> => {
  const promises: Promise<void>[] = [];

  const dataInstance = DataCache.getInstance();
  const queueInstance = QueueCache.getInstance();

  if (dataInstance) {
    promises.push(dataInstance.disconnect());
  }

  if (queueInstance) {
    promises.push(queueInstance.disconnect());
  }

  await Promise.all(promises);
  logger.info('All cache connections disconnected');
};
