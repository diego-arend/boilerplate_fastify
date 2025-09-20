import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import authPlugin from './modules/auth/auth.plugin.js'
import { registerModule } from './infraestructure/server/modules.js'
import MongoConnection from './infraestructure/mongo/connection.js'
import { errorHandler, notFoundHandler } from './lib/response/index.js'
import { swaggerPlugin } from './infraestructure/server/swagger.js'

export default async function app(fastify: FastifyInstance, opts: FastifyPluginOptions) {
  // Configurar middlewares globais de tratamento de resposta
  errorHandler(fastify);
  notFoundHandler(fastify);

  // Registrar Swagger (apenas em desenvolvimento)
  await fastify.register(swaggerPlugin);

  // Health check route
  fastify.get('/health', {
    schema: {
      description: 'Verifica o status de saúde da aplicação',
      tags: ['Health'],
      summary: 'Health Check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'UP' },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number', example: 123.45 },
            version: { type: 'string', example: '1.0.0' },
            service: { type: 'string', example: 'boilerplate-fastify' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const healthCheck = {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      service: 'boilerplate-fastify'
    };

    // Return 200 OK - application is healthy
    return reply.code(200).send(healthCheck);
  });

  // Register modules automatically with logging
  registerModule(fastify, authPlugin, '/auth', 'auth')

  // MongoDB connection will be handled in server.ts
  fastify.addHook('onReady', async () => {
    const mongoConnection = MongoConnection.getInstance();
    await mongoConnection.connect();
    fastify.decorate('mongo', mongoConnection);
  });

  // Graceful shutdown for MongoDB
  fastify.addHook('onClose', async () => {
    const mongoConnection = MongoConnection.getInstance();
    await mongoConnection.disconnect();
  });
}

export const options = {
  name: 'app'
}