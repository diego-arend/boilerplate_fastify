import type { ClientSession } from 'mongoose';
import type { IUser } from '../../../entities/user/index.js';
import type { IUserRepository } from '../../../entities/user/index.js';
import type { ICacheService } from '../../../infraestructure/cache/index.js';

/**
 * Interface for Authentication Repository operations
 */
export interface IAuthRepository {
  // Authentication-specific operations
  findByEmailForAuth(email: string, session?: ClientSession): Promise<IUser | null>;
  findByEmailWithPassword(email: string, session?: ClientSession): Promise<IUser | null>;
  createUser(
    userData: { name: string; email: string; password: string; role?: 'user' | 'admin' },
    session?: ClientSession
  ): Promise<IUser>;
  validateLogin(
    email: string,
    password: string,
    session?: ClientSession
  ): Promise<{
    user: IUser | null;
    isValid: boolean;
    reason?: string;
  }>;
  updateLastLogin(userId: string, session?: ClientSession): Promise<IUser | null>;
  findByIdForAuth(id: string, session?: ClientSession): Promise<IUser | null>;
  emailExistsForAuth(email: string, session?: ClientSession): Promise<boolean>;
}

/**
 * AuthRepository - Authentication-specific repository using composition with cache support
 *
 * Cache Strategy:
 * - Uses Cache Client (Database 0) for all authentication data
 * - Namespace: 'auth' for isolation
 * - TTL: 30 minutes for user data, 1 hour for tokens, 5 minutes for rate limiting
 * - Security: Password data is NEVER cached
 *
 * This class uses UserRepository via dependency injection and includes caching for better performance
 */
export class AuthRepository implements IAuthRepository {
  constructor(
    private userRepository: IUserRepository,
    private cacheService?: ICacheService
  ) {}

  /**
   * Find user by email for authentication (with Cache Client caching)
   * Uses Database 0 with 'auth' namespace and 30-minute TTL
   */
  async findByEmailForAuth(email: string, session?: ClientSession): Promise<IUser | null> {
    // Try cache first if available and no transaction session
    if (this.cacheService && !session) {
      const cachedUser = await this.cacheService.get<IUser>(`user:email:${email.toLowerCase()}`, {
        namespace: 'auth'
      });
      if (cachedUser) {
        return cachedUser;
      }
    }

    // Fetch from database
    const user = await this.userRepository.findByEmail(email, { ...(session && { session }) });

    // Cache the result if available and no session
    if (this.cacheService && user && !session) {
      await this.cacheService.set(`user:email:${email.toLowerCase()}`, user, {
        ttl: 1800,
        namespace: 'auth'
      }); // 30 minutes
    }

    return user;
  }

  /**
   * Find user by email including password (for login) - NO CACHING for security
   */
  async findByEmailWithPassword(email: string, session?: ClientSession): Promise<IUser | null> {
    // Never cache password data for security reasons
    return this.userRepository.findByEmail(email, {
      includePassword: true,
      ...(session && { session })
    });
  }

  /**
   * Create a new user for registration (with Cache Client invalidation)
   * Caches new user data in Database 0 with 'auth' namespace
   */
  async createUser(
    userData: {
      name: string;
      email: string;
      password: string;
      role?: 'user' | 'admin';
    },
    session?: ClientSession
  ): Promise<IUser> {
    // Check if email already exists
    const existingUser = await this.userRepository.emailExists(userData.email, session);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Create user using UserRepository method
    const newUser = await this.userRepository.createUser(
      {
        name: userData.name,
        email: userData.email,
        password: userData.password
      },
      session
    );

    // Cache the new user if cache is available and no session
    if (this.cacheService && !session) {
      await this.cacheService.set(`user:email:${userData.email.toLowerCase()}`, newUser, {
        ttl: 1800,
        namespace: 'auth'
      });
      await this.cacheService.set(`user:id:${String(newUser._id)}`, newUser, {
        ttl: 1800,
        namespace: 'auth'
      });
    }

    return newUser;
  }

  /**
   * Validate user login credentials (with Cache Client rate limiting)
   * Uses Database 0 for rate limiting counters with 5-minute TTL
   */
  async validateLogin(
    email: string,
    password: string,
    session?: ClientSession
  ): Promise<{
    user: IUser | null;
    isValid: boolean;
    reason?: string;
  }> {
    // Check rate limiting if cache service is available
    if (this.cacheService) {
      const attempts =
        (await this.cacheService.get<number>(`login:attempts:${email.toLowerCase()}`, {
          namespace: 'auth'
        })) || 0;
      const maxAttempts = 5;

      if (attempts >= maxAttempts) {
        // Increment attempts (extend blocking time)
        await this.cacheService.set(`login:attempts:${email.toLowerCase()}`, attempts + 1, {
          ttl: 300,
          namespace: 'auth'
        }); // 5 minutes
        return {
          user: null,
          isValid: false,
          reason: 'Too many login attempts. Try again later.'
        };
      }
    }

    // Validate credentials
    const result = await this.userRepository.validateCredentials({ email, password }, session);

    // Handle rate limiting based on result
    if (this.cacheService) {
      if (result.isValid) {
        // Reset attempts on successful login
        await this.cacheService.del(`login:attempts:${email.toLowerCase()}`, { namespace: 'auth' });
      } else {
        // Increment failed attempts
        const currentAttempts =
          (await this.cacheService.get<number>(`login:attempts:${email.toLowerCase()}`, {
            namespace: 'auth'
          })) || 0;
        await this.cacheService.set(`login:attempts:${email.toLowerCase()}`, currentAttempts + 1, {
          ttl: 300,
          namespace: 'auth'
        });
      }
    }

    return result;
  }

  /**
   * Update user last login timestamp (with Cache Client invalidation)
   * Invalidates cached user data in Database 0 to maintain consistency
   */
  async updateLastLogin(userId: string, session?: ClientSession): Promise<IUser | null> {
    const updatedUser = await this.userRepository.updateUser(
      userId,
      {
        lastLoginAt: new Date()
      },
      session
    );

    // Invalidate cache for this user if available and no session
    if (this.cacheService && updatedUser && !session) {
      await this.cacheService.del(`user:id:${userId}`, { namespace: 'auth' });
      await this.cacheService.del(`user:email:${updatedUser.email.toLowerCase()}`, {
        namespace: 'auth'
      });
    }

    return updatedUser;
  }

  /**
   * Find user by ID for authentication (with Cache Client caching)
   * Uses Database 0 with 'auth' namespace and 30-minute TTL
   */
  async findByIdForAuth(id: string, session?: ClientSession): Promise<IUser | null> {
    // Try cache first if available
    if (this.cacheService && !session) {
      const cachedUser = await this.cacheService.get<IUser>(`user:id:${id}`, { namespace: 'auth' });
      if (cachedUser) {
        return cachedUser;
      }
    }

    // Fetch from database
    const user = await this.userRepository.findById(id, session);

    // Cache the result if available and no session
    if (this.cacheService && user && !session) {
      await this.cacheService.set(`user:id:${id}`, user, { ttl: 1800, namespace: 'auth' }); // 30 minutes
    }

    return user;
  }

  /**
   * Check if email exists (no caching for accuracy)
   */
  async emailExistsForAuth(email: string, session?: ClientSession): Promise<boolean> {
    // Don't cache existence checks to ensure accuracy
    return this.userRepository.emailExists(email, session);
  }
}
