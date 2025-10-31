import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import apiPlugin from './infraestructure/server/api.plugin.js';
import cachePlugin from './infraestructure/cache/cache.plugin.js';
import mongodbPlugin from './infraestructure/mongo/mongodb.plugin.js';
import postgresPlugin from './infraestructure/postgres/postgres.plugin.js';
import queuePlugin from './infraestructure/queue/plugin.js';
import emailPlugin from './infraestructure/email/email.plugin.js';
import bucketPlugin from './infraestructure/bucket/bucket.plugin.js';
import rateLimitPlugin from './infraestructure/server/rateLimit.plugin.js';
import corsPlugin from './infraestructure/server/cors.plugin.js';
import multipartPlugin from './infraestructure/server/multipart.plugin.js';
import { errorHandler, notFoundHandler } from './lib/response/index.js';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

export default async function app(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  // Configure global response handling middlewares
  errorHandler(fastify);
  notFoundHandler(fastify);

  // Register MongoDB plugin FIRST for database access
  await fastify.register(mongodbPlugin);

  // Register PostgreSQL plugin AFTER MongoDB (optional - hybrid architecture)
  await fastify.register(postgresPlugin);

  // Register cache plugin SECOND to be available for all routes
  await fastify.register(cachePlugin, {
    defaultTTL: fastify.config.CACHE_DEFAULT_TTL, // Use environment variable
    enableAutoCache: true,
    // Skip cache for: health check, auth routes (dynamic), docs (static)
    skipRoutes: ['/health', '/auth/login', '/auth/register', '/docs']
  });

  // Register email plugin AFTER cache for email services
  await fastify.register(emailPlugin);

  // Register bucket plugin AFTER cache for file storage services
  await fastify.register(bucketPlugin, {
    autoConnect: true // Auto-connect using environment configuration
  });

  // Register queue plugin AFTER both MongoDB and cache for job processing
  await fastify.register(queuePlugin, {
    config: fastify.config,
    queueName: fastify.config.QUEUE_NAME,
    concurrency: fastify.config.WORKER_CONCURRENCY,
    batchSize: fastify.config.BATCH_SIZE_JOBS,
    processingInterval: fastify.config.WORKER_PROCESSING_INTERVAL,
    enablePersistence: true // Enable persistent job processing
  });

  // Register CORS plugin BEFORE rate limiting for proper request handling
  await fastify.register(corsPlugin, {
    // Options can be passed here to override environment variables
    // origin: 'http://localhost:3000',
    // credentials: true
  });

  // Register multipart plugin for file uploads
  await fastify.register(multipartPlugin);

  // Register rate limiting plugin AFTER CORS but BEFORE routes
  await fastify.register(rateLimitPlugin, {
    // Skip rate limit for: health check (monitoring), docs (static content)
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

  // Register modules AFTER all infrastructure plugins are loaded
  // This ensures bullQueue, cache, etc. are available in controllers
  await fastify.register(apiPlugin, { prefix: '/api' });
}

export const options = {
  name: 'app'
};
