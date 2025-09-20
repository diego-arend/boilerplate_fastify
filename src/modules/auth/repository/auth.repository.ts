import { Model } from 'mongoose';
import type { FilterQuery, UpdateQuery } from 'mongoose';
import { BaseRepository } from '../../../infraestructure/mongo/baseRepository.js';
import { UserModel, type IUser } from '../../../entities/user/index.js';
import { SecurityValidators } from '../../../entities/user/index.js';
import { EmailSchema, PasswordSchema } from '../../../lib/validators/index.js';
import { PasswordService } from '../services/index.js';
import { z } from 'zod';

export class AuthRepository extends BaseRepository<IUser> {
  constructor() {
    super(UserModel as Model<IUser>);
  }

  /**
   * Find user by email for authentication
   */
  async findByEmail(email: string): Promise<IUser | null> {
    try {
      // Validate and sanitize email using Zod
      const validEmail = EmailSchema.parse(email.toLowerCase());
      return await this.findOne({ email: validEmail });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error('Invalid email format');
      }
      throw error;
    }
  }

  /**
   * Find user by email including password (for login)
   */
  async findByEmailWithPassword(email: string): Promise<IUser | null> {
    try {
      // Validate and sanitize email using Zod
      const validEmail = EmailSchema.parse(email.toLowerCase());
      return await this.model.findOne({ email: validEmail }).select('+password').exec();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error('Invalid email format');
      }
      throw error;
    }
  }

  /**
   * Create a new user for registration
   */
  async createUser(userData: {
    name: string;
    email: string;
    password: string;
    role?: 'user' | 'admin';
  }): Promise<IUser> {
    try {
      // Validate user registration data using Zod schema
      const validatedData = SecurityValidators.validateUserRegistration({
        name: userData.name,
        email: userData.email.toLowerCase(),
        password: userData.password,
        role: userData.role || 'user'
      });

      // Check if email already exists
      const existingUser = await this.findByEmail(validatedData.email);
      if (existingUser) {
        throw new Error('Email already registered');
      }

      // Hash the password before saving
      const hashedPassword = await PasswordService.hashPassword(validatedData.password);

      // Create user data with hashed password
      const userDataToSave = {
        ...validatedData,
        password: hashedPassword
      };

      return await this.create(userDataToSave as Partial<IUser>);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation failed: ${error.issues.map((e) => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Find user by ID (for JWT verification)
   */
  async findByIdForAuth(id: string): Promise<IUser | null> {
    return await this.findById(id);
  }

  /**
   * Check if email exists (for registration)
   */
  async emailExists(email: string): Promise<boolean> {
    try {
      // Validate email using Zod schema
      const validEmail = EmailSchema.parse(email.toLowerCase());
      const count = await this.count({ email: validEmail });
      return count > 0;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return false; // Invalid email format, consider as not existing
      }
      throw error;
    }
  }

  /**
   * Update user's last login (optional)
   */
  async updateLastLogin(userId: string): Promise<IUser | null> {
    return await this.updateById(userId, {
      updatedAt: new Date()
    } as UpdateQuery<IUser>);
  }
}
