import type { ClientSession } from 'mongoose';
import type { IUser } from '../../../entities/user/index.js';
import type { IUserRepository } from '../../../entities/user/index.js';

/**
 * Interface for Authentication Repository operations
 */
export interface IAuthRepository {
  // Authentication-specific operations
  findByEmailForAuth(email: string, session?: ClientSession): Promise<IUser | null>;
  findByEmailWithPassword(email: string, session?: ClientSession): Promise<IUser | null>;
  createUser(userData: { name: string; email: string; password: string; role?: 'user' | 'admin' }, session?: ClientSession): Promise<IUser>;
  validateLogin(email: string, password: string, session?: ClientSession): Promise<{
    user: IUser | null;
    isValid: boolean;
    reason?: string;
  }>;
  updateLastLogin(userId: string, session?: ClientSession): Promise<IUser | null>;
  findByIdForAuth(id: string, session?: ClientSession): Promise<IUser | null>;
  emailExistsForAuth(email: string, session?: ClientSession): Promise<boolean>;
}

/**
 * AuthRepository - Authentication-specific repository using composition
 * This class uses UserRepository via dependency injection instead of inheritance
 * while maintaining access to authentication-focused methods
 */
export class AuthRepository implements IAuthRepository {
  constructor(private userRepository: IUserRepository) {}

  /**
   * Find user by email for authentication
   */
  async findByEmailForAuth(email: string, session?: ClientSession): Promise<IUser | null> {
    return this.userRepository.findByEmail(email, { ...(session && { session }) });
  }

  /**
   * Find user by email including password (for login)
   */
  async findByEmailWithPassword(email: string, session?: ClientSession): Promise<IUser | null> {
    return this.userRepository.findByEmail(email, { includePassword: true, ...(session && { session }) });
  }

  /**
   * Create a new user for registration
   */
  async createUser(userData: {
    name: string;
    email: string;
    password: string;
    role?: 'user' | 'admin';
  }, session?: ClientSession): Promise<IUser> {
    // Check if email already exists
    const existingUser = await this.userRepository.emailExists(userData.email, session);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Create user using UserRepository method
    return this.userRepository.createUser({
      name: userData.name,
      email: userData.email,
      password: userData.password
    }, session);
  }

  /**
   * Validate user login credentials
   */
  async validateLogin(email: string, password: string, session?: ClientSession): Promise<{
    user: IUser | null;
    isValid: boolean;
    reason?: string;
  }> {
    return this.userRepository.validateCredentials({ email, password }, session);
  }

  /**
   * Update user last login timestamp
   */
  async updateLastLogin(userId: string, session?: ClientSession): Promise<IUser | null> {
    return this.userRepository.updateUser(userId, { 
      lastLoginAt: new Date() 
    }, session);
  }

  /**
   * Find user by ID for authentication
   */
  async findByIdForAuth(id: string, session?: ClientSession): Promise<IUser | null> {
    return this.userRepository.findById(id, session);
  }

  /**
   * Check if email exists (uses UserRepository method)
   */
  async emailExistsForAuth(email: string, session?: ClientSession): Promise<boolean> {
    return this.userRepository.emailExists(email, session);
  }
}