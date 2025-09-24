import { BaseRepository } from '../../infraestructure/mongo/index.js';
import { UserModel } from './userEntity.js';
import { UserRepository, type IUserRepository } from './userRepository.js';
import type { IUser } from './userEntity.js';
import type { IMongoConnectionManager } from '../../infraestructure/mongo/connectionManager.interface.js';
import { MongoConnectionManagerFactory } from '../../infraestructure/mongo/connectionManager.factory.js';

/**
 * Factory class for creating User-related repositories with proper dependency injection
 * This ensures proper separation of concerns and testability
 */
export class UserRepositoryFactory {
  /**
   * Create UserRepository instance with injected dependencies
   */
  static async createUserRepository(
    connectionManager?: IMongoConnectionManager
  ): Promise<IUserRepository> {
    let connManager: IMongoConnectionManager;

    if (connectionManager) {
      connManager = connectionManager;
    } else {
      connManager = await MongoConnectionManagerFactory.create();
    }

    // Wait for connection to be established
    if (!connManager.isConnected()) {
      await connManager.connect();
    }

    const baseRepository = new BaseRepository<IUser>(UserModel, connManager);
    return new UserRepository(baseRepository);
  }

  /**
   * Create UserRepository instance for testing with mocked BaseRepository
   * @param mockBaseRepository - Mocked BaseRepository for testing
   */
  static createUserRepositoryForTesting(mockBaseRepository: any): IUserRepository {
    return new UserRepository(mockBaseRepository);
  }
}
