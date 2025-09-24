/**
 * Queue Manager Factory
 * Creates and initializes the queue system with all dependencies
 */

import type { FastifyBaseLogger } from 'fastify';
import type { config } from '../../lib/validators/validateEnv.js';

import { QueueManager } from './queue.manager.js';
import { JobRepositoryFactory } from '../../entities/job/index.js';
import { DLQRepositoryFactory } from '../../entities/dlq/index.js';
import { MongoConnectionManagerFactory } from '../mongo/index.js';
import type { QueueConfig } from './queue.types.js';

/**
 * Factory for creating Queue Manager with all dependencies
 */
export class QueueFactory {
  /**
   * Create a Queue Manager with default configuration
   */
  static async createDefault(
    appConfig: typeof config,
    logger: FastifyBaseLogger
  ): Promise<QueueManager> {
    // Create repositories
    const connectionManager = await MongoConnectionManagerFactory.create();
    const jobRepository = await JobRepositoryFactory.create(connectionManager);
    const dlqRepository = await DLQRepositoryFactory.create(connectionManager);

    // Queue configuration
    const redisConfig: { host: string; port: number; password?: string; db?: number } = {
      host: appConfig.QUEUE_REDIS_HOST || appConfig.REDIS_HOST,
      port: appConfig.QUEUE_REDIS_PORT || appConfig.REDIS_PORT,
      db: appConfig.QUEUE_REDIS_DB || 1
    };

    if (appConfig.QUEUE_REDIS_PASSWORD || appConfig.REDIS_PASSWORD) {
      redisConfig.password = (appConfig.QUEUE_REDIS_PASSWORD || appConfig.REDIS_PASSWORD)!;
    }

    const queueConfig: QueueConfig = {
      name: 'queue',

      mongodb: {
        enabled: true,
        connectionString: appConfig.MONGO_URI
      },

      redis: redisConfig,

      batch: {
        size: 50,
        ttl: 1800, // 30 minutes
        priorityLevels: {
          critical: { min: 15, max: 20 },
          high: { min: 10, max: 14 },
          normal: { min: 5, max: 9 },
          low: { min: 1, max: 4 }
        }
      },

      worker: {
        lockTimeout: 300000, // 5 minutes
        heartbeatInterval: 30000, // 30 seconds
        maxRetries: 3
      },

      cache: {
        namespace: 'queue',
        ttl: 1800, // 30 minutes
        refreshThreshold: 0.8 // 80%
      },

      dlq: {
        autoMove: true,
        maxReprocessAttempts: 3,
        cleanupInterval: 24, // 24 hours
        retentionDays: 30
      }
    };

    // Create and initialize the queue manager
    const queueManager = new QueueManager(queueConfig, jobRepository, dlqRepository, logger);

    await queueManager.initialize();

    return queueManager;
  }

  /**
   * Create Queue Manager with custom configuration
   */
  static async createWithConfig(
    queueConfig: QueueConfig,
    logger: FastifyBaseLogger
  ): Promise<QueueManager> {
    const connectionManager = await MongoConnectionManagerFactory.create();
    const jobRepository = await JobRepositoryFactory.create(connectionManager);
    const dlqRepository = await DLQRepositoryFactory.create(connectionManager);

    const manager = new QueueManager(queueConfig, jobRepository, dlqRepository, logger);

    await manager.initialize();

    return manager;
  }
}

/**
 * Singleton instance for default usage
 */
let defaultQueueManager: QueueManager | null = null;

/**
 * Get default Queue Manager instance (singleton)
 */
export async function getDefaultQueueManager(
  appConfig: typeof config,
  logger: FastifyBaseLogger
): Promise<QueueManager> {
  if (!defaultQueueManager) {
    defaultQueueManager = await QueueFactory.createDefault(appConfig, logger);
  }
  return defaultQueueManager;
}

/**
 * Reset the default queue manager (useful for testing)
 */
export function resetDefaultQueueManager(): void {
  defaultQueueManager = null;
}
