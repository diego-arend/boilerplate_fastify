import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { defaultLogger } from '../../../lib/logger/index.js';

export interface AuthenticatedUser {
  id: number;
  name: string;
  role: string;
}

export interface AuthStrategy {
  authenticate(request: FastifyRequest, reply: FastifyReply): Promise<AuthenticatedUser | null>;
}

export class JwtStrategy implements AuthStrategy {
  private logger = defaultLogger.child({ context: 'jwt-strategy' });
  
  constructor(private secret: string) {
    // Log strategy initialization (development only)
    if (process.env.NODE_ENV === 'development') {
      this.logger.info({
        message: 'JWT strategy initialized',
        hasSecret: !!secret,
        secretLength: secret ? secret.length : 0
      });
    }
  }

  async authenticate(request: FastifyRequest, reply: FastifyReply): Promise<AuthenticatedUser | null> {
    const requestId = request.id || Math.random().toString(36).substr(2, 9);
    const authLogger = this.logger.child({ requestId, operation: 'jwt-authenticate' });
    
    try {
      const authHeader = request.headers['authorization'];
      
      if (!authHeader) {
        authLogger.error({
          message: 'JWT authentication failed - missing authorization header',
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          requestMethod: request.method,
          requestUrl: request.url
        });
        return null;
      }
      
      if (!authHeader.startsWith('Bearer ')) {
        authLogger.error({
          message: 'JWT authentication failed - invalid authorization header format',
          authHeaderPrefix: authHeader.substring(0, 10) + '...',
          expectedFormat: 'Bearer <token>',
          ip: request.ip,
          userAgent: request.headers['user-agent']
        });
        return null;
      }
      
      const token = authHeader.slice(7);
      
      if (!token) {
        authLogger.error({
          message: 'JWT authentication failed - empty token',
          ip: request.ip,
          userAgent: request.headers['user-agent']
        });
        return null;
      }
      
      // Log token validation attempt (development only)
      if (process.env.NODE_ENV === 'development') {
        authLogger.info({
          message: 'Validating JWT token',
          tokenLength: token.length,
          tokenPrefix: token.substring(0, 20) + '...',
          hasSecret: !!this.secret
        });
      }
      
      const payload = jwt.verify(token, this.secret) as AuthenticatedUser;
      
      if (!payload || !payload.id || !payload.name || !payload.role) {
        authLogger.error({
          message: 'JWT authentication failed - invalid token payload',
          hasId: !!payload?.id,
          hasName: !!payload?.name,
          hasRole: !!payload?.role,
          ip: request.ip
        });
        return null;
      }
      
      // Log successful JWT validation (development only)
      if (process.env.NODE_ENV === 'development') {
        authLogger.info({
          message: 'JWT authentication successful',
          userId: payload.id,
          userName: payload.name,
          userRole: payload.role,
          tokenValid: true
        });
      }
      
      return payload;
    } catch (error) {
      // Determine error type for better logging
      let errorType = 'Unknown';
      let errorMessage = 'JWT authentication failed';
      
      if (error instanceof jwt.JsonWebTokenError) {
        errorType = 'InvalidToken';
        errorMessage = 'JWT authentication failed - invalid token';
      } else if (error instanceof jwt.TokenExpiredError) {
        errorType = 'ExpiredToken';
        errorMessage = 'JWT authentication failed - token expired';
      } else if (error instanceof jwt.NotBeforeError) {
        errorType = 'TokenNotActive';
        errorMessage = 'JWT authentication failed - token not active';
      }
      
      authLogger.error({
        message: errorMessage,
        errorType,
        error: error instanceof Error ? error.message : String(error),
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        tokenProvided: !!request.headers['authorization'],
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return null;
    }
  }
}
