import 'fastify';
import type mongoose from 'mongoose';
import type { config } from '../../lib/validators/validateEnv.ts';
import type { IMongoConnectionManager } from '../mongo/connectionManager.interface.js';
import type { ITransactionManager } from '../mongo/transactionManager.interface.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: typeof config;
    mongoConnectionManager: IMongoConnectionManager;
    transactionManager: ITransactionManager;
    // Legacy support
    mongo: {
      getConnection: () => mongoose.Connection;
      isConnected: () => boolean;
    };
  }
}
