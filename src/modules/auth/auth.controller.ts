import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { AuthRepository } from './repository/index.js';
import { SecurityValidators } from '../../entities/user/index.js';
import { ApiResponseHandler } from '../../lib/response/index.js';
import { PasswordService } from './services/index.js';
import { z } from 'zod';

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

      // Validate using Zod schemas
      try {
        const validatedData = SecurityValidators.validateUserRegistration({
          name,
          email,
          password,
          role: 'user'
        });

        // Create user using repository (validation already done)
        const newUser = await authRepository.createUser({
          name: validatedData.name,
          email: validatedData.email,
          password: validatedData.password // Will be hashed in repository
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
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          const errorMessages = validationError.issues.map((issue) => issue.message).join(', ');
          return ApiResponseHandler.validationError(reply, `Validation failed: ${errorMessages}`);
        }
        throw validationError;
      }
    } catch (error) {
      console.error('Registration error:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
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

      // Validate using Zod schemas
      try {
        const validatedData = SecurityValidators.validateUserLogin({
          email,
          password
        });

        // Find user with password (validation already done in repository)
        const user = await authRepository.findByEmailWithPassword(validatedData.email);

        if (!user) {
          return ApiResponseHandler.authError(reply, 'Invalid credentials');
        }

        // Check if user is active
        if (user.status !== 'active') {
          return ApiResponseHandler.authError(reply, 'Account deactivated');
        }

        // Compare password using bcrypt
        const isPasswordValid = await PasswordService.comparePassword(password, user.password);
        
        if (!isPasswordValid) {
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
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          return ApiResponseHandler.authError(reply, 'Invalid email or password format');
        }
        throw validationError;
      }
    } catch (error) {
      console.error('Login error:', error);
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

      const userId = request.authenticatedUser.id.toString();
      const cacheKey = `user:profile:${userId}`;

      // Try to get user data from cache first
      let userData = await fastify.cache.get<{
        id: string;
        name: string;
        email: string;
        role: string;
        status: string;
        createdAt: Date;
      }>(cacheKey);

      if (!userData) {
        // Cache miss - fetch from database
        const user = await authRepository.findById(userId);

        if (!user) {
          return ApiResponseHandler.notFound(reply, 'User not found');
        }

        userData = {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt
        };

        // Cache user data for 15 minutes
        await fastify.cache.set(cacheKey, userData, { ttl: 900 });
        
        // Add cache header for debugging
        reply.header('X-Data-Source', 'DATABASE');
      } else {
        // Cache hit
        reply.header('X-Data-Source', 'CACHE');
      }

      return ApiResponseHandler.success(reply, 'User data returned', {
        user: userData
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      return ApiResponseHandler.internalError(reply, error instanceof Error ? error : String(error));
    }
  });
};
