import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

/**
 * Plugin de documentação Swagger
 * Disponível apenas em ambiente de desenvolvimento
 */
export default async function swaggerPlugin(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
) {
  // Só registra o Swagger em desenvolvimento
  if (process.env.NODE_ENV !== 'development') {
    fastify.log.info('Swagger não registrado - ambiente não é desenvolvimento');
    return;
  }

  // Configuração do Swagger
  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Boilerplate Fastify API',
        description: 'API backend modular utilizando Fastify e TypeScript',
        version: process.env.npm_package_version || '1.0.0',
        contact: {
          name: 'Equipe de Desenvolvimento',
          email: 'dev@example.com'
        },
        license: {
          name: 'ISC'
        }
      },
      servers: [
        {
          url: 'http://localhost:3001',
          description: 'Servidor de desenvolvimento'
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Token JWT de autenticação'
          }
        }
      },
      security: [
        {
          bearerAuth: []
        }
      ],
      tags: [
        { name: 'Auth', description: 'Operações de autenticação' },
        { name: 'Health', description: 'Verificação de saúde da aplicação' }
      ]
    },
    transform: ({ schema, url }) => {
      const parsed = url.split('/');
      const tag = parsed[1] || 'Default';

      return {
        schema,
        url,
        operationId: `${tag}_${parsed[parsed.length - 1] || 'default'}`
      };
    }
  });

  // Interface Swagger UI
  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      displayRequestDuration: true,
      tryItOutEnabled: true
    },
    staticCSP: true,
    transformStaticCSP: (header) => header
  });

  fastify.log.info('Swagger registrado em /docs - Ambiente de desenvolvimento');
}

// Decorators para documentação
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
   * Decorator para adicionar descrição aos endpoints
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