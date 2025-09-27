import type { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { JwtStrategy, AuthenticateCommand } from './services/index.js';
import { CacheServiceFactory, type DataCache } from '../../infraestructure/cache/index.js';
import { config } from '../../lib/validators/validateEnv.js';
import authController from './auth.controller.js';
import { defaultLogger } from '../../lib/logger/index.js';

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  const logger = defaultLogger.child({ context: 'auth-plugin' });

  if (process.env.NODE_ENV === 'development') {
    logger.info({
      message: 'Initializing authentication plugin',
      hasJwtSecret: !!fastify.config.JWT_SECRET
    });
  }

  const SECRET = fastify.config.JWT_SECRET;

  // Create cache service using simplified DataCache
  let cacheService: DataCache | undefined;
  try {
    cacheService = CacheServiceFactory.getDataCache();
    await cacheService.connect();

    if (process.env.NODE_ENV === 'development') {
      logger.info({
        message: 'DataCache service initialized for authentication',
        cacheType: 'DataCache (Redis db0)'
      });
    }
  } catch (error) {
    logger.error({
      message: 'Failed to initialize cache service, proceeding without cache',
      error: error instanceof Error ? error.message : String(error)
    });
  }

  const jwtStrategy = new JwtStrategy(SECRET, cacheService);
  const authCommand = new AuthenticateCommand(jwtStrategy);

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.id || Math.random().toString(36).substr(2, 9);
    const authLogger = logger.child({ requestId, operation: 'authenticate' });

    const user = await authCommand.execute(request, reply);
    if (!user) {
      authLogger.error({
        message: 'Authentication failed - invalid or missing token',
        hasAuthHeader: !!request.headers['authorization'],
        userAgent: request.headers['user-agent'],
        ip: request.ip
      });
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    // Log successful authentication (development only)
    if (process.env.NODE_ENV === 'development') {
      authLogger.info({
        message: 'Authentication successful',
        userId: user.id,
        userName: user.name,
        userRole: user.role
      });
    }

    request.authenticatedUser = user;
  });

  // Role-based access control decorators
  fastify.decorate('requireRole', (requiredRole: string) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = request.id || Math.random().toString(36).substr(2, 9);
      const roleLogger = logger.child({ requestId, operation: 'require-role', requiredRole });

      // First authenticate the user
      const user = await authCommand.execute(request, reply);
      if (!user) {
        roleLogger.error({
          message: 'Role check failed - authentication required',
          requiredRole,
          ip: request.ip,
          userAgent: request.headers['user-agent']
        });
        return reply.code(401).send({
          error: 'Authentication required',
          message: 'Please provide a valid JWT token'
        });
      }

      // Then check the role
      if (user.role !== requiredRole) {
        roleLogger.error({
          message: 'Role check failed - insufficient permissions',
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          requiredRole
        });
        return reply.code(403).send({
          error: 'Access denied',
          message: `Required role: ${requiredRole}. Your role: ${user.role}`
        });
      }

      // Log successful role check (development only)
      if (process.env.NODE_ENV === 'development') {
        roleLogger.info({
          message: 'Role check successful',
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          requiredRole
        });
      }

      request.authenticatedUser = user;
    };
  });

  // Admin-only access decorator
  fastify.decorate('requireAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.id || Math.random().toString(36).substr(2, 9);
    const adminLogger = logger.child({ requestId, operation: 'require-admin' });

    const user = await authCommand.execute(request, reply);
    if (!user) {
      adminLogger.error({
        message: 'Admin check failed - authentication required',
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });
      return reply.code(401).send({
        error: 'Authentication required',
        message: 'Please provide a valid JWT token'
      });
    }

    if (user.role !== 'admin') {
      adminLogger.error({
        message: 'Admin check failed - insufficient privileges',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        requiredRole: 'admin'
      });
      return reply.code(403).send({
        error: 'Admin access required',
        message: 'This resource requires admin privileges'
      });
    }

    // Log successful admin check (development only)
    if (process.env.NODE_ENV === 'development') {
      adminLogger.info({
        message: 'Admin check successful',
        userId: user.id,
        userName: user.name,
        userRole: user.role
      });
    }

    request.authenticatedUser = user;
  });

  // Multi-role access decorator
  fastify.decorate('requireRoles', (allowedRoles: string[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = request.id || Math.random().toString(36).substr(2, 9);
      const rolesLogger = logger.child({ requestId, operation: 'require-roles', allowedRoles });

      const user = await authCommand.execute(request, reply);
      if (!user) {
        rolesLogger.error({
          message: 'Multi-role check failed - authentication required',
          allowedRoles,
          ip: request.ip,
          userAgent: request.headers['user-agent']
        });
        return reply.code(401).send({
          error: 'Authentication required',
          message: 'Please provide a valid JWT token'
        });
      }

      if (!allowedRoles.includes(user.role)) {
        rolesLogger.error({
          message: 'Multi-role check failed - insufficient permissions',
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          allowedRoles
        });
        return reply.code(403).send({
          error: 'Access denied',
          message: `Required roles: ${allowedRoles.join(', ')}. Your role: ${user.role}`
        });
      }

      // Log successful multi-role check (development only)
      if (process.env.NODE_ENV === 'development') {
        rolesLogger.info({
          message: 'Multi-role check successful',
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          allowedRoles
        });
      }

      request.authenticatedUser = user;
    };
  });

  // Log plugin registration completion (development only)
  if (process.env.NODE_ENV === 'development') {
    logger.info({
      message: 'Authentication plugin decorators registered',
      decorators: ['authenticate', 'requireRole', 'requireAdmin', 'requireRoles']
    });
  }

  // Register auth routes
  await authController(fastify);

  // Log final plugin setup completion (development only)
  if (process.env.NODE_ENV === 'development') {
    logger.info({
      message: 'Authentication plugin setup completed',
      routes: ['POST /register', 'POST /login', 'GET /me'],
      hasJwtStrategy: !!jwtStrategy,
      hasAuthCommand: !!authCommand,
      hasAuthCache: !!cacheService
    });
  }
}
