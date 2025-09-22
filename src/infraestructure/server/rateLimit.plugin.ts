import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { defaultLogger } from '../../lib/logger/index.js';
import { config } from '../../lib/validators/validateEnv.js';

export interface RateLimitOptions extends FastifyPluginOptions {
  max?: number;
  timeWindow?: number;
  skipRoutes?: string[];
  enableGlobal?: boolean;
  useRedis?: boolean;
}

export default async function rateLimitPlugin(
  fastify: FastifyInstance,
  opts: RateLimitOptions = {}
) {
  const logger = defaultLogger.child({ context: 'rate-limit-plugin' });

  // Configuration with environment variables and defaults
  const rateLimitConfig = {
    max: opts.max || config.RATE_LIMIT_MAX || 100, // requests per timeWindow
    timeWindow: opts.timeWindow || config.RATE_LIMIT_WINDOW_MS || 60000, // 1 minute in ms
    skipRoutes: opts.skipRoutes || ['/health', '/docs', '/docs/*'],
    enableGlobal: opts.enableGlobal !== false,
    useRedis: opts.useRedis !== false && !!config.REDIS_HOST
  };

  // Log plugin initialization (development only)
  if (config.NODE_ENV === 'development') {
    logger.info({
      message: 'Initializing rate limit plugin',
      config: {
        max: rateLimitConfig.max,
        timeWindow: rateLimitConfig.timeWindow,
        skipRoutes: rateLimitConfig.skipRoutes,
        enableGlobal: rateLimitConfig.enableGlobal,
        useRedis: rateLimitConfig.useRedis,
        redisAvailable: !!config.REDIS_HOST
      }
    });
  }

  const rateLimitOptions: any = {
    max: rateLimitConfig.max,
    timeWindow: rateLimitConfig.timeWindow,
    
    // Skip specific routes that shouldn't be rate limited
    skip: (request: any) => {
      const shouldSkip = rateLimitConfig.skipRoutes.some(route => {
        if (route.endsWith('/*')) {
          return request.url.startsWith(route.slice(0, -2));
        }
        return request.url === route || request.url.startsWith(route + '?');
      });
      
      if (shouldSkip && config.NODE_ENV === 'development') {
        logger.info({
          message: 'Rate limit skipped for route',
          url: request.url,
          ip: request.ip,
          userAgent: request.headers['user-agent']
        });
      }
      
      return shouldSkip;
    },

    // Custom key generator (default: IP address)
    keyGenerator: (request: any) => {
      // Use IP address as default key
      const key = request.ip || request.connection.remoteAddress || 'unknown';
      
      // You can extend this to use user ID for authenticated routes
      if (request.authenticatedUser) {
        return `user:${request.authenticatedUser.id}`;
      }
      
      return `ip:${key}`;
    },

    // Error response when rate limit is exceeded
    errorResponseBuilder: (request: any, context: any) => {
      const remainingTime = Math.ceil(context.ttl / 1000); // seconds
      
      // Log rate limit exceeded
      logger.error({
        message: 'Rate limit exceeded',
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        url: request.url,
        method: request.method,
        maxRequests: context.max,
        timeWindow: context.timeWindow,
        remainingTtl: remainingTime,
        totalRequests: context.totalRequests
      });
      
      return {
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${context.max} requests per ${Math.ceil(context.timeWindow / 1000)} seconds.`,
        code: 429,
        retryAfter: remainingTime,
        details: {
          limit: context.max,
          windowMs: context.timeWindow,
          remainingTime: remainingTime
        }
      };
    },

    // Add rate limit headers to responses
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true
    },

    // Global rate limit (applies to all routes unless skipped)
    global: rateLimitConfig.enableGlobal
  };

  // Use Redis as store if available and configured
  if (rateLimitConfig.useRedis) {
    try {
      // Get Redis client from cache plugin if available
      const redisClient = (fastify as any).redis || (fastify as any).cache?.redis;
      
      if (redisClient) {
        rateLimitOptions.redis = redisClient;
        
        if (config.NODE_ENV === 'development') {
          logger.info({
            message: 'Rate limit using Redis store',
            redisHost: config.REDIS_HOST,
            redisPort: config.REDIS_PORT,
            redisDb: config.REDIS_DB
          });
        }
      } else {
        logger.warn({
          message: 'Redis not available for rate limiting, using memory store',
          redisConfigured: !!config.REDIS_HOST
        });
      }
    } catch (error) {
      logger.error({
        message: 'Failed to configure Redis for rate limiting',
        error: error instanceof Error ? error.message : String(error),
        fallbackStore: 'memory'
      });
    }
  }

  // Register the rate limit plugin
  await fastify.register(rateLimit, rateLimitOptions);

  // Log successful registration
  if (config.NODE_ENV === 'development') {
    logger.info({
      message: 'Rate limit plugin registered successfully',
      storeType: rateLimitOptions.redis ? 'Redis' : 'Memory',
      globalEnabled: rateLimitConfig.enableGlobal,
      maxRequests: rateLimitConfig.max,
      timeWindowSeconds: Math.ceil(rateLimitConfig.timeWindow / 1000)
    });
  }

  // Hook to log rate limit info on each request (development only)
  if (config.NODE_ENV === 'development') {
    fastify.addHook('onResponse', async (request: any, reply: any) => {
      const rateLimitHeaders = {
        limit: reply.getHeader('x-ratelimit-limit'),
        remaining: reply.getHeader('x-ratelimit-remaining'),
        reset: reply.getHeader('x-ratelimit-reset')
      };
      
      // Only log if rate limit headers are present
      if (rateLimitHeaders.limit) {
        logger.info({
          message: 'Rate limit status',
          url: request.url,
          method: request.method,
          ip: request.ip,
          statusCode: reply.statusCode,
          rateLimit: rateLimitHeaders
        });
      }
    });
  }

  // Add hook to warn when approaching rate limit
  fastify.addHook('onRequest', async (request: any) => {
    // This hook runs after rate limiting, so we can check headers
    request.addHook?.('onResponse', async (req: any, reply: any) => {
      const remaining = parseInt(reply.getHeader('x-ratelimit-remaining') as string);
      const limit = parseInt(reply.getHeader('x-ratelimit-limit') as string);
      
      // Warn when client is using 80% of their limit
      if (remaining && limit && remaining < limit * 0.2) {
        logger.warn({
          message: 'Client approaching rate limit',
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          url: request.url,
          remaining,
          limit,
          utilizationPercent: Math.round(((limit - remaining) / limit) * 100)
        });
      }
    });
  });
}

// Export plugin options for external configuration
export const rateLimitOptions = {
  name: 'rate-limit-plugin'
};