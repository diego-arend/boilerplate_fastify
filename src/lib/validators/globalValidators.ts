import { z } from 'zod';

/**
 * Global validators using Zod schemas for secure validation and attack protection
 * These validators are not tied to any specific entity and can be reused across the application
 */

/**
 * Sanitize input by removing dangerous characters
 * @param {string} input - The input string to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';

  return input
    .replace(/[<>'"&]/g, '') // Remove HTML characters
    .replace(/javascript:/gi, '') // Remove javascript:
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/\.\./g, '.') // Prevent path traversal
    .replace(/\/+/g, '/') // Normalize slashes
    .trim();
}

/**
 * Detect potential injection attempts in input
 * @param {string} input - The input string to check
 * @returns {boolean} True if injection attempt is detected
 */
export function hasInjectionAttempt(input: string): boolean {
  if (!input || typeof input !== 'string') return false;

  const injectionPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/gi,
    /union\s+select/i,
    /;\s*drop/i,
    /\.\./,
    /\/etc\/passwd/i,
    /eval\(/i,
    /document\./i,
    /window\./i
  ];

  return injectionPatterns.some(pattern => pattern.test(input));
}

/**
 * Base string schema with sanitization and injection detection
 */
export const BaseStringSchema = z.string()
  .transform((val) => sanitizeInput(val))
  .refine((val) => !hasInjectionAttempt(val), {
    message: "Input contains potentially dangerous content"
  });

/**
 * Email validation schema with security checks
 */
export const EmailSchema = z.string()
  .email("Invalid email format")
  .max(254, "Email too long")
  .transform((val) => sanitizeInput(val))
  .refine((email: string) => {
    // Additional security checks
    return !/\.\./.test(email) && email.trim() === email && !hasInjectionAttempt(email);
  }, {
    message: "Email contains invalid patterns"
  });

/**
 * Strong password schema with comprehensive security requirements
 */
export const PasswordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password too long")
  .refine((password) => {
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    return strongPasswordRegex.test(password);
  }, {
    message: "Password must contain at least one lowercase, uppercase, number and special character"
  });

/**
 * Name validation schema (for user names, etc.)
 */
export const NameSchema = z.string()
  .min(2, "Name too short")
  .max(100, "Name too long")
  .transform((val) => sanitizeInput(val))
  .refine((name: string) => /^[a-zA-Z0-9\s\-_'\.]+$/.test(name), {
    message: "Name contains invalid characters"
  })
  .refine((name: string) => !hasInjectionAttempt(name), {
    message: "Name contains potentially dangerous content"
  });

/**
 * URL validation schema with security checks
 */
export const UrlSchema = z.string()
  .url("Invalid URL format")
  .max(2048, "URL too long")
  .refine((url) => {
    try {
      const parsedUrl = new URL(url);
      // Only allow HTTP/HTTPS protocols
      return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }, {
    message: "URL must use HTTP or HTTPS protocol"
  });

/**
 * MongoDB ObjectId validation schema
 */
export const ObjectIdSchema = z.string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId format");

/**
 * Generic text content schema with length limits
 */
export const TextContentSchema = z.string()
  .min(1, "Content cannot be empty")
  .max(5000, "Content too long")
  .transform((val) => sanitizeInput(val))
  .refine((content: string) => !hasInjectionAttempt(content), {
    message: "Content contains potentially dangerous content"
  });

/**
 * MongoDB query sanitization schema
 */
export const MongoQuerySchema = z.record(z.string(), z.any())
  .transform((query) => {
    if (!query || typeof query !== 'object') return query;

    const sanitized = { ...query };
    const dangerousOperators = ['$where', '$function', '$accumulator'];

    // Remove dangerous operators
    for (const key in sanitized) {
      if (dangerousOperators.includes(key)) {
        delete sanitized[key];
      }

      // Recursively sanitize nested objects
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = MongoQuerySchema.parse(sanitized[key]);
      }
    }

    return sanitized;
  });

/**
 * Registration request schema
 */
export const RegisterRequestSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  password: PasswordSchema
});

/**
 * Login request schema
 */
export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, "Password is required")
});

/**
 * User update schema
 */
export const UserUpdateSchema = z.object({
  name: NameSchema.optional(),
  email: EmailSchema.optional()
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update"
});

/**
 * Legacy GlobalValidators class for backward compatibility
 * @deprecated Use Zod schemas directly instead
 */
export class GlobalValidators {

  /**
   * Sanitize input by removing dangerous characters
   * @deprecated Use sanitizeInput function instead
   */
  static sanitizeInput(input: string): string {
    return sanitizeInput(input);
  }

  /**
   * Validate email with security rules
   * @deprecated Use EmailSchema.parse() instead
   */
  static isValidEmail(email: string): boolean {
    try {
      EmailSchema.parse(email);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate strong password
   * @deprecated Use PasswordSchema.parse() instead
   */
  static isStrongPassword(password: string): boolean {
    try {
      PasswordSchema.parse(password);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate password strength with detailed criteria
   * Uses same criteria as PasswordSchema: at least 8 chars, uppercase, lowercase, number, special char
   * @param {string} password - The password to validate
   * @returns {boolean} True if password meets all requirements
   */
  static validatePasswordStrength(password: string): boolean {
    if (!password || typeof password !== 'string') {
      return false;
    }

    // Same validation as PasswordSchema: at least 8 chars, uppercase, lowercase, number, special char
    const hasMinLength = password.length >= 8;
    const hasMaxLength = password.length <= 128;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return hasMinLength && hasMaxLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
  }

  /**
   * Detect injection attempts
   * @deprecated Use hasInjectionAttempt function instead
   */
  static hasInjectionAttempt(input: string): boolean {
    return hasInjectionAttempt(input);
  }

  /**
   * Clean MongoDB query parameters
   * @deprecated Use MongoQuerySchema.parse() instead
   */
  static sanitizeMongoQuery(query: any): any {
    try {
      return MongoQuerySchema.parse(query);
    } catch {
      return {};
    }
  }

  /**
   * Validate string length within specified range
   * @deprecated Create custom Zod schema instead
   */
  static isValidLength(input: string, minLength: number = 0, maxLength: number = Infinity): boolean {
    if (!input || typeof input !== 'string') return false;
    return input.length >= minLength && input.length <= maxLength;
  }

  /**
   * Validate that string contains only alphanumeric characters and spaces
   * @deprecated Use NameSchema or create custom Zod schema instead
   */
  static isAlphanumericWithSpaces(input: string): boolean {
    if (!input || typeof input !== 'string') return false;
    return /^[a-zA-Z0-9\s]+$/.test(input);
  }

  /**
   * Validate URL format
   * @deprecated Use UrlSchema.parse() instead
   */
  static isValidUrl(url: string): boolean {
    try {
      UrlSchema.parse(url);
      return true;
    } catch {
      return false;
    }
  }
}