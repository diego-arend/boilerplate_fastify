import bcrypt from 'bcryptjs';
import { GlobalValidators } from '../../../lib/validators/index.js';

/**
 * Password service for handling password hashing and verification
 * Uses bcryptjs for secure password hashing with salt rounds
 */
export class PasswordService {
  private static readonly SALT_ROUNDS = 12;

  /**
   * Hash a plain text password using bcrypt
   * @param {string} plainPassword - The plain text password to hash
   * @returns {Promise<string>} The hashed password
   * @throws {Error} If hashing fails
   */
  static async hashPassword(plainPassword: string): Promise<string> {
    try {
      if (!plainPassword || typeof plainPassword !== 'string') {
        throw new Error('Invalid password provided');
      }

      const hashedPassword = await bcrypt.hash(plainPassword, this.SALT_ROUNDS);
      return hashedPassword;
    } catch (error) {
      throw new Error(`Password hashing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Compare a plain text password with a hashed password
   * @param {string} plainPassword - The plain text password to verify
   * @param {string} hashedPassword - The hashed password to compare against
   * @returns {Promise<boolean>} True if passwords match, false otherwise
   * @throws {Error} If comparison fails
   */
  static async comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    try {
      if (!plainPassword || !hashedPassword) {
        return false;
      }

      const isValid = await bcrypt.compare(plainPassword, hashedPassword);
      return isValid;
    } catch (error) {
      throw new Error(`Password comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate password strength before hashing
   * Delegates to GlobalValidators.validatePasswordStrength for consistency
   * @param {string} password - The password to validate
   * @returns {boolean} True if password meets requirements
   */
  static validatePasswordStrength(password: string): boolean {
    return GlobalValidators.validatePasswordStrength(password);
  }
}