import type { FilterQuery, ClientSession } from 'mongoose';
import { BaseRepository } from '../mongo/baseRepository.js';
import { UserModel } from '../../entities/user/userEntity.js';
import type { IUser } from '../../entities/user/userEntity.js';
import type { IUserRepository } from '../../entities/user/userRepository.interface.js';
import type { PaginationOptions, PaginationResult, RepositoryOptions } from '../mongo/index.js';
import { UserValidations } from '../../entities/user/userEntity.js';

/**
 * User Repository Implementation - Infrastructure layer
 * Technical implementation of IUserRepository interface
 */
export class UserRepository extends BaseRepository<IUser> implements IUserRepository {
  constructor() {
    super(UserModel);
  }

  // User-specific CRUD operations
  async createUser(
    userData: Parameters<typeof UserValidations.validateCreateUser>[0],
    session?: ClientSession
  ): Promise<IUser> {
    const validatedData = UserValidations.validateCreateUser(userData);
    const options: RepositoryOptions = session ? { session } : {};
    return super.create(validatedData, options);
  }

  async findByEmail(
    email: string,
    options?: { includePassword?: boolean; session?: ClientSession }
  ): Promise<IUser | null> {
    const query = this.model.findOne({ email });

    if (options?.includePassword) {
      query.select('+password');
    }

    if (options?.session) {
      query.session(options.session);
    }

    return query.exec();
  }

  async updateUser(
    id: string,
    updateData: Parameters<typeof UserValidations.validateUpdateUser>[0],
    session?: ClientSession
  ): Promise<IUser | null> {
    const validatedData = UserValidations.validateUpdateUser(updateData);
    const options: RepositoryOptions = session ? { session } : {};
    return super.updateById(id, validatedData, options);
  }

  async softDeleteUser(id: string, session?: ClientSession): Promise<IUser | null> {
    const options: RepositoryOptions = session ? { session } : {};
    return super.updateById(id, { status: 'inactive' } as any, options);
  }

