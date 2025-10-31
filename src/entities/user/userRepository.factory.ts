import { BaseRepository } from '../../infraestructure/mongo/index.js';
import { UserModel } from './userEntity.js';
import { UserRepository, type IUserRepository } from './userRepository.js';
import type { IUser } from './userEntity.js';
import type { IMongoConnectionManager } from '../../infraestructure/mongo/connectionManager.interface.js';
import { MongoConnectionManagerFactory } from '../../infraestructure/mongo/connectionManager.factory.js';
import { createUserRepositoryPostgresSync } from './userRepository.postgres.factory.js';

/**
 * User Repository Factory - PostgreSQL Primary (MongoDB Deprecated)
 *
 * IMPORTANT: This application now uses PostgreSQL as the primary database.
 * MongoDB support is deprecated and will be removed in a future version.
 *
 * The factory automatically uses PostgreSQL implementation if available.
 * Falls back to MongoDB only if PostgreSQL is not configured.
 */
export class UserRepositoryFactory {
  /**
   * Create UserRepository instance (PostgreSQL primary, MongoDB deprecated)
   *
   * @throws {Error} If PostgreSQL is not configured
   * @returns {Promise<IUserRepository>} UserRepository instance (PostgreSQL or MongoDB)
   */
  static async createUserRepository(
    connectionManager?: IMongoConnectionManager
  ): Promise<IUserRepository | ReturnType<typeof createUserRepositoryPostgresSync>> {
    // Try PostgreSQL first (primary database)
    try {
      const postgresRepo = createUserRepositoryPostgresSync();
      console.log('[UserRepositoryFactory] Using PostgreSQL repository');
      return postgresRepo;
    } catch (error) {
      console.warn(
        '[UserRepositoryFactory] PostgreSQL not available, falling back to MongoDB (DEPRECATED)',
        error
      );

      // Fallback to MongoDB (deprecated)
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
  }

  /**
   * Create PostgreSQL UserRepository explicitly
   *
   * @throws {Error} If PostgreSQL DataSource is not initialized
   * @returns {ReturnType<typeof createUserRepositoryPostgresSync>} PostgreSQL repository
   */
  static createUserRepositoryPostgres() {
    return createUserRepositoryPostgresSync();
  }

  /**
   * Create MongoDB UserRepository explicitly (DEPRECATED)
   *
   * @deprecated Use PostgreSQL implementation instead
   * @param connectionManager - Optional MongoDB connection manager
   * @returns {Promise<IUserRepository>} MongoDB repository
   */
  static async createUserRepositoryMongo(
    connectionManager?: IMongoConnectionManager
  ): Promise<IUserRepository> {
    console.warn('[UserRepositoryFactory] MongoDB is DEPRECATED. Migrate to PostgreSQL.');

    let connManager: IMongoConnectionManager;

    if (connectionManager) {
      connManager = connectionManager;
    } else {
      connManager = await MongoConnectionManagerFactory.create();
    }

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
