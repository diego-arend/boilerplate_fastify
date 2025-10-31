import 'fastify';
import type mongoose from 'mongoose';
import type { config } from '../../lib/validators/validateEnv.ts';
import type { IMongoConnectionManager } from '../mongo/connectionManager.interface';
import type { IPostgresConnectionManager } from '../postgres/postgresConnectionManager.interface';
import type { ITransactionManager } from '../mongo/transactionManager.interface';
import type { QueueManager } from '../queue/queue.manager';
import type { PersistentQueueManager } from '../queue/persistentQueueManager';
import type { IBucketConnectionManager } from '../bucket/bucketConnectionManager.interface';
import type { BucketService } from '../bucket/bucket.service';

declare module 'fastify' {
  interface FastifyInstance {
    config: typeof config;
    mongoConnectionManager: IMongoConnectionManager;
    postgres?: IPostgresConnectionManager;
    transactionManager: ITransactionManager;
    queueManager: QueueManager;
    persistentQueueManager: PersistentQueueManager;
    bucketConnectionManager: IBucketConnectionManager;
    bucketService: BucketService;
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
