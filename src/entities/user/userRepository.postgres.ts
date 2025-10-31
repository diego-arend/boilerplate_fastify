/**
 * User Repository PostgreSQL Implementation
 * Uses TypeORM with DataSource injection
 *
 * Features:
 * - Full TypeORM Repository pattern
 * - QueryBuilder for complex queries with pagination
 * - Transaction support via DataSource
 * - bcryptjs for password hashing
 * - crypto for secure token generation
 * - Optimized queries with proper indexing
 *
 * Note: Standalone PostgreSQL implementation (no MongoDB interface)
 */

import { DataSource, Repository, type FindOptionsWhere } from 'typeorm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from './userEntity.postgres';

// Local types
type UserRole = 'user' | 'admin';

interface PaginationOptions {
  page: number;
  limit: number;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class UserRepositoryPostgres {
  private repository: Repository<User>;

  constructor(private readonly dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(User);
  }

  /**
   * ============================================
   * CRUD Operations
   * ============================================
   */

  async create(userData: {
    name: string;
    email: string;
    password: string;
  }): Promise<Partial<User>> {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    const user = this.repository.create({
      name: userData.name,
      email: userData.email.toLowerCase(),
      password: hashedPassword,
      emailVerificationToken,
      passwordResetExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      role: 'user',
      emailVerified: false,
      status: 'active',
      loginAttempts: 0
    });

    await this.repository.save(user);
    return user.toJSON();
  }

  async findById(id: number): Promise<Partial<User> | null>;
  async findById(id: string): Promise<Partial<User> | null>;
  async findById(id: number | string): Promise<Partial<User> | null> {
    const numericId = typeof id === 'string' ? Number(id) : id;
    const user = await this.repository.findOne({ where: { id: numericId } });
    return user ? user.toJSON() : null;
  }

  async findByEmail(email: string): Promise<Partial<User> | null> {
    const user = await this.repository.findOne({
      where: { email: email.toLowerCase() }
    });
    return user ? user.toJSON() : null;
  }

  async update(id: number, userData: Partial<User>): Promise<Partial<User> | null> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) return null;

