import type { FastifyInstance } from 'fastify';

export default async function healthController(fastify: FastifyInstance) {
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
            status: { type: 'string', description: 'Status da aplicação', example: 'UP' },
            timestamp: { type: 'string', format: 'date-time', description: 'Timestamp da verificação' },
            uptime: { type: 'number', description: 'Tempo de atividade em segundos' },
            version: { type: 'string', description: 'Versão da aplicação' },
            service: { type: 'string', description: 'Nome do serviço' }
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
}