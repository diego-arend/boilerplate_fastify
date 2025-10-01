import 'dotenv/config';
import { z } from 'zod';

// Simple console-based logger for env validation (before main logger is available)
const envLogger = {
  error: (data: any) => {
    console.error('🚨 [ENV-VALIDATION ERROR]', JSON.stringify(data, null, 2));
  }
};

const envSchema = z
  .object({
    // Core application settings
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().min(1).max(65535).default(3000),
    HOST: z.string().min(1).default('0.0.0.0'),

    // Worker Mode Configuration
    WORKER_MODE: z
      .string()
      .optional()
      .transform(val => val === 'true')
      .default(false),

    // Worker Configuration (used when WORKER_MODE=true)
    WORKER_CONCURRENCY: z.coerce.number().min(1).max(50).default(5),
    WORKER_PROCESSING_INTERVAL: z.coerce.number().min(1000).max(60000).default(5000),
    QUEUE_NAME: z.string().min(1).default('app-queue'),

    // New Batch Control Parameters
    BATCH_SIZE_JOBS: z.coerce.number().min(10).max(1000).default(50),
    WORKER_SIZE_JOBS: z.coerce.number().min(1).max(100).default(10),

    // JWT Authentication
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),

    // MongoDB Database
    MONGO_URI: z.string().url('MONGO_URI must be a valid URL'),

    // Redis Cache Configuration - Primary (API Cache)
    REDIS_HOST: z.string().min(1, 'REDIS_HOST cannot be empty').default('localhost'),
    REDIS_PORT: z.coerce.number().min(1).max(65535).default(6379),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_DB: z.coerce.number().min(0).max(15).default(0).optional(),

    // Redis Queue Configuration - Secondary (Queue Worker Cache)
    QUEUE_REDIS_HOST: z.string().min(1, 'QUEUE_REDIS_HOST cannot be empty').optional(),
    QUEUE_REDIS_PORT: z.coerce.number().min(1).max(65535).optional(),
    QUEUE_REDIS_PASSWORD: z.string().optional(),
    QUEUE_REDIS_DB: z.coerce.number().min(0).max(15).default(1).optional(),

    // Optional: Logging configuration
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    // Optional: Additional security settings
    CORS_ORIGIN: z.string().optional(),
    CORS_ALLOW_CREDENTIALS: z.coerce.boolean().default(false).optional(),
    RATE_LIMIT_MAX: z.coerce.number().positive().default(100).optional(),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(60000).optional(), // 1 minute

    // Cache Configuration
    CACHE_DEFAULT_TTL: z.coerce.number().positive().default(300).optional(), // 5 minutes

    // SMTP Email Configuration
    SMTP_HOST: z.string().min(1, 'SMTP_HOST cannot be empty').optional(),
    SMTP_PORT: z.coerce.number().min(1).max(65535).default(587).optional(),
    SMTP_SECURE: z.coerce.boolean().default(false).optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_FROM: z.string().email('EMAIL_FROM must be a valid email address').optional(),
    EMAIL_POOL: z.coerce.boolean().default(false).optional(),
    EMAIL_MAX_CONNECTIONS: z.coerce.number().positive().optional(),
    EMAIL_MAX_MESSAGES: z.coerce.number().positive().optional()
  })
  .refine(
    data => {
      // If any SMTP variable is provided, SMTP_HOST is required
      // For MailHog development setup, only SMTP_HOST and SMTP_PORT are required
      const hasAnySmtp = data.SMTP_HOST || data.SMTP_USER || data.SMTP_PASS || data.EMAIL_FROM;
      if (hasAnySmtp) {
        // Always require SMTP_HOST if any SMTP config is provided
        if (!data.SMTP_HOST) return false;

        // For production, require all SMTP credentials
        if (data.NODE_ENV === 'production') {
          return data.SMTP_HOST && data.SMTP_USER && data.SMTP_PASS && data.EMAIL_FROM;
        }

        // For development, SMTP_HOST is sufficient (allows MailHog usage)
        return true;
      }
      return true;
    },
    {
      message:
        'SMTP_HOST is required when using email functionality. For production, SMTP_USER, SMTP_PASS, and EMAIL_FROM are also required.',
      path: ['SMTP_HOST']
    }
  );

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
      QUEUE_REDIS_HOST: process.env.QUEUE_REDIS_HOST,
      QUEUE_REDIS_PORT: process.env.QUEUE_REDIS_PORT,
      QUEUE_REDIS_PASSWORD: process.env.QUEUE_REDIS_PASSWORD ? '[REDACTED]' : 'NOT_SET',
      QUEUE_REDIS_DB: process.env.QUEUE_REDIS_DB,
      LOG_LEVEL: process.env.LOG_LEVEL,
      CORS_ORIGIN: process.env.CORS_ORIGIN,
      CORS_ALLOW_CREDENTIALS: process.env.CORS_ALLOW_CREDENTIALS,
      RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      SMTP_SECURE: process.env.SMTP_SECURE,
      SMTP_USER: process.env.SMTP_USER ? '[REDACTED]' : 'NOT_SET',
      SMTP_PASS: process.env.SMTP_PASS ? '[REDACTED]' : 'NOT_SET',
      EMAIL_FROM: process.env.EMAIL_FROM,
      EMAIL_POOL: process.env.EMAIL_POOL,
      EMAIL_MAX_CONNECTIONS: process.env.EMAIL_MAX_CONNECTIONS,
      EMAIL_MAX_MESSAGES: process.env.EMAIL_MAX_MESSAGES
    }
  });

  // Also log to console for immediate visibility
  console.error('🚨 FATAL ERROR: Environment variables validation failed!');
  console.error('❌ Validation errors:', JSON.stringify(errorDetails, null, 2));
  console.error(
    '💡 Please check your .env file and ensure all required variables are set correctly.'
  );
  console.error('📖 Refer to .env.example for the correct format.');

  process.exit(1);
}

export const config = Object.freeze(parsed.data);

export function validateEnv(requiredVars: string[]) {
  const missing = requiredVars.filter(key => !process.env[key]);

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
    if (
      !config.MONGO_URI.startsWith('mongodb://') &&
      !config.MONGO_URI.startsWith('mongodb+srv://')
    ) {
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
