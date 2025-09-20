import type { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { getDefaultCache } from './index.js';

/**
 * Cache plugin for Fastify
 * Provides automatic caching capabilities for GET requests
 */
export default async function cachePlugin(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
): Promise<void> {
  // Initialize cache manager
  const cache = getDefaultCache();
  await cache.initialize(fastify.config);

  // Add cache to Fastify instance
  fastify.decorate('cache', cache);

  // Cache configuration options
  const cacheOptions = {
    defaultTTL: 300, // 5 minutes default
    enableAutoCache: true,
    skipRoutes: ['/health', '/auth/login', '/auth/register'], // Routes to skip auto-caching
    ...opts
  };

  /**
   * Generate cache key for request
   * @param request - Fastify request object
   * @returns Cache key string
   */
  function generateCacheKey(request: FastifyRequest): string {
    const { method, url } = request;
    const userId = request.authenticatedUser?.id || 'anonymous';
    
    // Include user ID for authenticated routes to avoid data leaks
    return `route:${method}:${url}:user:${userId}`;
  }

  /**
   * Check if route should be cached
   * @param request - Fastify request object
   * @returns True if route should be cached
   */
  function shouldCache(request: FastifyRequest): boolean {
    // Only cache GET requests
    if (request.method !== 'GET') {
      return false;
    }

    // Skip routes in skipRoutes array
    if (cacheOptions.skipRoutes.some(route => request.url.startsWith(route))) {
      return false;
    }

    // Skip routes with query parameters by default (can be overridden)
    if (Object.keys(request.query as object).length > 0 && !request.cacheWithQuery) {
      return false;
    }

    return cacheOptions.enableAutoCache;
  }

  /**
   * Pre-handler hook to check cache before route execution
   */
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!shouldCache(request)) {
      return;
    }

    try {
      const cacheKey = generateCacheKey(request);
      const cached = await cache.get(cacheKey);

      if (cached) {
        fastify.log.debug(`Cache hit for ${cacheKey}`);
        
        // Set cache hit header for debugging
        reply.header('X-Cache', 'HIT');
        reply.header('X-Cache-Key', cacheKey);
        
        // Send cached response
        reply.send(cached);
        return;
      }

      // Cache miss - store key for onSend hook
      request.cacheKey = cacheKey;
      fastify.log.debug(`Cache miss for ${cacheKey}`);
      
    } catch (error) {
      fastify.log.error(`Cache preHandler error: ${(error as Error).message}`);
      // Continue without cache on error
    }
  });

  /**
   * OnSend hook to save successful responses to cache
   */
  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload) => {
    // Only cache if we have a cache key and successful response
    if (!request.cacheKey || reply.statusCode !== 200) {
      return payload;
    }

    try {
      // Determine TTL (can be set per route)
      const ttl = request.cacheTTL || cacheOptions.defaultTTL;
      
      // Save to cache
      await cache.set(request.cacheKey, payload, { ttl });
      
      // Set cache miss header for debugging
      reply.header('X-Cache', 'MISS');
      reply.header('X-Cache-Key', request.cacheKey);
      reply.header('X-Cache-TTL', ttl.toString());
      
      fastify.log.debug(`Cached response for ${request.cacheKey} with TTL ${ttl}s`);
      
    } catch (error) {
      fastify.log.error(`Cache onSend error: ${(error as Error).message}`);
      // Continue without caching on error
    }

    return payload;
  });

  /**
   * Cache decorator methods for manual cache control
   */
  fastify.decorate('setCacheForRoute', function(this: FastifyInstance, key: string, data: any, ttl?: number) {
    return cache.set(key, data, { ttl: ttl || cacheOptions.defaultTTL });
  });

  fastify.decorate('getCacheForRoute', function(this: FastifyInstance, key: string) {
    return cache.get(key);
  });

  fastify.decorate('invalidateCache', function(this: FastifyInstance, pattern: string) {
    // For simple invalidation, we can delete specific keys
    // For pattern-based, we'd need to implement key scanning
    return cache.del(pattern);
  });

  fastify.decorate('clearRouteCache', function(this: FastifyInstance) {
    return cache.clear('route');
  });

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    try {
      if (cache.isReady()) {
        await cache.ping(); // Test if still connected
        fastify.log.info('Cache connection closed gracefully');
      }
    } catch (error) {
      fastify.log.error(`Error closing cache connection: ${(error as Error).message}`);
    }
  });

  fastify.log.info('Cache plugin registered successfully');
}

// Extend FastifyInstance type to include cache methods
declare module 'fastify' {
  interface FastifyInstance {
    cache: import('./cache.manager.js').CacheManager;
    setCacheForRoute: (key: string, data: any, ttl?: number) => Promise<void>;
    getCacheForRoute: (key: string) => Promise<any>;
    invalidateCache: (pattern: string) => Promise<boolean>;
    clearRouteCache: () => Promise<number>;
  }

  interface FastifyRequest {
    cacheKey?: string;
    cacheTTL?: number;
    cacheWithQuery?: boolean;
  }
}