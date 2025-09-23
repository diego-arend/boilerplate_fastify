import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import cors, { type FastifyCorsOptions } from '@fastify/cors';
import { defaultLogger } from '../../lib/logger/index.js';
import { config } from '../../lib/validators/validateEnv.js';

export interface CorsOptions extends FastifyPluginOptions {
  origin?: FastifyCorsOptions['origin'];
  credentials?: boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

export default async function corsPlugin(fastify: FastifyInstance, opts: CorsOptions = {}) {
  const logger = defaultLogger.child({ context: 'cors-plugin' });

  // Parse origin configuration from environment
  const parseOrigin = (originEnv?: string): FastifyCorsOptions['origin'] => {
    if (!originEnv) return false;

    // Handle special values
    if (originEnv === '*') return true;
    if (originEnv === 'false' || originEnv === 'null') return false;

    // Handle array of origins (comma-separated)
    if (originEnv.includes(',')) {
      return originEnv
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
    }

    // Handle regex pattern
    if (originEnv.startsWith('/') && originEnv.endsWith('/')) {
      const regexPattern = originEnv.slice(1, -1);
      try {
        return new RegExp(regexPattern);
      } catch (error) {
        logger.warn({
          message: 'Invalid regex pattern for CORS origin, falling back to string',
          pattern: regexPattern,
          error: (error as Error).message
        });
        return originEnv;
      }
    }

    // Single origin string
    return originEnv;
  };

  // Configuration with environment variables and defaults
  const corsConfig: FastifyCorsOptions = {
    // Origin configuration - restrictive by default in production
    origin:
      opts.origin !== undefined
        ? opts.origin
        : parseOrigin(config.CORS_ORIGIN) || (config.NODE_ENV === 'production' ? false : true),

    // Credentials - only allow if explicitly set
    credentials:
      opts.credentials !== undefined ? opts.credentials : config.CORS_ALLOW_CREDENTIALS || false,

    // Allowed HTTP methods
    methods: opts.methods || ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],

    // Allowed headers - include common ones used by modern web applications
    allowedHeaders: opts.allowedHeaders || [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'X-Request-ID',
      'Cache-Control'
    ],

    // Exposed headers - headers that the browser can access
    exposedHeaders: opts.exposedHeaders || [
      'X-Request-ID',
      'X-Response-Time',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],

    // Preflight cache duration (24 hours)
    maxAge: opts.maxAge !== undefined ? opts.maxAge : 86400,

    // Continue to next handler after preflight
    preflightContinue: opts.preflightContinue || false,

    // Success status for preflight requests
    optionsSuccessStatus: opts.optionsSuccessStatus || 204
  };

  // Security validations for production environment
  if (config.NODE_ENV === 'production') {
    // Check for wildcard origin
    if (corsConfig.origin === '*') {
      logger.error({
        message: 'CORS origin is set to allow all origins (*) in production',
        security: 'This is a security risk and should be avoided in production'
      });
      throw new Error('CORS origin cannot be wildcard (*) in production environment');
    }
  }

  // Log plugin initialization
  logger.info({
    message: 'Initializing CORS plugin',
    config: {
      origin: typeof corsConfig.origin === 'function' ? 'function' : corsConfig.origin,
      credentials: corsConfig.credentials,
      methods: corsConfig.methods,
      allowedHeaders: corsConfig.allowedHeaders?.length || 0,
      exposedHeaders: corsConfig.exposedHeaders?.length || 0,
      maxAge: corsConfig.maxAge,
      environment: config.NODE_ENV
    }
  });

  // Register the CORS plugin
  try {
    await fastify.register(cors, corsConfig);

    logger.info({
      message: 'CORS plugin registered successfully',
      originType: Array.isArray(corsConfig.origin) ? 'array' : typeof corsConfig.origin,
      credentialsEnabled: corsConfig.credentials,
      methodsCount: corsConfig.methods?.length || 0,
      environment: config.NODE_ENV
    });

    // Add development warning if CORS is wide open
    if (config.NODE_ENV === 'development' && corsConfig.origin === true) {
      logger.warn({
        message: 'CORS is configured to allow all origins in development',
        security: 'This should be restricted in production environments'
      });
    }
  } catch (error) {
    logger.error({
      message: 'Failed to register CORS plugin',
      error: (error as Error).message,
      config: corsConfig
    });
    throw error;
  }
}

// Export types for external use
export type { FastifyInstance };
