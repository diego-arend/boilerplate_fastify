import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { FilterQuery, ClientSession } from 'mongoose';
import type { IUser } from './userEntity.js';
import { UserModel, UserValidations } from './userEntity.js';
import type { 
  IBaseRepository, 
  RepositoryOptions, 
  PaginationOptions, 
  PaginationResult 
} from '../../infraestructure/mongo/index.js';

/**
 * Interface for User Repository operations
 */
export interface IUserRepository {
  // User-specific CRUD operations
  createUser(userData: Parameters<typeof UserValidations.validateCreateUser>[0], session?: ClientSession): Promise<IUser>;
  findByEmail(email: string, options?: { includePassword?: boolean; session?: ClientSession }): Promise<IUser | null>;
  findById(id: string, session?: ClientSession): Promise<IUser | null>;
  updateUser(id: string, updateData: Parameters<typeof UserValidations.validateUpdateUser>[0], session?: ClientSession): Promise<IUser | null>;
  softDeleteUser(id: string, session?: ClientSession): Promise<IUser | null>;

  // Query operations with pagination
  findUsersWithPagination(filters: FilterQuery<IUser>, options: PaginationOptions, session?: ClientSession): Promise<PaginationResult<IUser>>;
  findUsersByRole(role: 'user' | 'admin', options: PaginationOptions, session?: ClientSession): Promise<PaginationResult<IUser>>;
  findActiveUsers(options: PaginationOptions, session?: ClientSession): Promise<PaginationResult<IUser>>;
  searchUsers(searchTerm: string, options: PaginationOptions, session?: ClientSession): Promise<PaginationResult<IUser>>;

  // Authentication operations
  validateCredentials(loginData: Parameters<typeof UserValidations.validateLogin>[0], session?: ClientSession): Promise<{
    user: IUser | null;
    isValid: boolean;
    reason?: string;
  }>;
  changePassword(userId: string, passwordData: Parameters<typeof UserValidations.validatePasswordChange>[0], session?: ClientSession): Promise<{ success: boolean; reason?: string }>;

  // Email verification operations
  generateEmailVerificationToken(userId: string, session?: ClientSession): Promise<string | null>;
  verifyEmail(token: string, session?: ClientSession): Promise<{ success: boolean; user?: IUser }>;

  // Password reset operations
  generatePasswordResetToken(email: string, session?: ClientSession): Promise<{ success: boolean; token?: string }>;
  resetPassword(token: string, newPassword: string, session?: ClientSession): Promise<{ success: boolean; reason?: string }>;

  // Admin operations
  promoteToAdmin(userId: string, session?: ClientSession): Promise<{ success: boolean; reason?: string }>;
  suspendUser(userId: string, session?: ClientSession): Promise<boolean>;
  reactivateUser(userId: string, session?: ClientSession): Promise<boolean>;

  // Utility operations
  emailExists(email: string, session?: ClientSession): Promise<boolean>;
  getUserStats(session?: ClientSession): Promise<{
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    admins: number;
    emailVerified: number;
  }>;
  findUsersCreatedBetween(startDate: Date, endDate: Date, options: PaginationOptions, session?: ClientSession): Promise<PaginationResult<IUser>>;
  findLockedUsers(options: PaginationOptions, session?: ClientSession): Promise<PaginationResult<IUser>>;
}

/**
 * User Repository - Handles all database operations for User entity
 * Uses composition with BaseRepository instead of inheritance
 */
export class UserRepository implements IUserRepository {
  private readonly SALT_ROUNDS = 12;

  constructor(private baseRepository: IBaseRepository<IUser>) {}

  /**
   * Helper to create repository options with session
   */
  private getRepoOptions(session?: ClientSession): RepositoryOptions {
    return session ? { session } : {};
  }

  // ==========================================
  // ENHANCED CRUD OPERATIONS
  // ==========================================

  /**
   * Create a new user with validation and password hashing
   */
  async createUser(
    userData: Parameters<typeof UserValidations.validateCreateUser>[0],
    session?: ClientSession
  ): Promise<IUser> {
    // Validate input data
    const validatedData = UserValidations.validateCreateUser(userData);

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, this.SALT_ROUNDS);

