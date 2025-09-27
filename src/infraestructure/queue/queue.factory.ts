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

    // Create and initialize the queue manager
    const queueManager = new QueueManager(jobRepository, dlqRepository, logger);

    await queueManager.initialize();

    return queueManager;
  }

  /**
   * Create Queue Manager with custom repositories
   */
  static async createWithRepositories(
    jobRepository: any,
    dlqRepository: any,
    logger: FastifyBaseLogger
  ): Promise<QueueManager> {
    const manager = new QueueManager(jobRepository, dlqRepository, logger);

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
