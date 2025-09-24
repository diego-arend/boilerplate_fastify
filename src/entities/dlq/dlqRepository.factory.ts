import type { IBaseRepository } from '../../infraestructure/mongo/index.js';
import { DLQModel, type IDLQ } from './dlqEntity.js';
import { BaseRepository } from '../../infraestructure/mongo/index.js';
import type { IMongoConnectionManager } from '../../infraestructure/mongo/connectionManager.interface.js';

/**
 * DLQ Repository Factory
 * Creates DLQ repository instances with proper dependency injection
 */
export class DLQRepositoryFactory {
  /**
   * Create a DLQ repository with injected dependencies
   * @param connectionManager MongoDB connection manager
   * @returns Promise<IDLQRepository> DLQ repository instance
   */
  static async create(connectionManager: IMongoConnectionManager) {
    // Wait for connection to be established
    if (!connectionManager.isConnected()) {
      await connectionManager.connect();
    }

    // Create base repository with the DLQ model
    const baseRepository: IBaseRepository<IDLQ> = new BaseRepository(DLQModel, connectionManager);

    // Return repository instance
    return new (await import('./dlqRepository.js')).DLQRepository(baseRepository);
  }
}
