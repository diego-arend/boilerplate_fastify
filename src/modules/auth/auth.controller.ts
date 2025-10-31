import type { FastifyInstance } from 'fastify';
import { ApiResponseHandler } from '../../lib/response/index';
import { AuthService } from './services/index';
import { defaultLogger } from '../../lib/logger/index';

const logger = defaultLogger.child({ context: 'auth-controller' });

export default async function authController(fastify: FastifyInstance) {
  // Initialize AuthService with JWT secret only
  // BullMQ will be passed at runtime from fastify instance
  const authService = new AuthService(fastify.config.JWT_SECRET);
  await authService.initialize();

  // Register route
  fastify.post(
    '/register',
    {
      schema: {
        description: 'Register a new user in the system',
        tags: ['Auth'],
        summary: 'Register User',
        body: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string', minLength: 2 },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 }
          }
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              message: { type: 'string', example: 'User registered successfully' },
              code: { type: 'number', example: 201 },
              data: {
                type: 'object',
                properties: {
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                      name: { type: 'string', example: 'John Silva' },
                      email: { type: 'string', example: 'joao@example.com' },
                      role: { type: 'string', example: 'user' },
                      status: { type: 'string', example: 'active' }
                    }
                  },
                  token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
                }
              }
            }
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Name, email and password are required' },
              code: { type: 'number', example: 400 },
              error: { type: 'string', example: 'VALIDATION_ERROR' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const requestId = request.id || Math.random().toString(36).substr(2, 9);

      try {
        const { name, email, password } = request.body as {
          name: string;
          email: string;
          password: string;
        };

        // Use AuthService to handle registration logic
        const result = await authService.registerUser(
          { name, email, password },
          requestId,
          fastify.persistentQueueManager // 🔄 Use persistent queue for MongoDB→Redis→BullMQ flow
        );

        if (result.success && result.user && result.token) {
          return ApiResponseHandler.created(reply, 'User registered successfully', {
            user: result.user,
            token: result.token
          });
        } else {
          // Handle validation errors
          if (result.validationErrors) {
            return ApiResponseHandler.validationError(reply, result.error || 'Validation failed');
          }
          return ApiResponseHandler.validationError(reply, result.error || 'Registration failed');
        }
      } catch (error) {
        logger.error(
          {
            requestId,
            error: error instanceof Error ? error.message : String(error),
            operation: 'register'
          },
          'Auth controller registration error'
        );

        const message = error instanceof Error ? error.message : 'Internal server error';
        return ApiResponseHandler.internalError(reply, message);
      }
    }
  );

  // Login route
  fastify.post(
    '/login',
    {
      schema: {
        description: 'User login and JWT token return',
        tags: ['Auth'],
        summary: 'User Login',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              message: { type: 'string', example: 'Login successful' },
              code: { type: 'number', example: 200 },
              data: {
                type: 'object',
                properties: {
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                      name: { type: 'string', example: 'John Silva' },
                      email: { type: 'string', example: 'joao@example.com' },
                      role: { type: 'string', example: 'user' },
                      status: { type: 'string', example: 'active' }
                    }
                  },
                  token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
                }
              }
            }
          },
          401: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Invalid credentials' },
              code: { type: 'number', example: 401 },
              error: { type: 'string', example: 'AUTHENTICATION_ERROR' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const requestId = request.id || Math.random().toString(36).substr(2, 9);

      try {
        const { email, password } = request.body as { email: string; password: string };

        // Use AuthService to handle login logic
        const result = await authService.loginUser({ email, password }, requestId);

        if (result.success && result.user && result.token) {
          return ApiResponseHandler.success(reply, 'Login successful', {
            user: result.user,
            token: result.token
          });
        } else {
          // Handle validation or authentication errors
          if (result.validationErrors) {
            return ApiResponseHandler.authError(reply, 'Invalid email or password format');
          }
          return ApiResponseHandler.authError(reply, result.error || 'Invalid credentials');
        }
      } catch (error) {
        logger.error(
          {
            requestId,
            error: error instanceof Error ? error.message : String(error),
            operation: 'login'
          },
          'Auth controller login error'
        );

        return ApiResponseHandler.internalError(
          reply,
          error instanceof Error ? error.message : 'Internal server error'
        );
      }
    }
  );
}
