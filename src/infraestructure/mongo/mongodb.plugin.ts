import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type mongoose from 'mongoose';
import { MongoConnectionManagerFactory } from './connectionManager.factory.js';
import { TransactionManagerFactory } from './transactionManager.factory.js';
import type { IMongoConnectionManager } from './connectionManager.interface.js';
import type { ITransactionManager } from './transactionManager.interface.js';

declare module 'fastify' {
  interface FastifyInstance {
    mongoConnectionManager: IMongoConnectionManager;
    transactionManager: ITransactionManager;
    // Legacy support
    mongo: {
      getConnection: () => mongoose.Connection;
      isConnected: () => boolean;
    };
  }
}

interface MongoPluginOptions {
  connectionString?: string;
  skipConnection?: boolean; // For testing
}

/**
 * Fastify plugin for MongoDB with dependency injection
 */
async function mongoPlugin(
  fastify: FastifyInstance,
  options: MongoPluginOptions = {}
): Promise<void> {
  // Create connection manager
  const connectionManager = await MongoConnectionManagerFactory.create(options.connectionString);

  // Connect if not skipped (useful for testing)
  if (!options.skipConnection) {
    await connectionManager.connect();
  }

  // Create transaction manager
  const transactionManager = TransactionManagerFactory.create(connectionManager);

  // Decorate Fastify instance
  fastify.decorate('mongoConnectionManager', connectionManager);
  fastify.decorate('transactionManager', transactionManager);

  // Legacy support
  fastify.decorate('mongo', {
    getConnection: () => connectionManager.getConnection(),
    isConnected: () => connectionManager.isConnected()
  });

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    await connectionManager.disconnect();
  });
}

export default fp(mongoPlugin, {
  name: 'mongodb-plugin',
  fastify: '>=5.0.0'
});
