import type { FilterQuery, ClientSession } from 'mongoose';
import type { IUser } from './userEntity';
import type {
  PaginationOptions,
  PaginationResult,
  RepositoryOptions as _RepositoryOptions
} from '../../infraestructure/mongo/index';
import { UserValidations } from './userEntity';
import type { IBaseRepository } from '../../infraestructure/mongo/interfaces';

/**
 * User Repository Interface - Pure domain contract
 * Defines all operations for User entity data access
 */
export interface IUserRepository extends IBaseRepository<IUser> {
  // User-specific CRUD operations
  createUser(
    userData: Parameters<typeof UserValidations.validateCreateUser>[0],
    session?: ClientSession
  ): Promise<IUser>;

  findByEmail(
    email: string,
    options?: { includePassword?: boolean; session?: ClientSession }
  ): Promise<IUser | null>;

  updateUser(
    id: string,
    updateData: Parameters<typeof UserValidations.validateUpdateUser>[0],
    session?: ClientSession
  ): Promise<IUser | null>;

  softDeleteUser(id: string, session?: ClientSession): Promise<IUser | null>;

  // Query operations with pagination
  findUsersWithPagination(
    filters: FilterQuery<IUser>,
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IUser>>;

  findUsersByRole(
    role: 'user' | 'admin',
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IUser>>;

  findActiveUsers(
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IUser>>;

  searchUsers(
    searchTerm: string,
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IUser>>;

  // Authentication operations
  validatePassword(user: IUser, password: string): Promise<boolean>;
  updatePassword(id: string, newPassword: string, session?: ClientSession): Promise<IUser | null>;

  // Password reset operations
  generatePasswordResetToken(
    id: string,
    session?: ClientSession
  ): Promise<{ user: IUser; token: string }>;
  findByPasswordResetToken(token: string, session?: ClientSession): Promise<IUser | null>;
  resetPasswordWithToken(
    token: string,
    newPassword: string,
    session?: ClientSession
  ): Promise<IUser | null>;

  // Email verification operations
  generateEmailVerificationToken(
    id: string,
    session?: ClientSession
  ): Promise<{ user: IUser; token: string }>;
  findByEmailVerificationToken(token: string, session?: ClientSession): Promise<IUser | null>;
  verifyEmailWithToken(token: string, session?: ClientSession): Promise<IUser | null>;

  // Statistics and monitoring
  getUserStats(session?: ClientSession): Promise<{
    totalUsers: number;
    activeUsers: number;
    verifiedUsers: number;
    adminUsers: number;
  }>;

  findRecentUsers(limit: number, session?: ClientSession): Promise<IUser[]>;

  // Bulk operations
  activateMultipleUsers(userIds: string[], session?: ClientSession): Promise<number>;
  deactivateMultipleUsers(userIds: string[], session?: ClientSession): Promise<number>;
  updateUsersRole(
    userIds: string[],
    role: 'user' | 'admin',
    session?: ClientSession
  ): Promise<number>;

  // Cleanup operations
  cleanupUnverifiedUsers(olderThanDays: number, session?: ClientSession): Promise<number>;
  findUsersToCleanup(olderThanDays: number, session?: ClientSession): Promise<IUser[]>;
}
