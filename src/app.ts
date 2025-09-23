import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import authPlugin from './modules/auth/auth.plugin.js';
import healthPlugin from './modules/health/health.plugin.js';
import cachePlugin from './infraestructure/cache/cache.plugin.js';
import rateLimitPlugin from './infraestructure/server/rateLimit.plugin.js';
import corsPlugin from './infraestructure/server/cors.plugin.js';
import { registerModule } from './infraestructure/server/modules.js';
import MongoConnection from './infraestructure/mongo/connection.js';
import { errorHandler, notFoundHandler } from './lib/response/index.js';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

export default async function app(fastify: FastifyInstance, opts: FastifyPluginOptions) {
  // Configure global response handling middlewares
  errorHandler(fastify);
  notFoundHandler(fastify);

  // Register cache plugin FIRST to be available for all routes
  await fastify.register(cachePlugin, {
    defaultTTL: 300, // 5 minutes
    enableAutoCache: true,
    skipRoutes: ['/health', '/auth/login', '/auth/register', '/docs']
  });

  // Register CORS plugin BEFORE rate limiting for proper request handling
  await fastify.register(corsPlugin, {
    // Options can be passed here to override environment variables
    // origin: 'http://localhost:3000',
    // credentials: true
  });

  // Register rate limiting plugin AFTER CORS but BEFORE routes
  await fastify.register(rateLimitPlugin, {
    max: 100, // requests per minute
    timeWindow: 60000, // 1 minute
    skipRoutes: ['/health', '/docs', '/docs/*'],
    enableGlobal: true,
    useRedis: true // Use Redis if available
  });

  // Register Swagger FIRST to capture routes defined after
  if (process.env.NODE_ENV === 'development') {
    await fastify.register(fastifySwagger, {
      openapi: {
        openapi: '3.0.3',
        info: {
          title: 'Boilerplate Fastify API',
          description: 'API backend modular utilizando Fastify e TypeScript',
          version: '1.0.0'
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT'
            }
          }
        }
      }
    });

    await fastify.register(fastifySwaggerUi, {
      routePrefix: '/docs'
    });

    fastify.log.info('Swagger registrado em /docs');
  }

  // Register modules
  await registerModule(fastify, healthPlugin, '', 'health');
  await registerModule(fastify, authPlugin, '/auth', 'auth');

  // MongoDB connection will be handled in server.ts
  fastify.addHook('onReady', async () => {
    const mongoConnection = MongoConnection.getInstance();
    await mongoConnection.connect();
    fastify.decorate('mongo', mongoConnection);

    // Register Swagger after all routes are defined
    if (process.env.NODE_ENV === 'development') {
      // Note: This approach doesn't work because onReady is too late for plugin registration
      // await fastify.register(swaggerPlugin);
    }
  });

  // Graceful shutdown for MongoDB
  fastify.addHook('onClose', async () => {
    const mongoConnection = MongoConnection.getInstance();
    await mongoConnection.disconnect();
  });
}

export const options = {
  name: 'app'
};
