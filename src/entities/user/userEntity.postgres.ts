import 'reflect-metadata';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
  BeforeUpdate
} from 'typeorm';
import { sanitizeInput } from '../../lib/validators/index.js';

/**
 * User Entity for PostgreSQL with TypeORM
 * Uses SERIAL (auto-incrementing integer) for optimal index performance
 *
 * Key Features:
 * - ACID transactions for authentication operations
 * - Incremental ID for better B-tree performance
 * - Row-level security ready
 * - Full-text search capabilities
 * - Enum constraints at database level
 */
@Entity('users')
@Index(['email'], { unique: true })
@Index(['status', 'role'])
@Index(['createdAt'])
export class User {
  @PrimaryGeneratedColumn() // SERIAL - Auto-incrementing integer (better performance than UUID)
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 128, select: false })
  password!: string;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  })
  status!: 'active' | 'inactive' | 'suspended';

  @Column({
    type: 'enum',
    enum: ['user', 'admin'],
    default: 'user'
  })
  role!: 'user' | 'admin';

  @Column({ type: 'timestamp', nullable: true, default: null })
  lastLoginAt?: Date | null;

  @Column({ type: 'int', default: 0 })
  loginAttempts!: number;

  @Column({ type: 'timestamp', nullable: true, default: null })
  lockUntil?: Date | null;

  @Column({ type: 'boolean', default: false })
  emailVerified!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null, select: false })
  emailVerificationToken?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null, select: false })
  passwordResetToken?: string | null;

  @Column({ type: 'timestamp', nullable: true, default: null, select: false })
  passwordResetExpires?: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;

  // ==========================================
  // LIFECYCLE HOOKS
  // ==========================================

  @BeforeInsert()
  @BeforeUpdate()
  sanitizeFields() {
    // Sanitize name
    if (this.name) {
      this.name = sanitizeInput(this.name);
    }

    // Sanitize and normalize email
    if (this.email) {
      this.email = sanitizeInput(this.email.trim().toLowerCase());
    }
  }

  // ==========================================
  // INSTANCE METHODS
  // ==========================================

  /**
   * Check if account is locked
   */
  isLocked(): boolean {
    return !!(this.lockUntil && this.lockUntil > new Date());
  }

  /**
   * Serialize user for API responses (removes sensitive fields)
   */
  toJSON(): Partial<User> {
    const {
      password: _password,
      emailVerificationToken: _emailVerificationToken,
      passwordResetToken: _passwordResetToken,
      passwordResetExpires: _passwordResetExpires,
      ...safe
    } = this;
    return safe as Partial<User>;
  } /**
   * Check if user can login (business logic)
   */
  canLogin(): { canLogin: boolean; reason?: string } {
    if (this.status !== 'active') {
      return { canLogin: false, reason: 'User account is not active' };
    }

    if (this.isLocked()) {
      return { canLogin: false, reason: 'User account is temporarily locked' };
    }

    return { canLogin: true };
  }

  /**
   * Check if user can be promoted to admin
   */
  canPromoteToAdmin(): { canPromote: boolean; reason?: string } {
    if (!this.emailVerified) {
      return { canPromote: false, reason: 'Email must be verified to become admin' };
    }

    if (this.status !== 'active') {
      return { canPromote: false, reason: 'User must be active to become admin' };
    }

    return { canPromote: true };
  }
}

// Type alias for compatibility
export type { User as IUserPostgres };
