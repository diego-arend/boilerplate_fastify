import { Model, Document } from 'mongoose';
import type {
  FilterQuery,
  UpdateQuery,
  ClientSession as _ClientSession,
  SaveOptions,
  QueryOptions
} from 'mongoose';
import type {
  IBaseRepository,
  RepositoryOptions,
  PaginationResult as _PaginationResult
} from './interfaces';
import type { IMongoConnectionManager } from './connectionManager.interface';

/**
 * Generic base repository with connection dependency injection
 * Implements IBaseRepository interface for dependency injection
 */
export class BaseRepository<T extends Document> implements IBaseRepository<T> {
  constructor(
    protected model: Model<T>,
    protected connectionManager?: IMongoConnectionManager
  ) {}

  /**
   * Get the connection from the injected connection manager
   */
  protected getConnection() {
    if (this.connectionManager && !this.connectionManager.isConnected()) {
      throw new Error('MongoDB connection is not available');
    }
    return this.connectionManager?.getConnection();
  }

  /**
   * Create a new document
   * @param data - Document data
   * @param options - Repository options including optional session
   */
  async create(data: Partial<T>, options: RepositoryOptions = {}): Promise<T> {
    const document = new this.model(data);
    const saveOptions: SaveOptions = {};

    if (options.session) {
      saveOptions.session = options.session;
    }

    return await document.save(saveOptions);
  }

  /**
   * Create multiple documents
   * @param data - Array of document data
   * @param options - Repository options including optional session
   */
  async createMany(data: Partial<T>[], options: RepositoryOptions = {}): Promise<T[]> {
    const createOptions: any = {};

    if (options.session) {
      createOptions.session = options.session;
    }

    return await this.model.create(data, createOptions);
  }

  /**
   * Find document by ID
   * @param id - Document ID
   * @param options - Repository options including optional session
   */
  async findById(id: string, options: RepositoryOptions = {}): Promise<T | null> {
    const query = this.model.findById(id);

    if (options.session) {
      query.session(options.session);
    }

    return await query.exec();
  }

  /**
   * Find one document by filter
   * @param filter - Filter query
   * @param options - Repository options including optional session
   */
  async findOne(filter: FilterQuery<T>, options: RepositoryOptions = {}): Promise<T | null> {
    const query = this.model.findOne(filter);

    if (options.session) {
      query.session(options.session);
    }

    return await query.exec();
  }

  /**
   * Find multiple documents
   * @param filter - Filter query
   * @param options - Repository options including optional session
   */
  async find(filter: FilterQuery<T> = {}, options: RepositoryOptions = {}): Promise<T[]> {
    const query = this.model.find(filter);

    if (options.session) {
      query.session(options.session);
    }

    return await query.exec();
  }

  /**
   * Update document by ID
   * @param id - Document ID
   * @param update - Update query
   * @param options - Repository options including optional session
   */
  async updateById(
    id: string,
    update: UpdateQuery<T>,
    options: RepositoryOptions = {}
  ): Promise<T | null> {
    const queryOptions: QueryOptions = { new: true };

    if (options.session) {
      queryOptions.session = options.session;
    }

    return await this.model.findByIdAndUpdate(id, update, queryOptions).exec();
  }

  /**
   * Update one document by filter
   * @param filter - Filter query
   * @param update - Update query
   * @param options - Repository options including optional session
   */
  async updateOne(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options: RepositoryOptions = {}
  ): Promise<T | null> {
    const queryOptions: QueryOptions = { new: true };

    if (options.session) {
      queryOptions.session = options.session;
    }

    return await this.model.findOneAndUpdate(filter, update, queryOptions).exec();
  }

  /**
   * Find one document and update it (alias for updateOne)
   * @param filter - Filter query
   * @param update - Update query
   * @param options - Repository options including optional session
   */
  async findOneAndUpdate(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options: RepositoryOptions = {}
  ): Promise<T | null> {
    return await this.updateOne(filter, update, options);
  }

