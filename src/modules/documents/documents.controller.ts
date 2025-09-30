/**
 * Documents Controller - Simplified
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DocumentService } from './services/document.service.js';
import { DocumentRepository } from '../../entities/document/index.js';
import { ApiResponseHandler } from '../../lib/response/index.js';

export class DocumentsController {
  private documentService: DocumentService;
  private repository: DocumentRepository;

  constructor(private fastify: FastifyInstance) {
    this.documentService = new DocumentService(fastify);
    this.repository = new DocumentRepository();
  }

  /**
   * Upload CSV file
   */
  async uploadCSV(request: any, reply: FastifyReply): Promise<void> {
    try {
      if (!request.authenticatedUser?.id) {
        return ApiResponseHandler.authError(reply, 'Authentication required');
      }

      if (!request.file) {
        return ApiResponseHandler.validationError(reply, 'No file uploaded');
      }

      const { buffer, originalname, mimetype, size } = request.file;

      // Validate file size (max 10MB)
      if (size > 10 * 1024 * 1024) {
        return ApiResponseHandler.validationError(reply, 'File size exceeds 10MB limit');
      }

      const document = await this.documentService.uploadFile({
        file: buffer,
        originalName: originalname,
        mimeType: mimetype,
        uploadedBy: request.authenticatedUser.id
      });

      return ApiResponseHandler.created(reply, 'CSV uploaded successfully', {
        id: String(document._id),
        filename: document.filename,
        originalName: document.originalName,
        fileSize: document.fileSize,
        presignedUrl: document.presignedUrl,
        createdAt: document.createdAt
      });
    } catch (error) {
      this.fastify.log.error(`CSV upload failed: ${error}`);
      return ApiResponseHandler.validationError(
        reply,
        error instanceof Error ? error.message : 'Upload failed'
      );
    }
  }

  /**
   * List user documents
   */
  async listDocuments(request: any, reply: FastifyReply): Promise<void> {
    try {
      if (!request.authenticatedUser?.id) {
        return ApiResponseHandler.authError(reply, 'Authentication required');
      }

      const { page = 1, limit = 20 } = request.query;
      const offset = (page - 1) * limit;

      const { documents, total } = await this.repository.findByUserIdPaginated(
        request.authenticatedUser.id,
        limit,
        offset
      );

      return ApiResponseHandler.success(reply, 'Documents retrieved', {
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
      });
    } catch (error) {
      this.fastify.log.error(`Failed to list documents: ${error}`);
      return ApiResponseHandler.internalError(reply, 'Failed to retrieve documents');
    }
  }

  /**
   * Get document details
   */
  async getDocument(request: any, reply: FastifyReply): Promise<void> {
    try {
      if (!request.authenticatedUser?.id) {
        return ApiResponseHandler.authError(reply, 'Authentication required');
      }

      const document = await this.repository.findById(request.params.id);
      if (!document) {
        return ApiResponseHandler.notFound(reply, 'Document not found');
      }

      if (document.uploadedBy !== request.authenticatedUser.id) {
        return ApiResponseHandler.forbidden(reply, 'Access denied');
      }

      return ApiResponseHandler.success(reply, 'Document retrieved', {
        id: String(document._id),
        filename: document.filename,
        originalName: document.originalName,
        fileSize: document.fileSize,
        presignedUrl: document.presignedUrl,
        presignedUrlExpiry: document.presignedUrlExpiry,
        createdAt: document.createdAt
      });
    } catch (error) {
      this.fastify.log.error(`Failed to get document: ${error}`);
      return ApiResponseHandler.internalError(reply, 'Failed to retrieve document');
    }
  }

  /**
   * Generate new presigned URL
   */
  async getDownloadUrl(request: any, reply: FastifyReply): Promise<void> {
    try {
      if (!request.authenticatedUser?.id) {
        return ApiResponseHandler.authError(reply, 'Authentication required');
      }

      const presignedUrl = await this.documentService.generatePresignedUrl(
        request.params.id,
        request.authenticatedUser.id
      );

      return ApiResponseHandler.success(reply, 'Download URL generated', {
        presignedUrl,
        expiresIn: 3600,
        expiresAt: new Date(Date.now() + 3600 * 1000)
      });
    } catch (error) {
      this.fastify.log.error(`Failed to generate download URL: ${error}`);

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return ApiResponseHandler.notFound(reply, 'Document not found');
        }
        if (error.message.includes('Access denied')) {
          return ApiResponseHandler.forbidden(reply, 'Access denied');
        }
      }

      return ApiResponseHandler.internalError(reply, 'Failed to generate download URL');
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(request: any, reply: FastifyReply): Promise<void> {
    try {
      if (!request.authenticatedUser?.id) {
        return ApiResponseHandler.authError(reply, 'Authentication required');
      }

      await this.documentService.deleteDocument(request.params.id, request.authenticatedUser.id);
      return ApiResponseHandler.success(reply, 'Document deleted successfully');
    } catch (error) {
      this.fastify.log.error(`Failed to delete document: ${error}`);

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return ApiResponseHandler.notFound(reply, 'Document not found');
        }
        if (error.message.includes('Access denied')) {
          return ApiResponseHandler.forbidden(reply, 'Access denied');
        }
      }

      return ApiResponseHandler.internalError(reply, 'Failed to delete document');
    }
  }
}
