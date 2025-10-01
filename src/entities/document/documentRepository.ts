/**
 * Document Repository - Following project patterns with dependency injection
 */

import type { ClientSession } from 'mongoose';
import type { IDocument } from './documentEntity.js';
import { DocumentModel } from './documentEntity.js';
import type {
  IBaseRepository,
  RepositoryOptions,
  PaginationOptions,
  PaginationResult
} from '../../infraestructure/mongo/index.js';

/**
 * Interface for Document Repository operations
 */
export interface IDocumentRepository {
  // Basic CRUD operations
  createDocument(documentData: Partial<IDocument>, session?: ClientSession): Promise<IDocument>;
  findById(id: string, session?: ClientSession): Promise<IDocument | null>;
  updateById(
    id: string,
    updateData: Partial<IDocument>,
    session?: ClientSession
  ): Promise<IDocument | null>;
  deleteById(id: string, session?: ClientSession): Promise<boolean>;

  // Document-specific operations
  findByUserId(userId: string, session?: ClientSession): Promise<IDocument[]>;
  findByUserIdPaginated(
    userId: string,
    limit: number,
    offset: number,
    session?: ClientSession
  ): Promise<{ documents: IDocument[]; total: number }>;
  findByBucketKey(bucketKey: string, session?: ClientSession): Promise<IDocument | null>;
  findByFilename(filename: string, session?: ClientSession): Promise<IDocument | null>;

  // Query operations with pagination
  findDocumentsWithPagination(
    filters: Record<string, any>,
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IDocument>>;

  // Utility operations
  exists(filters: Record<string, any>, session?: ClientSession): Promise<boolean>;
  count(filters: Record<string, any>, session?: ClientSession): Promise<number>;
  getDocumentStats(session?: ClientSession): Promise<{
    total: number;
    totalSize: number;
    byMimeType: Record<string, number>;
  }>;
}

/**
 * Document Repository - Handles all database operations for Document entity
 * Uses composition with BaseRepository instead of inheritance
 */
export class DocumentRepository implements IDocumentRepository {
  constructor(private baseRepository: IBaseRepository<IDocument>) {}

  /**
   * Helper to create repository options with session
   */
  private getRepoOptions(session?: ClientSession): RepositoryOptions {
    return session ? { session } : {};
  }

  // ==========================================
  // BASIC CRUD OPERATIONS
  // ==========================================

  /**
   * Create a new document
   */
  async createDocument(
    documentData: Partial<IDocument>,
    session?: ClientSession
  ): Promise<IDocument> {
    return this.baseRepository.create(documentData, this.getRepoOptions(session));
  }

  /**
   * Find document by ID
   */
  async findById(id: string, session?: ClientSession): Promise<IDocument | null> {
    return this.baseRepository.findById(id, this.getRepoOptions(session));
  }

  /**
   * Update document by ID
   */
  async updateById(
    id: string,
    updateData: Partial<IDocument>,
    session?: ClientSession
  ): Promise<IDocument | null> {
    return this.baseRepository.updateById(id, { $set: updateData }, this.getRepoOptions(session));
  }

  /**
   * Delete document by ID
   */
  async deleteById(id: string, session?: ClientSession): Promise<boolean> {
    return this.baseRepository.deleteById(id, this.getRepoOptions(session));
  }

  // ==========================================
  // DOCUMENT-SPECIFIC OPERATIONS
  // ==========================================

  /**
   * Find all documents by user ID
   */
  async findByUserId(userId: string, session?: ClientSession): Promise<IDocument[]> {
    return await DocumentModel.find({ uploadedBy: userId })
      .sort({ createdAt: -1 })
      .session(session || null);
  }

  /**
   * Find documents by user ID with pagination
   */
  async findByUserIdPaginated(
    userId: string,
    limit: number = 10,
    offset: number = 0,
    session?: ClientSession
  ): Promise<{ documents: IDocument[]; total: number }> {
    const [documents, total] = await Promise.all([
      DocumentModel.find({ uploadedBy: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .session(session || null),
      DocumentModel.countDocuments({ uploadedBy: userId }).session(session || null)
    ]);

    return { documents, total };
  }

  /**
   * Find document by bucket key
   */
  async findByBucketKey(bucketKey: string, session?: ClientSession): Promise<IDocument | null> {
    return this.baseRepository.findOne({ bucketKey }, this.getRepoOptions(session));
  }

  /**
   * Find document by filename
   */
  async findByFilename(filename: string, session?: ClientSession): Promise<IDocument | null> {
    return this.baseRepository.findOne({ filename }, this.getRepoOptions(session));
  }

  // ==========================================
  // QUERY OPERATIONS WITH PAGINATION
  // ==========================================

  /**
   * Find documents with pagination and filtering
   */
  async findDocumentsWithPagination(
    filters: Record<string, any> = {},
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IDocument>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    // Build sort object
    const sort: Record<string, 1 | -1> = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    return this.baseRepository.findPaginated(
      filters,
      page,
      limit,
      sort,
      this.getRepoOptions(session)
    );
  }

  // ==========================================
  // UTILITY OPERATIONS
  // ==========================================

  /**
   * Check if document exists
   */
  async exists(filters: Record<string, any>, session?: ClientSession): Promise<boolean> {
    return this.baseRepository.exists(filters, this.getRepoOptions(session));
  }

  /**
   * Count documents
   */
  async count(filters: Record<string, any>, session?: ClientSession): Promise<number> {
    return this.baseRepository.count(filters, this.getRepoOptions(session));
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(session?: ClientSession): Promise<{
    total: number;
    totalSize: number;
    byMimeType: Record<string, number>;
  }> {
    const sessionOption = session ? { session } : {};

    const [total, totalSizeResult, mimeTypeStats] = await Promise.all([
      DocumentModel.countDocuments({}).session(session || null),
      DocumentModel.aggregate([
        { $group: { _id: null, totalSize: { $sum: '$fileSize' } } }
      ]).session(session || null),
      DocumentModel.aggregate([{ $group: { _id: '$mimeType', count: { $sum: 1 } } }]).session(
        session || null
      )
    ]);

    const totalSize = totalSizeResult[0]?.totalSize || 0;
    const byMimeType: Record<string, number> = {};

    mimeTypeStats.forEach((stat: any) => {
      byMimeType[stat._id] = stat.count;
    });

    return {
      total,
      totalSize,
      byMimeType
    };
  }
}
