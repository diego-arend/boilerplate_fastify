import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import healthPlugin from '../../modules/health/health.plugin.js';
import authPlugin from '../../modules/auth/auth.plugin.js';
import documentsPlugin from '../../modules/documents/documents.plugin.js';

/**
 * API Plugin - Registra todos os módulos sob o prefixo /api
 */
async function apiPlugin(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  // Register all modules under /api prefix
  await fastify.register(healthPlugin); // health controller já registra como /health
  await fastify.register(authPlugin); // auth já tem prefixo interno /auth
  await fastify.register(documentsPlugin, { prefix: '/documents' });

  fastify.log.info('API plugin registered successfully');
}

export default apiPlugin;
