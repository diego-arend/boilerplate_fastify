import type { IBaseRepository } from '../../mongo/index.js';
import { JobModel, type IJob } from '../../../entities/job/index.js';
import { JobRepository, type IJobRepository } from './job.repository.js';
import { BaseRepository } from '../../mongo/index.js';
import type { IMongoConnectionManager } from '../../mongo/connectionManager.interface.js';
import { MongoConnectionManagerFactory } from '../../mongo/connectionManager.factory.js';

/**
 * Job Repository Factory
 * Creates job repository instances with proper dependency injection
 */
export class JobRepositoryFactory {
  /**
   * Create a job repository with default configuration
   */
  static async createDefault(): Promise<IJobRepository> {
    const connectionManager = await MongoConnectionManagerFactory.create();
    return await JobRepositoryFactory.create(connectionManager);
  }

  /**
   * Create a job repository with injected dependencies
   * @param connectionManager MongoDB connection manager
   * @returns Promise<IJobRepository> Job repository instance
   */
  static async create(connectionManager: IMongoConnectionManager): Promise<IJobRepository> {
    // Wait for connection to be established
    if (!connectionManager.isConnected()) {
      await connectionManager.connect();
    }

    // Create base repository with the job model
    const baseRepository: IBaseRepository<IJob> = new BaseRepository(JobModel, connectionManager);

    // Return repository instance
    return new JobRepository(baseRepository);
  }
}