    this.repository.merge(user, userData);
    await this.repository.save(user);
    return user.toJSON();
  }

  /**
   * Update user by string ID (for auth repository compatibility)
   */
  async updateUser(id: string, userData: Partial<User>): Promise<Partial<User> | null> {
    return this.update(Number(id), userData);
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.repository.delete(id);
    return !!(result.affected && result.affected > 0);
  }

  async findAll(options?: PaginationOptions): Promise<PaginatedResult<Partial<User>>> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, total] = await this.repository.findAndCount({
      skip,
      take: limit,
      order: { createdAt: 'DESC' }
    });

    return {
      data: data.map(user => user.toJSON()),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * ============================================
   * Authentication Operations
   * ============================================
   */

  async validatePassword(email: string, password: string): Promise<Partial<User> | null> {
    const user = await this.repository.findOne({
      where: { email: email.toLowerCase() },
      select: ['id', 'email', 'password', 'status', 'emailVerified', 'lockUntil', 'loginAttempts']
    });

    if (!user) return null;
    if (!user.canLogin()) return null;

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      // Increment login attempts
      user.loginAttempts = (user.loginAttempts || 0) + 1;

      // Lock account after 5 failed attempts for 15 minutes
      if (user.loginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await this.repository.save(user);
      return null;
    }

    // Reset login attempts on successful login
    user.loginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();
    await this.repository.save(user);

    return user.toJSON();
  }

  async updateLastLogin(id: number): Promise<void> {
    await this.repository.update(id, { lastLoginAt: new Date() });
  }

  /**
   * ============================================
   * Email Verification Operations
   * ============================================
   */

  async findByEmailVerificationToken(token: string): Promise<Partial<User> | null> {
    const user = await this.repository.findOne({
      where: {
        emailVerificationToken: token
      }
    });

    // Note: PostgreSQL entity doesn't have emailVerificationExpires
    // Token expiration should be checked at application level or added to entity
    return user ? user.toJSON() : null;
  }

  async verifyEmail(token: string): Promise<boolean> {
    const user = await this.repository.findOne({
      where: {
        emailVerificationToken: token
      }
    });

    if (!user) return false;

    user.emailVerified = true;
    user.emailVerificationToken = null;

    await this.repository.save(user);
    return true;
  }

  async regenerateEmailVerificationToken(email: string): Promise<string | null> {
    const user = await this.repository.findOne({
      where: { email: email.toLowerCase() }
    });

    if (!user || user.emailVerified) return null;

    const token = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = token;

    await this.repository.save(user);
    return token;
  }

  /**
   * ============================================
   * Password Reset Operations
   * ============================================
   */

  async createPasswordResetToken(email: string): Promise<string | null> {
    const user = await this.repository.findOne({
      where: { email: email.toLowerCase() }
    });

    if (!user || user.status !== 'active') return null;

    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = token;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.repository.save(user);
    return token;
  }

  async findByPasswordResetToken(token: string): Promise<Partial<User> | null> {
    const user = await this.repository.findOne({
      where: {
        passwordResetToken: token
      }
    });

    // Check if token is expired
    if (user && user.passwordResetExpires && user.passwordResetExpires < new Date()) {
      return null;
    }

    return user ? user.toJSON() : null;
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const user = await this.repository.findOne({
      where: {
        passwordResetToken: token
      }
    });

    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return false;
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;

    await this.repository.save(user);
    return true;
  }

  /**
   * ============================================
   * Admin Operations
   * ============================================
   */

  async updateRole(id: number, role: UserRole): Promise<Partial<User> | null> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) return null;

    // Check if user can be promoted to admin
    if (role === 'admin' && !user.canPromoteToAdmin()) {
      throw new Error('User cannot be promoted to admin: email not verified or inactive');
    }

    user.role = role;
    await this.repository.save(user);
    return user.toJSON();
  }

  async deactivateUser(id: number): Promise<boolean> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) return false;

    user.status = 'inactive';
    await this.repository.save(user);
    return true;
  }

  async activateUser(id: number): Promise<boolean> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) return false;

    user.status = 'active';
    await this.repository.save(user);
    return true;
  }

  /**
   * ============================================
   * Query Operations
   * ============================================
   */

  async count(where?: FindOptionsWhere<User>): Promise<number> {
    if (!where) {
      return this.repository.count();
    }
    return this.repository.count({ where });
  }

  async exists(where: FindOptionsWhere<User>): Promise<boolean> {
    const count = await this.repository.count({ where });
    return count > 0;
  }

  async findByRole(
    role: UserRole,
    options?: PaginationOptions
  ): Promise<PaginatedResult<Partial<User>>> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, total] = await this.repository.findAndCount({
      where: { role },
      skip,
      take: limit,
      order: { createdAt: 'DESC' }
    });

    return {
      data: data.map(user => user.toJSON()),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * ============================================
   * Utility Methods
   * ============================================
   */

  /**
   * Check if email exists in database
   */
  async emailExists(email: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { email: email.toLowerCase() }
    });
    return count > 0;
  }

  /**
   * Validate user credentials (email + password)
   * Returns validation result with user data
   */
  async validateCredentials(credentials: {
    email: string;
    password: string;
  }): Promise<{ isValid: boolean; user: Partial<User> | null; reason?: string }> {
    const user = await this.repository.findOne({
      where: { email: credentials.email.toLowerCase() },
      select: [
        'id',
        'name',
        'email',
        'password',
        'status',
        'emailVerified',
        'lockUntil',
        'loginAttempts',
        'role'
      ]
    });

    if (!user) {
      return { isValid: false, user: null, reason: 'User not found' };
    }

    if (!user.canLogin()) {
      return { isValid: false, user: null, reason: 'Account locked or inactive' };
    }

    const isValid = await bcrypt.compare(credentials.password, user.password);

    if (!isValid) {
      // Increment login attempts
      user.loginAttempts = (user.loginAttempts || 0) + 1;

      // Lock account after 5 failed attempts for 15 minutes
      if (user.loginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await this.repository.save(user);
      return { isValid: false, user: null, reason: 'Invalid password' };
    }

    // Reset login attempts and update last login on successful login
    user.loginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();

    await this.repository.save(user);

    // Return user without password
    const { password: _pwd, ...userWithoutPassword } = user.toJSON();
    return { isValid: true, user: userWithoutPassword };
  }

  /**
   * Create user with optional role (for auth repository compatibility)
   */
  async createUser(userData: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
  }): Promise<Partial<User>> {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    const user = this.repository.create({
      name: userData.name,
      email: userData.email.toLowerCase(),
      password: hashedPassword,
      emailVerificationToken,
      passwordResetExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      role: userData.role || 'user',
      emailVerified: false,
      status: 'active',
      loginAttempts: 0
    });

    await this.repository.save(user);

    // Return without password
    const { password: _pwd, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.repository.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
