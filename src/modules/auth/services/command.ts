import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthStrategy, AuthenticatedUser } from './strategy';
import { defaultLogger } from '../../../lib/logger/index';

export interface AuthCommand {
  execute(request: FastifyRequest, reply: FastifyReply): Promise<AuthenticatedUser | null>;
}

export class AuthenticateCommand implements AuthCommand {
  private logger = defaultLogger.child({ context: 'auth-command' });

  constructor(private strategy: AuthStrategy) {
    // Log command initialization (development only)
    if (process.env.NODE_ENV === 'development') {
      this.logger.info({
        message: 'Authentication command initialized',
        strategyType: strategy.constructor.name,
        hasStrategy: !!strategy
      });
    }
  }

  async execute(request: FastifyRequest, reply: FastifyReply): Promise<AuthenticatedUser | null> {
    const requestId = request.id || Math.random().toString(36).substr(2, 9);
    const operationLogger = this.logger.child({ requestId, operation: 'execute-auth' });

    try {
      // Log authentication execution attempt (development only)
      if (process.env.NODE_ENV === 'development') {
        operationLogger.info({
          message: 'Executing authentication command',
          hasAuthHeader: !!request.headers['authorization'],
          requestMethod: request.method,
          requestUrl: request.url,
          userAgent: request.headers['user-agent'],
          ip: request.ip
        });
      }

      const authenticatedUser = await this.strategy.authenticate(request, reply);

      if (!authenticatedUser) {
        operationLogger.error({
          message: 'Authentication command execution failed',
          reason: 'Strategy returned null user',
          hasAuthHeader: !!request.headers['authorization'],
          strategyType: this.strategy.constructor.name,
          ip: request.ip
        });
        return null;
      }

      // Log successful authentication (development only)
      if (process.env.NODE_ENV === 'development') {
        operationLogger.info({
          message: 'Authentication command execution successful',
          userId: authenticatedUser.id,
          userName: authenticatedUser.name,
          userRole: authenticatedUser.role,
          strategyType: this.strategy.constructor.name
        });
      }

      return authenticatedUser;
    } catch (error) {
      operationLogger.error({
        message: 'Authentication command execution error',
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        strategyType: this.strategy.constructor.name,
        hasAuthHeader: !!request.headers['authorization'],
        stack: error instanceof Error ? error.stack : undefined,
        ip: request.ip
      });
      return null;
    }
  }
}
