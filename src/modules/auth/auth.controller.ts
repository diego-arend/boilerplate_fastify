import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { AuthRepositoryFactory } from './factory/auth.factory.js';
import { UserValidations } from '../../entities/user/index.js';
import { ApiResponseHandler } from '../../lib/response/index.js';
import { JobType, JobPriority } from '../../infraestructure/queue/queue.types.js';
import { type EmailJobData } from '../../infraestructure/queue/jobs/business/emailSend.job.js';
import { z } from 'zod';
import { defaultLogger } from '../../lib/logger/index.js';

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

const logger = defaultLogger.child({ context: 'auth-controller' });

export default async function authController(fastify: FastifyInstance) {
  // Create authentication repository with cache injection
  const authRepository = await AuthRepositoryFactory.createAuthRepositoryWithCache();

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
      const requestLogger = logger.child({ requestId, operation: 'register' });

      try {
        const { name, email, password } = request.body as RegisterRequest;

        // Log registration attempt (development only)
        if (process.env.NODE_ENV === 'development') {
          requestLogger.info({
            message: 'User registration attempt',
            email: email.toLowerCase(),
            hasName: !!name,
            hasPassword: !!password
          });
        }

        // Validate using Zod schemas
        try {
          const validatedData = UserValidations.validateCreateUser({
            name,
            email,
            password
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

          // Create email job for registration success notification
          try {
            const emailJobData: EmailJobData = {
              to: newUser.email,
              subject: `🎉 Parabéns ${newUser.name}! Seu cadastro foi realizado com sucesso`,
              template: 'registration_success',
              variables: {
                userName: newUser.name
              },
              priority: 'high'
            };

            // Add email job to queue
            const jobId = await fastify.queueManager.addJob(JobType.EMAIL_SEND, emailJobData, {
              priority: JobPriority.HIGH, // High priority for registration emails
              attempts: 3 // Retry up to 3 times
            });

            // Log email job creation (development only)
            if (process.env.NODE_ENV === 'development') {
              requestLogger.info({
                message: 'Registration email job created',
                jobId,
                userId: newUser._id,
                userEmail: newUser.email,
                template: 'registration_success'
              });
            }
          } catch (emailError) {
            // Log email job error but don't fail registration
            requestLogger.warn({
              message: 'Failed to create registration email job',
              error: emailError instanceof Error ? emailError.message : String(emailError),
              userId: newUser._id,
              userEmail: newUser.email
            });
            // Continue with successful registration response
          }

          // Log successful registration
          if (process.env.NODE_ENV === 'development') {
            requestLogger.info({
              message: 'User registration successful',
              userId: newUser._id,
              userEmail: newUser.email,
              userRole: newUser.role,
              tokenGenerated: !!token
            });
          }

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
            const errorMessages = validationError.issues.map(issue => issue.message).join(', ');

            // Log validation error
            requestLogger.error({
              message: 'User registration validation failed',
              error: errorMessages,
              email: email?.toLowerCase(),
              validationIssues: validationError.issues.map(issue => ({
                field: issue.path.join('.'),
                message: issue.message,
                code: issue.code
              }))
            });

            return ApiResponseHandler.validationError(reply, `Validation failed: ${errorMessages}`);
          }
          throw validationError;
        }
      } catch (error) {
        // Log registration error
        requestLogger.error({
          message: 'User registration failed',
          error: error instanceof Error ? error.message : String(error),
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          stack: error instanceof Error ? error.stack : undefined
        });

        const message = error instanceof Error ? error.message : 'Internal server error';
        return ApiResponseHandler.validationError(reply, message);
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
      const requestLogger = logger.child({ requestId, operation: 'login' });

      try {
        const { email, password } = request.body as LoginRequest;

        // Log login attempt (development only)
        if (process.env.NODE_ENV === 'development') {
          requestLogger.info({
            message: 'User login attempt',
            email: email?.toLowerCase(),
            hasPassword: !!password
          });
        }

        // Validate using Zod schemas
        try {
          const validatedData = UserValidations.validateLogin({
            email,
            password
          });

          // Validate user credentials using repository method
          const loginResult = await authRepository.validateLogin(
            validatedData.email,
            validatedData.password
          );

          if (!loginResult.isValid || !loginResult.user) {
            requestLogger.error({
              message: 'Login failed',
              email: email?.toLowerCase(),
              reason: loginResult.reason || 'Invalid credentials'
            });
            return ApiResponseHandler.authError(reply, loginResult.reason || 'Invalid credentials');
          }

          const user = loginResult.user;

          // Generate JWT token
          const token = jwt.sign(
            { id: user._id, name: user.name, role: user.role },
            fastify.config.JWT_SECRET,
            { expiresIn: '24h' }
          );

          // Update last login timestamp
          await authRepository.updateLastLogin(String(user._id));

          // Log successful login
          if (process.env.NODE_ENV === 'development') {
            requestLogger.info({
              message: 'User login successful',
              userId: user._id,
              userEmail: user.email,
              userRole: user.role,
              tokenGenerated: !!token
            });
          }

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
            requestLogger.error({
              message: 'Login validation failed',
              email: email?.toLowerCase(),
              validationIssues: validationError.issues.map(issue => ({
                field: issue.path.join('.'),
                message: issue.message,
                code: issue.code
              }))
            });
            return ApiResponseHandler.authError(reply, 'Invalid email or password format');
          }
          throw validationError;
        }
      } catch (error) {
        requestLogger.error({
          message: 'Login operation failed',
          error: error instanceof Error ? error.message : String(error),
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          stack: error instanceof Error ? error.stack : undefined
        });
        return ApiResponseHandler.internalError(
          reply,
          error instanceof Error ? error : String(error)
        );
      }
    }
  );

  // Protected route example
  fastify.get(
    '/me',
    {
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
    },
    async (request, reply) => {
      const requestId = request.id || Math.random().toString(36).substr(2, 9);
      const requestLogger = logger.child({ requestId, operation: 'get-profile' });

      try {
        // Check if user is authenticated
        if (!request.authenticatedUser) {
          requestLogger.error({
            message: 'Profile access failed - user not authenticated'
          });
          return ApiResponseHandler.authError(reply, 'User not authenticated');
        }

        const userId = request.authenticatedUser.id.toString();

        // Log profile access attempt (development only)
        if (process.env.NODE_ENV === 'development') {
          requestLogger.info({
            message: 'User profile access attempt',
            userId: userId,
            userName: request.authenticatedUser.name,
            userRole: request.authenticatedUser.role
          });
        }

        // Get user profile from repository (which has cache support)
        const user = await authRepository.findByIdForAuth(userId);

        if (!user) {
          requestLogger.error({
            message: 'Profile access failed - user not found in database',
            userId: userId
          });
          return ApiResponseHandler.notFound(reply, 'User not found');
        }

        const userData = {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt
        };

        // Log successful profile access (development only)
        if (process.env.NODE_ENV === 'development') {
          requestLogger.info({
            message: 'User profile access successful',
            userId: userData.id,
            userRole: userData.role,
            userStatus: userData.status
          });
        }

        return ApiResponseHandler.success(reply, 'User data returned', {
          user: userData
        });
      } catch (error) {
        requestLogger.error({
          message: 'Profile access operation failed',
          userId: request.authenticatedUser?.id,
          error: error instanceof Error ? error.message : String(error),
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          stack: error instanceof Error ? error.stack : undefined
        });
        return ApiResponseHandler.internalError(
          reply,
          error instanceof Error ? error : String(error)
        );
      }
    }
  );
}
