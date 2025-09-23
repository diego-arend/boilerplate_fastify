import type { FastifyInstance } from 'fastify';

export default async function healthController(fastify: FastifyInstance) {
  // Health check route
  fastify.get('/health', {
    schema: {
      description: 'Check the application health status',
      tags: ['Health'],
      summary: 'Health Check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', description: 'Application status', example: 'UP' },
            timestamp: { type: 'string', format: 'date-time', description: 'Verification timestamp' },
            uptime: { type: 'number', description: 'Uptime in seconds' },
            version: { type: 'string', description: 'Application version' },
            service: { type: 'string', description: 'Service name' }
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
