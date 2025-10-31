import { z } from 'zod';
import {
  EmailSchema,
  PasswordSchema,
  NameSchema,
  ChangePasswordSchema
} from '../../lib/validators/index';

/**
 * User-specific validation schemas and functions
 * Extracted from userEntity.ts for reusability across MongoDB and PostgreSQL implementations
 */
export class UserValidations {
  // ID validation (PostgreSQL uses number, MongoDB uses string)
  static readonly UserIdSchema = z.number().int().positive();

  // Status enum specific to User entity
  static readonly USER_STATUSES = ['active', 'inactive', 'suspended'] as const;
  static readonly USER_ROLES = ['user', 'admin'] as const;

  // User status validation
  static readonly StatusSchema = z.enum(['active', 'inactive', 'suspended'], {
    message: 'Status must be: active, inactive or suspended'
  });

  // User role validation
  static readonly RoleSchema = z.enum(['user', 'admin'], {
    message: 'Role must be: user or admin'
  });

  // Login attempts validation (entity-specific business rule)
  static readonly LoginAttemptsSchema = z
    .number()
    .int()
    .min(0, 'Login attempts cannot be negative')
    .max(10, 'Login attempts exceeded maximum');

  // Complete user creation schema
  static readonly CreateUserSchema = z.object({
    name: NameSchema,
    email: EmailSchema,
    password: PasswordSchema,
    status: UserValidations.StatusSchema.optional().default('active'),
    role: UserValidations.RoleSchema.optional().default('user'),
    emailVerified: z.boolean().optional().default(false)
  });

  // User update schema
  static readonly UpdateUserSchema = z
    .object({
      name: NameSchema.optional(),
      email: EmailSchema.optional(),
      status: UserValidations.StatusSchema.optional(),
      role: UserValidations.RoleSchema.optional(),
      emailVerified: z.boolean().optional(),
      lastLoginAt: z.date().optional(),
      loginAttempts: UserValidations.LoginAttemptsSchema.optional(),
      lockUntil: z.date().optional().nullable(),
      emailVerificationToken: z.string().optional().nullable(),
      passwordResetToken: z.string().optional().nullable(),
      passwordResetExpires: z.date().optional().nullable()
    })
    .refine(data => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update'
    });

  // Login schema
  static readonly LoginSchema = z.object({
    email: EmailSchema,
    password: z.string().min(1, 'Password is required')
  });

  // Password change schema (uses global schema)
  static readonly ChangePasswordSchema = ChangePasswordSchema;

  /**
   * Validates user creation data
   */
  static validateCreateUser(data: unknown) {
    return this.CreateUserSchema.parse(data);
  }

  /**
   * Validates user update data
   */
  static validateUpdateUser(data: unknown) {
    return this.UpdateUserSchema.parse(data);
  }

  /**
   * Validates login data
   */
  static validateLogin(data: unknown) {
    return this.LoginSchema.parse(data);
  }

  /**
   * Validates password change data
   */
  static validatePasswordChange(data: unknown) {
    return this.ChangePasswordSchema.parse(data);
  }
}
