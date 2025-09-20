import type { AuthenticatedUser } from '../services/strategy.ts';
import 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    authenticatedUser?: AuthenticatedUser;
  }
}
