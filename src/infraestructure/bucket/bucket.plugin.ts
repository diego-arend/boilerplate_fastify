/**
 * Bucket Plugin for Fastify
 *
 * Registers bucket service and connection manager as Fastify decorators
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { BucketConnectionManagerFactory } from './bucketConnectionManager.factory.js';
import { BucketService } from './bucket.service.js';
import type { IBucketConnectionManager } from './bucketConnectionManager.interface.js';
import type { BucketConfig } from './bucket.types.js';

// Declare module augmentation for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    bucketConnectionManager: IBucketConnectionManager;
    bucketService: BucketService;
  }
}

export interface BucketPluginOptions {
  config?: BucketConfig;
  instanceName?: string;
  autoConnect?: boolean;
}

const bucketPlugin: FastifyPluginAsync<BucketPluginOptions> = async (
  fastify: FastifyInstance,
  options: BucketPluginOptions
) => {
  const { config, instanceName = 'default', autoConnect = true } = options;

  try {
    // Create or get connection manager
    const connectionManager = config
      ? BucketConnectionManagerFactory.create(config, instanceName)
      : BucketConnectionManagerFactory.createDefault();

    // Create bucket service
    const bucketService = new BucketService(connectionManager);

    // Auto-connect if enabled and config provided
    if (autoConnect && config) {
      await connectionManager.connect(config);
      fastify.log.info('Bucket service auto-connected');
    } else if (autoConnect && !config) {
      // Use default configuration for auto-connect
      const defaultConfig: BucketConfig = {
        region: process.env.AWS_REGION || 'us-east-1',
        ...(process.env.NODE_ENV === 'development' && {
          endpoint: process.env.MINIO_ENDPOINT || 'http://minio:9000',
          credentials: {
            accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
            secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin123'
          },
          forcePathStyle: true
        }),
        ...(process.env.NODE_ENV === 'production' && {
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
          }
        })
      };

      await connectionManager.connect(defaultConfig);
      fastify.log.info('Bucket service auto-connected with default config');
    }

    // Register decorators
    fastify.decorate('bucketConnectionManager', connectionManager);
    fastify.decorate('bucketService', bucketService);

    // Add graceful shutdown
    fastify.addHook('onClose', async () => {
      fastify.log.info('Disconnecting from bucket service');
      await connectionManager.disconnect();
    });

    fastify.log.info('Bucket plugin registered successfully');
  } catch (error) {
    fastify.log.error(`Failed to register bucket plugin: ${error}`);
    throw error;
  }
};

export default fp(bucketPlugin, {
  name: 'bucket',
  dependencies: []
});
