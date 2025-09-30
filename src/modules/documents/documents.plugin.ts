import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { DocumentsController } from './documents.controller.js';

/**
 * Document Management Plugin - Simplified
 */
async function documentsPlugin(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  fastify.log.info('Initializing documents plugin...');

  const documentsController = new DocumentsController(fastify);
  fastify.log.info('DocumentsController initialized successfully');

  /**
   * GET /documents - List user documents
   */
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    handler: async (request: any, reply: any) => {
      return documentsController.listDocuments(request, reply);
    }
  });

  /**
   * POST /documents/upload - Upload CSV file
   */
  fastify.post('/upload', {
    preHandler: [fastify.authenticate],
    handler: async (request: any, reply: any) => {
      return documentsController.uploadCSV(request, reply);
    }
  });

  /**
   * GET /documents/:id/download - Generate download URL
   */
  fastify.get('/:id/download', {
    preHandler: [fastify.authenticate],
    handler: async (request: any, reply: any) => {
      return documentsController.getDownloadUrl(request, reply);
    }
  });

  /**
   * GET /documents/:id - Get document details
   */
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    handler: async (request: any, reply: any) => {
      return documentsController.getDocument(request, reply);
    }
  });

  /**
   * DELETE /documents/:id - Delete document
   */
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
    handler: async (request: any, reply: any) => {
      return documentsController.deleteDocument(request, reply);
    }
  });

  fastify.log.info('Documents plugin registered successfully');
}

export default documentsPlugin;
