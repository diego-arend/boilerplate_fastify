/**
 * Bucket Connection Manager Factory
 *
 * Factory for creating bucket connection manager instances
 */

import { BucketConnectionManager } from './bucketConnectionManager.js';
import type { IBucketConnectionManager } from './bucketConnectionManager.interface.js';
import type { BucketConfig } from './bucket.types.js';
import { defaultLogger } from '../../lib/logger/index.js';
import type { Logger } from 'pino';

export class BucketConnectionManagerFactory {
  private static instances: Map<string, IBucketConnectionManager> = new Map();

  /**
   * Create a new bucket connection manager instance
   */
  static create(
    config?: BucketConfig,
    instanceName: string = 'default',
    logger?: Logger
  ): IBucketConnectionManager {
    const finalLogger = logger || defaultLogger.child({ component: 'BucketFactory' });

    if (this.instances.has(instanceName)) {
      finalLogger.debug(`Returning existing bucket connection manager: ${instanceName}`);
      return this.instances.get(instanceName)!;
    }

    const manager = new BucketConnectionManager(finalLogger);

    this.instances.set(instanceName, manager);
    finalLogger.info(`Created new bucket connection manager: ${instanceName}`);

    return manager;
  }

  /**
   * Get existing instance by name
   */
  static getInstance(instanceName: string = 'default'): IBucketConnectionManager | null {
    return this.instances.get(instanceName) || null;
  }

  /**
   * Remove instance
   */
  static async removeInstance(instanceName: string = 'default'): Promise<void> {
    const instance = this.instances.get(instanceName);
    if (instance) {
      await instance.disconnect();
      this.instances.delete(instanceName);
    }
  }

  /**
   * Create default bucket connection manager with environment-based config
   */
  static createDefault(logger?: Logger): IBucketConnectionManager {
    const config: BucketConfig = {
      region: process.env.AWS_REGION || 'us-east-1',
      ...(process.env.NODE_ENV === 'development' && {
        // MinIO configuration for development
        endpoint: process.env.MINIO_ENDPOINT || 'http://minio:9000',
        credentials: {
          accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
          secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin123'
        },
        forcePathStyle: true
      }),
      ...(process.env.NODE_ENV === 'production' && {
        // AWS S3 configuration for production
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
        }
      })
    };

    const manager = this.create(config, 'default', logger);
    return manager;
  }

  /**
   * Clear all instances
   */
  static async clearAll(): Promise<void> {
    const disconnectPromises = Array.from(this.instances.values()).map(instance =>
      instance.disconnect()
    );
    await Promise.all(disconnectPromises);
    this.instances.clear();
  }
}
