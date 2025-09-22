import pino from 'pino';
import type { Logger, LoggerOptions } from 'pino';

/**
 * Log levels supported by the logger
 */
export enum LogLevel {
  FATAL = 'fatal',
  ERROR = 'error', 
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace',
  SILENT = 'silent'
}

/**
 * Configuration interface for the logger
 */
export interface LoggerConfig {
  /** Service name to be included in all logs */
  serviceName?: string;
  /** Minimum log level */
  level?: LogLevel;
  /** Environment (development, production, test) */
  environment?: string;
  /** Enable pretty printing for development */
  prettyPrint?: boolean;
  /** Custom base fields to be included in all logs */
  base?: Record<string, any>;
  /** Enable/disable timestamp */
  timestamp?: boolean;
  /** Custom serializers for specific objects */
  serializers?: Record<string, any>;
}

/**
 * Additional context data for logs
 */
export interface LogContext {
  /** Request ID for tracing */
  requestId?: string;
  /** User ID */
  userId?: string;
  /** Operation ID */
  operationId?: string;
  /** Additional custom fields */
  [key: string]: any;
}

/**
 * Sanitization configuration for sensitive data
 */
const SENSITIVE_FIELDS = [
  'password', 'token', 'authorization', 'auth', 'secret', 'key', 'apiKey',
  'accessToken', 'refreshToken', 'sessionId', 'cookie', 'credit_card',
  'creditCard', 'ssn', 'social_security', 'cpf', 'cnpj'
];

/**
 * Logger Manager class providing centralized logging functionality
 * 
 * This class implements a comprehensive logging solution using Pino library,
 * designed for high-performance applications with structured logging support.
 * 
 * Features:
 * - Multiple log levels (fatal, error, warn, info, debug, trace)
 * - Environment-based configuration
 * - Sensitive data sanitization
 * - Request context tracking
 * - Pretty printing for development
 * - JSON structured logs for production
 * - Child logger support
 * - Integration with Fastify
 * 
 * Usage:
 * ```typescript
 * // Basic usage
 * const logger = LoggerManager.getInstance();
 * logger.info('Application started', { port: 3000 });
 * 
 * // With context
 * const contextLogger = logger.child({ requestId: 'req-123' });
 * contextLogger.error('Database error', { error: err });
 * 
 * // Custom configuration
 * const customLogger = LoggerManager.createLogger({
 *   serviceName: 'user-service',
 *   level: LogLevel.DEBUG,
 *   environment: 'development'
 * });
 * ```
 */
export class LoggerManager {
  private static instance: LoggerManager | null = null;
  private logger: Logger;
  private config: LoggerConfig;

  /**
   * Creates a new LoggerManager instance
   * @param config - Logger configuration options
   */
  constructor(config: LoggerConfig = {}) {
    this.config = this.buildConfig(config);
    this.logger = this.createPinoLogger(this.config);
  }

  /**
   * Get singleton instance of LoggerManager with default configuration
   * @returns LoggerManager instance
   */
  public static getInstance(): LoggerManager {
    if (!LoggerManager.instance) {
      LoggerManager.instance = new LoggerManager();
    }
    return LoggerManager.instance;
  }

  /**
   * Create a new logger instance with custom configuration
   * @param config - Custom logger configuration
   * @returns New LoggerManager instance
   */
  public static createLogger(config: LoggerConfig): LoggerManager {
    return new LoggerManager(config);
  }

  /**
   * Get the underlying Pino logger instance for direct access
   * @returns Pino logger instance
   */
  public getPinoLogger(): Logger {
    return this.logger;
  }

  /**
   * Create a child logger with additional context
   * @param context - Additional context to be included in all log entries
   * @returns Child logger instance
   */
  public child(context: LogContext): Logger {
    const sanitizedContext = this.sanitizeObject(context);
    return this.logger.child(sanitizedContext);
  }

  /**
   * Log fatal error message
   * @param message - Log message
   * @param meta - Additional metadata
   */
  public fatal(message: string, meta?: LogContext): void {
    this.logger.fatal(this.sanitizeObject(meta || {}), message);
  }

  /**
   * Log error message
   * @param message - Log message
   * @param meta - Additional metadata (including error object)
   */
  public error(message: string, meta?: LogContext & { error?: Error }): void {
    const sanitizedMeta = this.sanitizeObject(meta || {});
    
    // Handle error object specially to include stack trace
    if (meta?.error && meta.error instanceof Error) {
      sanitizedMeta.error = {
        name: meta.error.name,
        message: meta.error.message,
        stack: meta.error.stack
      };
    }
    
    this.logger.error(sanitizedMeta, message);
  }

  /**
   * Log warning message
   * @param message - Log message
   * @param meta - Additional metadata
   */
  public warn(message: string, meta?: LogContext): void {
    this.logger.warn(this.sanitizeObject(meta || {}), message);
  }

