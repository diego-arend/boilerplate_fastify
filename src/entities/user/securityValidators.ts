// Security utilities for input validation
import { GlobalValidators, EmailSchema, PasswordSchema, NameSchema } from '../../lib/validators/index.js';
import { z } from 'zod';

export class SecurityValidators extends GlobalValidators {

  /**
   * User registration validation schema
   */
  static UserRegistrationSchema = z.object({
    name: NameSchema,
    email: EmailSchema,
    password: PasswordSchema,
    role: z.enum(['user', 'admin']).optional().default('user')
  });

  /**
   * User login validation schema  
   */
  static UserLoginSchema = z.object({
    email: EmailSchema,
    password: z.string().min(1, "Password is required")
  });

  /**
   * User profile update validation schema
   */
  static UserUpdateSchema = z.object({
    name: NameSchema.optional(),
    email: EmailSchema.optional()
  }).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update"
  });

  // Static method wrappers for backward compatibility
  /**
   * Sanitize input string - removes dangerous characters and patterns
   * @param input - Input string to sanitize
   * @returns Sanitized string
   */
  static sanitizeInput(input: string): string {
    return GlobalValidators.sanitizeInput(input);
  }

  /**
   * Check if email is valid
   * @param email - Email to validate
   * @returns True if email is valid
   */
  static isValidEmail(email: string): boolean {
    return GlobalValidators.isValidEmail(email);
  }

  /**
   * Check if input has injection attempts
   * @param input - Input to check
   * @returns True if injection attempt detected
   */
  static hasInjectionAttempt(input: string): boolean {
    return GlobalValidators.hasInjectionAttempt(input);
  }

  /**
   * Check if password meets security requirements
   * @param password - Password to validate
   * @returns True if password is strong enough
   */
  static isStrongPassword(password: string): boolean {
    return GlobalValidators.isStrongPassword(password);
  }

  /**
   * Validate user registration data
   * @param data - User registration data
   * @returns Validated and sanitized user data
   */
  static validateUserRegistration(data: unknown) {
    return this.UserRegistrationSchema.parse(data);
  }

  /**
   * Validate user login data
   * @param data - User login data
   * @returns Validated and sanitized login data
   */
  static validateUserLogin(data: unknown) {
    return this.UserLoginSchema.parse(data);
  }

  /**
   * Validate user profile update data
   * @param data - User update data
   * @returns Validated and sanitized update data
   */
  static validateUserUpdate(data: unknown) {
    return this.UserUpdateSchema.parse(data);
  }
}