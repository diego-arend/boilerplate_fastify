import type { AuthenticatedUser } from '../services/strategy.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (_request: FastifyRequest, _reply: FastifyReply) => Promise<void>;
    requireRole: (
      role: string
    ) => (_request: FastifyRequest, _reply: FastifyReply) => Promise<void>;
    requireAdmin: (_request: FastifyRequest, _reply: FastifyReply) => Promise<void>;
    requireRoles: (
      roles: string[]
    ) => (_request: FastifyRequest, _reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    authenticatedUser?: AuthenticatedUser;
  }
}
