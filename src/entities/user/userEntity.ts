import { Schema, model, Document } from 'mongoose';
import { z } from 'zod';
import {
  EmailSchema,
  PasswordSchema,
  NameSchema,
  ChangePasswordSchema,
  BaseStatusSchema,
  BaseRoleSchema,
  sanitizeInput
} from '../../lib/validators/index.js';

// ==========================================
// 1. INTERFACE DA ENTIDADE PARA REPOSITORY
// ==========================================

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  status: 'active' | 'inactive' | 'suspended';
  role: 'user' | 'admin';
  lastLoginAt?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  emailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  isLocked(): boolean;
  incrementLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
}

// ==========================================
// 2. VALIDAÇÕES ESPECÍFICAS DA ENTIDADE
// ==========================================

/**
 * User-specific validation schemas and functions
 */
export class UserValidations {
  // Status enum specific to User entity
  static readonly USER_STATUSES = ['active', 'inactive', 'suspended'] as const;
  static readonly USER_ROLES = ['user', 'admin'] as const;

  // User status validation (extends global base status and adds user-specific statuses)
  static readonly StatusSchema = z.enum(['active', 'inactive', 'suspended'], {
    message: 'Status must be: active, inactive or suspended'
  });

  // User role validation (extends global base role and adds admin role)
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
      lockUntil: z.date().optional(),
      emailVerificationToken: z.string().optional(),
      passwordResetToken: z.string().optional(),
      passwordResetExpires: z.date().optional()
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

  /**
   * Entity-specific business validation: Check if user can login
   */
  static canUserLogin(user: IUser): { canLogin: boolean; reason?: string } {
    if (user.status !== 'active') {
      return { canLogin: false, reason: 'User account is not active' };
    }

    if (user.isLocked()) {
      return { canLogin: false, reason: 'User account is temporarily locked' };
    }

    return { canLogin: true };
  }

  /**
   * Entity-specific validation: Check if user can be promoted to admin
   */
  static canPromoteToAdmin(user: IUser): { canPromote: boolean; reason?: string } {
    if (!user.emailVerified) {
      return { canPromote: false, reason: 'Email must be verified to become admin' };
    }

    if (user.status !== 'active') {
      return { canPromote: false, reason: 'User must be active to become admin' };
    }

    return { canPromote: true };
  }
}

// ==========================================
// 3. SCHEMA MONGOOSE PARA O MONGO
// ==========================================

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must have at least 2 characters'],
      maxlength: [100, 'Name must have at most 100 characters'],
      validate: {
        validator: function (v: string) {
          try {
            NameSchema.parse(v);
            return true;
          } catch {
            return false;
          }
        },
        message: 'Name contains invalid characters or format'
      }
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          try {
            EmailSchema.parse(v);
            return true;
          } catch {
            return false;
          }
        },
        message: 'Invalid email format'
      }
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must have at least 8 characters'],
      maxlength: [128, 'Password too long'],
      select: false, // Never return password by default
      validate: {
        validator: function (v: string) {
          try {
            PasswordSchema.parse(v);
            return true;
          } catch {
            return false;
          }
        },
        message:
          'Password must contain at least one lowercase, uppercase, number and special character'
      }
    },

    status: {
      type: String,
      enum: {
        values: UserValidations.USER_STATUSES,
        message: 'Status must be: active, inactive or suspended'
      },
      default: 'active'
    },

    role: {
      type: String,
      enum: {
        values: UserValidations.USER_ROLES,
        message: 'Role must be: user or admin'
      },
      default: 'user'
    },

    lastLoginAt: {
      type: Date,
      default: null
    },

    loginAttempts: {
      type: Number,
      default: 0,
      min: [0, 'Login attempts cannot be negative'],
      max: [10, 'Login attempts exceeded maximum']
    },

    lockUntil: {
      type: Date,
      default: null
    },

    emailVerified: {
      type: Boolean,
      default: false
    },

    emailVerificationToken: {
      type: String,
      default: null,
      select: false // Never return verification token by default
    },

    passwordResetToken: {
      type: String,
      default: null,
      select: false // Never return reset token by default
    },

    passwordResetExpires: {
      type: Date,
      default: null,
      select: false // Never return reset expiration by default
    }
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
    versionKey: false, // Removes the __v field
    strict: true, // Prevents fields not defined in schema
    minimize: false // Keeps empty objects
  }
);

// ==========================================
// 4. INDEXES PARA PERFORMANCE
// ==========================================

// Compound indexes for common queries
userSchema.index({ email: 1 }); // Unique index automatically created
userSchema.index({ status: 1, role: 1 }); // Admin queries
userSchema.index({ createdAt: -1 }); // Recent users
userSchema.index({ lastLoginAt: -1 }, { sparse: true }); // Login tracking
userSchema.index({ lockUntil: 1 }, { sparse: true }); // Unlock queries
userSchema.index({ emailVerificationToken: 1 }, { sparse: true }); // Email verification
userSchema.index({ passwordResetToken: 1 }, { sparse: true }); // Password reset

// ==========================================
// 5. MIDDLEWARE E HOOKS
// ==========================================

// Pre-save hook for data sanitization
userSchema.pre('save', function (next) {
  // Sanitize name
  if (this.name && this.isModified('name')) {
    this.name = sanitizeInput(this.name);
  }

  // Sanitize and normalize email
  if (this.email && this.isModified('email')) {
    this.email = sanitizeInput(this.email.trim().toLowerCase());
  }

  next();
});

// Pre-update hooks for validations
userSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function (next) {
  const update = this.getUpdate() as any;

  // Sanitize fields being updated
  if (update.$set) {
    if (update.$set.name) {
      update.$set.name = sanitizeInput(update.$set.name);
    }
    if (update.$set.email) {
      update.$set.email = sanitizeInput(update.$set.email.trim().toLowerCase());
    }
  }

  next();
});

// ==========================================
// 6. INSTANCE METHODS
// ==========================================

// Password comparison method (to be implemented with bcrypt in repository)
userSchema.methods.comparePassword = function (candidatePassword: string): Promise<boolean> {
  // This will be implemented in the repository layer with bcrypt
  throw new Error('comparePassword must be implemented in the repository layer');
};

// Check if account is locked
userSchema.methods.isLocked = function (): boolean {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incrementLoginAttempts = async function (): Promise<void> {
  const maxAttempts = 5;
  const lockTime = 30 * 60 * 1000; // 30 minutes

  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }

  const updates: any = { $inc: { loginAttempts: 1 } };

  // Lock account after max attempts
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }

  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = async function (): Promise<void> {
  return this.updateOne({
    $unset: {
      loginAttempts: 1,
      lockUntil: 1
    }
  });
};

// Transform document to JSON (removes sensitive fields)
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();

  // Remove sensitive fields
  delete userObject.password;
  delete userObject.emailVerificationToken;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;
  delete userObject.__v;

  return userObject;
};

// ==========================================
// 7. STATIC METHODS
// ==========================================

// Find users by role with pagination
userSchema.statics.findByRole = function (role: string, page = 1, limit = 20) {
  return this.find({ role })
    .select('-password -emailVerificationToken -passwordResetToken')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

// Find active users
userSchema.statics.findActiveUsers = function () {
  return this.find({
    status: 'active',
    $or: [{ lockUntil: null }, { lockUntil: { $lt: new Date() } }]
  }).select('-password');
};

// User model export
export const UserModel = model<IUser>('User', userSchema);