  // Query operations with pagination
  async findUsersWithPagination(
    filters: FilterQuery<IUser>,
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IUser>> {
    const repoOptions: RepositoryOptions = session ? { session } : {};
    return super.findPaginated(filters, options.page, options.limit, options.sort, repoOptions);
  }

  async findUsersByRole(
    role: 'user' | 'admin',
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IUser>> {
    const repoOptions: RepositoryOptions = session ? { session } : {};
    return super.findPaginated({ role }, options.page, options.limit, options.sort, repoOptions);
  }

  async findActiveUsers(
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IUser>> {
    const repoOptions: RepositoryOptions = session ? { session } : {};
    return super.findPaginated(
      { status: 'active' },
      options.page,
      options.limit,
      options.sort,
      repoOptions
    );
  }

  async searchUsers(
    searchTerm: string,
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IUser>> {
    const searchRegex = new RegExp(searchTerm, 'i');
    const filters: FilterQuery<IUser> = {
      $or: [{ name: searchRegex }, { email: searchRegex }]
    };

    const repoOptions: RepositoryOptions = session ? { session } : {};
    return super.findPaginated(filters, options.page, options.limit, options.sort, repoOptions);
  }

  // Authentication operations
  async validatePassword(user: IUser, password: string): Promise<boolean> {
    // This should use bcrypt to compare passwords
    // Implementation will be added when bcrypt is integrated
    throw new Error('validatePassword must be implemented with bcrypt');
  }

  async updatePassword(
    id: string,
    newPassword: string,
    session?: ClientSession
  ): Promise<IUser | null> {
    // This should hash the password before updating
    // Implementation will be added when bcrypt is integrated
    throw new Error('updatePassword must hash password with bcrypt');
  }

  // Password reset operations
  async generatePasswordResetToken(
    id: string,
    session?: ClientSession
  ): Promise<{ user: IUser; token: string }> {
    const token = Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    const query = this.model.findByIdAndUpdate(
      id,
      {
        passwordResetToken: token,
        passwordResetExpires: expiresAt
      },
      { new: true }
    );

    if (session) {
      query.session(session);
    }

    const user = await query.exec();

    if (!user) {
      throw new Error('User not found');
    }

    return { user, token };
  }

  async findByPasswordResetToken(token: string, session?: ClientSession): Promise<IUser | null> {
    const query = this.model
      .findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() }
      })
      .select('+passwordResetToken +passwordResetExpires');

    if (session) {
      query.session(session);
    }

    return query.exec();
  }

  async resetPasswordWithToken(
    token: string,
    newPassword: string,
    session?: ClientSession
  ): Promise<IUser | null> {
    const user = await this.findByPasswordResetToken(token, session);
    if (!user) {
      return null;
    }

    return this.updatePassword((user as any)._id.toString(), newPassword, session);
  }

  // Email verification operations
  async generateEmailVerificationToken(
    id: string,
    session?: ClientSession
  ): Promise<{ user: IUser; token: string }> {
    const token = Math.random().toString(36).substring(2, 15);

    const query = this.model.findByIdAndUpdate(id, { emailVerificationToken: token }, { new: true });

    if (session) {
      query.session(session);
    }

    const user = await query.exec();

    if (!user) {
      throw new Error('User not found');
    }

    return { user, token };
  }

  async findByEmailVerificationToken(
    token: string,
    session?: ClientSession
  ): Promise<IUser | null> {
    const query = this.model
      .findOne({
        emailVerificationToken: token,
        passwordResetExpires: { $gt: new Date() }
      })
      .select('+emailVerificationToken');

    if (session) {
      query.session(session);
    }

    return query.exec();
  }

  async verifyEmailWithToken(token: string, session?: ClientSession): Promise<IUser | null> {
    const user = await this.findByEmailVerificationToken(token, session);
    if (!user) {
      return null;
    }

    const query = this.model.findByIdAndUpdate(
      (user as any)._id,
      {
        emailVerified: true,
        $unset: { emailVerificationToken: 1 }
      },
      { new: true }
    );

    if (session) {
      query.session(session);
    }

    return query.exec();
  }

  // Statistics and monitoring
  async getUserStats(session?: ClientSession): Promise<{
    totalUsers: number;
    activeUsers: number;
    verifiedUsers: number;
    adminUsers: number;
  }> {
    const pipeline = [
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          verifiedUsers: { $sum: { $cond: ['$emailVerified', 1, 0] } },
          adminUsers: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } }
        }
      }
    ];

    const result = session
      ? await this.model.aggregate(pipeline).session(session).exec()
      : await this.model.aggregate(pipeline).exec();

    return result[0] || { totalUsers: 0, activeUsers: 0, verifiedUsers: 0, adminUsers: 0 };
  }

  async findRecentUsers(limit: number, session?: ClientSession): Promise<IUser[]> {
    const query = this.model.find().sort({ createdAt: -1 }).limit(limit);
    if (session) {
      query.session(session);
    }
    return query.exec();
  }

  // Bulk operations
  async activateMultipleUsers(userIds: string[], session?: ClientSession): Promise<number> {
    const options: RepositoryOptions = session ? { session } : {};
    const result = await super.updateMany(
      { _id: { $in: userIds } } as any,
      { status: 'active' } as any,
      options
    );
    return result.modifiedCount;
  }

  async deactivateMultipleUsers(userIds: string[], session?: ClientSession): Promise<number> {
    const options: RepositoryOptions = session ? { session } : {};
    const result = await super.updateMany(
      { _id: { $in: userIds } } as any,
      { status: 'inactive' } as any,
      options
    );
    return result.modifiedCount;
  }

  async updateUsersRole(
    userIds: string[],
    role: 'user' | 'admin',
    session?: ClientSession
  ): Promise<number> {
    const options: RepositoryOptions = session ? { session } : {};
    const result = await super.updateMany(
      { _id: { $in: userIds } } as any,
      { role } as any,
      options
    );
    return result.modifiedCount;
  }

  // Cleanup operations
  async cleanupUnverifiedUsers(olderThanDays: number, session?: ClientSession): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const options: RepositoryOptions = session ? { session } : {};
    const result = await super.deleteMany(
      {
        emailVerified: false,
        createdAt: { $lt: cutoffDate }
      } as any,
      options
    );

    return result.deletedCount;
  }

  async findUsersToCleanup(olderThanDays: number, session?: ClientSession): Promise<IUser[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const query = this.model.find({
      emailVerified: false,
      createdAt: { $lt: cutoffDate }
    });

    if (session) {
      query.session(session);
    }

    return query.exec();
  }
}