  /**
   * Update multiple documents
   * @param filter - Filter query
   * @param update - Update query
   * @param options - Repository options including optional session
   */
  async updateMany(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options: RepositoryOptions = {}
  ): Promise<{ modifiedCount: number }> {
    const queryOptions: any = {};

    if (options.session) {
      queryOptions.session = options.session;
    }

    const result = await this.model.updateMany(filter, update, queryOptions).exec();
    return { modifiedCount: result.modifiedCount };
  }

  /**
   * Delete document by ID
   * @param id - Document ID
   * @param options - Repository options including optional session
   */
  async deleteById(id: string, options: RepositoryOptions = {}): Promise<boolean> {
    const queryOptions: QueryOptions = {};

    if (options.session) {
      queryOptions.session = options.session;
    }

    const result = await this.model.findByIdAndDelete(id, queryOptions).exec();
    return result !== null;
  }

  /**
   * Delete one document by filter
   * @param filter - Filter query
   * @param options - Repository options including optional session
   */
  async deleteOne(filter: FilterQuery<T>, options: RepositoryOptions = {}): Promise<boolean> {
    const queryOptions: QueryOptions = {};

    if (options.session) {
      queryOptions.session = options.session;
    }

    const result = await this.model.findOneAndDelete(filter, queryOptions).exec();
    return result !== null;
  }

  /**
   * Delete multiple documents
   * @param filter - Filter query
   * @param options - Repository options including optional session
   */
  async deleteMany(
    filter: FilterQuery<T>,
    options: RepositoryOptions = {}
  ): Promise<{ deletedCount: number }> {
    const queryOptions: any = {};

    if (options.session) {
      queryOptions.session = options.session;
    }

    const result = await this.model.deleteMany(filter, queryOptions).exec();
    return { deletedCount: result.deletedCount || 0 };
  }

  /**
   * Count documents
   * @param filter - Filter query
   * @param options - Repository options including optional session
   */
  async count(filter: FilterQuery<T> = {}, options: RepositoryOptions = {}): Promise<number> {
    const query = this.model.countDocuments(filter);

    if (options.session) {
      query.session(options.session);
    }

    return await query.exec();
  }

  /**
   * Find documents with pagination
   * @param filter - Filter query
   * @param page - Page number (1-based)
   * @param limit - Items per page
   * @param sort - Sort options
   * @param options - Repository options including optional session
   */
  async findPaginated(
    filter: FilterQuery<T> = {},
    page: number = 1,
    limit: number = 10,
    sort: Record<string, 1 | -1> = {},
    options: RepositoryOptions = {}
  ): Promise<{
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const skip = (page - 1) * limit;
    const total = await this.count(filter, options);
    const totalPages = Math.ceil(total / limit);

    const query = this.model.find(filter).sort(sort).skip(skip).limit(limit);

    if (options.session) {
      query.session(options.session);
    }

    const data = await query.exec();

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
  }

  /**
   * Check if document exists
   * @param filter - Filter query
   * @param options - Repository options including optional session
   */
  async exists(filter: FilterQuery<T>, options: RepositoryOptions = {}): Promise<boolean> {
    const query = this.model.exists(filter);

    if (options.session) {
      query.session(options.session);
    }

    const result = await query.exec();
    return result !== null;
  }

  /**
   * Find one document and replace it
   * @param filter - Filter query
   * @param replacement - Replacement document
   * @param options - Repository options including optional session
   */
  async replaceOne(
    filter: FilterQuery<T>,
    replacement: Partial<T>,
    options: RepositoryOptions = {}
  ): Promise<T | null> {
    const queryOptions: QueryOptions = { new: true };

    if (options.session) {
      queryOptions.session = options.session;
    }

    return await this.model.findOneAndReplace(filter, replacement, queryOptions).exec();
  }
}
