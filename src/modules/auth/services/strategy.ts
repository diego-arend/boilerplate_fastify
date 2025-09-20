import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

export interface AuthenticatedUser {
  id: number;
  name: string;
  role: string;
}

export interface AuthStrategy {
  authenticate(request: FastifyRequest, reply: FastifyReply): Promise<AuthenticatedUser | null>;
}

export class JwtStrategy implements AuthStrategy {
  constructor(private secret: string) {}

  async authenticate(request: FastifyRequest, reply: FastifyReply): Promise<AuthenticatedUser | null> {
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, this.secret) as AuthenticatedUser;
      return payload;
    } catch {
      return null;
    }
  }
}
