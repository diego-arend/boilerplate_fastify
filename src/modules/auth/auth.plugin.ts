import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import { JwtStrategy, AuthenticateCommand } from "./services/index.js";
import authController from "./auth.controller.js";

export default async function (
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
) {
  const SECRET = fastify.config.JWT_SECRET;
  const jwtStrategy = new JwtStrategy(SECRET);
  const authCommand = new AuthenticateCommand(jwtStrategy);

  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await authCommand.execute(request, reply);
      if (!user) {
        reply.code(401).send({ error: "Unauthorized" });
        return;
      }
      request.authenticatedUser = user;
    }
  );

  // Role-based access control decorators
  fastify.decorate(
    "requireRole",
    (requiredRole: string) => {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        // First authenticate the user
        const user = await authCommand.execute(request, reply);
        if (!user) {
          return reply.code(401).send({ 
            error: "Authentication required",
            message: "Please provide a valid JWT token" 
          });
        }
        
        // Then check the role
        if (user.role !== requiredRole) {
          return reply.code(403).send({ 
            error: "Access denied",
            message: `Required role: ${requiredRole}. Your role: ${user.role}` 
          });
        }
        
        request.authenticatedUser = user;
      };
    }
  );

  // Admin-only access decorator
  fastify.decorate(
    "requireAdmin",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await authCommand.execute(request, reply);
      if (!user) {
        return reply.code(401).send({ 
          error: "Authentication required",
          message: "Please provide a valid JWT token" 
        });
      }
      
      if (user.role !== 'admin') {
        return reply.code(403).send({ 
          error: "Admin access required",
          message: "This resource requires admin privileges" 
        });
      }
      
      request.authenticatedUser = user;
    }
  );

  // Multi-role access decorator
  fastify.decorate(
    "requireRoles",
    (allowedRoles: string[]) => {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await authCommand.execute(request, reply);
        if (!user) {
          return reply.code(401).send({ 
            error: "Authentication required",
            message: "Please provide a valid JWT token" 
          });
        }
        
        if (!allowedRoles.includes(user.role)) {
          return reply.code(403).send({ 
            error: "Access denied",
            message: `Required roles: ${allowedRoles.join(', ')}. Your role: ${user.role}` 
          });
        }
        
        request.authenticatedUser = user;
      };
    }
  );

  // Register auth routes
  await authController(fastify);
}
