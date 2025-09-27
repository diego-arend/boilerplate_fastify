import 'fastify';
import type mongoose from 'mongoose';
import type { config } from '../../lib/validators/validateEnv.ts';
import type { IMongoConnectionManager } from '../mongo/connectionManager.interface.js';
import type { ITransactionManager } from '../mongo/transactionManager.interface.js';
import type { QueueManager } from '../queue/queue.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: typeof config;
    mongoConnectionManager: IMongoConnectionManager;
    transactionManager: ITransactionManager;
    queueManager: QueueManager;
    addJob: (
      jobId: string,
      type: string,
      data: any,
      options?: {
        priority?: number;
        attempts?: number;
        delay?: number;
        scheduledFor?: Date;
      }
    ) => Promise<string>;
    // Legacy support
    mongo: {
      getConnection: () => mongoose.Connection;
      isConnected: () => boolean;
    };
  }
}
