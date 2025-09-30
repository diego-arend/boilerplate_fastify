/**
 * Auth Service - Business logic for authentication operations
 * Handles registration, login, and profile operations
 */

import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { FastifyBaseLogger } from 'fastify';
import type { QueueManager } from '../../../infraestructure/queue/queue.js';
import { AuthRepositoryFactory } from '../factory/auth.factory.js';
import { UserValidations } from '../../../entities/user/index.js';
import { type RegistrationEmailData } from '../../../infraestructure/queue/jobs/business/registrationEmailJob.js';
import { defaultLogger } from '../../../lib/logger/index.js';

/**
 * Auth service interfaces
 */
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    createdAt?: Date;
  };
  token?: string;
  error?: string;
  validationErrors?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

/**
 * Auth Service Class
 */
export class AuthService {
  private authRepository: any;
  private logger: FastifyBaseLogger;
  private jwtSecret: string;

  constructor(jwtSecret: string) {
    this.jwtSecret = jwtSecret;
    this.logger = defaultLogger.child({ component: 'auth-service' });
  }

  /**
   * Initialize auth service (setup repository)
   */
  async initialize(): Promise<void> {
    this.authRepository = await AuthRepositoryFactory.createAuthRepositoryWithCache();
  }

  /**
   * Register new user
   */
  async registerUser(
    data: RegisterRequest,
    requestId: string,
    persistentQueueManager?: any // Changed to PersistentQueueManager
  ): Promise<AuthResult> {
    const serviceLogger = this.logger.child({ requestId, operation: 'register' });

    try {
      // Log registration attempt (development only)
      if (process.env.NODE_ENV === 'development') {
        serviceLogger.info({
          message: 'User registration attempt',
          email: data.email.toLowerCase(),
          hasName: !!data.name,
          hasPassword: !!data.password
        });
      }

      // Validate using Zod schemas
      const validatedData = UserValidations.validateCreateUser({
        name: data.name,
        email: data.email,
        password: data.password
      });

      // Create user using repository (validation already done)
      const newUser = await this.authRepository.createUser({
        name: validatedData.name,
        email: validatedData.email,
        password: validatedData.password // Will be hashed in repository
      });

      // Generate JWT token
      const token = jwt.sign(
        { id: newUser._id, name: newUser.name, role: newUser.role },
        this.jwtSecret,
        { expiresIn: '24h' }
      );

      // Schedule registration email (non-blocking)
      this.scheduleRegistrationEmail(newUser, serviceLogger, persistentQueueManager).catch(
        error => {
          serviceLogger.warn({
            message: 'Failed to schedule registration email',
            error: error instanceof Error ? error.message : String(error),
            userId: newUser._id,
            userEmail: newUser.email
          });
        }
      );

      // Log successful registration
      if (process.env.NODE_ENV === 'development') {
        serviceLogger.info({
          message: 'User registration successful',
          userId: newUser._id,
          userEmail: newUser.email,
          userRole: newUser.role,
          tokenGenerated: !!token
        });
      }

      return {
        success: true,
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          status: newUser.status
        },
        token
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code
        }));

        // Log validation error
        serviceLogger.error({
          message: 'User registration validation failed',
          email: data.email?.toLowerCase(),
          validationIssues: validationErrors
        });

        return {
          success: false,
          error: `Validation failed: ${error.issues.map(issue => issue.message).join(', ')}`,
          validationErrors
        };
      }

      // Log registration error
      serviceLogger.error({
        message: 'User registration failed',
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      };
    }
  }

  /**
   * Login user
   */
  async loginUser(data: LoginRequest, requestId: string): Promise<AuthResult> {
    const serviceLogger = this.logger.child({ requestId, operation: 'login' });

    try {
      // Log login attempt (development only)
      if (process.env.NODE_ENV === 'development') {
        serviceLogger.info({
          message: 'User login attempt',
          email: data.email?.toLowerCase(),
          hasPassword: !!data.password
        });
      }

      // Validate using Zod schemas
      const validatedData = UserValidations.validateLogin({
        email: data.email,
        password: data.password
      });

      // Validate user credentials using repository method
      const loginResult = await this.authRepository.validateLogin(
        validatedData.email,
        validatedData.password
      );

      if (!loginResult.isValid || !loginResult.user) {
        serviceLogger.error({
          message: 'Login failed',
          email: data.email?.toLowerCase(),
          reason: loginResult.reason || 'Invalid credentials'
        });

        return {
          success: false,
          error: loginResult.reason || 'Invalid credentials'
        };
      }

      const user = loginResult.user;

      // Generate JWT token
      const token = jwt.sign({ id: user._id, name: user.name, role: user.role }, this.jwtSecret, {
        expiresIn: '24h'
      });

      // Update last login timestamp
      await this.authRepository.updateLastLogin(String(user._id));

      // Log successful login
      if (process.env.NODE_ENV === 'development') {
        serviceLogger.info({
          message: 'User login successful',
          userId: user._id,
          userEmail: user.email,
          userRole: user.role,
          tokenGenerated: !!token
        });
      }

      return {
        success: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status
        },
        token
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code
        }));

        serviceLogger.error({
          message: 'Login validation failed',
          email: data.email?.toLowerCase(),
          validationIssues: validationErrors
        });

        return {
          success: false,
          error: 'Invalid email or password format',
          validationErrors
        };
      }

      serviceLogger.error({
        message: 'Login operation failed',
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      };
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string, requestId: string): Promise<AuthResult> {
    const serviceLogger = this.logger.child({ requestId, operation: 'get-profile' });

    try {
      // Log profile access attempt (development only)
      if (process.env.NODE_ENV === 'development') {
        serviceLogger.info({
          message: 'User profile access attempt',
          userId: userId
        });
      }

      // Get user profile from repository (which has cache support)
      const user = await this.authRepository.findByIdForAuth(userId);

      if (!user) {
        serviceLogger.error({
          message: 'Profile access failed - user not found in database',
          userId: userId
        });

        return {
          success: false,
          error: 'User not found'
        };
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
        serviceLogger.info({
          message: 'User profile access successful',
          userId: userData.id,
          userRole: userData.role,
          userStatus: userData.status
        });
      }

      return {
        success: true,
        user: userData
      };
    } catch (error) {
      serviceLogger.error({
        message: 'Profile access operation failed',
        userId: userId,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      };
    }
  }

  /**
   * Schedule registration email (private method)
   */
  private async scheduleRegistrationEmail(
    user: any,
    logger: FastifyBaseLogger,
    persistentQueueManager?: any // Changed to PersistentQueueManager
  ): Promise<void> {
    if (!persistentQueueManager) {
      logger.error({
        message: 'Persistent Queue Manager not available for email sending',
        userId: user._id,
        userEmail: user.email
      });
      return;
    }

    try {
      const registrationEmailData: RegistrationEmailData = {
        userId: user._id,
        userName: user.name,
        userEmail: user.email
      };

      // Add registration email job via PersistentQueueManager (MongoDB first)
      const jobId = await persistentQueueManager.addJob(
        'registration:email', // type first for PersistentQueueManager
        registrationEmailData,
        {
          priority: 1, // High priority for registration emails
          attempts: 1 // Single attempt since email is being sent despite SMTP error
        }
      );

      // Log email job creation (development only)
      if (process.env.NODE_ENV === 'development') {
        logger.info({
          message: 'Registration email job created with Persistent Queue Manager',
          jobId: jobId,
          userId: user._id,
          userEmail: user.email,
          jobType: 'registration:email'
        });
      }
    } catch (error) {
      // This is a non-blocking operation, so we only log the error
      logger.warn({
        message: 'Failed to create registration email job with Persistent Queue Manager',
        error: error instanceof Error ? error.message : String(error),
        userId: user._id,
        userEmail: user.email,
        jobType: 'registration:email'
      });
    }
  }
}
