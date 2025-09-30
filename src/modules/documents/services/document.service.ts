/**
 * Document Service - Simplified
 */

import crypto from 'node:crypto';
import path from 'node:path';
import { defaultLogger } from '../../../lib/logger/index.js';
import type { Logger } from 'pino';
import type { FastifyInstance } from 'fastify';
import { DocumentRepository } from '../../../entities/document/index.js';
import type { IDocument } from '../../../entities/document/index.js';

export interface UploadFileOptions {
  file: Buffer;
  originalName: string;
  mimeType: string;
  uploadedBy: string;
  bucket?: string;
}

export class DocumentService {
  private repository: DocumentRepository;
  private logger: Logger;
  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance, logger?: Logger) {
    this.fastify = fastify;
    this.repository = new DocumentRepository();
    this.logger = logger || defaultLogger.child({ component: 'DocumentService' });
  }

  /**
   * Upload CSV file to bucket
   */
  async uploadFile(options: UploadFileOptions): Promise<IDocument> {
    const { file, originalName, mimeType, uploadedBy, bucket = 'documents' } = options;

    // Validate CSV mime type
    if (!mimeType.includes('csv') && !originalName.toLowerCase().endsWith('.csv')) {
      throw new Error('Only CSV files are allowed');
    }

    // Generate unique filename
    const fileExtension = path.extname(originalName);
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const filename = `${timestamp}-${randomString}${fileExtension}`;
    const bucketKey = `${uploadedBy}/${filename}`;

    // Create document record
    const document = await this.repository.create({
      filename,
      originalName,
      fileSize: file.length,
      mimeType,
      uploadedBy,
      bucketKey
    });

    try {
      // Upload to bucket
      await this.fastify.bucketService.uploadFile({
        bucket,
        key: bucketKey,
        body: file,
        contentType: mimeType
      });

      // Generate presigned URL
      const presignedUrl = await this.fastify.bucketService.getPresignedUrl({
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
   * Generate new presigned URL
   */
  async generatePresignedUrl(documentId: string, userId: string): Promise<string> {
    const document = await this.repository.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (document.uploadedBy !== userId) {
      throw new Error('Access denied');
    }

    const presignedUrl = await this.fastify.bucketService.getPresignedUrl({
      bucket: 'documents',
      key: document.bucketKey,
      expiresIn: 3600
    });

    const expiryDate = new Date(Date.now() + 3600 * 1000);

    await this.repository.updateById(documentId, {
      presignedUrl,
      presignedUrlExpiry: expiryDate
    });

    return presignedUrl;
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string, userId: string): Promise<void> {
    const document = await this.repository.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (document.uploadedBy !== userId) {
      throw new Error('Access denied');
    }

    // Delete from bucket
    await this.fastify.bucketService.deleteFile('documents', document.bucketKey);

    // Delete document record
    await this.repository.deleteById(documentId);

    this.logger.info(`Document deleted: ${documentId}`);
  }
}
