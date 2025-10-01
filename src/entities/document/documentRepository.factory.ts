import { BaseRepository } from '../../infraestructure/mongo/index.js';
import { DocumentModel } from './documentEntity.js';
import { DocumentRepository, type IDocumentRepository } from './documentRepository.js';
import type { IDocument } from './documentEntity.js';
import type { IMongoConnectionManager } from '../../infraestructure/mongo/connectionManager.interface.js';
import { MongoConnectionManagerFactory } from '../../infraestructure/mongo/connectionManager.factory.js';

/**
 * Factory class for creating Document-related repositories with proper dependency injection
 * This ensures proper separation of concerns and testability
 */
export class DocumentRepositoryFactory {
  /**
   * Create DocumentRepository instance with injected dependencies
   */
  static async createDocumentRepository(
    connectionManager?: IMongoConnectionManager
  ): Promise<IDocumentRepository> {
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

    const baseRepository = new BaseRepository<IDocument>(DocumentModel, connManager);
    return new DocumentRepository(baseRepository);
  }

  /**
   * Create DocumentRepository instance for testing with mocked BaseRepository
   * @param mockBaseRepository - Mocked BaseRepository for testing
   */
  static createDocumentRepositoryForTesting(mockBaseRepository: any): IDocumentRepository {
    return new DocumentRepository(mockBaseRepository);
  }
}
