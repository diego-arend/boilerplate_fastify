import type { Document, FilterQuery, UpdateQuery, ClientSession } from 'mongoose';

/**
 * Options for repository operations that may include a session
 */
export interface RepositoryOptions {
  session?: ClientSession;
}

/**
 * Pagination result interface
 */
export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Pagination options interface
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Interface for base repository operations
 */
export interface IBaseRepository<T extends Document> {
  // Create operations
  create(data: Partial<T>, options?: RepositoryOptions): Promise<T>;
  createMany(data: Partial<T>[], options?: RepositoryOptions): Promise<T[]>;

  // Read operations
  findById(id: string, options?: RepositoryOptions): Promise<T | null>;
  findOne(filter: FilterQuery<T>, options?: RepositoryOptions): Promise<T | null>;
  find(filter?: FilterQuery<T>, options?: RepositoryOptions): Promise<T[]>;
  findPaginated(
    filter?: FilterQuery<T>,
    page?: number,
    limit?: number,
    sort?: Record<string, 1 | -1>,
    options?: RepositoryOptions
  ): Promise<PaginationResult<T>>;

  // Update operations
  updateById(id: string, update: UpdateQuery<T>, options?: RepositoryOptions): Promise<T | null>;
  updateOne(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: RepositoryOptions
  ): Promise<T | null>;
  updateMany(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: RepositoryOptions
  ): Promise<{ modifiedCount: number }>;
  replaceOne(
    filter: FilterQuery<T>,
    replacement: Partial<T>,
    options?: RepositoryOptions
  ): Promise<T | null>;

  // Delete operations
  deleteById(id: string, options?: RepositoryOptions): Promise<boolean>;
  deleteOne(filter: FilterQuery<T>, options?: RepositoryOptions): Promise<boolean>;
  deleteMany(
    filter: FilterQuery<T>,
    options?: RepositoryOptions
  ): Promise<{ deletedCount: number }>;

  // Utility operations
  count(filter?: FilterQuery<T>, options?: RepositoryOptions): Promise<number>;
  exists(filter: FilterQuery<T>, options?: RepositoryOptions): Promise<boolean>;
}
