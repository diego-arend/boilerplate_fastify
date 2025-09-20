import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default async function adminController(fastify: FastifyInstance): Promise<void> {
  // Admin dashboard route - requires admin role
  fastify.get(
    '/admin/dashboard',
    {
      preHandler: [fastify.authenticate, fastify.requireAdmin]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.authenticatedUser!;
      
      return {
        message: 'Admin dashboard access granted',
        user: {
          id: user.id,
          name: user.name,
          role: user.role
        },
        timestamp: new Date().toISOString()
      };
    }
  );

  // User management route - requires admin role
  fastify.get(
    '/admin/users',
    {
      preHandler: [fastify.authenticate, fastify.requireAdmin]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Simulate getting all users (in real app, query database)
      return {
        message: 'User management access granted',
        users: [
          { id: '1', name: 'User 1', email: 'user1@example.com', role: 'user' },
          { id: '2', name: 'Admin User', email: 'admin@example.com', role: 'admin' }
        ],
        total: 2
      };
    }
  );

  // Manager route - requires manager or admin role
  fastify.get(
    '/admin/reports',
    {
      preHandler: [fastify.authenticate, fastify.requireRoles(['manager', 'admin'])]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.authenticatedUser!;
      
      return {
        message: 'Reports access granted',
        user: {
          id: user.id,
          role: user.role
        },
        reports: [
          { id: '1', name: 'Monthly Report', type: 'financial' },
          { id: '2', name: 'User Analytics', type: 'analytics' }
        ]
      };
    }
  );

  // Moderator route - requires specific role
  fastify.get(
    '/admin/moderation',
    {
      preHandler: [fastify.authenticate, fastify.requireRole('moderator')]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return {
        message: 'Moderation panel access granted',
        pendingItems: [
          { id: '1', type: 'comment', status: 'pending' },
          { id: '2', type: 'post', status: 'flagged' }
        ]
      };
    }
  );
}