/**
 * Document Service - Following project patterns like AuthService
 */

import crypto from 'node:crypto';
import path from 'node:path';
import { defaultLogger } from '../../../lib/logger/index.js';
import type { Logger } from 'pino';
import {
  DocumentRepositoryFactory,
  type IDocumentRepository
} from '../../../entities/document/index.js';
import type { IDocument } from '../../../entities/document/index.js';

export interface UploadFileOptions {
  file: Buffer;
  originalName: string;
  mimeType: string;
  uploadedBy: string;
  bucket?: string;
}

export class DocumentService {
  private repository!: IDocumentRepository;
  private logger: Logger;
  private repositoryInitialized = false;

  constructor(logger?: Logger, repository?: IDocumentRepository) {
    this.logger = logger || defaultLogger.child({ component: 'DocumentService' });

    if (repository) {
      this.repository = repository;
      this.repositoryInitialized = true;
    }
  }

  /**
   * Initialize service - must be called before using any service methods
   */
  async initialize(): Promise<void> {
    if (!this.repositoryInitialized) {
      try {
        this.repository = await DocumentRepositoryFactory.createDocumentRepository();
        this.repositoryInitialized = true;
        this.logger.info('DocumentRepository initialized successfully');
      } catch (error) {
        this.logger.error({ error }, 'Failed to initialize DocumentRepository');
        throw error;
      }
    }
  }

  /**
   * Upload CSV file to bucket
   * Note: bucketService will be injected through the controller call
   */
  async uploadFile(options: UploadFileOptions, bucketService: any): Promise<IDocument> {
    if (!this.repositoryInitialized) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    const { file, originalName, mimeType, uploadedBy, bucket = 'documents' } = options;

    // Validate CSV mime type with safe checks
    const safeMimeType = mimeType || '';
    const safeOriginalName = originalName || '';

    if (!safeMimeType.includes('csv') && !safeOriginalName.toLowerCase().endsWith('.csv')) {
      throw new Error('Only CSV files are allowed');
    }

    // Generate unique filename
    const fileExtension = path.extname(originalName);
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const filename = `${timestamp}-${randomString}${fileExtension}`;
    const bucketKey = `${uploadedBy}/${filename}`;

    // Create document record using the interface method
    const document = await this.repository.createDocument({
      filename,
      originalName,
      fileSize: file.length,
      mimeType,
      uploadedBy,
      bucketKey
    });

    try {
      // Upload to bucket
      await bucketService.uploadFile({
        bucket,
        key: bucketKey,
        body: file,
        contentType: mimeType
      });

      // Generate presigned URL
      const presignedUrl = await bucketService.getPresignedUrl({
        bucket,
        key: bucketKey,
        expiresIn: 3600 // 1 hour
      });

      const expiryDate = new Date(Date.now() + 3600 * 1000);

      // Update document with presigned URL
      await this.repository.updateById(String(document._id), {
        presignedUrl,
        presignedUrlExpiry: expiryDate
      });

      const updatedDocument = await this.repository.findById(String(document._id));
      this.logger.info(`CSV uploaded: ${String(document._id)} (${originalName})`);
      return updatedDocument!;
    } catch (uploadError) {
      // Delete document record if upload fails
      await this.repository.deleteById(String(document._id));
      throw uploadError;
    }
  }

  /**
   * List documents for a user with pagination
   */
  async listDocuments(userId: string, page: number, limit: number) {
    if (!this.repositoryInitialized) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    const offset = (page - 1) * limit;

    const { documents, total } = await this.repository.findByUserIdPaginated(userId, limit, offset);

    return {
      documents: documents.map(doc => ({
        id: String(doc._id),
        filename: doc.filename,
        originalName: doc.originalName,
        fileSize: doc.fileSize,
        presignedUrl: doc.presignedUrl,
        createdAt: doc.createdAt
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get document details
   */
  async getDocument(documentId: string, userId: string) {
    if (!this.repositoryInitialized) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    const document = await this.repository.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (document.uploadedBy !== userId) {
      throw new Error('Access denied');
    }

    return {
      id: String(document._id),
      filename: document.filename,
      originalName: document.originalName,
      fileSize: document.fileSize,
      presignedUrl: document.presignedUrl,
      presignedUrlExpiry: document.presignedUrlExpiry,
      createdAt: document.createdAt
    };
  }

  /**
   * Generate new presigned URL
   */
  async generatePresignedUrl(documentId: string, userId: string, bucketService: any) {
    if (!this.repositoryInitialized) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    const document = await this.repository.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (document.uploadedBy !== userId) {
      throw new Error('Access denied');
    }

    const presignedUrl = await bucketService.getPresignedUrl({
      bucket: 'documents',
      key: document.bucketKey,
      expiresIn: 3600
    });

    const expiryDate = new Date(Date.now() + 3600 * 1000);

    await this.repository.updateById(documentId, {
      presignedUrl,
      presignedUrlExpiry: expiryDate
    });

    return {
      presignedUrl,
      expiresIn: 3600,
      expiresAt: expiryDate
    };
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string, userId: string, bucketService: any): Promise<void> {
    if (!this.repositoryInitialized) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    const document = await this.repository.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (document.uploadedBy !== userId) {
      throw new Error('Access denied');
    }

    // Delete from bucket
    await bucketService.deleteFile('documents', document.bucketKey);

    // Delete document record
    await this.repository.deleteById(documentId);

    this.logger.info(`Document deleted: ${documentId}`);
  }
}