    // Create user using base repository method
    return this.baseRepository.create({
      ...validatedData,
      password: hashedPassword,
      emailVerificationToken: crypto.randomBytes(32).toString('hex')
    } as Partial<IUser>, this.getRepoOptions(session));
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string, options?: { includePassword?: boolean; session?: ClientSession }): Promise<IUser | null> {
    const user = await this.baseRepository.findOne({ email: email.toLowerCase() }, this.getRepoOptions(options?.session));

    if (user && options?.includePassword) {
      // If password is needed, make a separate query with select
      const userWithPassword = await UserModel.findById(user._id)
        .select('+password')
        .session(options.session || null);
      return userWithPassword;
    }

    return user;
  }

  /**
   * Find user by ID
   */
  async findById(id: string, session?: ClientSession): Promise<IUser | null> {
    return this.baseRepository.findById(id, this.getRepoOptions(session));
  }

  /**
   * Update user with validation
   */
  async updateUser(
    id: string,
    updateData: Parameters<typeof UserValidations.validateUpdateUser>[0],
    session?: ClientSession
  ): Promise<IUser | null> {
    // Validate update data
    const validatedData = UserValidations.validateUpdateUser(updateData);

    return this.baseRepository.updateById(id, { $set: validatedData }, this.getRepoOptions(session));
  }

  /**
   * Soft delete user by changing status
   */
  async softDeleteUser(id: string, session?: ClientSession): Promise<IUser | null> {
    return this.baseRepository.updateById(id, { $set: { status: 'inactive' } }, this.getRepoOptions(session));
  }

  // ==========================================
  // QUERY OPERATIONS WITH PAGINATION
  // ==========================================

  /**
   * Find users with pagination and filtering
   */
  async findUsersWithPagination(
    filters: FilterQuery<IUser> = {},
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IUser>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    // Build sort object
    const sort: Record<string, 1 | -1> = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const result = await this.baseRepository.findPaginated(filters, page, limit, sort, this.getRepoOptions(session));

    return result;
  }

  /**
   * Find users by role
   */
  async findUsersByRole(
    role: 'user' | 'admin',
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IUser>> {
    return this.findUsersWithPagination({ role }, options, session);
  }

  /**
   * Find active users
   */
  async findActiveUsers(
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IUser>> {
    return this.findUsersWithPagination({
      status: 'active',
      $or: [
        { lockUntil: null },
        { lockUntil: { $lt: new Date() } }
      ]
    }, options, session);
  }

  /**
   * Search users by name or email
   */
  async searchUsers(
    searchTerm: string,
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IUser>> {
    const searchRegex = new RegExp(searchTerm, 'i');
    
    return this.findUsersWithPagination({
      $or: [
        { name: searchRegex },
        { email: searchRegex }
      ]
    }, options, session);
  }

  // ==========================================
  // AUTHENTICATION OPERATIONS
  // ==========================================

  /**
   * Validate user credentials
   */
  async validateCredentials(
    loginData: Parameters<typeof UserValidations.validateLogin>[0],
    session?: ClientSession
  ): Promise<{
    user: IUser | null;
    isValid: boolean;
    reason?: string;
  }> {
    // Validate login data
    const { email, password } = UserValidations.validateLogin(loginData);

    // Find user with password
    const user = await this.findByEmail(email, { 
      includePassword: true, 
      ...(session && { session })
    });

    if (!user) {
      return { user: null, isValid: false, reason: 'Invalid credentials' };
    }

    // Check if user can login
    const canLogin = UserValidations.canUserLogin(user);
    if (!canLogin.canLogin) {
      return { user, isValid: false, reason: canLogin.reason || 'Access denied' };
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Increment login attempts using base repository method
      await this.baseRepository.updateById((user._id as any).toString(), {
        $inc: { loginAttempts: 1 }
      }, this.getRepoOptions(session));
      return { user, isValid: false, reason: 'Invalid credentials' };
    }

    // Reset login attempts and update last login on successful login
    if (user.loginAttempts > 0) {
      await this.baseRepository.updateById((user._id as any).toString(), {
        $unset: { loginAttempts: 1, lockUntil: 1 },
        $set: { lastLoginAt: new Date() }
      }, this.getRepoOptions(session));
    } else {
      await this.baseRepository.updateById((user._id as any).toString(), {
        $set: { lastLoginAt: new Date() }
      }, this.getRepoOptions(session));
    }

    return { user, isValid: true };
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    passwordData: Parameters<typeof UserValidations.validatePasswordChange>[0],
    session?: ClientSession
  ): Promise<{ success: boolean; reason?: string }> {
    // Validate password data
    const { currentPassword, newPassword } = UserValidations.validatePasswordChange(passwordData);

    // Find user with password using base repository method
    const user = await this.baseRepository.findById(userId, this.getRepoOptions(session));
    if (!user) {
      return { success: false, reason: 'User not found' };
    }

    const userWithPassword = await UserModel.findById(userId)
      .select('+password')
      .session(session || null);

    if (!userWithPassword) {
      return { success: false, reason: 'User not found' };
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userWithPassword.password);

    if (!isCurrentPasswordValid) {
      return { success: false, reason: 'Current password is incorrect' };
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    // Update password using base repository method
    await this.baseRepository.updateById(userId, {
      $set: { password: hashedNewPassword },
      $unset: { passwordResetToken: 1, passwordResetExpires: 1 }
    }, this.getRepoOptions(session));

    return { success: true };
  }

  // ==========================================
  // EMAIL VERIFICATION OPERATIONS
  // ==========================================

  /**
   * Generate email verification token
   */
  async generateEmailVerificationToken(userId: string, session?: ClientSession): Promise<string | null> {
    const token = crypto.randomBytes(32).toString('hex');

    const user = await this.baseRepository.updateById(userId, {
      $set: { emailVerificationToken: token }
    }, this.getRepoOptions(session));

    return user ? token : null;
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string, session?: ClientSession): Promise<{ success: boolean; user?: IUser }> {
    const user = await this.baseRepository.findOne({ emailVerificationToken: token }, this.getRepoOptions(session));

    if (!user) {
      return { success: false };
    }

    const updatedUser = await this.baseRepository.updateById((user._id as any).toString(), {
      $set: { emailVerified: true },
      $unset: { emailVerificationToken: 1 }
    }, this.getRepoOptions(session));

    return { success: true, user: updatedUser! };
  }

  // ==========================================
  // PASSWORD RESET OPERATIONS
  // ==========================================

  /**
   * Generate password reset token
   */
  async generatePasswordResetToken(email: string, session?: ClientSession): Promise<{ success: boolean; token?: string }> {
    const user = await this.findByEmail(email, { ...(session && { session }) });

    if (!user) {
      return { success: false };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await this.baseRepository.updateById((user._id as any).toString(), {
      $set: {
        passwordResetToken: token,
        passwordResetExpires: expires
      }
    }, this.getRepoOptions(session));

    return { success: true, token };
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string, session?: ClientSession): Promise<{ success: boolean; reason?: string }> {
    // Validate new password
    try {
      UserValidations.ChangePasswordSchema.shape.newPassword.parse(newPassword);
    } catch {
      return { success: false, reason: 'Invalid password format' };
    }

    const user = await this.baseRepository.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    }, this.getRepoOptions(session));

    if (!user) {
      return { success: false, reason: 'Invalid or expired reset token' };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    // Update user using base repository method
    await this.baseRepository.updateById((user._id as any).toString(), {
      $set: { password: hashedPassword },
      $unset: { passwordResetToken: 1, passwordResetExpires: 1 }
    }, this.getRepoOptions(session));

    return { success: true };
  }

  // ==========================================
  // ADMIN OPERATIONS
  // ==========================================

  /**
   * Promote user to admin
   */
  async promoteToAdmin(userId: string, session?: ClientSession): Promise<{ success: boolean; reason?: string }> {
    const user = await this.baseRepository.findById(userId, this.getRepoOptions(session));

    if (!user) {
      return { success: false, reason: 'User not found' };
    }

    const canPromote = UserValidations.canPromoteToAdmin(user);
    if (!canPromote.canPromote) {
      return { success: false, reason: canPromote.reason || 'Cannot promote user' };
    }

    await this.baseRepository.updateById(userId, { $set: { role: 'admin' } }, this.getRepoOptions(session));

    return { success: true };
  }

  /**
   * Suspend user account
   */
  async suspendUser(userId: string, session?: ClientSession): Promise<boolean> {
    const user = await this.baseRepository.updateById(userId, { $set: { status: 'suspended' } }, this.getRepoOptions(session));
    return !!user;
  }

  /**
   * Reactivate user account
   */
  async reactivateUser(userId: string, session?: ClientSession): Promise<boolean> {
    const user = await this.baseRepository.updateById(userId, {
      $set: { status: 'active' },
      $unset: { lockUntil: 1, loginAttempts: 1 }
    }, this.getRepoOptions(session));
    return !!user;
  }

  // ==========================================
  // UTILITY OPERATIONS
  // ==========================================

  /**
   * Check if email exists
   */
  async emailExists(email: string, session?: ClientSession): Promise<boolean> {
    return this.baseRepository.exists({ email: email.toLowerCase() }, this.getRepoOptions(session));
  }

  /**
   * Get user statistics
   */
  async getUserStats(session?: ClientSession): Promise<{
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    admins: number;
    emailVerified: number;
  }> {
    const repoOptions = this.getRepoOptions(session);
    
    const [total, active, inactive, suspended, admins, emailVerified] = await Promise.all([
      this.baseRepository.count({}, repoOptions),
      this.baseRepository.count({ status: 'active' }, repoOptions),
      this.baseRepository.count({ status: 'inactive' }, repoOptions),
      this.baseRepository.count({ status: 'suspended' }, repoOptions),
      this.baseRepository.count({ role: 'admin' }, repoOptions),
      this.baseRepository.count({ emailVerified: true }, repoOptions)
    ]);

    return {
      total,
      active,
      inactive,
      suspended,
      admins,
      emailVerified
    };
  }

  /**
   * Find users created within date range
   */
  async findUsersCreatedBetween(
    startDate: Date,
    endDate: Date,
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IUser>> {
    return this.findUsersWithPagination({
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    }, options, session);
  }

  /**
   * Find locked users
   */
  async findLockedUsers(
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IUser>> {
    return this.findUsersWithPagination({
      lockUntil: { $gt: new Date() }
    }, options, session);
  }
}