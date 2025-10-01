/**
 * Documents Controller - Following auth module patterns
 */

import type { FastifyInstance } from 'fastify';
import { ApiResponseHandler } from '../../lib/response/index.js';
import { DocumentService } from './services/document.service.js';
import { defaultLogger } from '../../lib/logger/index.js';

const logger = defaultLogger.child({ context: 'documents-controller' });

export default async function documentsController(fastify: FastifyInstance) {
  // Initialize DocumentService - following auth pattern
  const documentService = new DocumentService();

  // POST /upload - Upload CSV file
  fastify.post(
    '/upload',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Upload a CSV file to the system',
        tags: ['Documents'],
        summary: 'Upload CSV File',
        security: [{ bearerAuth: [] }],
        body: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Document file to upload'
                  }
                },
                required: ['file']
              }
            }
          }
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              message: { type: 'string', example: 'CSV uploaded successfully' },
              code: { type: 'number', example: 201 },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                  filename: { type: 'string', example: '1633024800000-abc123def.csv' },
                  originalName: { type: 'string', example: 'data.csv' },
                  fileSize: { type: 'number', example: 2048 },
                  presignedUrl: {
                    type: 'string',
                    example: 'https://minio.example.com/documents/...'
                  },
                  createdAt: { type: 'string', format: 'date-time' }
                }
              }
            }
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'No file uploaded' },
              code: { type: 'number', example: 400 },
              error: { type: 'string', example: 'VALIDATION_ERROR' }
            }
          },
          401: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Authentication required' },
              code: { type: 'number', example: 401 },
              error: { type: 'string', example: 'AUTHENTICATION_ERROR' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const requestId = request.id || Math.random().toString(36).substr(2, 9);

      try {
        if (!request.authenticatedUser?.id) {
          return ApiResponseHandler.authError(reply, 'Authentication required');
        }

        // Process multipart data
        const data = await request.file();

        if (!data) {
          return ApiResponseHandler.validationError(reply, 'No file uploaded');
        }

        const { file, filename, mimetype } = data;

        // Convert stream to buffer
        const chunks: Buffer[] = [];
        for await (const chunk of file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        // Validate file size (max 10MB)
        if (buffer.length > 10 * 1024 * 1024) {
          return ApiResponseHandler.validationError(reply, 'File size exceeds 10MB limit');
        }

        const document = await documentService.uploadFile(
          {
            file: buffer,
            originalName: filename,
            mimeType: mimetype || 'text/csv',
            uploadedBy: request.authenticatedUser.id
          },
          fastify.bucketService
        );

        return ApiResponseHandler.created(reply, 'CSV uploaded successfully', {
          id: String(document._id),
          filename: document.filename,
          originalName: document.originalName,
          fileSize: document.fileSize,
          presignedUrl: document.presignedUrl,
          createdAt: document.createdAt
        });
      } catch (error) {
        logger.error(
          {
            requestId,
            error: error instanceof Error ? error.message : String(error),
            operation: 'upload-csv'
          },
          'Documents controller upload error'
        );

        const message = error instanceof Error ? error.message : 'Upload failed';
        return ApiResponseHandler.validationError(reply, message);
      }
    }
  );

  // GET / - List user documents
  fastify.get(
    '/',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'List documents uploaded by the authenticated user',
        tags: ['Documents'],
        summary: 'List User Documents',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number', minimum: 1, default: 1 },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              message: { type: 'string', example: 'Documents retrieved' },
              code: { type: 'number', example: 200 },
              data: {
                type: 'object',
                properties: {
                  documents: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                        filename: { type: 'string', example: '1633024800000-abc123def.csv' },
                        originalName: { type: 'string', example: 'data.csv' },
                        fileSize: { type: 'number', example: 2048 },
                        presignedUrl: {
                          type: 'string',
                          example: 'https://minio.example.com/documents/...'
                        },
                        createdAt: { type: 'string', format: 'date-time' }
                      }
                    }
                  },
                  pagination: {
                    type: 'object',
                    properties: {
                      page: { type: 'number', example: 1 },
                      limit: { type: 'number', example: 20 },
                      total: { type: 'number', example: 50 },
                      totalPages: { type: 'number', example: 3 }
                    }
                  }
                }
              }
            }
          },
          401: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Authentication required' },
              code: { type: 'number', example: 401 },
              error: { type: 'string', example: 'AUTHENTICATION_ERROR' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const requestId = request.id || Math.random().toString(36).substr(2, 9);

      try {
        if (!request.authenticatedUser?.id) {
          return ApiResponseHandler.authError(reply, 'Authentication required');
        }

        const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };

        const result = await documentService.listDocuments(
          request.authenticatedUser.id,
          page,
          limit
        );

        return ApiResponseHandler.success(reply, 'Documents retrieved', result);
      } catch (error) {
        logger.error(
          {
            requestId,
            error: error instanceof Error ? error.message : String(error),
            operation: 'list-documents'
          },
          'Documents controller list error'
        );

        return ApiResponseHandler.internalError(reply, 'Failed to retrieve documents');
      }
    }
  );

  // GET /:id - Get document details
  fastify.get(
    '/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Get detailed information about a specific document',
        tags: ['Documents'],
        summary: 'Get Document Details',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Document ID' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              message: { type: 'string', example: 'Document retrieved' },
              code: { type: 'number', example: 200 },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                  filename: { type: 'string', example: '1633024800000-abc123def.csv' },
                  originalName: { type: 'string', example: 'data.csv' },
                  fileSize: { type: 'number', example: 2048 },
                  presignedUrl: {
                    type: 'string',
                    example: 'https://minio.example.com/documents/...'
                  },
                  presignedUrlExpiry: { type: 'string', format: 'date-time' },
                  createdAt: { type: 'string', format: 'date-time' }
                }
              }
            }
          },
          401: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Authentication required' },
              code: { type: 'number', example: 401 },
              error: { type: 'string', example: 'AUTHENTICATION_ERROR' }
            }
          },
          403: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Access denied' },
              code: { type: 'number', example: 403 },
              error: { type: 'string', example: 'FORBIDDEN_ERROR' }
            }
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Document not found' },
              code: { type: 'number', example: 404 },
              error: { type: 'string', example: 'NOT_FOUND_ERROR' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const requestId = request.id || Math.random().toString(36).substr(2, 9);

      try {
        if (!request.authenticatedUser?.id) {
          return ApiResponseHandler.authError(reply, 'Authentication required');
        }

        const { id } = request.params as { id: string };

        const document = await documentService.getDocument(id, request.authenticatedUser.id);

        return ApiResponseHandler.success(reply, 'Document retrieved', document);
      } catch (error) {
        logger.error(
          {
            requestId,
            error: error instanceof Error ? error.message : String(error),
            operation: 'get-document'
          },
          'Documents controller get error'
        );

        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return ApiResponseHandler.notFound(reply, 'Document not found');
          }
          if (error.message.includes('Access denied')) {
            return ApiResponseHandler.forbidden(reply, 'Access denied');
          }
        }

        return ApiResponseHandler.internalError(reply, 'Failed to retrieve document');
      }
    }
  );

  // GET /:id/download - Generate download URL
  fastify.get(
    '/:id/download',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Generate a presigned download URL for a document',
        tags: ['Documents'],
        summary: 'Generate Download URL',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Document ID' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              message: { type: 'string', example: 'Download URL generated' },
              code: { type: 'number', example: 200 },
              data: {
                type: 'object',
                properties: {
                  presignedUrl: {
                    type: 'string',
                    example: 'https://minio.example.com/documents/...'
                  },
                  expiresIn: { type: 'number', example: 3600 },
                  expiresAt: { type: 'string', format: 'date-time' }
                }
              }
            }
          },
          401: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Authentication required' },
              code: { type: 'number', example: 401 },
              error: { type: 'string', example: 'AUTHENTICATION_ERROR' }
            }
          },
          403: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Access denied' },
              code: { type: 'number', example: 403 },
              error: { type: 'string', example: 'FORBIDDEN_ERROR' }
            }
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Document not found' },
              code: { type: 'number', example: 404 },
              error: { type: 'string', example: 'NOT_FOUND_ERROR' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const requestId = request.id || Math.random().toString(36).substr(2, 9);

      try {
        if (!request.authenticatedUser?.id) {
          return ApiResponseHandler.authError(reply, 'Authentication required');
        }

        const { id } = request.params as { id: string };

        const result = await documentService.generatePresignedUrl(
          id,
          request.authenticatedUser.id,
          fastify.bucketService
        );

        return ApiResponseHandler.success(reply, 'Download URL generated', result);
      } catch (error) {
        logger.error(
          {
            requestId,
            error: error instanceof Error ? error.message : String(error),
            operation: 'generate-download-url'
          },
          'Documents controller download URL error'
        );

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
  );

  // DELETE /:id - Delete document
  fastify.delete(
    '/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Delete a document from the system',
        tags: ['Documents'],
        summary: 'Delete Document',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Document ID' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              message: { type: 'string', example: 'Document deleted successfully' },
              code: { type: 'number', example: 200 }
            }
          },
          401: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Authentication required' },
              code: { type: 'number', example: 401 },
              error: { type: 'string', example: 'AUTHENTICATION_ERROR' }
            }
          },
          403: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Access denied' },
              code: { type: 'number', example: 403 },
              error: { type: 'string', example: 'FORBIDDEN_ERROR' }
            }
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Document not found' },
              code: { type: 'number', example: 404 },
              error: { type: 'string', example: 'NOT_FOUND_ERROR' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const requestId = request.id || Math.random().toString(36).substr(2, 9);

      try {
        if (!request.authenticatedUser?.id) {
          return ApiResponseHandler.authError(reply, 'Authentication required');
        }

        const { id } = request.params as { id: string };

        await documentService.deleteDocument(
          id,
          request.authenticatedUser.id,
          fastify.bucketService
        );

        return ApiResponseHandler.success(reply, 'Document deleted successfully');
      } catch (error) {
        logger.error(
          {
            requestId,
            error: error instanceof Error ? error.message : String(error),
            operation: 'delete-document'
          },
          'Documents controller delete error'
        );

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
  );
}
