import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

/**
 * Swagger documentation plugin
 * Available only in development environment
 */
export default async function swaggerPlugin(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  // Only register Swagger in development
  if (process.env.NODE_ENV !== 'development') {
    fastify.log.info('Swagger not registered - environment is not development');
    return;
  }

  fastify.log.info('Registrando Swagger...');

  // Swagger configuration with OpenAPI v3
  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Boilerplate Fastify API',
        description: 'API backend modular utilizando Fastify e TypeScript',
        version: process.env.npm_package_version || '1.0.0',
        contact: {
          name: 'API Support',
          email: 'support@example.com'
        },
        license: {
          name: 'ISC'
        }
      },
      servers: [
        {
          url: `http://localhost:${process.env.PORT || 3001}`,
          description: 'Development server'
        },
        {
          url: 'https://api.example.com',
          description: 'Production server'
        }
      ],
      tags: [
        { name: 'Auth', description: 'Authentication endpoints' },
        { name: 'Health', description: 'Health check endpoints' }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT Authorization header using the Bearer scheme'
          }
        },
        schemas: {
          Error: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Error message' },
              code: { type: 'number', example: 400 },
              error: { type: 'string', example: 'Error details' }
            }
          },
          Success: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              message: { type: 'string', example: 'Operation successful' },
              code: { type: 'number', example: 200 },
              data: { type: 'object', description: 'Response data' }
            }
          }
        }
      },
      security: [
        {
          bearerAuth: []
        }
      ]
    }
  });

  // Interface Swagger UI
  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
      tryItOutEnabled: true,
      requestInterceptor: (req: any) => {
        // Add custom headers if necessary
        return req;
      },
      responseInterceptor: (res: any) => {
        // Process responses if necessary
        return res;
      }
    },
    staticCSP: true,
    transformStaticCSP: (header: string) => header
  });

  fastify.log.info('Swagger registrado em /docs - Ambiente de desenvolvimento');
}

// Decorators for documentation
export const swaggerDecorators = {
  /**
   * Decorator para adicionar tags aos endpoints
   */
  tags: (tags: string[]) => (target: any, propertyKey: string) => {
    if (!target.constructor.swaggerTags) {
      target.constructor.swaggerTags = {};
    }
    target.constructor.swaggerTags[propertyKey] = tags;
  },

  /**
   * Decorator to add description to endpoints
   */
  description: (description: string) => (target: any, propertyKey: string) => {
    if (!target.constructor.swaggerDescriptions) {
      target.constructor.swaggerDescriptions = {};
    }
    target.constructor.swaggerDescriptions[propertyKey] = description;
  },

  /**
   * Decorator para adicionar summary aos endpoints
   */
  summary: (summary: string) => (target: any, propertyKey: string) => {
    if (!target.constructor.swaggerSummaries) {
      target.constructor.swaggerSummaries = {};
    }
    target.constructor.swaggerSummaries[propertyKey] = summary;
  }
};
