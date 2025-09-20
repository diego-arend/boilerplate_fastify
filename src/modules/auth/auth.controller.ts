import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { AuthRepository } from './repository/index.js';
import { SecurityValidators } from '../../entities/user/index.js';
import { ApiResponseHandler } from '../../lib/response/index.js';

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

// Authentication repository instance
const authRepository = new AuthRepository();

export default async function authController(fastify: FastifyInstance) {

  // Register route
  fastify.post('/register', {
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
  }, async (request, reply) => {
    try {
      const { name, email, password } = request.body as RegisterRequest;

      // Basic input validations
      if (!name || !email || !password) {
        return ApiResponseHandler.validationError(reply, 'Name, email and password are required');
      }

      // Sanitiza os dados de entrada
      const sanitizedData = {
        name: SecurityValidators.sanitizeInput(name),
        email: SecurityValidators.sanitizeInput(email).toLowerCase(),
        password
      };

      // Security validations
      if (SecurityValidators.hasInjectionAttempt(sanitizedData.name) ||
          SecurityValidators.hasInjectionAttempt(sanitizedData.email)) {
        return ApiResponseHandler.validationError(reply, 'Invalid data detected');
      }

      // Create user using repository
      const newUser = await authRepository.createUser({
        name: sanitizedData.name,
        email: sanitizedData.email,
        password: sanitizedData.password // Will be hashed in service later
      });

      // Generate JWT token
      const token = jwt.sign(
        { id: newUser._id, name: newUser.name, role: newUser.role },
        fastify.config.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return ApiResponseHandler.created(reply, 'User registered successfully', {
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          status: newUser.status
        },
        token
      });
    } catch (error) {
      console.error('Erro no registro:', error);
      const message = error instanceof Error ? error.message : 'Erro interno do servidor';
      return ApiResponseHandler.validationError(reply, message);
    }
  });

  // Login route
  fastify.post('/login', {
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
  }, async (request, reply) => {
    try {
      const { email, password } = request.body as LoginRequest;

      // Basic validations
      if (!email || !password) {
        return ApiResponseHandler.validationError(reply, 'Email and password are required');
      }

      // Sanitize email
      const sanitizedEmail = SecurityValidators.sanitizeInput(email).toLowerCase();

      // Find user with password (for comparison)
      const user = await authRepository.findByEmailWithPassword(sanitizedEmail);

      if (!user) {
        return ApiResponseHandler.authError(reply, 'Invalid credentials');
      }

      // Check if user is active
      if (user.status !== 'active') {
        return ApiResponseHandler.authError(reply, 'Account deactivated');
      }

      // TODO: Compare hashed password (implement in service)
      // For now, simple comparison (DO NOT use in production)
      if (password !== user.password) {
        return ApiResponseHandler.authError(reply, 'Invalid credentials');
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user._id, name: user.name, role: user.role },
        fastify.config.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return ApiResponseHandler.success(reply, 'Login successful', {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status
        },
        token
      });
    } catch (error) {
      console.error('Erro no login:', error);
      return ApiResponseHandler.internalError(reply, error instanceof Error ? error : String(error));
    }
  });

  // Protected route example
  fastify.get('/me', {
    preHandler: fastify.authenticate,
    schema: {
      description: 'Return authenticated user data',
      tags: ['Auth'],
      summary: 'User Profile',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'User data returned' },
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
                    status: { type: 'string', example: 'active' },
                    createdAt: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'User not authenticated' },
            code: { type: 'number', example: 401 },
            error: { type: 'string', example: 'AUTHENTICATION_ERROR' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Check if user is authenticated
      if (!request.authenticatedUser) {
        return ApiResponseHandler.authError(reply, 'User not authenticated');
      }

      // Find updated user data
      const user = await authRepository.findById(request.authenticatedUser.id.toString());

      if (!user) {
        return ApiResponseHandler.notFound(reply, 'User not found');
      }

      return ApiResponseHandler.success(reply, 'User data returned', {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      return ApiResponseHandler.internalError(reply, error instanceof Error ? error : String(error));
    }
  });
};