  /**
   * Log informational message
   * @param message - Log message
   * @param meta - Additional metadata
   */
  public info(message: string, meta?: LogContext): void {
    this.logger.info(this.sanitizeObject(meta || {}), message);
  }

  /**
   * Log debug message
   * @param message - Log message
   * @param meta - Additional metadata
   */
  public debug(message: string, meta?: LogContext): void {
    this.logger.debug(this.sanitizeObject(meta || {}), message);
  }

  /**
   * Log trace message
   * @param message - Log message
   * @param meta - Additional metadata
   */
  public trace(message: string, meta?: LogContext): void {
    this.logger.trace(this.sanitizeObject(meta || {}), message);
  }

  /**
   * Build configuration with defaults and environment variables
   * @param userConfig - User provided configuration
   * @returns Complete logger configuration
   */
  private buildConfig(userConfig: LoggerConfig): LoggerConfig {
    const environment = process.env.NODE_ENV || 'development';
    const isDevelopment = environment === 'development';
    
    return {
      serviceName: userConfig.serviceName || process.env.SERVICE_NAME || 'fastify-app',
      level: userConfig.level || (process.env.LOG_LEVEL as LogLevel) || 
             (isDevelopment ? LogLevel.DEBUG : LogLevel.INFO),
      environment: userConfig.environment || environment,
      prettyPrint: userConfig.prettyPrint !== undefined ? userConfig.prettyPrint : isDevelopment,
      timestamp: userConfig.timestamp !== undefined ? userConfig.timestamp : true,
      base: {
        service: userConfig.serviceName || process.env.SERVICE_NAME || 'fastify-app',
        environment: userConfig.environment || environment,
        version: process.env.npm_package_version || '1.0.0',
        ...userConfig.base
      },
      serializers: {
        // Default serializers for common objects
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
        err: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
        ...userConfig.serializers
      }
    };
  }

  /**
   * Create Pino logger instance with transport configuration
   * @param config - Logger configuration
   * @returns Pino logger instance
   */
  private createPinoLogger(config: LoggerConfig): Logger {
    const pinoOptions: LoggerOptions = {
      ...(config.serviceName && { name: config.serviceName }),
      ...(config.level && { level: config.level }),
      ...(config.base && { base: config.base }),
      ...(config.timestamp !== undefined && { timestamp: config.timestamp }),
      ...(config.serializers && { serializers: config.serializers }),
      formatters: {
        // Custom formatter to add consistent structure
        level: (label: string) => ({ level: label }),
        bindings: (bindings: any) => ({ 
          pid: bindings.pid, 
          hostname: bindings.hostname,
          ...bindings 
        })
      }
    };

    // Configure transport based on environment
    if (config.prettyPrint) {
      // Development: use pretty printing
      pinoOptions.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          messageFormat: '[{service}] {msg}',
          errorProps: 'error.name,error.message,error.stack'
        }
      };
    }
    // Production: JSON logs to stdout (default)

    return pino(pinoOptions);
  }

  /**
   * Sanitize object to remove sensitive information
   * @param obj - Object to sanitize
   * @returns Sanitized object
   */
  private sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      // Check if the key contains sensitive information
      const isSensitive = SENSITIVE_FIELDS.some(field => 
        lowerKey.includes(field.toLowerCase())
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Get current log level
   * @returns Current log level
   */
  public getLevel(): string {
    return this.logger.level;
  }

  /**
   * Set log level dynamically
   * @param level - New log level
   */
  public setLevel(level: LogLevel): void {
    this.logger.level = level;
  }

  /**
   * Check if a specific log level is enabled
   * @param level - Log level to check
   * @returns True if level is enabled
   */
  public isLevelEnabled(level: LogLevel): boolean {
    return this.logger.isLevelEnabled(level);
  }

  /**
   * Flush any pending logs (useful for testing or shutdown)
   */
  public async flush(): Promise<void> {
    // Pino automatically flushes on process exit, but this can be useful for testing
    return new Promise((resolve) => {
      // For destinations that support flushing
      if (this.logger.flush) {
        this.logger.flush();
      }
      setImmediate(resolve);
    });
  }
}

/**
 * Default logger instance for application-wide use
 * 
 * This is a convenience export that provides a pre-configured logger instance
 * ready for immediate use throughout the application.
 * 
 * Environment Variables for Configuration:
 * - LOG_LEVEL: Minimum log level (fatal, error, warn, info, debug, trace)
 * - NODE_ENV: Environment (development enables pretty printing)
 * - SERVICE_NAME: Name of the service for log identification
 * 
 * Usage:
 * ```typescript
 * import { defaultLogger } from './lib/logger';
 * 
 * defaultLogger.info('Server starting', { port: 3000 });
 * defaultLogger.error('Database connection failed', { error: err });
 * ```
 */
export const defaultLogger = LoggerManager.getInstance();

/**
 * Export types and utilities for external use
 */
export type { Logger as PinoLogger };

// Export the class as default for convenient importing
export default LoggerManager;