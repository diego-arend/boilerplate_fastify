import 'dotenv/config';
import { z } from 'zod';

// Simple console-based logger for env validation (before main logger is available)
const envLogger = {
  error: (data: any) => {
    console.error('🚨 [ENV-VALIDATION ERROR]', JSON.stringify(data, null, 2));
  }
};

const envSchema = z.object({
  // Core application settings
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3000),

  // JWT Authentication
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),

  // MongoDB Database
  MONGO_URI: z.string().url('MONGO_URI must be a valid URL'),

  // Redis Cache Configuration
  REDIS_HOST: z.string().min(1, 'REDIS_HOST cannot be empty').default('localhost'),
  REDIS_PORT: z.coerce.number().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().min(0).max(15).default(0).optional(),

  // Optional: Logging configuration
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Optional: Additional security settings
  CORS_ORIGIN: z.string().optional(),
  CORS_ALLOW_CREDENTIALS: z.coerce.boolean().default(false).optional(),
  RATE_LIMIT_MAX: z.coerce.number().positive().default(100).optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(60000).optional() // 1 minute
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const errorDetails = parsed.error.format();

  // Log detailed validation errors
  envLogger.error({
    message: 'Environment variables validation failed',
    errors: errorDetails,
    providedEnvs: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      JWT_SECRET: process.env.JWT_SECRET ? `[${process.env.JWT_SECRET.length} chars]` : 'NOT_SET',
      MONGO_URI: process.env.MONGO_URI ? '[REDACTED]' : 'NOT_SET',
      REDIS_HOST: process.env.REDIS_HOST,
      REDIS_PORT: process.env.REDIS_PORT,
      REDIS_PASSWORD: process.env.REDIS_PASSWORD ? '[REDACTED]' : 'NOT_SET',
      REDIS_DB: process.env.REDIS_DB,
      LOG_LEVEL: process.env.LOG_LEVEL,
      CORS_ORIGIN: process.env.CORS_ORIGIN,
      CORS_ALLOW_CREDENTIALS: process.env.CORS_ALLOW_CREDENTIALS,
      RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS
    }
  });

  // Also log to console for immediate visibility
  console.error('🚨 FATAL ERROR: Environment variables validation failed!');
  console.error('❌ Validation errors:', JSON.stringify(errorDetails, null, 2));
  console.error('💡 Please check your .env file and ensure all required variables are set correctly.');
  console.error('📖 Refer to .env.example for the correct format.');

  process.exit(1);
}

export const config = Object.freeze(parsed.data);

export function validateEnv(requiredVars: string[]) {
  const missing = requiredVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    envLogger.error({
      message: 'Missing required environment variables',
      missingVariables: missing,
      totalMissing: missing.length,
      allEnvKeys: Object.keys(process.env).length
    });

    console.error(`🚨 FATAL ERROR: Missing required environment variables: ${missing.join(', ')}`);
    console.error('💡 Please ensure all required variables are set in your .env file.');

    process.exit(1);
  }
}

// Additional validation utilities
export function validateCriticalEnvs() {
  const criticalEnvs = ['JWT_SECRET', 'MONGO_URI'];

  try {
    validateEnv(criticalEnvs);

    // Additional JWT_SECRET validation
    if (config.JWT_SECRET.length < 32) {
      envLogger.error({
        message: 'JWT_SECRET is too short for production use',
        currentLength: config.JWT_SECRET.length,
        requiredLength: 32,
        recommendation: 'Use a strong, random string of at least 32 characters'
      });

      console.error('🚨 SECURITY WARNING: JWT_SECRET is too short!');

      if (config.NODE_ENV === 'production') {
        console.error('❌ This is not allowed in production environment.');
        process.exit(1);
      }
    }

    // MongoDB URI validation
    if (!config.MONGO_URI.startsWith('mongodb://') && !config.MONGO_URI.startsWith('mongodb+srv://')) {
      envLogger.error({
        message: 'Invalid MongoDB URI format',
        providedUri: config.MONGO_URI.substring(0, 20) + '...',
        expectedFormats: ['mongodb://', 'mongodb+srv://']
      });

      console.error('🚨 FATAL ERROR: Invalid MongoDB URI format!');
      process.exit(1);
    }

  } catch (error) {
    envLogger.error({
      message: 'Critical environment validation failed',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    console.error('🚨 FATAL ERROR: Critical environment validation failed!');
    process.exit(1);
  }
}
