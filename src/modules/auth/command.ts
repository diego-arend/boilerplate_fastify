import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthStrategy, AuthenticatedUser } from './strategy.js';

export interface AuthCommand {
  execute(request: FastifyRequest, reply: FastifyReply): Promise<AuthenticatedUser | null>;
}

export class AuthenticateCommand implements AuthCommand {
  constructor(private strategy: AuthStrategy) {}
  async execute(request: FastifyRequest, reply: FastifyReply): Promise<AuthenticatedUser | null> {
    return this.strategy.authenticate(request, reply);
  }
}
