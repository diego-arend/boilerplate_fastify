import type { AuthenticatedUser } from '../strategy.ts';
import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    authenticatedUser?: AuthenticatedUser;
  }
}
