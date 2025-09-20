import { Model } from 'mongoose';
import type { FilterQuery, UpdateQuery } from 'mongoose';
import { BaseRepository } from '../../../infraestructure/mongo/baseRepository.js';
import { UserModel, type IUser } from '../../../entities/user/index.js';
import { SecurityValidators } from '../../../entities/user/index.js';

export class AuthRepository extends BaseRepository<IUser> {
  constructor() {
    super(UserModel as Model<IUser>);
  }

  /**
   * Find user by email for authentication
   */
  async findByEmail(email: string): Promise<IUser | null> {
    const sanitizedEmail = SecurityValidators.sanitizeInput(email).toLowerCase();

    if (!SecurityValidators.isValidEmail(sanitizedEmail)) {
      throw new Error('Invalid email');
    }

    return await this.findOne({ email: sanitizedEmail });
  }

  /**
   * Find user by email including password (for login)
   */
  async findByEmailWithPassword(email: string): Promise<IUser | null> {
    const sanitizedEmail = SecurityValidators.sanitizeInput(email).toLowerCase();

    if (!SecurityValidators.isValidEmail(sanitizedEmail)) {
      throw new Error('Invalid email');
    }

    return await this.model.findOne({ email: sanitizedEmail }).select('+password').exec();
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
    const sanitizedData = {
      name: SecurityValidators.sanitizeInput(userData.name),
      email: SecurityValidators.sanitizeInput(userData.email).toLowerCase(),
      password: userData.password,
      role: userData.role || 'user'
    };

    if (!SecurityValidators.isValidEmail(sanitizedData.email)) {
      throw new Error('Invalid email');
    }

    if (!SecurityValidators.isStrongPassword(userData.password)) {
      throw new Error('Password does not meet security requirements');
    }

    const existingUser = await this.findByEmail(sanitizedData.email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    return await this.create(sanitizedData as Partial<IUser>);
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
    const sanitizedEmail = SecurityValidators.sanitizeInput(email).toLowerCase();

    if (!SecurityValidators.isValidEmail(sanitizedEmail)) {
      return false;
    }

    const count = await this.count({ email: sanitizedEmail });
    return count > 0;
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
