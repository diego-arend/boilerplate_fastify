import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import documentsController from './documents.controller';
import { defaultLogger } from '../../lib/logger/index';

const logger = defaultLogger.child({ context: 'documents-plugin' });

async function documentsPluginFunction(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  if (process.env.NODE_ENV === 'development') {
    logger.info({
      message: 'Initializing documents plugin',
      hasBucketService: !!fastify.bucketService
    });
  }

  // Register documents routes with prefix
  await fastify.register(documentsController, { prefix: '/documents' });

  if (process.env.NODE_ENV === 'development') {
    logger.info({
      message: 'Documents plugin setup completed',
      routes: [
        'POST /documents/upload',
        'GET /documents/',
        'GET /documents/:id',
        'GET /documents/:id/download',
        'DELETE /documents/:id'
      ]
    });
  }
}

export default fp(documentsPluginFunction, {
  name: 'documents',
  dependencies: ['auth', 'bucket'] // Ensure documents loads after auth and bucket services
});
